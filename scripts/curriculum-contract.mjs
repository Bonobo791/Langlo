import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {string[]} CsvRow */
/** @typedef {Map<string, CsvRow>} Catalog */
/** @typedef {{ manifest_version: number, curriculum_version: string, publication_status: string, coverage_file: string, coverage_sha256: string, prerequisites_file: string, prerequisites_sha256: string, id_registry_file: string, id_registry_sha256: string, dependency_semantics: string, included_tracks: string[], selected_subset_tracks: string[] }} Manifest */
/** @typedef {{ schema_version: number, ids: string[] }} IdRegistry */
/** @typedef {{ schema_version: number, nodes: { skill_id: string, prerequisites: string[] }[] }} Graph */

export const headers = [
  'id',
  'language',
  'level',
  'topic',
  'skill',
  'source_ids',
  'placement_rationale',
  'evidence_status',
  'provenance',
  'lifecycle_status',
  'replaced_by'
];

const tracks = [
  'French A1',
  'German A1',
  'German A2',
  'English A1',
  'English A2'
];
const allowedEvidence = ['source-aligned', 'local-alignment', 'provisional'];
const semver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

/** @param {string} input @returns {CsvRow[]} */
export function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  let atFieldStart = true;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        field += char;
      }
    } else if (afterQuote) {
      if (char === ',') {
        row.push(field);
        field = '';
        afterQuote = false;
        atFieldStart = true;
      } else if (char === '\n' || char === '\r') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        afterQuote = false;
        atFieldStart = true;
        if (char === '\r' && input[index + 1] === '\n') index += 1;
      } else {
        throw new Error('Unexpected character after a quoted CSV field.');
      }
    } else if (char === '"') {
      if (!atFieldStart)
        throw new Error('Unexpected quote inside an unquoted CSV field.');
      quoted = true;
      atFieldStart = false;
    } else if (char === ',') {
      row.push(field);
      field = '';
      atFieldStart = true;
    } else if (char === '\n' || char === '\r') {
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
      atFieldStart = true;
      if (char === '\r' && input[index + 1] === '\n') index += 1;
    } else {
      field += char;
      atFieldStart = false;
    }
  }

  if (quoted) throw new Error('Unclosed quoted CSV field.');
  if (field !== '' || row.length > 0 || afterQuote) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** @param {unknown} condition @param {string} message */
function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

/** @param {string} value */
function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** @param {Manifest} manifest @param {Record<string, string>} files */
export function validateManifest(manifest, files) {
  requireCondition(
    manifest.manifest_version === 1,
    'Unsupported manifest version.'
  );
  requireCondition(
    typeof manifest.curriculum_version === 'string' &&
      semver.test(manifest.curriculum_version),
    'Invalid curriculum version.'
  );
  requireCondition(
    ['draft', 'approved'].includes(manifest.publication_status),
    'Invalid publication status.'
  );
  requireCondition(
    manifest.dependency_semantics === 'recommended_teaching_order',
    'Unsupported dependency semantics.'
  );
  requireCondition(
    JSON.stringify(manifest.included_tracks) === JSON.stringify(tracks),
    'Included tracks do not match the T004 scope.'
  );
  requireCondition(
    JSON.stringify(manifest.selected_subset_tracks) ===
      JSON.stringify(['French A1']),
    'The French A1 subset must be declared.'
  );

  for (const [pathKey, hashKey] of [
    ['coverage_file', 'coverage_sha256'],
    ['prerequisites_file', 'prerequisites_sha256'],
    ['id_registry_file', 'id_registry_sha256']
  ]) {
    const path = manifest[pathKey];
    requireCondition(
      typeof path === 'string' &&
        path.length > 0 &&
        !path.startsWith('/') &&
        !path.split('/').includes('..'),
      `Invalid manifest path: ${pathKey}.`
    );
    requireCondition(
      typeof files[path] === 'string',
      `Manifest file is missing: ${path}.`
    );
    requireCondition(
      /^[a-f\d]{64}$/u.test(manifest[hashKey]),
      `Invalid digest: ${hashKey}.`
    );
    requireCondition(
      digest(files[path]) === manifest[hashKey],
      `Digest mismatch: ${path}.`
    );
  }
}

/** @param {CsvRow[]} records @param {Set<string>} knownSources @param {Set<string>} registryIds @returns {Catalog} */
export function validateCatalog(records, knownSources, registryIds) {
  requireCondition(
    records[0]?.length === headers.length &&
      records[0].every((value, index) => value === headers[index]),
    'Invalid catalog header.'
  );
  const catalog = new Map();
  for (const row of records.slice(1)) {
    requireCondition(
      row.length === headers.length,
      `Invalid row width for ${row[0] ?? '<unknown>'}.`
    );
    requireCondition(
      row.every(
        (value, index) =>
          index === headers.length - 1 || value.trim().length > 0
      ),
      `Empty required field for ${row[0]}.`
    );
    const [
      id,
      language,
      level,
      ,
      ,
      sourceIds,
      ,
      evidenceStatus,
      ,
      lifecycleStatus,
      replacedBy
    ] = row;
    requireCondition(!catalog.has(id), `Duplicate skill ID: ${id}.`);
    requireCondition(
      tracks.includes(`${language} ${level}`),
      `Unsupported language and level: ${language} ${level}.`
    );
    requireCondition(
      allowedEvidence.includes(evidenceStatus),
      `Invalid evidence status for ${id}.`
    );
    requireCondition(
      ['active', 'retired'].includes(lifecycleStatus),
      `Invalid lifecycle status for ${id}.`
    );
    requireCondition(
      lifecycleStatus === 'retired' || replacedBy === '',
      `Active skill has a replacement: ${id}.`
    );
    for (const sourceId of sourceIds.split(';'))
      requireCondition(
        knownSources.has(sourceId),
        `Unknown source ${sourceId} for ${id}.`
      );
    catalog.set(id, row);
  }

  requireCondition(
    JSON.stringify(
      [...new Set(records.slice(1).map((row) => `${row[1]} ${row[2]}`))].sort()
    ) === JSON.stringify([...tracks].sort()),
    'Catalog does not contain exactly the five requested tracks.'
  );
  for (const id of catalog.keys())
    requireCondition(registryIds.has(id), `Skill ID is not registered: ${id}.`);
  for (const row of catalog.values()) {
    const id = row[0];
    for (const replacement of row[10] ? row[10].split(';') : []) {
      requireCondition(
        catalog.has(replacement),
        `Unknown replacement ${replacement} for ${id}.`
      );
      requireCondition(
        replacement !== id,
        `Skill cannot replace itself: ${id}.`
      );
      requireCondition(
        catalog.get(replacement)[9] === 'active',
        `Replacement must be active: ${replacement}.`
      );
    }
  }
  return catalog;
}

/** @param {IdRegistry} registry @param {Catalog} catalog @param {string[]} [previousIds] */
export function validateIdRegistry(registry, catalog, previousIds = []) {
  requireCondition(
    registry.schema_version === 1 && Array.isArray(registry.ids),
    'Invalid ID registry.'
  );
  requireCondition(
    new Set(registry.ids).size === registry.ids.length,
    'Duplicate ID registry entry.'
  );
  for (const id of catalog.keys())
    requireCondition(
      registry.ids.includes(id),
      `Skill ID is not registered: ${id}.`
    );
  for (const id of previousIds)
    requireCondition(
      registry.ids.includes(id),
      `Previously registered ID was removed: ${id}.`
    );
}

/** @param {Graph} graph @param {Catalog} catalog @returns {number} */
export function validateGraph(graph, catalog) {
  requireCondition(
    graph.schema_version === 1 && Array.isArray(graph.nodes),
    'Invalid prerequisite graph.'
  );
  const nodes = new Map();
  for (const node of graph.nodes) {
    requireCondition(
      !nodes.has(node.skill_id),
      `Duplicate graph node: ${node.skill_id}.`
    );
    requireCondition(
      Array.isArray(node.prerequisites),
      `Invalid prerequisites for ${node.skill_id}.`
    );
    nodes.set(node.skill_id, node.prerequisites);
  }
  requireCondition(
    nodes.size === catalog.size &&
      [...catalog.keys()].every((id) => nodes.has(id)),
    'Graph and catalog IDs differ.'
  );

  for (const [id, prerequisites] of nodes) {
    const skill = catalog.get(id);
    requireCondition(
      skill[9] === 'active' || prerequisites.length === 0,
      `Retired skill has prerequisites: ${id}.`
    );
    requireCondition(
      new Set(prerequisites).size === prerequisites.length,
      `Duplicate prerequisite for ${id}.`
    );
    for (const prerequisiteId of prerequisites) {
      const prerequisite = catalog.get(prerequisiteId);
      requireCondition(
        prerequisite,
        `Unknown prerequisite ${prerequisiteId} for ${id}.`
      );
      requireCondition(
        prerequisite[9] === 'active',
        `Retired skill is a prerequisite: ${prerequisiteId}.`
      );
      requireCondition(prerequisiteId !== id, `Self prerequisite: ${id}.`);
      requireCondition(
        prerequisite[1] === skill[1],
        `Cross-language prerequisite: ${id} -> ${prerequisiteId}.`
      );
      const level = /** @type {const} */ ({ A1: 1, A2: 2 });
      requireCondition(
        level[/** @type {'A1' | 'A2'} */ (prerequisite[2])] <=
          level[/** @type {'A1' | 'A2'} */ (skill[2])],
        `Higher-level prerequisite: ${id} -> ${prerequisiteId}.`
      );
    }
  }

  const state = new Map();
  const visit = (id) => {
    requireCondition(
      state.get(id) !== 'active',
      `Prerequisite cycle at ${id}.`
    );
    if (state.get(id) === 'done') return;
    state.set(id, 'active');
    for (const prerequisiteId of nodes.get(id)) visit(prerequisiteId);
    state.set(id, 'done');
  };
  for (const id of nodes.keys()) visit(id);
  return [...nodes.values()].reduce((total, ids) => total + ids.length, 0);
}

/** @param {string} root @param {string[]} [previousIds] */
export function validateBundle(root, previousIds = []) {
  const manifest = JSON.parse(
    readFileSync(resolve(root, 'content/curriculum-manifest.json'), 'utf8')
  );
  const paths = [
    manifest.coverage_file,
    manifest.prerequisites_file,
    manifest.id_registry_file
  ];
  const files = Object.fromEntries(
    paths.map((path) => [path, readFileSync(resolve(root, path), 'utf8')])
  );
  validateManifest(manifest, files);
  const evidence = readFileSync(resolve(root, 'docs/evidence/T004.md'), 'utf8');
  const knownSources = new Set(
    [...evidence.matchAll(/^\|\s*`([A-Z0-9-]+)`\s*\|/gmu)].map(
      (match) => match[1]
    )
  );
  const registry = JSON.parse(files[manifest.id_registry_file]);
  const records = parseCsv(files[manifest.coverage_file]);
  const catalog = validateCatalog(records, knownSources, new Set(registry.ids));
  validateIdRegistry(registry, catalog, previousIds);
  const graph = JSON.parse(files[manifest.prerequisites_file]);
  const edges = validateGraph(graph, catalog);
  return { manifest, records, catalog, registry, graph, edges };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const root = process.cwd();
  const previousRegistryPath = process.argv[2];
  const previousIds = previousRegistryPath
    ? JSON.parse(readFileSync(resolve(root, previousRegistryPath), 'utf8')).ids
    : [];
  const { records, edges, manifest } = validateBundle(root, previousIds);
  console.log(
    `PASS: ${records.length - 1} curriculum records; ${edges} edges; ${manifest.publication_status} bundle ${manifest.curriculum_version}.`
  );
  if (!previousRegistryPath) {
    console.log(
      'ID reuse across versions requires comparison with the previous registry before approval.'
    );
  }
}
