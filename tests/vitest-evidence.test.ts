import { describe, expect, it } from 'vitest';
import { parseVitestEvidence } from '../scripts/validate-vitest-evidence.mjs';

type AssertionStatus =
  'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled';

function reportWith(statuses: AssertionStatus[] = ['passed']) {
  const count = (status: AssertionStatus) =>
    statuses.filter((item) => item === status).length;
  const failedTestCount = count('failed');
  const passedTestCount = count('passed');
  const pendingTestCount =
    count('skipped') + count('pending') + count('disabled');
  const todoTestCount = count('todo');
  return JSON.stringify({
    numTotalTestSuites: 1,
    numPassedTestSuites: failedTestCount === 0 ? 1 : 0,
    numFailedTestSuites: failedTestCount > 0 ? 1 : 0,
    numPendingTestSuites: 0,
    numTotalTests: statuses.length,
    numPassedTests: passedTestCount,
    numFailedTests: failedTestCount,
    numPendingTests: pendingTestCount,
    numTodoTests: todoTestCount,
    success: failedTestCount === 0,
    testResults: [
      {
        assertionResults: statuses.map((status) => ({ status })),
        status: failedTestCount === 0 ? 'passed' : 'failed',
        name: '/workspace/tests/example.test.ts'
      }
    ]
  });
}

describe('Vitest report evidence validation', () => {
  it('accepts a non-empty report and derives counts from its test results', () => {
    expect(parseVitestEvidence(reportWith())).toEqual({
      suiteCount: 1,
      testCount: 1,
      passedTestCount: 1,
      failedTestCount: 0,
      skippedTestCount: 0
    });
  });

  it('accepts a report with failures when it also records passed assertions', () => {
    expect(parseVitestEvidence(reportWith(['passed', 'failed']))).toEqual({
      suiteCount: 1,
      testCount: 2,
      passedTestCount: 1,
      failedTestCount: 1,
      skippedTestCount: 0
    });
  });

  it('accepts partially skipped, pending, todo, and disabled tests', () => {
    expect(
      parseVitestEvidence(
        reportWith(['passed', 'skipped', 'pending', 'todo', 'disabled'])
      )
    ).toEqual({
      suiteCount: 1,
      testCount: 5,
      passedTestCount: 1,
      failedTestCount: 0,
      skippedTestCount: 2
    });
  });

  it.each(['', 'not json', 'null', '[]'])(
    'rejects an invalid report: %s',
    (source) => {
      expect(() => parseVitestEvidence(source)).toThrow();
    }
  );

  it('rejects a report with no executed tests', () => {
    const noAssertions = JSON.parse(reportWith()) as Record<string, unknown>;
    noAssertions.numTotalTests = 0;
    noAssertions.numPassedTests = 0;
    noAssertions.testResults = [];
    expect(() => parseVitestEvidence(JSON.stringify(noAssertions))).toThrow(
      /no test results/u
    );

    expect(() => parseVitestEvidence(reportWith(['skipped', 'todo']))).toThrow(
      /passed assertion/u
    );
    expect(() =>
      parseVitestEvidence(reportWith(['skipped', 'skipped']))
    ).toThrow(/passed assertion/u);
  });

  it('rejects unknown statuses and mismatched report counters', () => {
    const invalidStatus = JSON.parse(reportWith()) as {
      testResults: Array<{ assertionResults: Array<{ status: string }> }>;
    };
    invalidStatus.testResults[0]!.assertionResults[0]!.status = 'unknown';
    expect(() => parseVitestEvidence(JSON.stringify(invalidStatus))).toThrow(
      /status/u
    );

    const mismatchedTotal = JSON.parse(reportWith()) as Record<string, unknown>;
    mismatchedTotal.numTotalTests = 2;
    expect(() => parseVitestEvidence(JSON.stringify(mismatchedTotal))).toThrow(
      /does not match/u
    );

    const mismatchedPassed = JSON.parse(reportWith()) as Record<
      string,
      unknown
    >;
    mismatchedPassed.numPassedTests = 0;
    expect(() => parseVitestEvidence(JSON.stringify(mismatchedPassed))).toThrow(
      /numPassedTests count/u
    );

    const mismatchedPending = JSON.parse(
      reportWith(['passed', 'skipped'])
    ) as Record<string, unknown>;
    mismatchedPending.numPendingTests = 0;
    expect(() =>
      parseVitestEvidence(JSON.stringify(mismatchedPending))
    ).toThrow(/numPendingTests count/u);

    const mismatchedTodo = JSON.parse(reportWith(['passed', 'todo'])) as Record<
      string,
      unknown
    >;
    mismatchedTodo.numTodoTests = 0;
    expect(() => parseVitestEvidence(JSON.stringify(mismatchedTodo))).toThrow(
      /numTodoTests count/u
    );

    const mismatchedSuiteCounts = JSON.parse(reportWith()) as Record<
      string,
      unknown
    >;
    mismatchedSuiteCounts.numPassedTestSuites = 0;
    expect(() =>
      parseVitestEvidence(JSON.stringify(mismatchedSuiteCounts))
    ).toThrow(/suite counters/u);

    const mismatchedSuiteTotal = JSON.parse(reportWith()) as Record<
      string,
      unknown
    >;
    mismatchedSuiteTotal.numTotalTestSuites = 2;
    expect(() =>
      parseVitestEvidence(JSON.stringify(mismatchedSuiteTotal))
    ).toThrow(/suite counters/u);

    const mismatchedSuiteStatus = JSON.parse(reportWith()) as {
      testResults: Array<{ status: string }>;
    };
    mismatchedSuiteStatus.testResults[0]!.status = 'failed';
    expect(() =>
      parseVitestEvidence(JSON.stringify(mismatchedSuiteStatus))
    ).toThrow(/success flag/u);

    const incorrectSuccessFlag = JSON.parse(reportWith()) as Record<
      string,
      unknown
    >;
    incorrectSuccessFlag.success = false;
    expect(() =>
      parseVitestEvidence(JSON.stringify(incorrectSuccessFlag))
    ).toThrow(/success flag/u);
  });
});
