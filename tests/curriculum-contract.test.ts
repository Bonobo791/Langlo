import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rows = parseCsv(
  readFileSync(resolve(root, 'docs/curriculum-coverage.csv'), 'utf8')
);
const graph = JSON.parse(
  readFileSync(resolve(root, 'content/prerequisites.json'), 'utf8')
);
const evidence = readFileSync(resolve(root, 'docs/evidence/T004.md'), 'utf8');

function parseCsv(text: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && char === '\n') {
      row.push(field.replace(/\r$/u, ''));
      if (row.some((value) => value !== '')) records.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    records.push(row);
  }
  return records;
}

describe('versioned curriculum import contract', () => {
  it('pins a versioned bundle to its two repository-relative data files', () => {
    const manifestPath = resolve(root, 'content/curriculum-manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest).toEqual({
      manifest_version: 1,
      curriculum_version: '1.0.0',
      coverage_file: 'docs/curriculum-coverage.csv',
      prerequisites_file: 'content/prerequisites.json',
      dependency_semantics: 'recommended_teaching_order'
    });
    for (const path of [manifest.coverage_file, manifest.prerequisites_file]) {
      expect(path.startsWith('/')).toBe(false);
      expect(path.split('/')).not.toContain('..');
      expect(readFileSync(resolve(root, path), 'utf8')).not.toBe('');
    }
  });

  it('keeps the five tracks in a unique, fully sourced catalog', () => {
    const headers = rows[0];
    const ids = rows.slice(1).map((row) => row[headers.indexOf('id')]);
    const languages = rows
      .slice(1)
      .map((row) => row[headers.indexOf('language')]);
    const levels = rows.slice(1).map((row) => row[headers.indexOf('level')]);
    const sources = rows
      .slice(1)
      .map((row) => row[headers.indexOf('source_ids')]);
    const tracks = new Set(
      rows
        .slice(1)
        .map(
          (row) =>
            `${row[headers.indexOf('language')]} ${row[headers.indexOf('level')]}`
        )
    );
    const registeredSources = new Set(
      [...evidence.matchAll(/^\|\s*`([A-Z0-9-]+)`\s*\|/gmu)].map(
        (match) => match[1]
      )
    );
    expect(headers).toEqual([
      'id',
      'language',
      'level',
      'topic',
      'skill',
      'source_ids',
      'placement_rationale',
      'evidence_status',
      'provenance'
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      languages.every((language) =>
        ['French', 'German', 'English'].includes(language)
      )
    ).toBe(true);
    expect(levels.every((level) => ['A1', 'A2'].includes(level))).toBe(true);
    expect(sources.every((source) => source.length > 0)).toBe(true);
    expect(tracks).toEqual(
      new Set([
        'French A1',
        'German A1',
        'German A2',
        'English A1',
        'English A2'
      ])
    );
    expect(
      sources
        .flatMap((source) => source.split(';'))
        .every((id) => registeredSources.has(id))
    ).toBe(true);
    const expectedNewIds = [
      ...Array.from(
        { length: 8 },
        (_, index) => `fr-a1-${String(index + 21).padStart(3, '0')}`
      ),
      ...Array.from(
        { length: 3 },
        (_, index) => `de-a1-${String(index + 25).padStart(3, '0')}`
      ),
      ...Array.from(
        { length: 4 },
        (_, index) => `en-a1-${String(index + 19).padStart(3, '0')}`
      ),
      'en-a2-023'
    ];
    expect(expectedNewIds.every((id) => ids.includes(id))).toBe(true);
  });

  it('requires valid same-language, non-cyclic recommended-order edges', () => {
    const headers = rows[0];
    const catalog = new Map(
      rows.slice(1).map((row) => [row[headers.indexOf('id')], row])
    );
    const nodes = graph.nodes as {
      skill_id: string;
      prerequisites: string[];
    }[];
    const graphIds = nodes.map((node) => node.skill_id);
    const edges = new Map(
      nodes.map((node) => [node.skill_id, node.prerequisites])
    );
    expect(graph.schema_version).toBe(1);
    expect(new Set(graphIds).size).toBe(graphIds.length);
    expect(new Set(graphIds)).toEqual(new Set(catalog.keys()));

    const state = new Map<string, 'active' | 'done'>();
    const visit = (skillId: string) => {
      expect(state.get(skillId)).not.toBe('active');
      if (state.get(skillId) === 'done') return;
      state.set(skillId, 'active');
      const dependents = edges.get(skillId) ?? [];
      expect(new Set(dependents).size).toBe(dependents.length);
      for (const prerequisiteId of dependents) {
        const skill = catalog.get(skillId);
        const prerequisite = catalog.get(prerequisiteId);
        expect(prerequisite).toBeDefined();
        expect(prerequisiteId).not.toBe(skillId);
        expect(prerequisite?.[headers.indexOf('language')]).toBe(
          skill?.[headers.indexOf('language')]
        );
        const level = { A1: 1, A2: 2 } as const;
        expect(
          level[prerequisite?.[headers.indexOf('level')] as keyof typeof level]
        ).toBeLessThanOrEqual(
          level[skill?.[headers.indexOf('level')] as keyof typeof level]
        );
        visit(prerequisiteId);
      }
      state.set(skillId, 'done');
    };
    for (const skillId of graphIds) visit(skillId);
    expect(edges.get('fr-a1-019')).toContain('fr-a1-005');
    for (const id of ['fr-a1-012', 'fr-a1-013', 'fr-a1-014']) {
      expect(edges.get(id)).toEqual(
        expect.arrayContaining(['fr-a1-009', 'fr-a1-010'])
      );
    }
    expect(edges.get('fr-a1-018')).toEqual(
      expect.arrayContaining(['fr-a1-003', 'fr-a1-004'])
    );
    expect(edges.get('de-a1-017')).toEqual(
      expect.arrayContaining(['de-a1-001', 'de-a1-004'])
    );
    expect(edges.get('de-a1-020')).toEqual(
      expect.arrayContaining(['de-a1-001', 'de-a1-004'])
    );
    expect(edges.get('de-a2-001')).toContain('de-a1-018');
  });
});
