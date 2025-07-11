// Unified test runner - handles both single governance and all governance types
// Robust argument parsing: collect CLI args from process.argv, npm_config_argv, and npm_lifecycle_script
function getAllCliArgs(): string[] {
  const args: string[] = [];
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
import { maxConcurrency } from '../config/test-settings';
import * as path from 'path';
import * as fs from 'fs';
import { generateTestSummary, generateCombinedSummary, TestResult } from './test-summary';
const os = require('os');
const tsNodeBin = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'ts-node.cmd' : 'ts-node');

// Declare resultsDir at the top for use throughout the file
const resultsDir = path.join(process.cwd(), 'test-results');

// Check if this should run all governance types (default behavior)
const debugMode = argv.some(arg => arg === '--debug' || arg === 'debug');
const governanceArg = argv.find(arg => arg.startsWith('--governance='));
const singleGovernanceMode = !!governanceArg;

// If not in single governance mode, run all governance types (including debug mode)
const runAllGovernanceTypes = !singleGovernanceMode;

if (runAllGovernanceTypes) {
  runAllGovernanceTests();
} else {
  runSingleGovernanceTests();
}

async function runAllGovernanceTests() {
  const governanceTypes = ['erc20', 'erc721', 'multisig'];
  const wallClockStart = Date.now();
  
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  
  let allPassed = true;
  let firstTimestamp = '';
  let totalDuration = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalCount = 0;
  
  // Store results for each governance type
  const resultsByGov: Record<string, Record<string, { result: string, runTime: string, screenshot: string }>> = {};
  const allTestNames = new Set<string>();
  const allSummaries: string[] = [];
  
  for (const governanceType of governanceTypes) {
    resultsByGov[governanceType] = {};
    console.log(`\n===== Running tests for governance: ${governanceType} =====`);
    
    const screenshotsDir = path.join(resultsDir, 'screenshots', governanceType);
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    
    // Clear existing screenshots
    for (const file of fs.readdirSync(screenshotsDir)) {
      if (file.endsWith('.png')) fs.unlinkSync(path.join(screenshotsDir, file));
    }
    
    await new Promise((resolve) => {
      const args = ['src/run-tests.ts', `--governance=${governanceType}`];
      if (debugMode) args.push('--debug');
      
      const proc = spawn('npx', ['ts-node', ...args], {
        stdio: 'inherit',
        shell: true,
        env: { 
          ...process.env, 
          SCREENSHOTS_DIR: screenshotsDir,
          SKIP_MARKDOWN: 'true' // Use environment variable instead of command line flag
        },
      });
      
      proc.on('close', (code) => {
        // Parse the HTML summary for this governance type to extract test results for markdown
        const htmlPath = path.join(resultsDir, 'test-results-summary.html');
        let html = '';
        if (fs.existsSync(htmlPath)) {
          html = fs.readFileSync(htmlPath, 'utf8');
          
          // Parse test results from HTML immediately before it gets overwritten
          const tableRowRegex = /<tr class='data-row'><td>(.*?)<\/td><td class='[^']*'>([^<]+)<\/td><td>([^<]*)<\/td><td>.*?<\/td><\/tr>/g;
          let match;
          while ((match = tableRowRegex.exec(html)) !== null) {
            const testName = match[1].replace(/<span.*?<\/span>/g, '').trim(); // Remove error link spans
            const result = match[2] === 'PASS' ? '✅' : match[2] === 'SKIPPED' ? '⚠️ Skipped' : '❌';
            const runTime = match[3];
            const screenshot = 'Available'; // We know screenshots exist since HTML is generated
            
            allTestNames.add(testName);
            resultsByGov[governanceType][testName] = {
              result,
              runTime,
              screenshot
            };
          }
          
          // Store HTML for combined summary (keep existing HTML generation logic)
          const governanceTypeRegex = new RegExp(`href='screenshots/(?!${governanceType}/)`, 'g');
          html = html.replace(governanceTypeRegex, `href='screenshots/${governanceType}/`);
          html = html.replace(/id='error-link-(\d+)'/g, `id='${governanceType}-error-link-$1'`)
                     .replace(/id='error-details-(\d+)'/g, `id='${governanceType}-error-details-$1'`)
                     .replace(/onclick='toggleError\((\d+)\)'/g, `onclick="toggleError('${governanceType}', $1)"`);
          
          allSummaries.push(`<h2>Results for governance: ${governanceType}</h2>\n` + html);
        }
        
        const timestampMatch = html.match(/<b>Timestamp:<\/b> ([^<]+)<\/p>/);
        if (!firstTimestamp && timestampMatch) firstTimestamp = timestampMatch[1];
        
        const durationMatch = html.match(/<b>Total run time:<\/b> ([^<]+)<\/p>/);
        if (durationMatch) {
          const val = durationMatch[1];
          if (val.includes('min')) totalDuration += parseFloat(val) * 60;
          else if (val.includes('s')) totalDuration += parseFloat(val);
        }
        
        const passMatch = html.match(/<b>(\d+)[/](\d+) tests passed<\/b>/);
        if (passMatch) {
          totalPassed += parseInt(passMatch[1]);
          totalCount += parseInt(passMatch[2]);
        }
        
        const failMatch = html.match(/title='Failed: (\d+)'/);
        if (failMatch) totalFailed += parseInt(failMatch[1]);
        
        const skipMatch = html.match(/title='Skipped: (\d+)'/);
        if (skipMatch) totalSkipped += parseInt(skipMatch[1]);
        
        if (code !== 0) allPassed = false;
        resolve(undefined);
      });
    });
  }
  
  // Generate combined summary
  await generateCombinedSummary(
    resultsByGov,
    allTestNames,
    wallClockStart,
    firstTimestamp,
    totalPassed,
    totalCount,
    totalFailed,
    totalSkipped,
    totalDuration,
    resultsDir,
    allSummaries
  );
  
  process.exit(allPassed ? 0 : 1);
}

async function runSingleGovernanceTests() {
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
    // Remove any leading governance type from testName to avoid double folders
    let cleanName = testName.replace(/^(token-voting|multisig|erc20|erc721|multisig)\//, '');
    const screenshotRelPath = cleanName.replace(/\\/g, '/').replace(/\.test\.ts$/, '.png');
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

  // In debug mode, limit to first 5 tests
  if (debugMode) {
    filteredTests = filteredTests.slice(0, 5);
  }

  // Always capture output for summary, but also print in real time
  const SHOW_REALTIME_LOGS = true;
  const wallClockStart = Date.now();

  let allPassed = true;
  const testResults: TestResult[] = [];

  // Parallel worker pool for test files
  const queue = [...filteredTests];
  let running = 0;
  
  async function runNext(): Promise<void> {
    if (queue.length === 0) return;
    const testFile = queue.shift();
    if (!testFile) return;
    running++;
    let start = Date.now();
    
    await new Promise<void>((resolve) => {
      const isWin = process.platform === 'win32';
      let proc;
      if (isWin) {
        const cmd = `"${tsNodeBin}" "${testFile}" --governance=${governanceType}`;
        proc = spawn(cmd, [], {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
          env: { ...process.env, TEST_FLAGS: testFlags },
        });
      } else {
        proc = spawn(tsNodeBin, [testFile, `--governance=${governanceType}`], {
          stdio: ['ignore', 'pipe', 'pipe'],
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
          if (SHOW_REALTIME_LOGS && !debugMode) process.stdout.write(str);
        });
      }
      
      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          const str = data.toString();
          error += str;
          if (SHOW_REALTIME_LOGS && !debugMode) process.stderr.write(str);
        });
      }
      
      proc.on('close', (code) => {
        let testName = path.relative(path.join(__dirname, '..', 'tests'), testFile).replace(/\\/g, '/');
        testName = testName.replace(/^(token-voting|multisig|erc20|erc721|multisig)\//, '');
        const passed = code === 0;
        let screenshotPath = findScreenshotPath(testName);
        let durationMs = Date.now() - start;
        
        // In debug mode, print all buffered output for this test, then the result line
        if (debugMode) {
          if (output.trim()) {
            process.stdout.write(`\n[${testName}]\n` + output);
          }
          if (error.trim()) {
            process.stderr.write(`\n[${testName} ERROR]\n` + error);
          }
        }
        
        if (passed) {
          console.log(`${testName}: ${colors.green}pass${colors.reset}`);
        } else {
          allPassed = false;
          console.log(`${testName}: ${colors.red}fail${colors.reset}`);
        }
        
        if (!passed) {
          let msgParts: string[] = [];
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
        
        running--;
        resolve();
      });
    });
    
    await runNext();
  }
  
  // Start up to maxConcurrency workers
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(maxConcurrency, filteredTests.length); i++) {
    workers.push(runNext());
  }
  await Promise.all(workers);

  // Generate test results summary
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${pad(now.getMonth()+1)}/${pad(now.getDate())}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  
  // Wall-clock total run time
  const wallClockEnd = Date.now();
  const wallClockDuration = wallClockEnd - wallClockStart;
  let totalRunTimeStr = '';
  const wallClockSeconds = wallClockDuration / 1000;
  if (wallClockSeconds >= 60) {
    totalRunTimeStr = (wallClockSeconds / 60).toFixed(1) + ' min';
  } else {
    totalRunTimeStr = wallClockSeconds.toFixed(2) + 's';
  }

  generateTestSummary(testResults, {
    resultsDir,
    governanceType,
    timestamp,
    totalRunTimeStr,
    wallClockDuration,
    openSummary: !process.env.SCREENSHOTS_DIR, // Only open if not called from multi-governance run
    skipMarkdown: !!process.env.SKIP_MARKDOWN // Skip markdown when SKIP_MARKDOWN env var is set
  });

  process.exit(allPassed ? 0 : 1);
}
