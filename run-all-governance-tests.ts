// Run all governance types in sequence and aggregate results into a single summary
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const governanceTypes = ['erc20', 'erc721', 'multisig'];
const resultsDir = path.join(process.cwd(), 'test-results');
const summaryPath = path.join(resultsDir, 'test-results-summary.html');
const mdSummaryPath = path.join(resultsDir, 'test-results-summary.md');

async function runAll() {
  const wallClockStart = Date.now();
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  let allSummaries: string[] = [];
  let allPassed = true;
  let runStart = Date.now();
  let firstTimestamp = '';
  let totalDuration = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalCount = 0;
  // For Markdown summary
  let mdTotalPassed = 0;
  let mdTotalCount = 0;
  let mdTotalDuration = 0;
  // Store results for each governance type
  const resultsByGov: Record<string, Record<string, { result: string, runTime: string, screenshot: string }>> = {};
  const allTestNames = new Set<string>();
  for (const governanceType of governanceTypes) {
    resultsByGov[governanceType] = {};
    console.log(`\n===== Running tests for governance: ${governanceType} =====`);
    const screenshotsDir = path.join(resultsDir, 'screenshots', governanceType);
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    for (const file of fs.readdirSync(screenshotsDir)) {
      if (file.endsWith('.png')) fs.unlinkSync(path.join(screenshotsDir, file));
    }
    await new Promise((resolve) => {
      const proc = spawn('npx', ['ts-node', 'run-all-tests.ts', `--governance=${governanceType}`], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, SCREENSHOTS_DIR: screenshotsDir },
      });
      proc.on('close', (code) => {
        // Parse the .md summary for this governance type
        const mdPath = path.join(resultsDir, 'test-results-summary.md');
        let md = '';
        if (fs.existsSync(mdPath)) {
          md = fs.readFileSync(mdPath, 'utf8');
        }
        // Parse the table rows (robust: find lines between header and first non-table line)
        const lines = md.split('\n');
        let inTable = false;
        for (const line of lines) {
          if (line.startsWith('| Test Name ')) {
            inTable = true;
            continue;
          }
          if (inTable && line.startsWith('|---')) {
            continue;
          }
          if (inTable) {
            if (line.trim().startsWith('|') && line.includes('|')) {
              const cols = line.split('|').map(s => s.trim());
              if (cols.length >= 5) {
                const testName = cols[1];
                allTestNames.add(testName);
                resultsByGov[governanceType][testName] = {
                  result: cols[2],
                  runTime: cols[3],
                  screenshot: cols[4]
                };
              }
            } else {
              // End of table
              break;
            }
          }
        }
        // Extract stats from the HTML for summary
        let html = '';
        if (fs.existsSync(summaryPath)) {
          html = fs.readFileSync(summaryPath, 'utf8');
          // Only patch screenshot links that do not already start with the governanceType
          const governanceTypeRegex = new RegExp(`href='screenshots/(?!${governanceType}/)`, 'g');
          html = html.replace(governanceTypeRegex, `href='screenshots/${governanceType}/`);
          // Patch error toggle IDs to be unique per governance type
          html = html.replace(/id="error-link-(\d+)"/g, `id="${governanceType}-error-link-$1"`)
                     .replace(/id="error-details-(\d+)"/g, `id="${governanceType}-error-details-$1"`)
                     .replace(/toggleError\((\d+)\)/g, `toggleError('${governanceType}', $1)`);
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
        allSummaries.push(`<h2>Results for governance: ${governanceType}</h2>\n` + html);
        if (code !== 0) allPassed = false;
        resolve(undefined);
      });
    });
  }
  // Cumulative summary section
  const percentPassed = totalCount ? (totalPassed / totalCount) * 100 : 0;
  const percentFailed = totalCount ? (totalFailed / totalCount) * 100 : 0;
  const percentSkipped = totalCount ? (totalSkipped / totalCount) * 100 : 0;
  let totalRunTimeStr = '';
  if (totalDuration >= 60) {
    totalRunTimeStr = (totalDuration / 60).toFixed(1) + ' min';
  } else {
    totalRunTimeStr = totalDuration.toFixed(2) + 's';
  }
  const summarySection = `
  <h2>All Governance Test Results Summary</h2>
  <p><b>Start Timestamp:</b> ${firstTimestamp}</p>
  <p><b>Cumulative run time:</b> ${totalRunTimeStr}</p>
  <p><b>${totalPassed}/${totalCount} tests passed</b></p>
  <div class='bar-container'>
    <div class='bar-pass' style='width:${percentPassed}%' title='Passed: ${totalPassed}'></div>
    <div class='bar-fail' style='width:${percentFailed}%' title='Failed: ${totalFailed}'></div>
    <div class='bar-skipped' style='width:${percentSkipped}%' title='Skipped: ${totalSkipped}'></div>
  </div>
  `;
  // Combine all summaries into one HTML file
  const combinedHtml = `<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><title>All Governance Test Results</title>
  <style>
  body { font-family: Arial, sans-serif; background: #fafbfc; color: #222; }
  .bar-container { width: 100%; height: 24px; background: #eee; border-radius: 6px; overflow: hidden; margin: 18px 0 10px 0; border: 1px solid #ccc; display: flex; }
  .bar-pass { background: #228B22; height: 100%; }
  .bar-fail { background: #B22222; height: 100%; }
  .bar-skipped { background: #b59a00; height: 100%; }
  </style>
  <script>
  function toggleError(gov, id) {
    var details = document.getElementById(gov + '-error-details-' + id);
    var link = document.getElementById(gov + '-error-link-' + id);
    if (details.style.display === 'block') {
      details.style.display = 'none';
      link.textContent = '(show error)';
    } else {
      details.style.display = 'block';
      link.textContent = '(hide error)';
    }
  }
  </script>
  </head><body>\n${summarySection}\n${allSummaries.join('<hr style=\"margin:2em 0\">')}\n</body></html>`;
  fs.writeFileSync(summaryPath, combinedHtml);
  // Combine all markdown summaries into a single table with governance columns
  const govHeaders = governanceTypes.map(g => g.toUpperCase());
  let combinedMd = `# 🧪 UI Automation Test Results\n\n> 📸 Download all screenshots from the workflow artifacts above (find the automation check and navigate to 'Upload Test Results').\n\n# Extract the test results file and open the html summary to quickly review results and screenshots.\n\n`;
  combinedMd += `**Legend:**\n`;
  combinedMd += `\n- Each cell shows: result (✅/❌), run time, and screenshot status.\n`;
  combinedMd += `- Example: \`✅ (2.29s, Available)\` means the test passed, took 2.29 seconds, and a screenshot is available.\n`;
  combinedMd += `- \`N/A\` means the test was not run for that governance type.\n\n`;
  combinedMd += `| Test Name | ${govHeaders.join(' | ')} |\n|---|${govHeaders.map(()=>'---').join('|')}|\n`;
  const sortedTestNames = Array.from(allTestNames).sort();
  for (const testName of sortedTestNames) {
    const row = [testName];
    let testPassedCount = 0;
    let testRunCount = 0;
    let testTotalDuration = 0;
    for (const gov of governanceTypes) {
      const r = resultsByGov[gov][testName];
      if (r) {
        let cell = `${r.result}`;
        if (r.runTime) cell += ` (${r.runTime}`;
        if (r.screenshot && r.screenshot !== '') cell += `, ${r.screenshot}`;
        cell += ')';
        row.push(cell);
        testRunCount++;
        if (r.result.includes('✅')) testPassedCount++;
        // Parse duration (e.g., '2.71s' or '1.2 min')
        if (r.runTime) {
          if (r.runTime.includes('min')) testTotalDuration += parseFloat(r.runTime) * 60;
          else if (r.runTime.includes('s')) testTotalDuration += parseFloat(r.runTime);
        }
      } else {
        row.push('N/A');
      }
    }
    mdTotalPassed += testPassedCount;
    mdTotalCount += testRunCount;
    mdTotalDuration += testTotalDuration;
    combinedMd += `| ${row.join(' | ')} |\n`;
  }
  // Add summary above the table using wall-clock time and a plain pipe separator
  const wallClockEnd = Date.now();
  const wallClockDuration = wallClockEnd - wallClockStart;
  let wallClockRunTimeStr = '';
  if (wallClockDuration >= 60 * 1000) {
    wallClockRunTimeStr = (wallClockDuration / 1000 / 60).toFixed(1) + ' min';
  } else {
    wallClockRunTimeStr = (wallClockDuration / 1000).toFixed(2) + 's';
  }
  const mdSummaryStats = `**Summary:** ${mdTotalPassed}/${mdTotalCount} tests passed | Total runtime: ${wallClockRunTimeStr}\n\n`;
  combinedMd = combinedMd.replace('# 🧪 UI Automation Test Results\n\n', `# 🧪 UI Automation Test Results\n\n${mdSummaryStats}`);
  combinedMd += `\n---\n*Generated by UI automation workflow.*\n`;
  fs.writeFileSync(mdSummaryPath, combinedMd);
  // Open the combined summary
  if (process.platform === 'win32') {
    require('child_process').spawn('cmd', ['/c', 'start', '', summaryPath], { stdio: 'ignore', detached: true });
  } else {
    const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    require('child_process').spawn(openCmd, [summaryPath], { stdio: 'ignore', detached: true });
  }
  process.exit(allPassed ? 0 : 1);
}

runAll();
