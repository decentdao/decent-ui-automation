import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
const os = require('os');

const resultsDir = path.join(process.cwd(), 'test-results');

function deleteAllScreenshots(dir: string) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      deleteAllScreenshots(filePath);
      // Remove empty directories
      if (fs.readdirSync(filePath).length === 0) fs.rmdirSync(filePath);
    } else if (file.endsWith('.png')) {
      fs.unlinkSync(filePath);
    }
  }
}

deleteAllScreenshots(resultsDir);

function findTestFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findTestFiles(filePath));
    } else if (file.endsWith('.test.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

function findScreenshotPath(testName: string): string | undefined {
  const screenshotRelPath = testName.replace(/\\/g, '/').replace(/\.test\.ts$/, '.png');
  const screenshotPath = path.join(process.cwd(), 'test-results', 'screenshots', screenshotRelPath);
  if (fs.existsSync(screenshotPath)) return screenshotPath;
  return undefined;
}

function readTempErrorFile(pid: number): string | undefined {
  const tmpErrorPath = path.join(os.tmpdir(), `selenium-test-error-${pid}.log`);
  if (fs.existsSync(tmpErrorPath)) {
    try {
      const content = fs.readFileSync(tmpErrorPath, 'utf8').trim();
      fs.unlinkSync(tmpErrorPath);
      return content;
    } catch {}
  }
  return undefined;
}

function testHasRegressionType(testFile: string, type: string): boolean {
  try {
    const content = fs.readFileSync(testFile, 'utf8');
    const match = content.match(/const regressionType = (\[[^\]]+\])/);
    if (match) {
      // eslint-disable-next-line no-eval
      const arr = eval(match[1]);
      return arr.includes(type);
    }
  } catch {}
  return false;
}

const tests = findTestFiles(path.join(__dirname, 'tests'));

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

const regressionTypeFilter = process.env.REGRESSION_TYPE;

const argv = process.argv.slice(2);
const debugMode = argv.includes('--debug');
const testFileArgs = argv.filter(arg => arg.endsWith('.test.ts'));

let filteredTests: string[];
if (testFileArgs.length > 0) {
  filteredTests = testFileArgs.map(f => path.isAbsolute(f) ? f : path.join(process.cwd(), f));
} else {
  filteredTests = regressionTypeFilter
    ? tests.filter(f => testHasRegressionType(f, regressionTypeFilter))
    : tests;
}

const debugFilteredTests = debugMode ? filteredTests.slice(0, 5) : filteredTests;

function groupTestsByPage(tests: string[]): Record<string, { header?: string; others: string[] }> {
  const groups: Record<string, { header?: string; others: string[] }> = {};
  for (const test of tests) {
    const match = test.match(/tests\/(.+?)\/(header-loads|content-loads)\.test\.ts$/);
    if (match) {
      const page = match[1];
      const type = match[2];
      if (!groups[page]) groups[page] = { others: [] };
      if (type === 'header-loads') {
        groups[page].header = test;
      } else {
        groups[page].others.push(test);
      }
    }
  }
  return groups;
}

const SHOW_REALTIME_LOGS = true;

(async function runAllTests() {
  let allPassed = true;
  const testResults: { name: string; passed: boolean; errorMsg?: string; screenshotPath?: string; durationMs?: number }[] = [];
  const groups = groupTestsByPage(debugFilteredTests);
  for (const page of Object.keys(groups)) {
    const { header, others } = groups[page];
    let headerPassed = true;
    if (header) {
      let start = Date.now();
      await new Promise<void>((resolve) => {
        const proc = spawn('ts-node', [header], { stdio: SHOW_REALTIME_LOGS ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
        let output = '';
        let error = '';
        // Removed timeout logic (undo)
        if (proc.stdout) {
          proc.stdout.on('data', (data) => { output += data.toString(); });
        }
        if (proc.stderr) {
          proc.stderr.on('data', (data) => { error += data.toString(); });
        }
        proc.on('close', (code) => {
          const testName = path.relative(path.join(__dirname, 'tests'), header).replace(/\\/g, '/');
          const passed = code === 0;
          let errorMsg = '';
          let screenshotPath = findScreenshotPath(testName);
          let durationMs = Date.now() - start;
          if (!passed) {
            errorMsg = (output + '\n' + error).trim();
            // If either output or error contains TimeoutError, prefer that message
            const timeoutMatch = /TimeoutError[\s\S]*?(?=\n\s*at|$)/.exec(errorMsg);
            if (timeoutMatch) {
              errorMsg = timeoutMatch[0].trim();
            }
            // Fallback: read error from temp file if errorMsg is empty
            if (!errorMsg) {
              const tempError = proc.pid !== undefined ? readTempErrorFile(proc.pid) : undefined;
              if (tempError) errorMsg = tempError;
            }
            if (!errorMsg) errorMsg = 'Test failed (no error output)';
          }
          testResults.push({ name: testName, passed, errorMsg, screenshotPath, durationMs });
          if (passed) {
            console.log(`${testName}: ${colors.green}pass${colors.reset}`);
          } else {
            allPassed = false;
            headerPassed = false;
            console.log(`${testName}: ${colors.red}fail${colors.reset}`);
            if (output) console.log(output.trim());
            if (error) console.error(error.trim());
          }
          resolve();
        });
      });
    }
    if (headerPassed) {
      for (const test of others) {
        let start = Date.now();
        await new Promise<void>((resolve) => {
          const proc = spawn('ts-node', [test], { stdio: SHOW_REALTIME_LOGS ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
          let output = '';
          let error = '';
          // Removed timeout logic (undo)
          if (proc.stdout) {
            proc.stdout.on('data', (data) => { output += data.toString(); });
          }
          if (proc.stderr) {
            proc.stderr.on('data', (data) => { error += data.toString(); });
          }
          proc.on('close', (code) => {
            const testName = path.relative(path.join(__dirname, 'tests'), test).replace(/\\/g, '/');
            const passed = code === 0;
            let errorMsg = '';
            let screenshotPath = findScreenshotPath(testName);
            let durationMs = Date.now() - start;
            if (!passed) {
              errorMsg = (output + '\n' + error).trim();
              // If either output or error contains TimeoutError, prefer that message
              const timeoutMatch = /TimeoutError[\s\S]*?(?=\n\s*at|$)/.exec(errorMsg);
              if (timeoutMatch) {
                errorMsg = timeoutMatch[0].trim();
              }
              // Fallback: read error from temp file if errorMsg is empty
              if (!errorMsg) {
                const tempError = proc.pid !== undefined ? readTempErrorFile(proc.pid) : undefined;
                if (tempError) errorMsg = tempError;
              }
              if (!errorMsg) errorMsg = 'Test failed (no error output)';
            }
            testResults.push({ name: testName, passed, errorMsg, screenshotPath, durationMs });
            if (passed) {
              console.log(`${testName}: ${colors.green}pass${colors.reset}`);
            } else {
              allPassed = false;
              console.log(`${testName}: ${colors.red}fail${colors.reset}`);
              if (output) console.log(output.trim());
              if (error) console.error(error.trim());
            }
            resolve();
          });
        });
      }
    } else {
      for (const test of others) {
        const testName = path.relative(path.join(__dirname, 'tests'), test).replace(/\\/g, '/');
        testResults.push({ name: testName, passed: false, errorMsg: 'Skipped due to header-loads failure.' });
        console.log(`${testName}: ${colors.red}skipped (header-loads failed)${colors.reset}`);
      }
    }
  }
  // Write test results summary as HTML
  const resultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${pad(now.getMonth()+1)}/${pad(now.getDate())}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;
  const totalDuration = testResults.reduce((sum, r) => sum + (r.durationMs || 0), 0);
  const failedCount = testResults.filter(r => !r.passed && r.errorMsg !== 'Skipped due to header-loads failure.').length;
  const skippedCount = testResults.filter(r => r.errorMsg === 'Skipped due to header-loads failure.').length;
  const percentPassed = (passedCount / totalCount) * 100;
  const percentFailed = (failedCount / totalCount) * 100;
  const percentSkipped = (skippedCount / totalCount) * 100;
  let html = `<!DOCTYPE html>\n<html lang='en'>\n<head>\n<meta charset='UTF-8'>\n<title>Test Results Summary</title>\n<style>\nbody { font-family: Arial, sans-serif; background: #fafbfc; color: #222; }\ntable { border-collapse: collapse; width: 100%; margin-top: 1em; }\nth, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }\nth { background: #f3f3f3; }\n.pass { color: #228B22; font-weight: bold; }\n.fail { color: #B22222; font-weight: bold; }\n.skipped { color: #b59a00; font-weight: bold; }\ntr:nth-child(even) { background: #f9f9f9; }\ntr.data-row:hover { background: #e0eaff !important; }\n.bar-container { width: 100%; height: 24px; background: #eee; border-radius: 6px; overflow: hidden; margin: 18px 0 10px 0; border: 1px solid #ccc; display: flex; }\n.bar-pass { background: #228B22; height: 100%; }\n.bar-fail { background: #B22222; height: 100%; }\n.bar-skipped { background: #b59a00; height: 100%; }\n.error-link { color: #0074d9; cursor: pointer; text-decoration: underline; font-size: 0.95em; margin-left: 8px; }\n.error-details { display: none; color: #B22222; font-size: 0.95em; background: #fff8f8; border: 1px solid #f3cccc; border-radius: 4px; margin-top: 4px; padding: 8px; white-space: pre-wrap; }\n</style>\n<script>\nfunction toggleError(id) {\n  var details = document.getElementById('error-details-' + id);\n  var link = document.getElementById('error-link-' + id);\n  if (details.style.display === 'block') {\n    details.style.display = 'none';\n    link.textContent = '(show error)';\n  } else {\n    details.style.display = 'block';\n    link.textContent = '(hide error)';\n  }\n}\n</script>\n</head>\n<body>\n<h2>Test Results Summary</h2>\n<p><b>Timestamp:</b> ${timestamp}</p>\n<p><b>Total run time:</b> ${(totalDuration / 1000).toFixed(2)}s</p>\n<p><b>${passedCount}/${totalCount} tests passed</b></p>\n<div class='bar-container'>\n  <div class='bar-pass' style='width:${percentPassed}%' title='Passed: ${passedCount}'></div>\n  <div class='bar-fail' style='width:${percentFailed}%' title='Failed: ${failedCount}'></div>\n  <div class='bar-skipped' style='width:${percentSkipped}%' title='Skipped: ${skippedCount}'></div>\n</div>\n<table>\n<thead><tr><th>Test Name</th><th>Result</th><th>Run Time</th><th>Screenshot</th></tr></thead>\n<tbody>\n`;
let errorId = 0;
for (const r of testResults) {
  let resultClass = r.passed ? 'pass' : r.errorMsg === 'Skipped due to header-loads failure.' ? 'skipped' : 'fail';
  let resultText = r.passed ? 'PASS' : r.errorMsg === 'Skipped due to header-loads failure.' ? 'SKIPPED' : 'FAIL';
  let runTime = typeof r.durationMs === 'number' ? (r.durationMs / 1000).toFixed(2) + 's' : '';
  let screenshotLink = '';
  if (r.screenshotPath && fs.existsSync(r.screenshotPath)) {
    const relPath = path.relative(resultsDir, r.screenshotPath).replace(/\\/g, '/');
    screenshotLink = `<a href='${relPath}' target='_blank'>View</a>`;
  }
  let testNameCell = r.name;
  if (!r.passed && r.errorMsg && resultClass !== 'skipped') {
    testNameCell += ` <span id='error-link-${errorId}' class='error-link' onclick='toggleError(${errorId})'>(show error)</span>`;
  }
  html += `<tr class='data-row'><td>${testNameCell}</td><td class='${resultClass}'>${resultText}</td><td>${runTime}</td><td>${screenshotLink}</td></tr>\n`;
  if (!r.passed && r.errorMsg && resultClass !== 'skipped') {
    html += `<tr><td colspan='4'><div id='error-details-${errorId}' class='error-details'>${r.errorMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div></td></tr>\n`;
    errorId++;
  }
}
html += `</tbody></table>\n</body>\n</html>\n`;

  const summaryPath = path.join(resultsDir, 'test-results-summary.html');
  fs.writeFileSync(summaryPath, html);

  // Open the summary in the default browser (macOS: 'open', Windows: 'start', Linux: 'xdg-open')
  const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  require('child_process').spawn(openCmd, [summaryPath], { stdio: 'ignore', detached: true });

  process.exit(allPassed ? 0 : 1);
})();
