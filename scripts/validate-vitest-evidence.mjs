import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Parse the Vitest/Jest-compatible JSON report and reject absent or hollow
 * evidence. Test failures remain valid evidence; the test step and Merge-
 * Evidence Gate decide whether those failures should fail the workflow.
 *
 * @param {string} source
 * @returns {{ suiteCount: number, testCount: number, failedTestCount: number }}
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

  const failedTestCount = assertions.filter(
    (assertion) => assertion?.status === 'failed'
  ).length;

  if (
    !Number.isSafeInteger(report.numFailedTests) ||
    report.numFailedTests < 0 ||
    report.numFailedTests !== failedTestCount
  ) {
    throw new Error(
      'Vitest report failure count does not match its test results'
    );
  }

  if (
    typeof report.success !== 'boolean' ||
    report.success !== (failedTestCount === 0)
  ) {
    throw new Error(
      'Vitest report success flag does not match its test results'
    );
  }

  return {
    suiteCount: report.testResults.length,
    testCount: assertions.length,
    failedTestCount
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
    `Validated Vitest evidence: ${summary.testCount} tests across ${summary.suiteCount} suites (${summary.failedTestCount} failed)`
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
