// Robust argument parsing: collect CLI args from process.argv, npm_config_argv, and npm_lifecycle_script
function getAllCliArgs() {
  const args = [];
  // 1. process.argv (direct node/ts-node invocation)
  if (process.argv && process.argv.length > 2) {
    args.push(...process.argv.slice(2));
  }
  // 2. npm_config_argv (npm run ... -- ...)
  if (process.env.npm_config_argv) {
    try {
      const npmArgv = JSON.parse(process.env.npm_config_argv);
      if (npmArgv && Array.isArray(npmArgv.original)) {
        // Remove the script name (e.g., 'test:erc721')
        const orig = npmArgv.original;
        // Find the first arg that starts with '-' or ends with .ts
        let firstFlagIdx = orig.findIndex((a: string) => a.startsWith('-') || a.endsWith('.ts'));
        if (firstFlagIdx === -1) firstFlagIdx = 1;
        args.push(...orig.slice(firstFlagIdx));
      }
    } catch {}
  }
  // 3. npm_lifecycle_script (sometimes contains the full script line)
  if (process.env.npm_lifecycle_script) {
    const scriptLine = process.env.npm_lifecycle_script;
    // Extract args after the script name
    const match = scriptLine.match(/\s(--?.*)$/);
    if (match && match[1]) {
      // Split by space, but keep quoted args together
      const parts = match[1].match(/("[^"]+"|'[^']+'|[^\s]+)/g);
      if (parts) args.push(...parts.map(s => s.replace(/^['"]|['"]$/g, '')));
    }
  }
  // Remove duplicates
  return [...new Set(args)];
}

const argv = getAllCliArgs();
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
const os = require('os');
const tsNodeBin = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'ts-node.cmd' : 'ts-node');
// Declare resultsDir at the top for use throughout the file
const resultsDir = path.join(process.cwd(), 'test-results');

// Use custom screenshots dir if provided (for multi-governance runs)
const screenshotsDir = process.env.SCREENSHOTS_DIR || path.join(resultsDir, 'screenshots');

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

deleteAllScreenshots(screenshotsDir);

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
  const screenshotPath = path.join(screenshotsDir, screenshotRelPath);
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

let governanceType = 'erc20';
const governanceArg = argv.find(arg => arg.startsWith('--governance='));
if (governanceArg) {
  const val = governanceArg.split('=')[1].toLowerCase();
  if (["erc20", "erc721", "multisig"].includes(val)) governanceType = val;
}

let testRoot = '';
if (governanceType === 'multisig') {
  testRoot = path.join(process.cwd(), 'tests', 'multisig');
} else {
  testRoot = path.join(process.cwd(), 'tests', 'token-voting');
}
const tests = findTestFiles(testRoot);

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

const regressionTypeFilter = process.env.REGRESSION_TYPE;

const debugMode = argv.some(arg => arg === '--debug' || arg === 'debug');
const testFileArgs = argv.filter(arg => arg.endsWith('.test.ts'));
// Accept --flags=... or a bare value as the flags
let flagsArg = argv.find(arg => arg.startsWith('--flags='));
let testFlags = '';
if (flagsArg) {
  testFlags = flagsArg.replace('--flags=', '');
} else {
  // If not found, but a single non-option arg exists, treat it as flags
  const bareFlags = argv.find(arg => !arg.startsWith('--') && !arg.endsWith('.test.ts'));
  if (bareFlags) testFlags = bareFlags;
}

let filteredTests: string[];
if (testFileArgs.length > 0) {
  filteredTests = testFileArgs.map(f => path.isAbsolute(f) ? f : path.join(process.cwd(), f));
} else {
  filteredTests = regressionTypeFilter
    ? tests.filter(f => testHasRegressionType(f, regressionTypeFilter))
    : tests;
}



function groupTestsByPage(tests: string[]): Record<string, { header?: string; others: string[] }> {
  const groups: Record<string, { header?: string; others: string[] }> = {};
  for (const test of tests) {
    const normalized = test.replace(/\\/g, '/');
    const match = normalized.match(/tests\/(.+)\/(header-loads|content-loads)\.test\.ts$/);
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


// Always capture output for summary, but also print in real time
const SHOW_REALTIME_LOGS = true;

(async function runAllTests() {
  let allPassed = true;
  const testResults: { name: string; passed: boolean; errorMsg?: string; screenshotPath?: string; durationMs?: number }[] = [];

  // Always generate and open the test results summary, even for a single test
  if (debugMode || filteredTests.length === 1) {
    // In debug mode, run only the first 5 test files directly, no grouping or grouping logic
    // If only one test, run it directly and show summary
    const testsToRun = debugMode ? filteredTests.slice(0, 5) : filteredTests;
    for (const testFile of testsToRun) {
      let start = Date.now();
      await new Promise<void>((resolve) => {
        const isWin = process.platform === 'win32';
        let proc;
        if (isWin) {
          const cmd = `"${tsNodeBin}" "${testFile}" --governance=${governanceType}`;
          proc = spawn(cmd, [], {
            stdio: ['ignore', 'pipe', 'pipe'], // Always capture output
            shell: true,
            env: { ...process.env, TEST_FLAGS: testFlags },
          });
        } else {
          proc = spawn(tsNodeBin, [testFile, `--governance=${governanceType}`], {
            stdio: ['ignore', 'pipe', 'pipe'], // Always capture output
            shell: false,
            env: { ...process.env, TEST_FLAGS: testFlags },
          });
        }
        let output = '';
        let error = '';
        if (proc.stdout) {
          proc.stdout.on('data', (data) => {
            const str = data.toString();
            output += str;
            if (SHOW_REALTIME_LOGS) process.stdout.write(str);
          });
        }
        if (proc.stderr) {
          proc.stderr.on('data', (data) => {
            const str = data.toString();
            error += str;
            if (SHOW_REALTIME_LOGS) process.stderr.write(str);
          });
        }
        proc.on('close', (code) => {
          let testName = path.relative(path.join(__dirname, 'tests'), testFile).replace(/\\/g, '/');
          // Remove leading token-voting/, multisig/, or governance type (erc20/erc721/multisig) if present
          testName = testName.replace(/^(token-voting|multisig|erc20|erc721|multisig)\//, '');
          const passed = code === 0;
          let screenshotPath = findScreenshotPath(testName);
          let durationMs = Date.now() - start;
          if (!passed) {
            // Always show all output, even if not marked as error
            let msgParts = [];
            if (output.trim()) msgParts.push('[Console Output]\n' + output.trim());
            if (error.trim()) msgParts.push('[Error Output]\n' + error.trim());
            // If neither output nor error, try to read the process exit code message
            let errorMsg = msgParts.join('\n');
            // If TimeoutError is present in either output or error, prepend it
            const timeoutMatch = /TimeoutError[\s\S]*?(?=\n\s*at|$)/.exec(output + '\n' + error);
            if (timeoutMatch && !errorMsg.startsWith(timeoutMatch[0].trim())) {
              errorMsg = timeoutMatch[0].trim() + '\n' + errorMsg;
            }
            // Always append error from temp file if present
            const tempError = proc.pid !== undefined ? readTempErrorFile(proc.pid) : undefined;
            if (tempError && !errorMsg.includes(tempError)) {
              errorMsg += (errorMsg ? '\n' : '') + tempError;
            }
            if (!errorMsg) errorMsg = 'Test failed (no error output)';
            testResults.push({ name: testName, passed, errorMsg, screenshotPath, durationMs });
          } else {
            testResults.push({ name: testName, passed, screenshotPath, durationMs });
          }
          if (passed) {
            console.log(`${testName}: ${colors.green}pass${colors.reset}`);
          } else {
            allPassed = false;
            console.log(`${testName}: ${colors.red}fail${colors.reset}`);
            // Already printed in real time above, so no need to print again here
          }
          resolve();
        });
      });
    }
  } else {
    // In non-debug mode, run all tests using grouping
    const groups = groupTestsByPage(filteredTests);
    for (const page of Object.keys(groups)) {
      const { header, others } = groups[page];
      let headerPassed = true;
      if (header) {
        let start = Date.now();
        await new Promise<void>((resolve) => {
          const isWin = process.platform === 'win32';
          let proc;
          if (isWin) {
            const cmd = `"${tsNodeBin}" "${header}" --governance=${governanceType}`;
            proc = spawn(cmd, [], {
              stdio: ['ignore', 'pipe', 'pipe'], // Always capture output
              shell: true,
              env: { ...process.env, TEST_FLAGS: testFlags },
            });
          } else {
            proc = spawn(tsNodeBin, [header, `--governance=${governanceType}`], {
              stdio: ['ignore', 'pipe', 'pipe'], // Always capture output
              shell: false,
              env: { ...process.env, TEST_FLAGS: testFlags },
            });
          }
          let output = '';
          let error = '';
          if (proc.stdout) {
            proc.stdout.on('data', (data) => {
              const str = data.toString();
              output += str;
              if (SHOW_REALTIME_LOGS) process.stdout.write(str);
            });
          }
          if (proc.stderr) {
            proc.stderr.on('data', (data) => {
              const str = data.toString();
              error += str;
              if (SHOW_REALTIME_LOGS) process.stderr.write(str);
            });
          }
          proc.on('close', (code) => {
            let testName = path.relative(path.join(__dirname, 'tests'), header).replace(/\\/g, '/');
            testName = testName.replace(/^(token-voting|multisig|erc20|erc721|multisig)\//, '');
            const passed = code === 0;
            let screenshotPath = findScreenshotPath(testName);
            let durationMs = Date.now() - start;
            if (!passed) {
              let msgParts = [];
              if (output.trim()) msgParts.push('[Console Output]\n' + output.trim());
              if (error.trim()) msgParts.push('[Error Output]\n' + error.trim());
              let errorMsg = msgParts.join('\n');
              const timeoutMatch = /TimeoutError[\s\S]*?(?=\n\s*at|$)/.exec(output + '\n' + error);
              if (timeoutMatch && !errorMsg.startsWith(timeoutMatch[0].trim())) {
                errorMsg = timeoutMatch[0].trim() + '\n' + errorMsg;
              }
              const tempError = proc.pid !== undefined ? readTempErrorFile(proc.pid) : undefined;
              if (tempError && !errorMsg.includes(tempError)) {
                errorMsg += (errorMsg ? '\n' : '') + tempError;
              }
              if (!errorMsg) errorMsg = 'Test failed (no error output)';
              testResults.push({ name: testName, passed, errorMsg, screenshotPath, durationMs });
            } else {
              testResults.push({ name: testName, passed, screenshotPath, durationMs });
            }
            if (passed) {
              console.log(`${testName}: ${colors.green}pass${colors.reset}`);
            } else {
              allPassed = false;
              headerPassed = false;
              console.log(`${testName}: ${colors.red}fail${colors.reset}`);
              // Already printed in real time above, so no need to print again here
            }
            resolve();
          });
        });
      }
      if (headerPassed) {
        for (const test of others) {
          let start = Date.now();
          await new Promise<void>((resolve) => {
            const isWin = process.platform === 'win32';
            let proc;
            if (isWin) {
              const cmd = `"${tsNodeBin}" "${test}" --governance=${governanceType}`;
              proc = spawn(cmd, [], {
                stdio: ['ignore', 'pipe', 'pipe'], // Always capture output
                shell: true,
                env: { ...process.env, TEST_FLAGS: testFlags },
              });
            } else {
              proc = spawn(tsNodeBin, [test, `--governance=${governanceType}`], {
                stdio: ['ignore', 'pipe', 'pipe'], // Always capture output
                shell: false,
                env: { ...process.env, TEST_FLAGS: testFlags },
              });
            }
            let output = '';
            let error = '';
            if (proc.stdout) {
              proc.stdout.on('data', (data) => {
                const str = data.toString();
                output += str;
                if (SHOW_REALTIME_LOGS) process.stdout.write(str);
              });
            }
            if (proc.stderr) {
              proc.stderr.on('data', (data) => {
                const str = data.toString();
                error += str;
                if (SHOW_REALTIME_LOGS) process.stderr.write(str);
              });
            }
            proc.on('close', (code) => {
              let testName = path.relative(path.join(__dirname, 'tests'), test).replace(/\\/g, '/');
              testName = testName.replace(/^(token-voting|multisig|erc20|erc721|multisig)\//, '');
              const passed = code === 0;
              let screenshotPath = findScreenshotPath(testName);
              let durationMs = Date.now() - start;
              if (!passed) {
                let msgParts = [];
                if (output.trim()) msgParts.push('[Console Output]\n' + output.trim());
                if (error.trim()) msgParts.push('[Error Output]\n' + error.trim());
                let errorMsg = msgParts.join('\n');
                const timeoutMatch = /TimeoutError[\s\S]*?(?=\n\s*at|$)/.exec(output + '\n' + error);
                if (timeoutMatch && !errorMsg.startsWith(timeoutMatch[0].trim())) {
                  errorMsg = timeoutMatch[0].trim() + '\n' + errorMsg;
                }
                // Always append error from temp file if present
                const tempError = proc.pid !== undefined ? readTempErrorFile(proc.pid) : undefined;
                if (tempError && !errorMsg.includes(tempError)) {
                  errorMsg += (errorMsg ? '\n' : '') + tempError;
                }
                if (!errorMsg) errorMsg = 'Test failed (no error output)';
                testResults.push({ name: testName, passed, errorMsg, screenshotPath, durationMs });
              } else {
                testResults.push({ name: testName, passed, screenshotPath, durationMs });
              }
              if (passed) {
                console.log(`${testName}: ${colors.green}pass${colors.reset}`);
              } else {
                allPassed = false;
                console.log(`${testName}: ${colors.red}fail${colors.reset}`);
                // Already printed in real time above, so no need to print again here
              }
              resolve();
            });
          });
        }
      } else {
        for (const test of others) {
          let testName = path.relative(path.join(__dirname, 'tests'), test).replace(/\\/g, '/');
          testName = testName.replace(/^(token-voting|multisig|erc20|erc721|multisig)\//, '');
          testResults.push({ name: testName, passed: false, errorMsg: 'Skipped due to header-loads failure.' });
          console.log(`${testName}: ${colors.red}skipped (header-loads failed)${colors.reset}`);
        }
      }
    }
  }
  // Write test results summary as HTML
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
  // Format total run time: show in minutes if >= 60s
  let totalRunTimeStr = '';
  const totalSeconds = totalDuration / 1000;
  if (totalSeconds >= 60) {
    totalRunTimeStr = (totalSeconds / 60).toFixed(1) + ' min';
  } else {
    totalRunTimeStr = totalSeconds.toFixed(2) + 's';
  }
  let html = `<!DOCTYPE html>\n<html lang='en'>\n<head>\n<meta charset='UTF-8'>\n<title>Test Results Summary</title>\n<style>\nbody { font-family: Arial, sans-serif; background: #fafbfc; color: #222; }\ntable { border-collapse: collapse; width: 100%; margin-top: 1em; }\nth, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }\nth { background: #f3f3f3; }\n.pass { color: #228B22; font-weight: bold; }\n.fail { color: #B22222; font-weight: bold; }\n.skipped { color: #b59a00; font-weight: bold; }\ntr:nth-child(even) { background: #f9f9f9; }\ntr.data-row:hover { background: #e0eaff !important; }\n.bar-container { width: 100%; height: 24px; background: #eee; border-radius: 6px; overflow: hidden; margin: 18px 0 10px 0; border: 1px solid #ccc; display: flex; }\n.bar-pass { background: #228B22; height: 100%; }\n.bar-fail { background: #B22222; height: 100%; }\n.bar-skipped { background: #b59a00; height: 100%; }\n.error-link { color: #0074d9; cursor: pointer; text-decoration: underline; font-size: 0.95em; margin-left: 8px; }\n.error-details { display: none; color: #B22222; font-size: 0.95em; background: #fff8f8; border: 1px solid #f3cccc; border-radius: 4px; margin-top: 4px; padding: 8px; white-space: pre-wrap; }\n</style>\n<script>\nfunction toggleError(id) {\n  var details = document.getElementById('error-details-' + id);\n  var link = document.getElementById('error-link-' + id);\n  if (details.style.display === 'block') {\n    details.style.display = 'none';\n    link.textContent = '(show error)';\n  } else {\n    details.style.display = 'block';\n    link.textContent = '(hide error)';\n  }\n}\n</script>\n</head>\n<body>\n<h2>Test Results Summary</h2>\n<p><b>Timestamp:</b> ${timestamp}</p>\n<p><b>Total run time:</b> ${totalRunTimeStr}</p>\n<p><b>${passedCount}/${totalCount} tests passed</b></p>\n<div class='bar-container'>\n  <div class='bar-pass' style='width:${percentPassed}%' title='Passed: ${passedCount}'></div>\n  <div class='bar-fail' style='width:${percentFailed}%' title='Failed: ${failedCount}'></div>\n  <div class='bar-skipped' style='width:${percentSkipped}%' title='Skipped: ${skippedCount}'></div>\n</div>\n<table>\n<thead><tr><th>Test Name</th><th>Result</th><th>Run Time</th><th>Screenshot</th></tr></thead>\n<tbody>\n`;
  let errorId = 0;
  for (const r of testResults) {
    let resultClass = r.passed ? 'pass' : r.errorMsg === 'Skipped due to header-loads failure.' ? 'skipped' : 'fail';
    let resultText = r.passed ? 'PASS' : r.errorMsg === 'Skipped due to header-loads failure.' ? 'SKIPPED' : 'FAIL';
    let runTime = '';
    if (typeof r.durationMs === 'number') {
      const seconds = r.durationMs / 1000;
      if (seconds >= 60) {
        runTime = (seconds / 60).toFixed(1) + ' min';
      } else {
        runTime = seconds.toFixed(2) + 's';
      }
    }
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

  // Open the summary in the default browser (macOS: 'open', Windows: 'cmd /c start "" <file>', Linux: 'xdg-open')
  // Only open the summary if not running as part of multi-governance (SCREENSHOTS_DIR not set)
  if (!process.env.SCREENSHOTS_DIR) {
    if (process.platform === 'win32') {
      require('child_process').spawn('cmd', ['/c', 'start', '', summaryPath], { stdio: 'ignore', detached: true });
    } else {
      const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      require('child_process').spawn(openCmd, [summaryPath], { stdio: 'ignore', detached: true });
    }
  }

  process.exit(allPassed ? 0 : 1);
})();
