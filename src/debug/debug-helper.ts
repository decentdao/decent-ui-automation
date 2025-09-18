import { WebDriver, By, WebElement } from 'selenium-webdriver';
import { DebugLogger } from './debug-logger';
import * as fs from 'fs';
import * as path from 'path';

// Configuration constants for debugging behavior
const MAX_ELEMENTS_TO_ANALYZE = 10;
const LOG_ATTEMPT_INTERVAL = 5;

/**
 * Advanced debugging utilities for Selenium tests.
 * Provides DOM snapshots, page state logging, and element analysis.
 */
export class DebugHelper {
  constructor(private driver: WebDriver, private logger: DebugLogger) {}

  /**
   * Check if browser session is still alive
   * Useful for preventing errors when browser has crashed or been closed
   */
  private async isBrowserSessionAlive(): Promise<boolean> {
    try {
      await this.driver.getCurrentUrl();
      return true;
    } catch (sessionError) {
      return false;
    }
  }

  /**
   * Capture a complete DOM snapshot at a specific step
   */
  async captureDomSnapshot(stepName: string): Promise<string | undefined> {
    try {
      // Check if browser session is still alive before attempting DOM capture
      if (!await this.isBrowserSessionAlive()) {
        console.warn(`[DEBUG] Browser session not available for DOM snapshot '${stepName}', skipping`);
        return undefined;
      }
      
      const html = await this.driver.getPageSource();
      const timestamp = Date.now();
      const filename = `dom_${stepName}_${timestamp}.html`;
      const filepath = path.join(this.logger.debugDir, filename);
      
      // Add some debugging metadata to the HTML
      const debugMetadata = `<!-- DOM Snapshot captured at: ${new Date().toISOString()} for step: ${stepName} -->\n`;
      const fullHtml = debugMetadata + html;
      
      fs.writeFileSync(filepath, fullHtml, 'utf8');
      
      this.logger.log({
        action: 'dom_snapshot',
        success: true,
        context: {
          step: stepName,
          filePath: path.basename(filepath),
          htmlLength: html.length
        }
      });
      
      return filepath;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.warn(`[DEBUG] Failed to capture DOM snapshot for step '${stepName}':`, error);
      
      this.logger.log({
        action: 'dom_snapshot',
        success: false,
        error,
        context: { step: stepName }
      });
      
      return undefined;
    }
  }

  /**
   * Log comprehensive page state information
   */
  async logPageState(stepName: string): Promise<void> {
    try {
      // Check if browser session is still alive before attempting page state capture
      if (!await this.isBrowserSessionAlive()) {
        console.warn(`[DEBUG] Browser session not available for page state logging '${stepName}', skipping`);
        return;
      }
      
      const url = await this.driver.getCurrentUrl();
      const title = await this.driver.getTitle();
      const windowSize = await this.driver.manage().window().getRect();
      
      // Get additional browser information
      const userAgent = await this.driver.executeScript('return navigator.userAgent;') as string;
      const pageLoadState = await this.driver.executeScript('return document.readyState;') as string;
      
      // Get viewport information
      const viewportInfo = await this.driver.executeScript(`
        return {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          devicePixelRatio: window.devicePixelRatio
        };
      `) as any;
      
      this.logger.log({
        action: 'page_state',
        success: true,
        context: {
          step: stepName,
          url,
          title,
          windowSize,
          userAgent,
          pageLoadState,
          viewport: viewportInfo
        }
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.warn(`[DEBUG] Failed to log page state for step '${stepName}':`, error);
      
      this.logger.log({
        action: 'page_state',
        success: false,
        error,
        context: { step: stepName }
      });
    }
  }

  /**
   * Log information about elements found with a given locator
   */
  async logElementsFound(locator: string, expectedCount?: number): Promise<void> {
    try {
      const elements = await this.driver.findElements(By.css(locator));
      const actualCount = elements.length;
      
      // Gather detailed information about found elements
      const elementDetails = await Promise.all(
        // Limit to first MAX_ELEMENTS_TO_ANALYZE (10) elements for performance
        elements.slice(0, MAX_ELEMENTS_TO_ANALYZE).map(async (el, i) => {
          try {
            const tagName = await el.getTagName();
            const text = await el.getText();
            const isVisible = await el.isDisplayed();
            const isEnabled = await el.isEnabled();
            const rect = await el.getRect();
            
            // Get key attributes
            const attributes: { [key: string]: string | null } = {};
            const commonAttrs = ['id', 'class', 'name', 'type', 'value', 'href', 'src', 'alt'];
            for (const attr of commonAttrs) {
              attributes[attr] = await el.getAttribute(attr);
            }
            
            return {
              index: i,
              tagName,
              text: text.substring(0, 100), // Limit text length
              isVisible,
              isEnabled,
              rect,
              attributes: Object.fromEntries(
                Object.entries(attributes).filter(([, value]) => value !== null && value !== '')
              )
            };
          } catch (elementError) {
            return {
              index: i,
              error: elementError instanceof Error ? elementError.message : String(elementError)
            };
          }
        })
      );
      
      this.logger.log({
        action: 'elements_found',
        element: locator,
        success: expectedCount ? actualCount === expectedCount : actualCount > 0,
        context: {
          expectedCount,
          actualCount,
          elements: elementDetails,
          truncated: elements.length > 10
        }
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.warn(`[DEBUG] Failed to log elements found for locator '${locator}':`, error);
      
      this.logger.log({
        action: 'elements_found',
        element: locator,
        success: false,
        error,
        context: { expectedCount }
      });
    }
  }

  /**
   * Advanced wait with detailed debugging information
   */
  async waitAndDebug(locator: string, timeoutMs: number = 10000): Promise<WebElement | null> {
    const startTime = Date.now();
    let found = false;
    let element: WebElement | null = null;
    let attempts = 0;
    
    this.logger.log({
      action: 'wait_debug_start',
      element: locator,
      success: true,
      context: {
        timeoutMs,
        startTime: new Date(startTime).toISOString()
      }
    });
    
    while (Date.now() - startTime < timeoutMs && !found) {
      attempts++;
      
      try {
        const elements = await this.driver.findElements(By.css(locator));
        if (elements.length > 0) {
          element = elements[0];
          found = true;
          
          // Log successful find with element details
          const isVisible = await element.isDisplayed();
          const isEnabled = await element.isEnabled();
          const rect = await element.getRect();
          
          this.logger.log({
            action: 'wait_debug_success',
            element: locator,
            success: true,
            duration: Date.now() - startTime,
            context: {
              attempts,
              elementsFound: elements.length,
              isVisible,
              isEnabled,
              rect
            }
          });
          
          return element;
        } else {
          // Log attempt details
          if (attempts % LOG_ATTEMPT_INTERVAL === 0) { // Log at regular intervals to avoid spam
            await this.logPageState(`wait_attempt_${attempts}`);
            
            this.logger.log({
              action: 'wait_debug_attempt',
              element: locator,
              success: false,
              context: {
                attempt: attempts,
                elapsed: Date.now() - startTime,
                elementsFound: 0
              }
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        this.logger.log({
          action: 'wait_debug_error',
          element: locator,
          success: false,
          error,
          context: {
            attempt: attempts,
            elapsed: Date.now() - startTime
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!found) {
      // Final failure - capture comprehensive debug information
      const domSnapshot = await this.captureDomSnapshot('wait_timeout');
      await this.logPageState('wait_timeout');
      await this.logElementsFound(locator);
      
      this.logger.log({
        action: 'wait_debug_timeout',
        element: locator,
        success: false,
        duration: Date.now() - startTime,
        context: {
          timeoutMs,
          attempts,
          domSnapshot: domSnapshot ? path.basename(domSnapshot) : undefined
        }
      });
    }
    
    return element;
  }

  /**
   * Analyze and debug element interaction issues
   */
  async analyzeElementInteraction(locator: string, interaction: string): Promise<void> {
    try {
      const elements = await this.driver.findElements(By.css(locator));
      
      if (elements.length === 0) {
        this.logger.log({
          action: 'analyze_element',
          element: locator,
          success: false,
          context: {
            interaction,
            issue: 'Element not found',
            elementsCount: 0
          }
        });
        return;
      }
      
      const element = elements[0];
      
      // Comprehensive element analysis
      const isDisplayed = await element.isDisplayed();
      const isEnabled = await element.isEnabled();
      const rect = await element.getRect();
      const tagName = await element.getTagName();
      const text = await element.getText();
      
      // Check if element is in viewport
      const inViewport = await this.driver.executeScript(`
        const rect = arguments[0].getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
      `, element) as boolean;
      
      // Check for overlapping elements
      const isClickable = await this.driver.executeScript(`
        const element = arguments[0];
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const elementAtPoint = document.elementFromPoint(centerX, centerY);
        return elementAtPoint === element || element.contains(elementAtPoint);
      `, element) as boolean;
      
      // Get computed styles that might affect interaction
      const computedStyles = await this.driver.executeScript(`
        const styles = window.getComputedStyle(arguments[0]);
        return {
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          pointerEvents: styles.pointerEvents,
          position: styles.position,
          zIndex: styles.zIndex
        };
      `, element) as any;
      
      const analysis = {
        interaction,
        elementsFound: elements.length,
        isDisplayed,
        isEnabled,
        inViewport,
        isClickable,
        rect,
        tagName,
        textContent: text.substring(0, 100),
        computedStyles
      };
      
      // Determine potential issues
      const issues: string[] = [];
      if (!isDisplayed) issues.push('Element not displayed');
      if (!isEnabled) issues.push('Element not enabled');
      if (!inViewport) issues.push('Element not in viewport');
      if (!isClickable) issues.push('Element not clickable (covered by another element)');
      if (computedStyles.pointerEvents === 'none') issues.push('Pointer events disabled');
      if (computedStyles.opacity === '0') issues.push('Element has opacity 0');
      if (computedStyles.visibility === 'hidden') issues.push('Element visibility hidden');
      
      this.logger.log({
        action: 'analyze_element',
        element: locator,
        success: issues.length === 0,
        context: {
          ...analysis,
          issues: issues.length > 0 ? issues : undefined
        }
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.logger.log({
        action: 'analyze_element',
        element: locator,
        success: false,
        error,
        context: { interaction }
      });
    }
  }

  /**
   * Capture console logs from the browser
   */
  async captureConsoleLogs(stepName: string): Promise<void> {
    try {
      const logs = await this.driver.manage().logs().get('browser');
      const formattedLogs = logs.map(log => ({
        level: log.level.name,
        message: log.message,
        timestamp: new Date(log.timestamp).toISOString()
      }));
      
      if (formattedLogs.length > 0) {
        const logsFile = path.join(this.logger.debugDir, `console_${stepName}_${Date.now()}.json`);
        fs.writeFileSync(logsFile, JSON.stringify(formattedLogs, null, 2));
      }
      
      this.logger.log({
        action: 'console_logs',
        success: true,
        context: {
          step: stepName,
          logCount: formattedLogs.length,
          errors: formattedLogs.filter(log => log.level === 'SEVERE').length,
          warnings: formattedLogs.filter(log => log.level === 'WARNING').length
        }
      });
    } catch (e) {
      // Console logs might not be available in all drivers/modes
      this.logger.log({
        action: 'console_logs',
        success: false,
        error: 'Console logs not available',
        context: { step: stepName }
      });
    }
  }
}