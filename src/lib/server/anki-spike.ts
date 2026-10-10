import { createHash } from 'node:crypto';

export type SyntheticAnkiRequest = {
  learnerId: string;
  profileId: string;
  sourceId: string;
  fields: Record<string, string>;
};

export type SyntheticAnkiAdapter = {
  inspectSyntheticProfile: (profileId: string) => Promise<unknown>;
  findSyntheticNotes: (input: {
    profileId: string;
    identity: string;
  }) => Promise<unknown>;
  addSyntheticNote: (input: {
    profileId: string;
    identity: string;
    fields: Record<string, string>;
  }) => Promise<unknown>;
};

export type SyntheticAnkiResult = {
  mode: 'SYNTHETIC_MOCK_ONLY';
  delivery: 'NOT_DELIVERED';
  profileId: string;
  noteIdentity: string;
  noteId: number;
  reusedExisting: boolean;
};

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function syntheticNote(
  value: unknown,
  identity: string
): { noteId: number; identity: string } {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.noteId) ||
    (value.noteId as number) < 1 ||
    value.identity !== identity
  ) {
    fail('Malformed synthetic note response.');
  }
  return { noteId: value.noteId as number, identity };
}

function validateNotes(
  value: unknown,
  identity: string
): Array<{ noteId: number; identity: string }> {
  if (!Array.isArray(value)) fail('Malformed synthetic lookup response.');
  return value.map((note) => {
    try {
      return syntheticNote(note, identity);
    } catch {
      fail('Malformed synthetic lookup response.');
    }
  });
}

function identityFor(request: SyntheticAnkiRequest): string {
  const stableKey = JSON.stringify([request.learnerId, request.sourceId]);
  return `langlo:${createHash('sha256').update(stableKey).digest('hex')}`;
}

function validateRequest(request: SyntheticAnkiRequest): void {
  if (
    typeof request.learnerId !== 'string' ||
    !request.learnerId.trim() ||
    typeof request.profileId !== 'string' ||
    !request.profileId.trim()
  ) {
    fail('Explicit learner and profile selection is required.');
  }
  if (
    typeof request.sourceId !== 'string' ||
    !request.sourceId.trim() ||
    !isRecord(request.fields) ||
    Object.keys(request.fields).length === 0 ||
    Object.entries(request.fields).some(
      ([key, value]) => !key.trim() || typeof value !== 'string'
    )
  ) {
    fail('Malformed synthetic note request.');
  }
}

async function findNotes(
  adapter: SyntheticAnkiAdapter,
  profileId: string,
  identity: string
): Promise<Array<{ noteId: number; identity: string }>> {
  await verifyProfile(adapter, profileId);

  let response: unknown;
  try {
    response = await adapter.findSyntheticNotes({ profileId, identity });
  } catch {
    fail('Synthetic lookup failed.');
  }
  return validateNotes(response, identity);
}

async function verifyProfile(
  adapter: SyntheticAnkiAdapter,
  selectedProfileId: string
): Promise<void> {
  let profile: unknown;
  try {
    profile = await adapter.inspectSyntheticProfile(selectedProfileId);
  } catch {
    fail('Synthetic connector is not ready for this profile.');
  }
  if (
    !isRecord(profile) ||
    typeof profile.state !== 'string' ||
    typeof profile.profileId !== 'string' ||
    typeof profile.permission !== 'string'
  ) {
    fail('Malformed synthetic connector response.');
  }
  if (profile.profileId !== selectedProfileId) {
    fail('Selected synthetic profile is unavailable.');
  }
  if (profile.state !== 'open' || profile.permission !== 'granted') {
    fail('Synthetic connector is not ready for this profile.');
  }
}

function oneMatch(
  notes: Array<{ noteId: number; identity: string }>
): { noteId: number; identity: string } | undefined {
  if (notes.length > 1) {
    fail(
      'Multiple synthetic notes match the stable identity; manual resolution is required.'
    );
  }
  return notes[0];
}

function result(
  profileId: string,
  identity: string,
  noteId: number,
  reusedExisting: boolean
): SyntheticAnkiResult {
  return {
    mode: 'SYNTHETIC_MOCK_ONLY',
    delivery: 'NOT_DELIVERED',
    profileId,
    noteIdentity: identity,
    noteId,
    reusedExisting
  };
}

async function addOrRecover(
  adapter: SyntheticAnkiAdapter,
  profileId: string,
  identity: string,
  fields: Record<string, string>
): Promise<{ noteId: number; reusedExisting: boolean }> {
  await verifyProfile(adapter, profileId);

  let added: unknown;
  try {
    added = await adapter.addSyntheticNote({
      profileId,
      identity,
      fields: { ...fields }
    });
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    if (code !== 'DUPLICATE' && code !== 'TIMEOUT') {
      fail('Synthetic add failed.');
    }

    let afterError: Array<{ noteId: number; identity: string }>;
    try {
      afterError = await findNotes(adapter, profileId, identity);
    } catch {
      if (code === 'TIMEOUT') {
        fail(
          'Synthetic add outcome is unknown; recovery lookup failed. Retry lookup only; do not add again.'
        );
      }
      fail(
        'Synthetic duplicate response could not be reconciled. Retry lookup only; do not add again.'
      );
    }
    const existing = oneMatch(afterError);
    if (existing) {
      return { noteId: existing.noteId, reusedExisting: true };
    }
    if (code === 'TIMEOUT') {
      fail(
        'Synthetic add outcome is unknown; retry by looking up the same identity.'
      );
    }
    fail('Synthetic duplicate response had no matching note.');
  }

  try {
    const note = syntheticNote(added, identity);
    return { noteId: note.noteId, reusedExisting: false };
  } catch {
    fail('Malformed synthetic add response.');
  }
}

/** Run only against an injected synthetic adapter; this function does not implement a real Anki transport. */
export async function runSyntheticAnkiSpike(
  request: SyntheticAnkiRequest,
  adapter: SyntheticAnkiAdapter
): Promise<SyntheticAnkiResult> {
  validateRequest(request);

  const identity = identityFor(request);
  const existing = await findNotes(adapter, request.profileId, identity);
  const match = oneMatch(existing);
  if (match) {
    return result(request.profileId, identity, match.noteId, true);
  }

  const outcome = await addOrRecover(
    adapter,
    request.profileId,
    identity,
    request.fields
  );
  return result(
    request.profileId,
    identity,
    outcome.noteId,
    outcome.reusedExisting
  );
}
