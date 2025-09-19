import { WebDriver, By, until, WebElement } from 'selenium-webdriver';

/**
 * Configuration interface for wallet impersonator setup
 */
export interface WalletImpersonatorConfig {
  walletAddress: string;
  networkName?: string;
  timeoutMs?: number;
}

/**
 * Gets a WalletConnect URI from the Decent app
 * @param driver - The WebDriver instance
 * @param baseUrl - The base URL of the Decent app
 * @returns Promise<string> - The WalletConnect URI
 */
async function getWalletConnectUri(driver: WebDriver, baseUrl: string): Promise<string> {
  console.log('[WalletImpersonator] Getting WalletConnect URI from Decent app...');
  
  // 1. Load the app homepage
  await driver.get(baseUrl);
  console.log('[WalletImpersonator] Loaded app homepage');
  
  // 2. Select the Connect Wallet button (data-testid="header-accountMenu")
  const headerAccountMenu = await driver.wait(
    until.elementLocated(By.css('[data-testid="header-accountMenu"]')),
    10000
  );
  await headerAccountMenu.click();
  console.log('[WalletImpersonator] Clicked Connect Wallet button');
  
  // 3. Select the Connect button (data-testid="accountMenu-connect")
  const accountMenuConnect = await driver.wait(
    until.elementLocated(By.css('[data-testid="accountMenu-connect"]')),
    10000
  );
  await accountMenuConnect.click();
  console.log('[WalletImpersonator] Clicked Connect button');
  
  // Wait for the wallet selection modal to fully load
  await driver.sleep(2000);
  
  // 4. Select the WalletConnect button (data-testid="wallet-selector-walletconnect")
  const walletConnectClicked = await driver.executeScript(`
    function findInShadowRoots(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
      let node;
      while (node = walker.nextNode()) {
        if (node.shadowRoot) {
          const found = node.shadowRoot.querySelector('[data-testid="wallet-selector-walletconnect"]');
          if (found) return found;
          
          const foundRecursive = findInShadowRoots(node.shadowRoot);
          if (foundRecursive) return foundRecursive;
        }
      }
      return null;
    }
    
    const element = document.querySelector('[data-testid="wallet-selector-walletconnect"]') || 
                   findInShadowRoots(document);
    
    if (element) {
      element.click();
      return true;
    }
    return false;
  `) as boolean;
  
  if (!walletConnectClicked) {
    throw new Error('Could not find WalletConnect selector element');
  }
  
  console.log('[WalletImpersonator] Selected WalletConnect option');
  // Wait for the WalletConnect modal/screen to load
  await driver.sleep(3000);
  
  // 5. Select the Copy Link button (data-testid="copy-wc2-uri")
  const walletConnectUri = await driver.executeScript(`
    // Set up clipboard interception
    window.capturedClipboardText = '';
    const originalWriteText = navigator.clipboard.writeText;
    navigator.clipboard.writeText = function(text) {
      window.capturedClipboardText = text;
      return originalWriteText.call(this, text);
    };
    
    // Find and click the copy button in shadow DOM
    function findInShadowRoots(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
      let node;
      while (node = walker.nextNode()) {
        if (node.shadowRoot) {
          const found = node.shadowRoot.querySelector('[data-testid="copy-wc2-uri"]');
          if (found) return found;
          
          const foundRecursive = findInShadowRoots(node.shadowRoot);
          if (foundRecursive) return foundRecursive;
        }
      }
      return null;
    }
    
    const element = document.querySelector('[data-testid="copy-wc2-uri"]') || 
                   findInShadowRoots(document);
    
    if (element) {
      element.click();
      // Return the captured clipboard text after a brief delay
      return new Promise(resolve => {
        setTimeout(() => resolve(window.capturedClipboardText), 500);
      });
    }
    
    throw new Error('Could not find copy button');
  `) as string;
  
  if (!walletConnectUri || !walletConnectUri.startsWith('wc:')) {
    throw new Error('Could not capture WalletConnect URI from clipboard operation');
  }
  
  console.log('[WalletImpersonator] Successfully captured WalletConnect URI from clipboard');
  
  if (walletConnectUri && walletConnectUri.startsWith('wc:')) {
    console.log('[WalletImpersonator] Successfully captured WalletConnect URI from clipboard');
    return walletConnectUri;
  }
  
  throw new Error('Could not capture WalletConnect URI from clipboard operation.');
}

/**
 * Sets up wallet impersonation in a new tab, then switches back to the first tab for the main test.
 * This function should be called before the main test steps begin.
 * 
 * @param driver - The WebDriver instance
 * @param config - Configuration object containing wallet details
 * @param baseUrl - The base URL of the Decent app to get WalletConnect URI from
 * @returns Promise<string> - The window handle of the original tab for the main test
 */
export async function setupWalletImpersonator(
  driver: WebDriver, 
  config: WalletImpersonatorConfig,
  baseUrl: string
): Promise<string> {
  const {
    walletAddress,
    networkName = "Ethereum Sepolia",
    timeoutMs = 30000
  } = config;

  console.log(`[WalletImpersonator] Setting up wallet impersonation for ${walletAddress}`);
  
  try {
    // Store the original tab handle (where we got the WalletConnect URI)
    const originalTabHandle = await driver.getWindowHandle();
    
    // Get a WalletConnect URI from the Decent app
    const walletConnectUri = await getWalletConnectUri(driver, baseUrl);
    console.log(`[WalletImpersonator] Got WalletConnect URI: ${walletConnectUri.substring(0, 50)}...`);

    // Open a new tab for the impersonator website
    await driver.executeScript("window.open('https://impersonator.xyz/', '_blank');");
    const allWindowHandles = await driver.getAllWindowHandles();
    const impersonatorTabHandle = allWindowHandles[allWindowHandles.length - 1];
    
    // Switch to the impersonator tab
    await driver.switchTo().window(impersonatorTabHandle);
    console.log('[WalletImpersonator] Opened new tab and navigated to impersonator.xyz');

    // 1. Type the wallet address into the "Enter Address or ENS to Impersonate" field
    const addressInput = await findInputBelowLabel(driver, "Enter Address or ENS to Impersonate");
    await addressInput.clear();
    await addressInput.sendKeys(walletAddress);
    console.log('[WalletImpersonator] Entered wallet address');

    // 2. Change network if not already on the target network
    try {
      // Try to find the network dropdown button more precisely
      let networkButton;
      let needsNetworkChange = true;
      
      const networkSelectors = [
        `//button[contains(text(), "Ethereum Mainnet")]`,
        `//*[text()="Ethereum Mainnet"]`,
        `//*[contains(@class, "dropdown") or contains(@class, "select")]//text()[contains(., "Ethereum Mainnet")]/parent::*`,
        `//div[contains(text(), "Ethereum Mainnet") and (@role="button" or contains(@class, "dropdown"))]`,
        `//*[normalize-space(.)="Ethereum Mainnet" and (self::button or @role="button")]`,
        // Try to find the parent dropdown container
        `//*[contains(text(), "Ethereum Mainnet")]/parent::*[contains(@class, "select") or contains(@class, "dropdown")]`,
        `//*[contains(text(), "Ethereum Mainnet")]/ancestor::*[contains(@class, "select") or contains(@class, "dropdown")][1]`
      ];
      
      for (const selector of networkSelectors) {
        try {
          networkButton = await driver.findElement(By.xpath(selector));
          const buttonText = await networkButton.getText();
          console.log(`[WalletImpersonator] Found network element: "${buttonText}"`);
          
          // Check if it's already the target network
          if (buttonText.includes(networkName)) {
            console.log(`[WalletImpersonator] Network is already set to ${networkName}`);
            needsNetworkChange = false;
          }
          break;
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!networkButton) {
        console.log(`[WalletImpersonator] Could not find network dropdown button, assuming network is already correct`);
      } else if (needsNetworkChange) {
        // Try clicking the element that's actually at the click point
        console.log(`[WalletImpersonator] Attempting to open network dropdown...`);
        
        // Get the actual clickable element at the center of the network button
        const boundingRect: any = await driver.executeScript("return arguments[0].getBoundingClientRect();", networkButton);
        const centerX = boundingRect.x + boundingRect.width / 2;
        const centerY = boundingRect.y + boundingRect.height / 2;
        const elementAtPoint = await driver.executeScript(`
          return document.elementFromPoint(${centerX}, ${centerY});
        `);
        
        if (elementAtPoint) {
          // Use focus + mouse events sequence which works reliably with React Select components
          await driver.executeScript(`
            const el = arguments[0];
            el.focus();
            el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
            el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, cancelable: true}));
            el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
          `, elementAtPoint);
          console.log(`[WalletImpersonator] Opened network dropdown`);
        } else {
          // Fallback to clicking the parent element
          const parentElement = await driver.executeScript("return arguments[0].parentElement;", networkButton);
          await driver.executeScript("arguments[0].click();", parentElement);
          console.log(`[WalletImpersonator] Opened network dropdown (fallback)`);
        }
        
        // Wait for dropdown to open
        await driver.sleep(2000);
        
        // Select the target network from dropdown
        const targetSelectors = [
          `//*[normalize-space(.)="${networkName}" and (self::div or self::button or @role="menuitem")]`,
          `//*[contains(text(), "${networkName}")]`,
          `//*[normalize-space(.)="${networkName}"]`
        ];
        
        let targetNetwork;
        for (const selector of targetSelectors) {
          try {
            targetNetwork = await driver.wait(
              until.elementLocated(By.xpath(selector)),
              5000
            );
            console.log(`[WalletImpersonator] Found target network: ${networkName}`);
            break;
          } catch (e) {
            // Continue to next selector
          }
        }
        
        if (targetNetwork) {
          await driver.wait(until.elementIsVisible(targetNetwork), 5000);
          await targetNetwork.click();
          console.log(`[WalletImpersonator] Successfully changed network to ${networkName}`);
        } else {
          console.log(`[WalletImpersonator] Could not find ${networkName} in dropdown, it may already be selected or unavailable`);
        }
      }
      
    } catch (error) {
      console.log(`[WalletImpersonator] Network selection failed or may already be correct:`, error instanceof Error ? error.message : String(error));
    }

    // 3. Click the "WalletConnect" tab (if not already selected)
    const wcTab = await driver.wait(
      until.elementLocated(
        By.xpath(`//*[self::button or self::a or self::div][normalize-space(.)="WalletConnect"]`)
      ),
      10000
    );
    await wcTab.click();
    console.log('[WalletImpersonator] Clicked WalletConnect tab');

    // 4. Enter the WalletConnect URI into the "WalletConnect URI" field
    const uriInput = await findInputBelowLabel(driver, "WalletConnect URI");
    await uriInput.clear();
    await uriInput.sendKeys(walletConnectUri);
    console.log('[WalletImpersonator] Entered WalletConnect URI');

    // 5. Click "Connect"
    const connectBtn = await driver.wait(
      until.elementLocated(By.xpath(`//button[normalize-space(.)="Connect"]`)),
      10000
    );
    await driver.wait(until.elementIsEnabled(connectBtn), 5000);
    await connectBtn.click();
    console.log('[WalletImpersonator] Clicked Connect button');

    // 6. Wait for the connection to complete
    await waitUntilWalletConnected(driver, timeoutMs);
    console.log('[WalletImpersonator] Wallet connection completed');

    // 7. Switch back to the original tab for the main test
    await driver.switchTo().window(originalTabHandle);
    console.log('[WalletImpersonator] Switched back to original tab for main test');
    
    return originalTabHandle;

  } catch (error) {
    console.error('[WalletImpersonator] Setup failed:', error);
    throw new Error(`Wallet impersonator setup failed: ${error}`);
  }
}

/**
 * Helper function to find the first <input> or <textarea> that appears after a label with the given text.
 */
async function findInputBelowLabel(driver: WebDriver, labelText: string): Promise<WebElement> {
  try {
    // Match a <label> element first
    return await driver.findElement(
      By.xpath(
        `//label[normalize-space(.)="${labelText}"]//following::input[1] | ` +
        `//label[normalize-space(.)="${labelText}"]//following::textarea[1]`
      )
    );
  } catch {
    // Fallback: any element with that text, then its next input/textarea
    return await driver.findElement(
      By.xpath(
        `//*[normalize-space(.)="${labelText}"]/following::input[1] | ` +
        `//*[normalize-space(.)="${labelText}"]/following::textarea[1]`
      )
    );
  }
}

/**
 * Helper function to wait for an indication that the wallet has connected to the target app on impersonator.xyz.
 * This checks for connection status indicators specifically on the impersonator site.
 */
async function waitUntilWalletConnected(driver: WebDriver, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  console.log('[WalletImpersonator] Waiting for wallet connection confirmation on impersonator.xyz...');
  
  while (Date.now() - start < timeoutMs) {
    try {
      // First, make sure we're still on the impersonator.xyz domain
      const currentUrl = await driver.getCurrentUrl();
      if (!currentUrl.includes('impersonator.xyz')) {
        throw new Error(`Expected to be on impersonator.xyz but found: ${currentUrl}`);
      }
      
      // The most reliable indicator is that the Connect button becomes disabled or disappears
      const activeConnectButtons = await driver.findElements(By.xpath(`//button[normalize-space(.)="Connect" and not(@disabled) and not(contains(@class, "disabled"))]`));
      
      if (activeConnectButtons.length === 0) {
        // Connect button is gone or disabled, now look for additional confirmation
        console.log('[WalletImpersonator] Connect button is disabled/gone, checking for additional indicators...');
        
        // Look for session-specific indicators that only appear after successful connection
        const sessionIndicators = [
          // Look for a disconnect button (only appears after connection)
          `//button[contains(normalize-space(.), "Disconnect")]`,
          
          // Look for session ID or session info
          `//*[contains(normalize-space(.), "Session ID") or contains(normalize-space(.), "session:")]`,
          
          // Look for connected peer/app information
          `//*[contains(normalize-space(.), "Connected to:") or contains(normalize-space(.), "Peer:")]`,
          
          // Look for transaction form fields that become active (not just static text)
          `//input[@placeholder*="FROM" or @placeholder*="TO" or @placeholder*="DATA"] | //input[contains(@class, "from") or contains(@class, "to") or contains(@class, "data")]`,
          
          // Look for an active transaction section with input fields
          `//*[contains(normalize-space(.), "eth_sendTransaction")]//following::input[1] | //*[contains(normalize-space(.), "eth_sendTransaction")]//preceding::input[1]`
        ];
        
        let foundSessionIndicator = false;
        for (const indicator of sessionIndicators) {
          const elements = await driver.findElements(By.xpath(indicator));
          if (elements.length > 0) {
            try {
              const elementText = await elements[0].getText();
              console.log(`[WalletImpersonator] Found session indicator: "${elementText}"`);
              foundSessionIndicator = true;
              break;
            } catch (e) {
              // Element might not have text, but its presence is still a good indicator
              console.log(`[WalletImpersonator] Found session indicator element (no text)`);
              foundSessionIndicator = true;
              break;
            }
          }
        }
        
        if (foundSessionIndicator) {
          console.log('[WalletImpersonator] Connection confirmed - WalletConnect session established');
          // Add a brief wait to ensure the connection is fully stabilized
          await driver.sleep(2000);
          return;
        } else {
          console.log('[WalletImpersonator] Connect button disabled but no session indicators found, continuing to wait...');
        }
      } else {
        // Connect button is still active, so definitely not connected yet
        console.log(`[WalletImpersonator] Connect button still active (${activeConnectButtons.length} found), waiting...`);
      }
      
      // Check for error messages that would indicate connection failure
      const errorSelectors = [
        `//*[contains(normalize-space(.), "Failed to connect")]`,
        `//*[contains(normalize-space(.), "Connection failed")]`,
        `//*[contains(normalize-space(.), "Invalid URI")]`,
        `//*[contains(normalize-space(.), "expired")]`,
        `//*[contains(normalize-space(.), "Error")]`,
        `//*[contains(@class, "error") and string-length(normalize-space(.)) > 0]`,
        `//*[contains(normalize-space(.), "Unable to connect")]`,
        `//*[contains(normalize-space(.), "Connection timeout")]`
      ];
      
      for (const errorSelector of errorSelectors) {
        const errorElements = await driver.findElements(By.xpath(errorSelector));
        if (errorElements.length > 0) {
          const errorText = await errorElements[0].getText();
          if (errorText.trim() && !errorText.includes('Impersonator\nConnect to dapps')) {
            throw new Error(`Connection failed with error: ${errorText}`);
          }
        }
      }
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Connection failed')) {
        throw error; // Re-throw connection failures
      }
      console.log(`[WalletImpersonator] Error checking connection status: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Log progress every 5 seconds
    if ((Date.now() - start) % 5000 < 1000) {
      console.log(`[WalletImpersonator] Still waiting for connection... (${Math.round((Date.now() - start) / 1000)}s elapsed)`);
    }
    
    await driver.sleep(1000); // Check every second
  }
  
  // If we get here, we timed out - capture debug info
  try {
    const currentUrl = await driver.getCurrentUrl();
    console.error(`[WalletImpersonator] Timeout - Current URL: ${currentUrl}`);
    
    // Check final state of Connect button
    const connectButtons = await driver.findElements(By.xpath(`//button[normalize-space(.)="Connect"]`));
    console.error(`[WalletImpersonator] Final Connect button count: ${connectButtons.length}`);
    if (connectButtons.length > 0) {
      const isDisabled = await connectButtons[0].getAttribute('disabled');
      console.error(`[WalletImpersonator] Connect button disabled: ${isDisabled !== null}`);
    }
    
  } catch (debugError) {
    console.error(`[WalletImpersonator] Could not capture debug info: ${debugError}`);
  }
  
  throw new Error(`Timed out waiting for wallet connection confirmation on impersonator.xyz after ${timeoutMs}ms`);
}
