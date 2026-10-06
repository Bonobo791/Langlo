import { createHash } from 'node:crypto';

export interface CardIdentity {
  ownerId: string;
  language: string;
  skillId: string;
  canonicalMistake: string;
}

/** Canonical mistake semantics are owned by T021; identity never includes editable card fields. */
export function createSourceId(identity: CardIdentity): string {
  const fields = [
    identity.ownerId,
    identity.language,
    identity.skillId,
    identity.canonicalMistake
  ];
  if (
    fields.some(
      (value) =>
        typeof value !== 'string' ||
        value.trim().length === 0 ||
        value.length > 4096
    )
  ) {
    throw new Error(
      'Invalid card identity: all fields must be nonempty bounded strings'
    );
  }
  // Structured framing prevents separator ambiguity; preserve exact canonical semantics.
  return `langlo:v1:${createHash('sha256').update(JSON.stringify(fields), 'utf8').digest('hex')}`;
}
