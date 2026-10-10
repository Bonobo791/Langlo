/* global $state */
// Shared synthetic session state for the T005 prototype. In-memory only —
// resets on reload; no persistence and no backend, matching the fixture data.
import { decks as fixtureDecks } from './data';

export const prototypeSession = $state({
  decks: globalThis.structuredClone(fixtureDecks),
  showAnkiExport: true
});
