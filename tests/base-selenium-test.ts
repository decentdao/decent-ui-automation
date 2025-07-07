import { Builder, By, until, WebDriver, WebElement, Locator } from 'selenium-webdriver';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class BaseSeleniumTest {
  pageName: string;
  screenshotName?: string;
  driver: WebDriver | null;
  screenshotDir: string;
  screenshotPath?: string;


  constructor(pageName: string, screenshotName?: string) {
    this.pageName = pageName;
    this.screenshotName = screenshotName;
    this.driver = null;
    // Prefer SCREENSHOTS_DIR env if set, else use default
    const envScreenshotsDir = process.env.SCREENSHOTS_DIR;
    if (envScreenshotsDir) {
      // Always append pageName so screenshots are grouped by test type under the governance dir
      this.screenshotDir = path.join(envScreenshotsDir, pageName);
    } else {
      this.screenshotDir = path.join(process.cwd(), `test-results/screenshots/${pageName}`);
    }
    if (!fs.existsSync(this.screenshotDir)) fs.mkdirSync(this.screenshotDir, { recursive: true });
    this.screenshotPath = undefined;
  }

  getScreenshotName(): string {
    if (this.screenshotName) {
      // Only use the part after the pageName, e.g. content-loads
      const parts = this.screenshotName.split(/[\\/]/); // cross-platform
      return parts.length > 1 ? parts[1] : parts[0];
    }
    try {
      const err = new Error();
      const stack = err.stack?.split("\n") || [];
      for (const line of stack) {
        // cross-platform: match both / and \\ in stack traces
        const match = line.match(/\((.*tests[\\/](.*)\.test\.ts):/);
        if (match) {
          const parts = match[2].split(/[\\/]/); // cross-platform
          return parts[parts.length - 1];
        }
      }
    } catch {}
    return 'screenshot';
  }

  async start() {
    const chrome = require('selenium-webdriver/chrome');
    const options = new chrome.Options();
    options.addArguments('--ignore-certificate-errors');
    options.addArguments('--log-level=3'); // Suppress most Chrome logs

    // Allow disabling headless mode via CLI or env
    const noHeadless = process.argv.includes('--no-headless') || process.env.NO_HEADLESS === '1' || process.env.NO_HEADLESS === 'true';
    if (!noHeadless) {
      options.addArguments('--headless=new'); // Use new headless mode for CI
    } else {
      console.log('[BaseSeleniumTest] Running in headed (non-headless) mode');
    }

    this.driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    // Set window size to typical desktop resolution to avoid mobile layout
    await this.driver.manage().window().setRect({ width: 1920, height: 1080 });
  }

  async saveScreenshot() {
    if (this.driver) {
      const screenshotPath = path.join(this.screenshotDir, `${this.getScreenshotName()}.png`);
      const screenshotDir = path.dirname(screenshotPath);
      if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
      try {
        const data = await this.driver.takeScreenshot();
        fs.writeFileSync(screenshotPath, data, 'base64');
        this.screenshotPath = screenshotPath;
        await this.flushLogs();
      } catch (err) {
        // Only log errors
        console.error(`[BaseSeleniumTest] Failed to save screenshot:`, err);
        await this.flushLogs();
      }
    }
  }

  async finish(testPassed = false) {
    if (this.driver) {
      try {
        await this.saveScreenshot();
      } catch (err) {
        console.error('[BaseSeleniumTest] Error during saveScreenshot in finish:', err);
      }
      await this.driver.quit();
      // Do not call process.exit here; let the test runner handle process exit
    }
  }

  /**
   * Call this in a test's finally block to ensure proper cleanup and exit code.
   * Exits with code 0 if testPassed, 1 otherwise.
   */
  async finishAndExit(testPassed: boolean) {
    await this.finish(testPassed);
    process.exit(testPassed ? 0 : 1);
  }

  async flushLogs() {
    // Ensures logs are flushed before process exit (for Node.js)
    return new Promise<void>(resolve => {
      if (process.stdout.writableLength === 0) return resolve();
      process.stdout.write('', () => resolve());
    });
  }

  async waitForElement(locator: Locator, timeout = 5000): Promise<WebElement> {
    if (!this.driver) throw new Error('Driver not started');
    return await this.driver.wait(until.elementLocated(locator), timeout);
  }

  async clickElement(locator: Locator, timeout = 5000): Promise<WebElement> {
    const el = await this.waitForElement(locator, timeout);
    await el.click();
    return el;
  }

  async getElementText(locator: Locator, timeout = 5000): Promise<string> {
    const el = await this.waitForElement(locator, timeout);
    return await el.getText();
  }

  async getElementAttribute(locator: Locator, attr: string, timeout = 5000): Promise<string> {
    const el = await this.waitForElement(locator, timeout);
    return await el.getAttribute(attr);
  }

  /**
   * Handles errors in tests: ensures teardown, logs the error, flushes logs, and exits with code 1.
   */
  async handleError(e: any) {
    const tmpErrorPath = path.join(os.tmpdir(), `selenium-test-error-${process.pid}.log`);
    try {
      await this.finish(false); // Ensure browser closes and screenshot is saved
    } catch (teardownErr) {
      console.error('[BaseSeleniumTest] Error during finish in handleError:', teardownErr);
    }
    // Print error stack or message
    let errorText = '';
    if (e instanceof Error) {
      errorText = e.stack || e.message;
      console.error(errorText);
    } else {
      errorText = String(e);
      console.error(errorText);
    }
    // Write error to temp file for parent process to pick up
    try {
      fs.writeFileSync(tmpErrorPath, errorText, 'utf8');
    } catch {}
    await this.flushLogs();
    await new Promise(res => setTimeout(res, 200));
    process.exit(1);
  }

  /**
   * Static runner to wrap test logic, ensuring teardown and error handling for all tests.
   * Usage: BaseSeleniumTest.run(async (test) => { ... })
   */
  static async run(testBody: (test: BaseSeleniumTest) => Promise<void>, testInstance: BaseSeleniumTest) {
    let testPassed = false;
    try {
      await testBody(testInstance);
      testPassed = true;
    } catch (e) {
      try {
        await testInstance.handleError(e);
      } catch (teardownErr) {
        console.error('[BaseSeleniumTest] Error during teardown in handleError:', teardownErr);
        process.exit(1);
      }
      return; // handleError will exit
    }
    try {
      await testInstance.finishAndExit(testPassed);
    } catch (teardownErr) {
      console.error('[BaseSeleniumTest] Error during teardown in finishAndExit:', teardownErr);
      process.exit(testPassed ? 0 : 1);
    }
  }
}
