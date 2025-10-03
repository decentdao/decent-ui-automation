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
  await driver.get(baseUrl);

  const headerAccountMenu = await driver.wait(
    until.elementLocated(By.css('[data-testid="header-accountMenu"]')),
    10000
  );
  await headerAccountMenu.click();
  await driver.sleep(5000);
  
  const accountMenuConnect = await driver.wait(
    until.elementLocated(By.css('[data-testid="accountMenu-connect"]')),
    10000
  );
  await accountMenuConnect.click();
  await driver.sleep(2000);
  
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
  
  await driver.sleep(3000);
  
  const walletConnectUri = await driver.executeScript(`
    window.capturedClipboardText = '';
    const originalWriteText = navigator.clipboard.writeText;
    navigator.clipboard.writeText = function(text) {
      window.capturedClipboardText = text;
      return originalWriteText.call(this, text);
    };
    
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
      return new Promise(resolve => {
        setTimeout(() => resolve(window.capturedClipboardText), 500);
      });
    }
    
    throw new Error('Could not find copy button');
  `) as string;
  
  if (!walletConnectUri || !walletConnectUri.startsWith('wc:')) {
    throw new Error('Could not capture WalletConnect URI from clipboard operation');
  }
  
  return walletConnectUri;
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
    const originalTabHandle = await driver.getWindowHandle();
    const walletConnectUri = await getWalletConnectUri(driver, baseUrl);

    await driver.executeScript("window.open('https://impersonator.xyz/', '_blank');");
    const allWindowHandles = await driver.getAllWindowHandles();
    const impersonatorTabHandle = allWindowHandles[allWindowHandles.length - 1];
    await driver.switchTo().window(impersonatorTabHandle);

    const addressInput = await findInputBelowLabel(driver, "Enter Address or ENS to Impersonate");
    await addressInput.clear();
    await addressInput.sendKeys(walletAddress);

    try {
      let networkButton;
      let needsNetworkChange = true;
      
      const networkSelectors = [
        `//button[contains(text(), "Ethereum Mainnet")]`,
        `//*[text()="Ethereum Mainnet"]`,
        `//*[contains(@class, "dropdown") or contains(@class, "select")]//text()[contains(., "Ethereum Mainnet")]/parent::*`,
        `//div[contains(text(), "Ethereum Mainnet") and (@role="button" or contains(@class, "dropdown"))]`,
        `//*[normalize-space(.)="Ethereum Mainnet" and (self::button or @role="button")]`,
        `//*[contains(text(), "Ethereum Mainnet")]/parent::*[contains(@class, "select") or contains(@class, "dropdown")]`,
        `//*[contains(text(), "Ethereum Mainnet")]/ancestor::*[contains(@class, "select") or contains(@class, "dropdown")][1]`
      ];
      
      for (const selector of networkSelectors) {
        try {
          networkButton = await driver.findElement(By.xpath(selector));
          const buttonText = await networkButton.getText();
          
          if (buttonText.includes(networkName)) {
            needsNetworkChange = false;
          }
          break;
        } catch (e) {
        }
      }
      
      if (!networkButton) {
        console.log(`[WalletImpersonator] Could not find network dropdown button, assuming network is already correct`);
      } else if (needsNetworkChange) {
        const boundingRect: any = await driver.executeScript("return arguments[0].getBoundingClientRect();", networkButton);
        const centerX = boundingRect.x + boundingRect.width / 2;
        const centerY = boundingRect.y + boundingRect.height / 2;
        const elementAtPoint = await driver.executeScript(`
          return document.elementFromPoint(${centerX}, ${centerY});
        `);
        
        if (elementAtPoint) {
          await driver.executeScript(`
            const el = arguments[0];
            el.focus();
            el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
            el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, cancelable: true}));
            el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
          `, elementAtPoint);
        } else {
          const parentElement = await driver.executeScript("return arguments[0].parentElement;", networkButton);
          await driver.executeScript("arguments[0].click();", parentElement);
        }
        
        await driver.sleep(2000);
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
            break;
          } catch (e) {
          }
        }
        
        if (targetNetwork) {
          await driver.wait(until.elementIsVisible(targetNetwork), 5000);
          await targetNetwork.click();
        } else {
          throw new Error(`Could not find target network option "${networkName}" in dropdown`);
        }
      }
      
    } catch (error) {
      console.log(`[WalletImpersonator] Network selection failed or may already be correct:`, error instanceof Error ? error.message : String(error));
    }

    const wcTab = await driver.wait(
      until.elementLocated(
        By.xpath(`//*[self::button or self::a or self::div][normalize-space(.)="WalletConnect"]`)
      ),
      10000
    );
    await wcTab.click();

    const uriInput = await findInputBelowLabel(driver, "WalletConnect URI");
    await uriInput.clear();
    await uriInput.sendKeys(walletConnectUri);

    const connectBtn = await driver.wait(
      until.elementLocated(By.xpath(`//button[normalize-space(.)="Connect"]`)),
      10000
    );
    await driver.wait(until.elementIsEnabled(connectBtn), 5000);
    await connectBtn.click();

    await waitUntilWalletConnected(driver, timeoutMs);
    await driver.switchTo().window(originalTabHandle);
    
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
    return await driver.findElement(
      By.xpath(
        `//label[normalize-space(.)="${labelText}"]//following::input[1] | ` +
        `//label[normalize-space(.)="${labelText}"]//following::textarea[1]`
      )
    );
  } catch {
    return await driver.findElement(
      By.xpath(
        `//*[normalize-space(.)="${labelText}"]/following::input[1] | ` +
        `//*[normalize-space(.)="${labelText}"]/following::textarea[1]`
      )
    );
  }
}

async function waitUntilWalletConnected(driver: WebDriver, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    try {
      const currentUrl = await driver.getCurrentUrl();
      if (!currentUrl.includes('impersonator.xyz')) {
        throw new Error(`Expected to be on impersonator.xyz but found: ${currentUrl}`);
      }
      
      const activeConnectButtons = await driver.findElements(By.xpath(`//button[normalize-space(.)="Connect" and not(@disabled) and not(contains(@class, "disabled"))]`));
      
      if (activeConnectButtons.length === 0) {
        const sessionIndicators = [
          `//button[contains(normalize-space(.), "Disconnect")]`,
          `//*[contains(normalize-space(.), "Session ID") or contains(normalize-space(.), "session:")]`,
          `//*[contains(normalize-space(.), "Connected to:") or contains(normalize-space(.), "Peer:")]`,
          `//input[@placeholder*="FROM" or @placeholder*="TO" or @placeholder*="DATA"] | //input[contains(@class, "from") or contains(@class, "to") or contains(@class, "data")]`,
          `//*[contains(normalize-space(.), "eth_sendTransaction")]//following::input[1] | //*[contains(normalize-space(.), "eth_sendTransaction")]//preceding::input[1]`
        ];
        
        let foundSessionIndicator = false;
        for (const indicator of sessionIndicators) {
          const elements = await driver.findElements(By.xpath(indicator));
          if (elements.length > 0) {
            try {
              const elementText = await elements[0].getText();
              foundSessionIndicator = true;
              break;
            } catch (e) {
              foundSessionIndicator = true;
              break;
            }
          }
        }
        
        if (foundSessionIndicator) {
          console.log('[WalletImpersonator] Connection confirmed - WalletConnect session established');
          await driver.sleep(2000);
          return;
        }
      }
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
        throw error;
      }
    }
    
    await driver.sleep(1000);
  }
  
  try {
    const currentUrl = await driver.getCurrentUrl();
    console.error(`[WalletImpersonator] Timeout - Current URL: ${currentUrl}`);
    
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
