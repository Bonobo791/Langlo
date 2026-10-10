// Synthetic dataset for the T005 design prototype. All records are invented
// fixtures for screen review only — no learner data, persistence, or backend.

export type Mastery = 'not-started' | 'introduced' | 'practising' | 'strong';
export type Scheduling = 'new' | 'learning' | 'due' | 'suspended';
export type Outcome = 'correct' | 'incorrect' | 'uncertain';
export type NoteStatus = 'draft' | 'approved' | 'rejected';

export const masteryLabel: Record<Mastery, string> = {
  'not-started': 'Not started',
  introduced: 'Introduced',
  practising: 'Practising',
  strong: 'Strong'
};

export const schedulingLabel: Record<Scheduling, string> = {
  new: 'New',
  learning: 'Learning',
  due: 'Due',
  suspended: 'Suspended'
};

export const outcomeLabel: Record<Outcome, string> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  uncertain: 'Uncertain'
};

export interface Skill {
  id: string;
  topic: string;
  name: string;
  prerequisites: string[];
  mastery: Mastery;
}

export interface Track {
  id: string;
  label: string;
  language: string;
  explanationLanguage: string;
  enrolled: boolean;
  skills: Skill[];
}

function skill(
  id: string,
  topic: string,
  name: string,
  prerequisites: string[],
  mastery: Mastery
): Skill {
  return { id, topic, name, prerequisites, mastery };
}

// French A1 skill names/topics/edges mirror this repository's draft catalog.
export const frenchA1: Skill[] = [
  skill(
    'fr-a1-001',
    'Sentence basics',
    'Build short affirmative statements with a subject and a finite verb',
    [],
    'strong'
  ),
  skill(
    'fr-a1-002',
    'Pronouns',
    'Use subject pronouns with common verbs',
    ['fr-a1-001'],
    'not-started'
  ),
  skill(
    'fr-a1-003',
    'Present tense',
    'Conjugate regular -er verbs in common present-tense statements and questions',
    ['fr-a1-001'],
    'practising'
  ),
  skill(
    'fr-a1-004',
    'Present tense',
    'Use être and avoir in common present-tense patterns',
    ['fr-a1-002'],
    'practising'
  ),
  skill(
    'fr-a1-005',
    'Present tense',
    'Use frequent irregular present forms including aller in routine expressions',
    ['fr-a1-003', 'fr-a1-004'],
    'not-started'
  ),
  skill(
    'fr-a1-006',
    'Negation',
    'Form simple ne…pas negation around a finite verb',
    ['fr-a1-003'],
    'not-started'
  ),
  skill(
    'fr-a1-007',
    'Questions',
    'Ask yes/no questions with intonation and est-ce que',
    ['fr-a1-003', 'fr-a1-004'],
    'not-started'
  ),
  skill(
    'fr-a1-008',
    'Questions',
    'Ask about people and familiar details with common question words',
    ['fr-a1-007'],
    'not-started'
  ),
  skill(
    'fr-a1-009',
    'Nouns and articles',
    'Choose common singular definite and indefinite articles with noun gender',
    [],
    'practising'
  ),
  skill(
    'fr-a1-010',
    'Nouns and articles',
    'Form regular plural nouns and choose plural articles in familiar noun phrases',
    ['fr-a1-009'],
    'introduced'
  ),
  skill(
    'fr-a1-011',
    'Adjectives',
    'Place common adjectives and agree them with familiar nouns',
    ['fr-a1-009', 'fr-a1-010'],
    'not-started'
  ),
  skill(
    'fr-a1-012',
    'Determiners',
    'Use basic possessive determiners for family and personal belongings',
    ['fr-a1-009', 'fr-a1-010'],
    'not-started'
  ),
  skill(
    'fr-a1-013',
    'Determiners',
    'Use ce/cette/ces to identify familiar people and things',
    ['fr-a1-009', 'fr-a1-010'],
    'not-started'
  ),
  skill(
    'fr-a1-014',
    'Quantity',
    'Use common partitive forms for food and uncounted quantities',
    ['fr-a1-009', 'fr-a1-010'],
    'not-started'
  ),
  skill(
    'fr-a1-015',
    'Prepositions',
    'Use frequent place prepositions in simple location statements',
    [],
    'strong'
  ),
  skill(
    'fr-a1-016',
    'Time',
    'Use common clock and calendar expressions with simple prepositions',
    ['fr-a1-015'],
    'introduced'
  ),
  skill(
    'fr-a1-017',
    'Verbs',
    'Use the infinitive after common ability and preference verbs',
    [],
    'practising'
  ),
  skill(
    'fr-a1-018',
    'Imperative',
    'Understand and produce frequent short instructions and requests',
    ['fr-a1-003', 'fr-a1-004'],
    'not-started'
  ),
  skill(
    'fr-a1-019',
    'Future',
    'Use aller + infinitive for an immediate plan',
    ['fr-a1-005'],
    'not-started'
  ),
  skill(
    'fr-a1-020',
    'Connectors',
    'Join short clauses with common additive and contrastive connectors',
    [],
    'introduced'
  ),
  skill(
    'fr-a1-021',
    'Past tense',
    'Use passé composé with avoir and a few frequent être verbs for short past events',
    ['fr-a1-003', 'fr-a1-004'],
    'not-started'
  ),
  skill(
    'fr-a1-022',
    'Recent past',
    'Use venir de + infinitive to describe something just completed',
    ['fr-a1-005', 'fr-a1-017'],
    'not-started'
  ),
  skill(
    'fr-a1-023',
    'Reflexive verbs',
    'Use frequent present-tense reflexive verbs for daily routines',
    ['fr-a1-002', 'fr-a1-004'],
    'not-started'
  ),
  skill(
    'fr-a1-024',
    'Existence',
    'Use il y a in simple existence and location statements',
    ['fr-a1-001', 'fr-a1-009'],
    'not-started'
  ),
  skill(
    'fr-a1-025',
    'Requests and necessity',
    'Use il faut and il ne faut pas with an infinitive for simple instructions',
    ['fr-a1-017', 'fr-a1-018'],
    'not-started'
  ),
  skill(
    'fr-a1-026',
    'Polite requests',
    'Use voudrais and pourriez-vous as memorised polite request forms',
    ['fr-a1-007', 'fr-a1-008'],
    'not-started'
  ),
  skill(
    'fr-a1-027',
    'Identity',
    'Use masculine and feminine forms for common professions and nationalities',
    ['fr-a1-009', 'fr-a1-011'],
    'not-started'
  ),
  skill(
    'fr-a1-028',
    'Present progressive',
    'Use être en train de + infinitive for an action happening now',
    ['fr-a1-004', 'fr-a1-017'],
    'not-started'
  )
];

export const germanA1: Skill[] = [
  skill(
    'de-a1-001',
    'Sentence order',
    'Build short main clauses with the finite verb in second position',
    [],
    'practising'
  ),
  skill(
    'de-a1-002',
    'Sentence order',
    'Form yes/no questions with the finite verb first',
    ['de-a1-001'],
    'introduced'
  ),
  skill(
    'de-a1-003',
    'Questions',
    'Ask simple questions with frequent question words',
    ['de-a1-002'],
    'not-started'
  ),
  skill(
    'de-a1-004',
    'Present tense',
    'Conjugate common regular verbs in the present tense',
    [],
    'practising'
  ),
  skill(
    'de-a1-005',
    'Present tense',
    'Use frequent irregular present forms including sein and haben',
    ['de-a1-004'],
    'introduced'
  ),
  skill(
    'de-a1-006',
    'Negation',
    'Recognize the difference between kein in noun phrases and nicht in predicates',
    ['de-a1-004', 'de-a1-007'],
    'not-started'
  ),
  skill(
    'de-a1-007',
    'Nouns',
    'Recognize grammatical gender and identify nominative article forms',
    [],
    'introduced'
  ),
  skill(
    'de-a1-008',
    'Nouns',
    'Form and recognize common singular and plural noun forms',
    ['de-a1-007'],
    'not-started'
  ),
  skill(
    'de-a1-009',
    'Cases',
    'Use nominative and accusative articles for common subjects and direct objects',
    ['de-a1-007', 'de-a1-011'],
    'not-started'
  ),
  skill(
    'de-a1-010',
    'Cases',
    'Recognize dative forms in frequent fixed expressions and common verbs',
    ['de-a1-009'],
    'not-started'
  ),
  skill(
    'de-a1-011',
    'Determiners',
    'Choose common definite and indefinite articles with familiar nouns',
    ['de-a1-007'],
    'not-started'
  ),
  skill(
    'de-a1-012',
    'Determiners',
    'Use possessive determiners in basic personal descriptions',
    ['de-a1-011'],
    'not-started'
  )
];

export const tracks: Track[] = [
  {
    id: 'fr-a1',
    label: 'French A1',
    language: 'French',
    explanationLanguage: 'English',
    enrolled: true,
    skills: frenchA1
  },
  {
    id: 'de-a1',
    label: 'German A1',
    language: 'German',
    explanationLanguage: 'English',
    enrolled: true,
    skills: germanA1
  },
  {
    id: 'de-a2',
    label: 'German A2',
    language: 'German',
    explanationLanguage: 'English',
    enrolled: false,
    skills: []
  }
];

export function groupByTopic(skills: Skill[]): [string, Skill[]][] {
  const groups: [string, Skill[]][] = [];
  for (const skill of skills) {
    const group = groups.find(([topic]) => topic === skill.topic);
    if (group) group[1].push(skill);
    else groups.push([skill.topic, [skill]]);
  }
  return groups;
}

export function unmetPrerequisites(skill: Skill, skills: Skill[]): Skill[] {
  return skill.prerequisites
    .map((id) => skills.find((candidate) => candidate.id === id))
    .filter(
      (prerequisite): prerequisite is Skill =>
        prerequisite !== undefined && prerequisite.mastery !== 'strong'
    );
}

export const learner = {
  displayName: 'Sam',
  enrollments: [
    { trackId: 'fr-a1', label: 'French A1', explanationLanguage: 'English' },
    { trackId: 'de-a1', label: 'German A1', explanationLanguage: 'English' }
  ]
};

export const reviewQueue = { dueNow: 7, laterToday: 4, newAvailable: 5 };

export const recentSessions = [
  {
    when: 'Yesterday',
    mode: 'Practice',
    skill: 'Use être and avoir in common present-tense patterns',
    correct: 6,
    incorrect: 1,
    uncertain: 1
  },
  {
    when: '2 days ago',
    mode: 'Mixed review',
    skill: 'Several French A1 skills',
    correct: 8,
    incorrect: 3,
    uncertain: 0
  }
];

export interface PracticeItem {
  format: 'multiple-choice' | 'typed-blank' | 'translation' | 'correction';
  formatLabel: string;
  prompt: string;
  hint?: string;
  options?: string[];
  acceptable?: string[];
  sampleAnswer: string;
  explanation: string;
}

export const practiceItems: PracticeItem[] = [
  {
    format: 'multiple-choice',
    formatLabel: 'Multiple choice',
    prompt: 'Choose the correct completion: « Elle ___ fatiguée. »',
    options: ['es', 'est', 'sont', 'suis'],
    acceptable: ['est'],
    sampleAnswer: 'est',
    explanation: 'With elle, être takes the form est.'
  },
  {
    format: 'typed-blank',
    formatLabel: 'Typed blank',
    prompt: 'Type the missing word: « Nous ___ au marché demain. »',
    hint: 'aller (we)',
    acceptable: ['allons'],
    sampleAnswer: 'allons',
    explanation:
      'The nous form of aller is allons — here it marks a near-future plan.'
  },
  {
    format: 'translation',
    formatLabel: 'Translation',
    prompt: 'Translate into French: “I am going to eat.”',
    acceptable: ['je vais manger'],
    sampleAnswer: 'Je vais manger',
    explanation:
      'Aller + infinitive expresses an immediate plan: Je vais manger.'
  },
  {
    format: 'correction',
    formatLabel: 'Correction',
    prompt: 'Fix the error: « Je suis aller au marché. »',
    acceptable: [
      'je vais au marché',
      'je suis allé au marché',
      'je suis allée au marché'
    ],
    sampleAnswer: 'Je vais au marché',
    explanation:
      'Suis aller is ungrammatical — fix it to the present « Je vais » or the passé composé « Je suis allé(e) ».'
  }
];

export interface ReviewCard {
  id: string;
  deck: string;
  kind: 'basic' | 'cloze';
  front: string;
  back: string;
}

export const reviewCards: ReviewCard[] = [
  {
    id: 'card-1',
    deck: 'French mistakes',
    kind: 'basic',
    front: 'When do you use « est-ce que »?',
    back: 'To ask a yes/no question without changing word order, e.g. « Est-ce que tu viens ? »'
  },
  {
    id: 'card-2',
    deck: 'French mistakes',
    kind: 'cloze',
    front: 'Je {{…}} parle {{…}} français.',
    back: 'Je ne parle pas français. — ne … pas wraps the verb.'
  },
  {
    id: 'card-3',
    deck: 'Everyday phrases',
    kind: 'basic',
    front: 'What does aller + infinitive express?',
    back: 'An immediate plan or near future: « Je vais manger » — I am going to eat.'
  }
];

export const ratingIntervals = [
  { rating: 'again', label: 'Again', interval: '<10 min', key: '1' },
  { rating: 'hard', label: 'Hard', interval: '15 min', key: '2' },
  { rating: 'good', label: 'Good', interval: '1 day', key: '3' },
  { rating: 'easy', label: 'Easy', interval: '4 days', key: '4' }
];

export interface DeckNote {
  id: string;
  kind: 'basic' | 'cloze';
  preview: string;
  status: NoteStatus;
  scheduling: Scheduling;
  // Scheduling state the note returns to when resumed from suspended.
  preSuspension?: Scheduling;
}

export interface Deck {
  id: string;
  name: string;
  counts: { new: number; learning: number; due: number; suspended: number };
  notes: DeckNote[];
}

export const decks: Deck[] = [
  {
    id: 'deck-mistakes',
    name: 'French mistakes',
    counts: { new: 3, learning: 4, due: 5, suspended: 1 },
    notes: [
      {
        id: 'n1',
        kind: 'basic',
        preview: '« Est-ce que » for yes/no questions',
        status: 'approved',
        scheduling: 'due'
      },
      {
        id: 'n2',
        kind: 'cloze',
        preview: 'Je {{c1::ne}} parle {{c1::pas}}…',
        status: 'approved',
        scheduling: 'learning'
      },
      {
        id: 'n3',
        kind: 'basic',
        preview: 'tu es vs tu as — agreement mix-up',
        status: 'draft',
        scheduling: 'new'
      },
      {
        id: 'n4',
        kind: 'basic',
        preview: 'je suis aller → je vais (correction)',
        status: 'draft',
        scheduling: 'new'
      },
      {
        id: 'n5',
        kind: 'basic',
        preview: 'un/une gender choice for common nouns',
        status: 'approved',
        scheduling: 'suspended',
        preSuspension: 'due'
      }
    ]
  },
  {
    id: 'deck-phrases',
    name: 'Everyday phrases',
    counts: { new: 2, learning: 1, due: 2, suspended: 0 },
    notes: [
      {
        id: 'n6',
        kind: 'basic',
        preview: 'aller + infinitive = near future',
        status: 'approved',
        scheduling: 'due'
      },
      {
        id: 'n7',
        kind: 'cloze',
        preview: 'Il {{c1::y a}} un problème.',
        status: 'approved',
        scheduling: 'learning'
      },
      {
        id: 'n8',
        kind: 'basic',
        preview: 'je voudrais… polite request',
        status: 'rejected',
        scheduling: 'new'
      }
    ]
  }
];

export interface ResultsBreakdown {
  correct: number;
  incorrect: number;
  uncertain: number;
  skillEvidence: { skillId: string; skill: string; change: string }[];
  missedItems: { prompt: string; yourAnswer: string; expected: string }[];
}

export const defaultResults: ResultsBreakdown = {
  correct: 6,
  incorrect: 1,
  uncertain: 1,
  skillEvidence: [
    {
      skillId: 'fr-a1-004',
      skill: 'Use être and avoir in common present-tense patterns',
      change: 'Evidence added — still Practising'
    },
    {
      skillId: 'fr-a1-005',
      skill: 'Use frequent irregular present forms including aller',
      change: 'First evidence — Introduced'
    }
  ],
  missedItems: [
    {
      prompt: 'Choose the correct completion: « Elle ___ fatiguée. »',
      yourAnswer: 'es',
      expected: 'est'
    }
  ]
};
