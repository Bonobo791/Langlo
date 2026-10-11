import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSERTION_STATUSES = [
  'passed',
  'failed',
  'skipped',
  'pending',
  'todo',
  'disabled'
];

/**
 * Parse the Vitest/Jest-compatible JSON report and reject absent or hollow
 * evidence. Test failures remain valid evidence; the test step and Merge-
 * Evidence Gate decide whether those failures should fail the workflow.
 *
 * @param {string} source
 * @returns {{ suiteCount: number, testCount: number, passedTestCount: number, failedTestCount: number, skippedTestCount: number }}
 */
export function parseVitestEvidence(source) {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new Error('Vitest report is empty');
  }

  let report;
  try {
    report = JSON.parse(source);
  } catch {
    throw new Error('Vitest report is not valid JSON');
  }

  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('Vitest report must be a JSON object');
  }

  if (!Array.isArray(report.testResults) || report.testResults.length === 0) {
    throw new Error('Vitest report contains no test results');
  }

  if (
    !Number.isSafeInteger(report.numTotalTests) ||
    report.numTotalTests <= 0
  ) {
    throw new Error('Vitest report must declare a positive test count');
  }

  const assertions = report.testResults.flatMap((suite) => {
    if (
      suite === null ||
      typeof suite !== 'object' ||
      !['passed', 'failed'].includes(suite.status) ||
      !Array.isArray(suite.assertionResults)
    ) {
      throw new Error(
        'Vitest report contains a suite without assertion results'
      );
    }
    return suite.assertionResults;
  });

  if (assertions.length === 0) {
    throw new Error('Vitest report contains no test results');
  }

  if (assertions.length !== report.numTotalTests) {
    throw new Error(
      `Vitest report test count ${report.numTotalTests} does not match ${assertions.length} assertion results`
    );
  }

  const counts = {
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    todo: 0,
    disabled: 0
  };
  for (const assertion of assertions) {
    if (
      assertion === null ||
      typeof assertion !== 'object' ||
      !ASSERTION_STATUSES.includes(assertion.status)
    ) {
      throw new Error('Vitest report contains an unknown assertion status');
    }
    counts[assertion.status] += 1;
  }

  const passedTestCount = counts.passed;
  const failedTestCount = counts.failed;
  const skippedTestCount = counts.skipped + counts.disabled;
  const pendingTestCount = counts.skipped + counts.pending + counts.disabled;

  if (passedTestCount === 0) {
    throw new Error('Vitest report contains no passed assertion');
  }

  const counters = [
    ['numPassedTests', report.numPassedTests, passedTestCount],
    ['numFailedTests', report.numFailedTests, failedTestCount],
    ['numPendingTests', report.numPendingTests, pendingTestCount],
    ['numTodoTests', report.numTodoTests, counts.todo]
  ];
  for (const [name, value, expected] of counters) {
    if (!Number.isSafeInteger(value) || value < 0 || value !== expected) {
      throw new Error(
        `Vitest report ${name} count does not match assertion statuses`
      );
    }
  }

  if (
    report.numTotalTests !==
    passedTestCount + failedTestCount + pendingTestCount + counts.todo
  ) {
    throw new Error('Vitest report test counters do not add up to the total');
  }

  const suiteCountCounters = [
    report.numPassedTestSuites,
    report.numFailedTestSuites,
    report.numPendingTestSuites
  ];
  if (
    !Number.isSafeInteger(report.numTotalTestSuites) ||
    report.numTotalTestSuites <= 0 ||
    suiteCountCounters.some(
      (count) => !Number.isSafeInteger(count) || count < 0
    ) ||
    suiteCountCounters.reduce((sum, count) => sum + count, 0) !==
      report.numTotalTestSuites
  ) {
    throw new Error('Vitest report suite counters are missing or inconsistent');
  }

  if (
    typeof report.success !== 'boolean' ||
    report.success !==
      (failedTestCount === 0 &&
        report.numFailedTestSuites === 0 &&
        !report.testResults.some((suite) => suite.status === 'failed'))
  ) {
    throw new Error(
      'Vitest report success flag does not match its test results'
    );
  }

  return {
    suiteCount: report.testResults.length,
    testCount: assertions.length,
    passedTestCount,
    failedTestCount,
    skippedTestCount
  };
}

function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    throw new Error(
      'Usage: node scripts/validate-vitest-evidence.mjs <report-path>'
    );
  }

  const summary = parseVitestEvidence(
    readFileSync(resolve(process.cwd(), reportPath), 'utf8')
  );
  console.log(
    `Validated Vitest evidence: ${summary.passedTestCount}/${summary.testCount} passed across ${summary.suiteCount} suites (${summary.failedTestCount} failed, ${summary.skippedTestCount} skipped/disabled)`
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Invalid Vitest evidence: ${message}`);
    process.exitCode = 1;
  }
}
