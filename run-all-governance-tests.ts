// Run all governance types in sequence and aggregate results into a single summary
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const governanceTypes = ['erc20', 'erc721', 'multisig'];
const resultsDir = path.join(process.cwd(), 'test-results');
const summaryPath = path.join(resultsDir, 'test-results-summary.html');

async function runAll() {
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
  for (const governanceType of governanceTypes) {
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
        let html = '';
        if (fs.existsSync(summaryPath)) {
          html = fs.readFileSync(summaryPath, 'utf8');
          // Only patch screenshot links that do not already start with the governanceType
          const governanceTypeRegex = new RegExp(`href='screenshots/(?!${governanceType}/)`, 'g');
          html = html.replace(governanceTypeRegex, `href='screenshots/${governanceType}/`);
        }
        // Extract stats from the HTML for summary
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
  </head><body>\n${summarySection}\n${allSummaries.join('<hr style=\"margin:2em 0\">')}\n</body></html>`;
  fs.writeFileSync(summaryPath, combinedHtml);
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
