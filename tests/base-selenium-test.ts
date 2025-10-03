import { Builder, By, until, WebDriver, WebElement, Locator } from 'selenium-webdriver';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { defaultElementWaitTime } from './test-helpers';
import { DebugConfigManager, DebugConfig } from '../src/debug/debug-config';
import { DebugLogger } from '../src/debug/debug-logger';
import { DebugHelper } from '../src/debug/debug-helper';

export class BaseSeleniumTest {
  pageName: string;
  screenshotName?: string;
  driver: WebDriver | null;
  screenshotDir: string;
  screenshotPath?: string;
  // Debug functionality
  private debugConfig: DebugConfig;
  private debugLogger?: DebugLogger;
  public debugHelper?: DebugHelper;

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

    // Initialize debug functionality
    this.debugConfig = DebugConfigManager.getInstance().getConfig();
    
    if (this.debugConfig.enabled) {
      this.debugLogger = new DebugLogger(pageName);
      console.log(`[DEBUG] Debug mode enabled for test: ${pageName}`);
    }
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

  /**
   * Check if browser session is still alive
   * Useful for preventing errors when browser has crashed or been closed
   */
  private async isBrowserSessionAlive(): Promise<boolean> {
    if (!this.driver) return false;
    
    try {
      await Promise.race([
        this.driver.getCurrentUrl(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Session check timeout')), 1000))
      ]);
      return true;
    } catch (sessionError) {
      // Silently handle all session errors (including ECONNREFUSED)
      return false;
    }
  }

  /**
   * Clean up Chrome temporary files and directories
   * Simple cleanup without complex temp directory management
   */
  private cleanupChromeTemp(): void {
    try {
      const tempDir = os.tmpdir();
      const patterns = [
        /^scoped_dir\d+_\d+$/,
        /^\.org\.chromium\.Chromium\./,
        /^chrome_/,
        /^\.com\.google\.Chrome\./
      ];

      const entries = fs.readdirSync(tempDir);
      for (const entry of entries) {
        if (patterns.some(pattern => pattern.test(entry))) {
          const fullPath = path.join(tempDir, entry);
          try {
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(fullPath);
            }
          } catch (err) {
            // Ignore errors for files/dirs that might be in use
          }
        }
      }
    } catch (err) {
      // Silently ignore cleanup errors - not critical for test operation
    }
  }



  async start() {
    const chrome = require('selenium-webdriver/chrome');
    const options = new chrome.Options();
    
    // Basic Chrome options
    options.addArguments('--ignore-certificate-errors');
    options.addArguments('--log-level=3');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.addArguments('--disable-extensions');
    
    // Allow disabling headless mode via CLI or env
    const noHeadless = process.argv.includes('--no-headless') || process.env.NO_HEADLESS === '1' || process.env.NO_HEADLESS === 'true';
    if (!noHeadless) {
      options.addArguments('--headless=new');
    }

    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    await this.driver.manage().window().setRect({ width: 1920, height: 1400 });

    // Initialize debug helper and log test start
    if (this.debugConfig.enabled) {
      this.debugHelper = new DebugHelper(this.driver, this.debugLogger!);
      await this.debugLog('test_start', { action: 'Browser started', success: true });
    }
  }

  async saveScreenshot(timeoutMs = 10000) {
    if (this.driver) {
      // Check if browser session is still alive before attempting screenshot
      if (!await this.isBrowserSessionAlive()) {
        return; // Silently skip if browser session is not available
      }
      
      const screenshotPath = path.join(this.screenshotDir, `${this.getScreenshotName()}.png`);
      const screenshotDir = path.dirname(screenshotPath);
      if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
      try {
        const data = await Promise.race([
          this.driver.takeScreenshot(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), timeoutMs))
        ]);
        fs.writeFileSync(screenshotPath, String(data), 'base64');
        // Only set screenshotPath if file exists and is non-empty
        try {
          const stats = fs.statSync(screenshotPath);
          if (stats.size > 0) {
            this.screenshotPath = screenshotPath;
          } else {
            this.screenshotPath = undefined;
          }
        } catch {
          this.screenshotPath = undefined;
        }
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
        // Ignore screenshot errors
      }
      
      try {
        await this.driver.quit();
      } catch (err) {
        // Ignore driver quit errors
      }
      
      this.driver = null;
    }

    // Clean up Chrome temporary files
    this.cleanupChromeTemp();

    // Save debug report if debug mode is enabled
    if (this.debugConfig.enabled) {
      await this.debugLog('test_end', { 
        action: 'Test finished', 
        success: testPassed,
        screenshot: testPassed ? undefined : await this.captureDebugScreenshot('test_end')
      });
      await this.debugLogger?.saveDebugReport();
      
      if (!testPassed) {
        console.log('');
        console.log('🤖 [AI ANALYSIS] Test failed - AI-ready analysis request generated!');
        console.log(`📁 Check: ${this.debugLogger?.debugDir}/ai-analysis-request.md`);
        console.log('💡 Copy the contents of ai-analysis-request.md to your AI assistant for detailed failure analysis');
        console.log('');
      }
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

  async waitForElement(locator: Locator, timeout: number | { extra: number } = defaultElementWaitTime): Promise<WebElement> {
    if (!this.driver) throw new Error('Driver not started');
    
    let actualTimeout: number;
    if (typeof timeout === 'object' && 'extra' in timeout) {
      actualTimeout = defaultElementWaitTime + timeout.extra;
    } else {
      actualTimeout = timeout as number;
    }
    
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    
    try {
      const element = await this.driver.wait(until.elementLocated(locator), actualTimeout);
      success = true;
      return element;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      if (this.debugConfig.enabled) {
        await this.debugLog('wait_for_element', {
          element: this.locatorToString(locator),
          duration: Date.now() - startTime,
          success,
          error
        });
      }
    }
  }

  async clickElement(locator: Locator, timeout: number | { extra: number } = defaultElementWaitTime): Promise<WebElement> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    
    try {
      const el = await this.waitForElement(locator, timeout);
      await el.click();
      success = true;
      return el;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      if (this.debugConfig.enabled) {
        await this.debugLog('click_element', {
          element: this.locatorToString(locator),
          duration: Date.now() - startTime,
          success,
          error,
          screenshot: success ? undefined : await this.captureDebugScreenshot('click_failure')
        });
      }
    }
  }

  async getElementText(locator: Locator, timeout: number | { extra: number } = defaultElementWaitTime): Promise<string> {
    const el = await this.waitForElement(locator, timeout);
    return await el.getText();
  }

  async getElementAttribute(locator: Locator, attr: string, timeout = defaultElementWaitTime): Promise<string> {
    const el = await this.waitForElement(locator, timeout);
    return await el.getAttribute(attr);
  }

  /**
   * Handles errors in tests: ensures teardown, logs the error, flushes logs, and exits with code 1.
   */
  async handleError(e: any) {
    const tmpErrorPath = path.join(os.tmpdir(), `selenium-test-error-${process.pid}.log`);
    
    // Log debug information about the error before finish
    if (this.debugConfig.enabled) {
      await this.debugLog('test_error', { 
        action: 'Test failed with error', 
        success: false,
        error: e instanceof Error ? e.message : String(e),
        screenshot: await this.captureDebugScreenshot('error')
      });
    }
    
    try {
      await this.finish(false);
    } catch (teardownErr) {
      // Silently handle cleanup errors
    }
    
    // Additional AI analysis feedback after finish() which generates the report
    if (this.debugConfig.enabled) {
      console.log('');
      console.log('🤖 [AI ANALYSIS] Error detected - AI analysis request generated!');
      console.log(`📁 Check: ${this.debugLogger?.debugDir}/ai-analysis-request.md`);
      console.log('💡 Copy the contents to your AI assistant for immediate error analysis');
      console.log('');
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

  // Debug helper methods
  private async debugLog(action: string, context: any): Promise<void> {
    if (this.debugLogger) {
      this.debugLogger.log({ action, ...context });
    }
  }

  private async captureDebugScreenshot(suffix: string): Promise<string | undefined> {
    if (this.debugConfig.enabled && this.debugConfig.captureScreenshots && this.driver) {
      try {
        const screenshotPath = path.join(this.debugLogger!.debugDir, `${suffix}_${Date.now()}.png`);
        const data = await this.driver.takeScreenshot();
        fs.writeFileSync(screenshotPath, data, 'base64');
        return screenshotPath;
      } catch (e) {
        console.warn('[DEBUG] Failed to capture debug screenshot:', e instanceof Error ? e.message : String(e));
      }
    }
    return undefined;
  }

  private locatorToString(locator: Locator): string {
    // For Selenium 4+, locators are functions, so we need to extract info differently
    try {
      return locator.toString();
    } catch {
      return 'unknown-locator';
    }
  }
}