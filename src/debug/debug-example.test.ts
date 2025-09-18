import { By } from 'selenium-webdriver';
import { BaseSeleniumTest } from '../../tests/base-selenium-test';
import { DebugConfigManager } from './debug-config';

/**
 * Example test demonstrating the debug toolset functionality.
 * Run with: npm test -- --file=src/debug/debug-example.test.ts --debug-mode
 */

async function debugExampleTest() {
  const test = new BaseSeleniumTest('debug-example');
  
  try {
    await test.start();
    
    const debugConfig = DebugConfigManager.getInstance().getConfig();
    console.log('[EXAMPLE] Debug mode enabled:', debugConfig.enabled);
    
    if (debugConfig.enabled) {
      console.log('[EXAMPLE] Debug configuration:', JSON.stringify(debugConfig, null, 2));
    }
    
    // Navigate to a test page
    await test.driver!.get('https://example.com');
    
    // Debug helper usage examples (only when debug mode is enabled)
    if (debugConfig.enabled && test.debugHelper) {
      await test.debugHelper.logPageState('after_navigation');
      await test.debugHelper.captureDomSnapshot('initial_page');
      await test.debugHelper.logElementsFound('h1', 1);
    }
    
    // Try to find and interact with elements
    try {
      await test.waitForElement(By.css('h1'));
      console.log('[EXAMPLE] Found h1 element successfully');
    } catch (e) {
      console.log('[EXAMPLE] Failed to find h1 element');
    }
    
    // Demonstrate element analysis
    if (debugConfig.enabled && test.debugHelper) {
      await test.debugHelper.analyzeElementInteraction('h1', 'click');
    }
    
    // Try clicking a non-existent element to demonstrate error debugging
    try {
      await test.clickElement(By.css('.non-existent-button'));
    } catch (e) {
      console.log('[EXAMPLE] Expected error - element not found');
    }
    
    // Demonstrate advanced wait debugging
    if (debugConfig.enabled && test.debugHelper) {
      await test.debugHelper.waitAndDebug('.another-non-existent-element', 2000);
    }
    
    console.log('[EXAMPLE] Test completed successfully');
    await test.finish(true);
    
  } catch (error) {
    console.error('[EXAMPLE] Test failed:', error);
    await test.handleError(error);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  console.log('[EXAMPLE] Starting debug example test...');
  console.log('[EXAMPLE] To see debug output, run with: npm test -- --file=src/debug/debug-example.test.ts --debug-mode');
  debugExampleTest();
}