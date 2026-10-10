import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Graph } from '../scripts/curriculum-contract.mjs';
import {
  headers,
  parseCsv,
  validateBundle,
  validateCatalog,
  validateGraph,
  validateIdRegistry,
  validateManifest
} from '../scripts/curriculum-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { manifest, records, catalog, registry, graph, edges } =
  validateBundle(root);
const evidence = readFileSync(resolve(root, 'docs/evidence/T004.md'), 'utf8');
const knownSources = new Set(
  [...evidence.matchAll(/^\|\s*`([A-Z0-9-]+)`\s*\|/gmu)].map(
    (match) => match[1]
  )
);
const registryIds = new Set(registry.ids);

function validateRows(rows: string[][]) {
  return validateCatalog(rows, knownSources, registryIds);
}

function getNode(source: Graph, id: string) {
  const node = source.nodes.find((item) => item.skill_id === id);
  if (!node) throw new Error(`Missing graph node: ${id}`);
  return node;
}

describe('versioned curriculum bundle contract', () => {
  it('uses a pre-release version, separate publication status, explicit scope and file hashes', () => {
    const files = Object.fromEntries(
      [
        manifest.coverage_file,
        manifest.prerequisites_file,
        manifest.id_registry_file
      ].map((path) => [path, readFileSync(resolve(root, path), 'utf8')])
    );
    expect(manifest.curriculum_version).toMatch(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-draft\.\d+$/u
    );
    expect(manifest.publication_status).toBe('draft');
    expect(manifest.dependency_semantics).toBe('recommended_teaching_order');
    expect(manifest.selected_subset_tracks).toContain('French A1');
    expect(() =>
      validateManifest(
        { ...manifest, dependency_semantics: 'mastery_gate' },
        files
      )
    ).toThrow();
    expect(() =>
      validateManifest({ ...manifest, publication_status: 'released' }, files)
    ).toThrow();
    expect(() =>
      validateManifest({ ...manifest, curriculum_version: 'draft' }, files)
    ).toThrow();
    expect(() =>
      validateManifest(
        { ...manifest, curriculum_version: '0.1.0-draft..1' },
        files
      )
    ).toThrow();
    expect(() =>
      validateManifest({ ...manifest, coverage_sha256: '0'.repeat(64) }, files)
    ).toThrow();
  });

  it('parses valid quoted CSV and rejects malformed quote placement', () => {
    expect(parseCsv('id,skill\n1,"be, have"\n')).toEqual([
      ['id', 'skill'],
      ['1', 'be, have']
    ]);
    expect(() => parseCsv('id,skill\n1,"unfinished\n')).toThrow();
    expect(() => parseCsv('id,skill\n1,un"escaped\n')).toThrow();
    expect(() => parseCsv('id,skill\n1,"quoted"x\n')).toThrow();
  });

  it('validates row width, required values, status values, source IDs and track placement', () => {
    expect(records[0]).toEqual(headers);
    expect(new Set(catalog.keys()).size).toBe(records.length - 1);
    expect(
      [...catalog.values()].every((row) =>
        row.every((value, index) => index === 10 || value.trim().length > 0)
      )
    ).toBe(true);

    const row = [...records[1]];
    const withRow = (change: (copy: string[]) => void) => {
      const copy = [...row];
      change(copy);
      return [records[0], copy, ...records.slice(2)];
    };
    expect(() => validateRows(withRow((copy) => copy.pop()))).toThrow(
      /row width/u
    );
    for (const field of [
      'topic',
      'skill',
      'placement_rationale',
      'provenance'
    ]) {
      expect(() =>
        validateRows(
          withRow((copy) => {
            copy[headers.indexOf(field)] = '   ';
          })
        )
      ).toThrow(/Empty required field/u);
    }
    expect(() =>
      validateRows(
        withRow((copy) => {
          copy[7] = 'source-aligned ';
        })
      )
    ).toThrow(/evidence status/u);
    expect(() =>
      validateRows(
        withRow((copy) => {
          copy[1] = 'French';
          copy[2] = 'A2';
        })
      )
    ).toThrow(/Unsupported language and level/u);
    expect(() =>
      validateRows(
        withRow((copy) => {
          copy[5] = 'UNREGISTERED';
        })
      )
    ).toThrow(/Unknown source/u);
    expect(() => validateRows([...records, [...records[1]]])).toThrow(
      /Duplicate skill ID/u
    );
  });

  it('keeps lifecycle history separate from active objectives and mastery', () => {
    const retired = [...catalog.values()].filter((row) => row[9] === 'retired');
    expect(retired.length).toBeGreaterThan(0);
    expect(
      retired.every((row) =>
        row[10].split(';').every((id) => catalog.get(id)?.[9] === 'active')
      )
    ).toBe(true);
    expect(() =>
      validateRows(
        records.map((row, index) =>
          index === 1 ? [...row.slice(0, 9), 'unknown', ''] : [...row]
        )
      )
    ).toThrow(/lifecycle status/u);
    const badReplacement = records.map((row) => [...row]);
    const retiredIndex = badReplacement.findIndex(
      (row) => row[9] === 'retired'
    );
    badReplacement[retiredIndex][10] = 'missing-skill';
    expect(() => validateRows(badReplacement)).toThrow(/Unknown replacement/u);
  });

  it('requires a unique ID registry and rejects removal of an earlier ID', () => {
    validateIdRegistry(registry, catalog);
    const firstId = registry.ids[0];
    expect(() =>
      validateIdRegistry(
        { ...registry, ids: [...registry.ids, firstId] },
        catalog
      )
    ).toThrow(/Duplicate ID registry/u);
    expect(() =>
      validateIdRegistry(registry, catalog, ['previously-used-id'])
    ).toThrow(/Previously registered ID was removed/u);
  });

  it('validates same-language, level-ordered, acyclic graph structure without pinning lesson choices', () => {
    expect(validateGraph(graph, catalog)).toBe(edges);
    const omitted = structuredClone(graph);
    Reflect.deleteProperty(omitted.nodes[0], 'prerequisites');
    expect(() => validateGraph(omitted, catalog)).toThrow(
      /Invalid prerequisites/u
    );

    const missing = structuredClone(graph);
    missing.nodes[0].prerequisites = ['missing-skill-id'];
    expect(() => validateGraph(missing, catalog)).toThrow(
      /Unknown prerequisite/u
    );

    const selfEdge = structuredClone(graph);
    selfEdge.nodes[0].prerequisites = [selfEdge.nodes[0].skill_id];
    expect(() => validateGraph(selfEdge, catalog)).toThrow(
      /Self prerequisite/u
    );

    const crossLanguage = structuredClone(graph);
    const first = catalog.values().next().value;
    if (!first) throw new Error('The catalog is empty.');
    const otherLanguage = [...catalog.values()].find(
      (row) => row[1] !== first[1]
    );
    if (!otherLanguage)
      throw new Error('The catalog needs multiple languages.');
    getNode(crossLanguage, first[0]).prerequisites = [otherLanguage[0]];
    expect(() => validateGraph(crossLanguage, catalog)).toThrow(
      /Cross-language prerequisite/u
    );

    const a1 = [...catalog.values()].find(
      (row) =>
        row[9] === 'active' &&
        row[2] === 'A1' &&
        [...catalog.values()].some(
          (candidate) =>
            candidate[9] === 'active' &&
            candidate[1] === row[1] &&
            candidate[2] === 'A2'
        )
    );
    if (!a1) throw new Error('The catalog needs an active A1 skill.');
    const higherLevel = [...catalog.values()].find(
      (row) => row[9] === 'active' && row[1] === a1[1] && row[2] === 'A2'
    );
    if (!higherLevel) throw new Error('The catalog needs an active A2 skill.');
    const invalidLevel = structuredClone(graph);
    getNode(invalidLevel, a1[0]).prerequisites = [higherLevel[0]];
    expect(() => validateGraph(invalidLevel, catalog)).toThrow(
      /Higher-level prerequisite/u
    );

    const retired = [...catalog.values()].find((row) => row[9] === 'retired');
    if (!retired) throw new Error('The catalog needs a retired skill.');
    const retiredDependency = structuredClone(graph);
    getNode(retiredDependency, a1[0]).prerequisites = [retired[0]];
    expect(() => validateGraph(retiredDependency, catalog)).toThrow(
      /Retired skill is a prerequisite/u
    );

    const cycle = structuredClone(graph);
    const peers = [...catalog.values()].filter(
      (row) => row[9] === 'active' && row[1] === first[1] && row[2] === first[2]
    );
    const [left, right] = peers.slice(0, 2);
    if (!left || !right) throw new Error('The catalog needs two peer skills.');
    getNode(cycle, left[0]).prerequisites = [right[0]];
    getNode(cycle, right[0]).prerequisites = [left[0]];
    expect(() => validateGraph(cycle, catalog)).toThrow(/cycle/u);
  });
});
