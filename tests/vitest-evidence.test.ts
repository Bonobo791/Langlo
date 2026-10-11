import { describe, expect, it } from 'vitest';
import { parseVitestEvidence } from '../scripts/validate-vitest-evidence.mjs';

function reportWith(status: 'passed' | 'failed' = 'passed') {
  return JSON.stringify({
    numTotalTestSuites: 1,
    numPassedTestSuites: status === 'passed' ? 1 : 0,
    numFailedTestSuites: status === 'failed' ? 1 : 0,
    numPendingTestSuites: 0,
    numTotalTests: 1,
    numPassedTests: status === 'passed' ? 1 : 0,
    numFailedTests: status === 'failed' ? 1 : 0,
    numPendingTests: 0,
    numTodoTests: 0,
    success: status === 'passed',
    testResults: [
      {
        assertionResults: [{ status }],
        status,
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
      failedTestCount: 0
    });
  });

  it('accepts failed tests as evidence without treating them as a passing report', () => {
    expect(parseVitestEvidence(reportWith('failed'))).toEqual({
      suiteCount: 1,
      testCount: 1,
      failedTestCount: 1
    });
  });

  it.each(['', 'not json', 'null', '[]'])(
    'rejects an invalid report: %s',
    (source) => {
      expect(() => parseVitestEvidence(source)).toThrow();
    }
  );

  it('rejects a report with no executed tests', () => {
    const report = JSON.parse(reportWith()) as Record<string, unknown>;
    report.numTotalTests = 0;
    report.numPassedTests = 0;
    report.testResults = [];
    expect(() => parseVitestEvidence(JSON.stringify(report))).toThrow(
      /no test results/u
    );
  });

  it('rejects mismatched report counters instead of accepting hollow evidence', () => {
    const report = JSON.parse(reportWith()) as Record<string, unknown>;
    report.numTotalTests = 2;
    expect(() => parseVitestEvidence(JSON.stringify(report))).toThrow(
      /does not match/u
    );
  });
});
