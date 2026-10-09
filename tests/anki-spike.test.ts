import { describe, expect, it } from 'vitest';
import { runSyntheticAnkiSpike } from '../src/lib/server/anki-spike';

type SyntheticAdapter = {
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

const request = {
  learnerId: 'synthetic-learner-a',
  profileId: 'synthetic-profile-a',
  sourceId: 'synthetic-source-001',
  fields: { Front: 'synthetic prompt', Back: 'synthetic answer' }
};

function adapter(overrides: Partial<SyntheticAdapter> = {}): SyntheticAdapter {
  return {
    inspectSyntheticProfile: async (profileId) => ({
      state: 'open',
      profileId,
      permission: 'granted'
    }),
    findSyntheticNotes: async () => [],
    addSyntheticNote: async ({ identity }) => ({ noteId: 17, identity }),
    ...overrides
  };
}

describe('synthetic Anki delivery spike', () => {
  it('requires explicit learner and profile selection', async () => {
    let inspections = 0;
    const mock = adapter({
      inspectSyntheticProfile: async (profileId) => {
        inspections += 1;
        return { state: 'open', profileId, permission: 'granted' };
      }
    });
    await expect(
      runSyntheticAnkiSpike({ ...request, learnerId: '' }, mock)
    ).rejects.toThrow('Explicit learner and profile selection is required.');
    await expect(
      runSyntheticAnkiSpike({ ...request, profileId: '' }, mock)
    ).rejects.toThrow('Explicit learner and profile selection is required.');
    expect(inspections).toBe(0);
  });

  it('fails closed when the selected profile does not match the inspected profile', async () => {
    await expect(
      runSyntheticAnkiSpike(
        request,
        adapter({
          inspectSyntheticProfile: async () => ({
            state: 'open',
            profileId: 'synthetic-profile-other',
            permission: 'granted'
          })
        })
      )
    ).rejects.toThrow('Selected synthetic profile is unavailable.');
  });

  it.each([
    ['closed', 'granted'],
    ['unavailable', 'granted'],
    ['open', 'denied']
  ])(
    'rejects connector state %s with permission %s',
    async (state, permission) => {
      await expect(
        runSyntheticAnkiSpike(
          request,
          adapter({
            inspectSyntheticProfile: async (profileId) => ({
              state,
              profileId,
              permission
            })
          })
        )
      ).rejects.toThrow('Synthetic connector is not ready for this profile.');
    }
  );

  it('rejects malformed connector, lookup, and add responses', async () => {
    await expect(
      runSyntheticAnkiSpike(
        request,
        adapter({ inspectSyntheticProfile: async () => ({ state: 'open' }) })
      )
    ).rejects.toThrow('Malformed synthetic connector response.');

    const open = adapter({
      findSyntheticNotes: async () => ({ noteId: 17 })
    });
    await expect(runSyntheticAnkiSpike(request, open)).rejects.toThrow(
      'Malformed synthetic lookup response.'
    );

    const malformedAdd = adapter({
      addSyntheticNote: async () => ({
        noteId: 'not-an-integer',
        identity: 'wrong'
      })
    });
    await expect(runSyntheticAnkiSpike(request, malformedAdd)).rejects.toThrow(
      'Malformed synthetic add response.'
    );
  });

  it('derives the same stable identity for the same learner, profile, and source', async () => {
    const first = await runSyntheticAnkiSpike(request, adapter());
    const second = await runSyntheticAnkiSpike(request, adapter());
    expect(first.noteIdentity).toBe(second.noteIdentity);
    expect(first.noteIdentity).toMatch(/^langlo:[a-f0-9]{64}$/);
  });

  it('looks up by stable identity before adding a synthetic note', async () => {
    const calls: string[] = [];
    const mock = adapter({
      findSyntheticNotes: async ({ identity }) => {
        calls.push(`find:${identity}`);
        return [];
      },
      addSyntheticNote: async ({ identity }) => {
        calls.push(`add:${identity}`);
        return { noteId: 17, identity };
      }
    });

    const result = await runSyntheticAnkiSpike(request, mock);
    expect(calls).toEqual([
      `find:${result.noteIdentity}`,
      `add:${result.noteIdentity}`
    ]);
    expect(result.noteId).toBe(17);
  });

  it('fails closed when lookup finds multiple notes for the stable identity', async () => {
    let adds = 0;
    const mock = adapter({
      findSyntheticNotes: async ({ identity }) => [
        { noteId: 17, identity },
        { noteId: 18, identity }
      ],
      addSyntheticNote: async ({ identity }) => {
        adds += 1;
        return { noteId: 19, identity };
      }
    });

    await expect(runSyntheticAnkiSpike(request, mock)).rejects.toThrow(
      'Multiple synthetic notes match the stable identity; manual resolution is required.'
    );
    expect(adds).toBe(0);
  });

  it('reuses an existing note after a duplicate add response', async () => {
    let lookups = 0;
    const mock = adapter({
      findSyntheticNotes: async ({ identity }) => {
        lookups += 1;
        return lookups === 1 ? [] : [{ noteId: 23, identity }];
      },
      addSyntheticNote: async () => {
        throw Object.assign(new Error('duplicate synthetic identity'), {
          code: 'DUPLICATE'
        });
      }
    });

    const result = await runSyntheticAnkiSpike(request, mock);
    expect(result.noteId).toBe(23);
    expect(result.reusedExisting).toBe(true);
    expect(lookups).toBe(2);
  });

  it('looks up after an add timeout and never blindly retries the add', async () => {
    const calls: string[] = [];
    const mock = adapter({
      findSyntheticNotes: async ({ identity }) => {
        calls.push('find');
        return calls.length === 1 ? [] : [{ noteId: 31, identity }];
      },
      addSyntheticNote: async () => {
        calls.push('add');
        throw Object.assign(new Error('synthetic timeout'), {
          code: 'TIMEOUT'
        });
      }
    });

    const result = await runSyntheticAnkiSpike(request, mock);
    expect(result.noteId).toBe(31);
    expect(result.reusedExisting).toBe(true);
    expect(calls).toEqual(['find', 'add', 'find']);
  });

  it('fails after a timeout with no matching note and does not retry the add', async () => {
    let adds = 0;
    const mock = adapter({
      addSyntheticNote: async () => {
        adds += 1;
        throw Object.assign(new Error('synthetic timeout'), {
          code: 'TIMEOUT'
        });
      }
    });

    await expect(runSyntheticAnkiSpike(request, mock)).rejects.toThrow(
      'Synthetic add outcome is unknown; retry by looking up the same identity.'
    );
    expect(adds).toBe(1);
  });

  it('preserves the unknown add outcome when timeout reconciliation lookup fails', async () => {
    let lookups = 0;
    let adds = 0;
    const mock = adapter({
      findSyntheticNotes: async () => {
        lookups += 1;
        if (lookups === 1) return [];
        throw new Error('synthetic lookup unavailable');
      },
      addSyntheticNote: async () => {
        adds += 1;
        throw Object.assign(new Error('synthetic timeout'), {
          code: 'TIMEOUT'
        });
      }
    });

    await expect(runSyntheticAnkiSpike(request, mock)).rejects.toThrow(
      'Synthetic add outcome is unknown; recovery lookup failed. Retry lookup only; do not add again.'
    );
    expect(lookups).toBe(2);
    expect(adds).toBe(1);
  });

  it('labels all results synthetic and explicitly reports no Windows delivery', async () => {
    const result = await runSyntheticAnkiSpike(request, adapter());
    expect(result).toMatchObject({
      mode: 'SYNTHETIC_MOCK_ONLY',
      delivery: 'NOT_DELIVERED'
    });
    expect(JSON.stringify(result)).toMatch(/SYNTHETIC_MOCK_ONLY|synthetic/i);
    expect(JSON.stringify(result)).not.toMatch(
      /windows|windows_delivery|delivered:true/i
    );
  });
});
