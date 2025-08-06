import { Builder, By, until, WebDriver, WebElement, Locator } from 'selenium-webdriver';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { defaultElementWaitTime } from './test-helpers';

export class BaseSeleniumTest {
  pageName: string;
  screenshotName?: string;
  driver: WebDriver | null;
  screenshotDir: string;
  screenshotPath?: string;
  private tempDirs: string[] = [];

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

  /**
   * Clean up Chrome temporary files and directories
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
      // Don't log cleanup errors as they're not critical
    }
  }

  /**
   * Create a custom temporary directory for Chrome user data
   */
  private createCustomTempDir(): string {
    const baseTempDir = os.tmpdir();
    const customTempDir = path.join(baseTempDir, `chrome-test-${process.pid}-${Date.now()}`);
    fs.mkdirSync(customTempDir, { recursive: true });
    this.tempDirs.push(customTempDir);
    return customTempDir;
  }

  async start() {
    const chrome = require('selenium-webdriver/chrome');
    const options = new chrome.Options();
    
    // Create custom temp directory for Chrome user data
    const customTempDir = this.createCustomTempDir();
    
    // Configure Chrome options with better cleanup behavior
    options.addArguments('--ignore-certificate-errors');
    options.addArguments('--log-level=3'); // Suppress most Chrome logs
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.addArguments('--disable-extensions');
    options.addArguments('--disable-plugins');
    options.addArguments('--disable-images');
    options.addArguments('--disable-javascript-harmony-shipping');
    options.addArguments('--disable-background-timer-throttling');
    options.addArguments('--disable-backgrounding-occluded-windows');
    options.addArguments('--disable-renderer-backgrounding');
    options.addArguments('--disable-features=TranslateUI,BlinkGenPropertyTrees');
    options.addArguments('--disable-ipc-flooding-protection');
    
    // Use custom user data directory
    options.addArguments(`--user-data-dir=${customTempDir}`);
    
    // Set disk cache to a custom location for easier cleanup
    const cacheDir = path.join(customTempDir, 'cache');
    options.addArguments(`--disk-cache-dir=${cacheDir}`);
    options.addArguments('--disk-cache-size=50000000'); // 50MB limit
    
    // Allow disabling headless mode via CLI or env
    const noHeadless = process.argv.includes('--no-headless') || process.env.NO_HEADLESS === '1' || process.env.NO_HEADLESS === 'true';
    if (!noHeadless) {
      options.addArguments('--headless=new'); // Use new headless mode for CI
    } else {
      console.log('[BaseSeleniumTest] Running in headed (non-headless) mode');
    }

    // Set service args for better cleanup
    const service = new chrome.ServiceBuilder();
    service.addArguments('--whitelisted-ips=');
    service.addArguments('--disable-background-networking');

    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .setChromeService(service)
      .build();
    
    // Set explicit window size in both headed and headless modes for consistency
    await this.driver.manage().window().setRect({ width: 1920, height: 1400 });
  }

  async saveScreenshot(timeoutMs = 10000) {
    if (this.driver) {
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

  /**
   * Clean up custom temporary directories with retry logic
   */
  private async cleanupCustomTempDirs(): Promise<void> {
    for (const tempDir of this.tempDirs) {
      try {
        if (fs.existsSync(tempDir)) {
          // Try immediate cleanup first
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            continue; // Success, move to next directory
          } catch (err) {
            // If immediate cleanup fails, wait and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
              fs.rmSync(tempDir, { recursive: true, force: true });
              continue; // Success after delay
            } catch (retryErr) {
              // Final attempt with more aggressive cleanup
              await this.forceRemoveDirectory(tempDir);
            }
          }
        }
      } catch (err) {
        // Don't throw on cleanup errors, but log them for debugging
        console.warn(`[BaseSeleniumTest] Could not clean up temp directory: ${tempDir}`);
      }
    }
    this.tempDirs = [];
  }

  /**
   * Aggressively attempt to remove a directory on Windows
   */
  private async forceRemoveDirectory(dirPath: string): Promise<void> {
    if (process.platform === 'win32') {
      try {
        // On Windows, use command line to force remove
        const { spawn } = require('child_process');
        await new Promise<void>((resolve) => {
          const proc = spawn('cmd', ['/c', 'rmdir', '/s', '/q', `"${dirPath}"`], {
            stdio: 'ignore',
            shell: true
          });
          proc.on('close', () => resolve()); // Don't care about exit code
        });
      } catch {
        // If cmd approach fails, try one more time with Node.js
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));
          fs.rmSync(dirPath, { recursive: true, force: true });
        } catch {
          // Final failure - directory will remain but don't throw error
        }
      }
    } else {
      // On Unix systems, try one more time after delay
      try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        fs.rmSync(dirPath, { recursive: true, force: true });
      } catch {
        // Final failure - directory will remain but don't throw error
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
      
      // Add timeout to driver.quit()
      try {
        await Promise.race([
          this.driver.quit(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Driver quit timeout')), 10000))
        ]);
      } catch (err) {
        console.error('[BaseSeleniumTest] Error during driver.quit in finish:', err);
      }
      
      // Wait a bit for Chrome to fully close and release file handles
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Clean up custom temporary directories (now async with proper waiting)
      await this.cleanupCustomTempDirs();
      
      // Clean up general Chrome temp files
      this.cleanupChromeTemp();
      
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

  async waitForElement(locator: Locator, timeout: number | { extra: number } = defaultElementWaitTime): Promise<WebElement> {
    if (!this.driver) throw new Error('Driver not started');
    
    let actualTimeout: number;
    if (typeof timeout === 'object' && 'extra' in timeout) {
      actualTimeout = defaultElementWaitTime + timeout.extra;
    } else {
      actualTimeout = timeout as number;
    }
    
    return await this.driver.wait(until.elementLocated(locator), actualTimeout);
  }

  async clickElement(locator: Locator, timeout: number | { extra: number } = defaultElementWaitTime): Promise<WebElement> {
    const el = await this.waitForElement(locator, timeout);
    await el.click();
    return el;
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