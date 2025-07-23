// Unified test runner - handles both single governance and all governance types
import { initializeReleaseUrl, getEnvironmentUrl } from '../config/environments';

// Robust argument parsing: collect CLI args from process.argv, npm_config_argv, and npm_lifecycle_script
function getAllCliArgs(): string[] {
  const args: string[] = [];
  
  // 1. process.argv (direct node/ts-node invocation)
  if (process.argv && process.argv.length > 2) {
    args.push(...process.argv.slice(2));
  }
  
  // 2. npm_config_* environment variables (npm run ... -- --flag becomes npm_config_flag=true)
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('npm_config_') && !key.match(/^npm_config_(cache|globalconfig|global_prefix|init_module|local_prefix|node_gyp|noproxy|npm_version|prefix|userconfig|user_agent)$/)) {
      const flagName = key.replace('npm_config_', '');
      const value = process.env[key];
      if (value === 'true') {
        args.push(`--${flagName}`);
      } else if (value && value !== 'false') {
        args.push(`--${flagName}=${value}`);
      }
    }
  });
  
  // 3. npm_config_argv (npm run ... -- ...)
  if (process.env.npm_config_argv) {
    try {
      const npmArgv = JSON.parse(process.env.npm_config_argv);
      if (npmArgv && Array.isArray(npmArgv.original)) {
        // For npm scripts, we want everything after the script name and "--"
        const orig = npmArgv.original;
        const dashDashIndex = orig.indexOf('--');
        if (dashDashIndex !== -1 && dashDashIndex < orig.length - 1) {
          // Take everything after "--"
          args.push(...orig.slice(dashDashIndex + 1));
        }
      }
    } catch {}
  }
  
  // 4. npm_lifecycle_script (sometimes contains the full script line)
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

// Detect if this is a child process to suppress redundant console output
const isChildProcess = argv.some(arg => arg.startsWith('--governance='));

// Check if this should run all governance types (default behavior)
const debugMode = argv.some(arg => arg === '--debug' || arg === 'debug');
const governanceArg = argv.find(arg => arg.startsWith('--governance='));
const testFileArgs = argv.filter(arg => arg.endsWith('.test.ts'));

// Handle --env= argument
const envArg = argv.find(arg => arg.startsWith('--env='));
const testEnv = envArg ? envArg.split('=')[1] : 'develop';

// Handle --base-url= argument (npm converts hyphens to underscores)
const baseUrlArg = argv.find(arg => arg.startsWith('--base-url=') || arg.startsWith('--base_url='));
if (baseUrlArg) {
  process.env.BASE_URL = baseUrlArg.split('=')[1];
  if (!isChildProcess) {
    console.log(`[run-tests] Custom base URL set: ${process.env.BASE_URL}`);
  }
}

// Handle --flags= argument
const flagsArg = argv.find(arg => arg.startsWith('--flags='));
if (flagsArg) {
  process.env.TEST_FLAGS = flagsArg.split('=')[1];
  if (!isChildProcess) {
    console.log(`[run-tests] Feature flags set: ${process.env.TEST_FLAGS}`);
  }
}

// Set TEST_ENV for backward compatibility with existing code
process.env.TEST_ENV = testEnv;
if (testEnv !== 'develop') {
  console.log(`[run-tests] Environment set to: ${testEnv}`);
}

// Display base URL info once at startup
let baseUrlDisplayed = false;
function displayBaseUrlOnce() {
  if (!baseUrlDisplayed && !isChildProcess) {
    const { displayBaseUrlInfo } = require('../tests/test-helpers');
    const { env, baseUrl, source } = displayBaseUrlInfo();
    baseUrlDisplayed = true;
    return { env, baseUrl, source };
  }
  // For subsequent calls or child processes, just return the info without console output
  const { getEnv, getBaseUrl } = require('../tests/test-helpers');
  const env = getEnv();
  const baseUrl = getBaseUrl();
  const source = process.env.BASE_URL ? 'BASE_URL override' : `${env} environment`;
  return { env, baseUrl, source };
}

// If a specific test file is provided, determine governance type from path and use single governance mode
let singleGovernanceMode = !!governanceArg;
if (!singleGovernanceMode && testFileArgs.length > 0) {
  // Auto-detect governance type from test file path
  const testFile = testFileArgs[0];
  if (testFile.includes('multisig/') || testFile.includes('multisig\\') || testFile.includes('/multisig/') || testFile.includes('\\multisig\\')) {
    argv.push('--governance=multisig');
    singleGovernanceMode = true;
  } else if (testFile.includes('token-voting/') || testFile.includes('token-voting\\') || testFile.includes('/token-voting/') || testFile.includes('\\token-voting\\')) {
    argv.push('--governance=erc20');
    singleGovernanceMode = true;
  }
}

// If not in single governance mode, run all governance types (including debug mode)
const runAllGovernanceTypes = !singleGovernanceMode;

(async () => {
  if (runAllGovernanceTypes) {
    await runAllGovernanceTests();
  } else {
    await runSingleGovernanceTests();
  }
})();

async function runAllGovernanceTests() {
  // Initialize release URL if running in release mode
  if (process.env.TEST_ENV === 'release') {
    console.log('Initializing release environment...');
    try {
      await initializeReleaseUrl();
      // Store the release URL in an environment variable for child processes
      const releaseUrl = await getEnvironmentUrl('release');
      process.env.RELEASE_URL = releaseUrl;
      console.log(`[run-tests] Release URL stored for child processes: ${releaseUrl}`);
    } catch (error) {
      console.error('Failed to initialize release environment:', error);
      process.exit(1);
    }
  }

  // Display which base URL will be used
  const { env, baseUrl, source } = displayBaseUrlOnce();

  const governanceTypes = ['erc20', 'erc721', 'multisig'];
  const wallClockStart = Date.now();
  
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  
  let allPassed = true;
  let firstTimestamp = '';
  let totalDuration = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalCrashed = 0;
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
            const result = match[2] === 'PASS' ? '✅' : match[2] === 'SKIPPED' ? '⚠️ Skipped' : match[2] === 'NO RUN' ? '⚪ NO RUN' : '❌';
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
        
        const crashMatch = html.match(/title='No Run: (\d+)'/);
        if (crashMatch) totalCrashed += parseInt(crashMatch[1]);
        
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
    totalCrashed,
    totalSkipped,
    totalDuration,
    resultsDir,
    allSummaries,
    baseUrl
  );
  
  process.exit(allPassed ? 0 : 1);
}

async function runSingleGovernanceTests() {
  // Initialize release URL if running in release mode
  if (process.env.TEST_ENV === 'release') {
    console.log('Initializing release environment...');
    try {
      await initializeReleaseUrl();
      // Store the release URL in an environment variable for child processes
      const releaseUrl = await getEnvironmentUrl('release');
      process.env.RELEASE_URL = releaseUrl;
      console.log(`[run-tests] Release URL stored for child processes: ${releaseUrl}`);
    } catch (error) {
      console.error('Failed to initialize release environment:', error);
      process.exit(1);
    }
  }

  // Display which base URL will be used
  const { env, baseUrl, source } = displayBaseUrlOnce();

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
    const list = fs.readdirSync(dir).sort(); // Sort directory contents alphabetically
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(findTestFiles(filePath));
      } else if (file.endsWith('.test.ts')) {
        results.push(filePath);
      }
    });
    
    // Custom sort: group by directory first, then by filename within each directory
    return results.sort((a, b) => {
      const dirA = path.dirname(a);
      const dirB = path.dirname(b);
      const fileA = path.basename(a);
      const fileB = path.basename(b);
      
      // First compare directories
      if (dirA !== dirB) {
        return dirA.localeCompare(dirB);
      }
      
      // If same directory, compare filenames
      return fileA.localeCompare(fileB);
    });
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

  function detectCrash(output: string, error: string): boolean {
    const crashPatterns = [
      /Fatal error/i,
      /unreachable code/i,
      /Segmentation fault/i,
      /out of memory/i,
      /SIGKILL/i,
      /SIGTERM/i
    ];
    
    const combinedOutput = (output + '\n' + error).toLowerCase();
    
    // Check for known crash patterns
    if (crashPatterns.some(pattern => pattern.test(combinedOutput))) {
      return true;
    }
    
    // Check for process death with minimal output (likely infrastructure failure)
    const meaningfulOutput = output.trim() + error.trim();
    if (meaningfulOutput.length < 100 && !meaningfulOutput.includes('PASS') && !meaningfulOutput.includes('FAIL') && !meaningfulOutput.includes('test')) {
      return true;
    }
    
    return false;
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
    gray: '\x1b[90m',
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
    filteredTests = testFileArgs.map(f => {
      if (path.isAbsolute(f)) {
        return f;
      }
      // If it doesn't start with 'tests/', prepend it
      if (!f.startsWith('tests/') && !f.startsWith('tests\\')) {
        f = path.join('tests', f);
      }
      return path.join(process.cwd(), f);
    });
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
        const crashed = !passed && detectCrash(output, error);
        let durationMs = Date.now() - start;
        
        // Check if a screenshot was actually saved
        const screenshotPath = findScreenshotPath(testName);
        
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
        } else if (crashed) {
          allPassed = false;
          console.log(`${testName}: ${colors.gray}NO RUN${colors.reset}`);
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
          
          if (!errorMsg) errorMsg = crashed ? 'Test process crashed (no test execution)' : 'Test failed (no error output)';
          testResults.push({ name: testName, passed, crashed, errorMsg, screenshotPath, durationMs });
        } else {
          testResults.push({ name: testName, passed, crashed: false, screenshotPath, durationMs });
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

  // Sort test results by directory first, then by filename within each directory
  testResults.sort((a, b) => {
    const dirA = path.dirname(a.name);
    const dirB = path.dirname(b.name);
    const fileA = path.basename(a.name);
    const fileB = path.basename(b.name);
    
    // First compare directories
    if (dirA !== dirB) {
      return dirA.localeCompare(dirB);
    }
    
    // If same directory, compare filenames
    return fileA.localeCompare(fileB);
  });

  generateTestSummary(testResults, {
    resultsDir,
    governanceType,
    timestamp,
    totalRunTimeStr,
    wallClockDuration,
    baseUrl,
    openSummary: !process.env.SCREENSHOTS_DIR, // Only open if not called from multi-governance run
    skipMarkdown: !!process.env.SKIP_MARKDOWN // Skip markdown when SKIP_MARKDOWN env var is set
  });

  process.exit(allPassed ? 0 : 1);
}
