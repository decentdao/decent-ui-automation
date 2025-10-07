import { environments, getEnvironmentUrl, initializeReleaseUrl } from '../config/environments';
import { defaultElementWaitTime } from '../config/test-settings';
import { WebDriver } from 'selenium-webdriver';

export function getEnv() {
  return process.env.TEST_ENV || 'develop';
}

export { defaultElementWaitTime };

export function displayBaseUrlInfo() {
  const env = getEnv();
  const baseUrl = getBaseUrl();
  const source = process.env.BASE_URL ? 'BASE_URL override' : `${env} environment`;
  console.log(`[test-runner] Using ${source}: ${baseUrl}`);
  return { env, baseUrl, source };
}

export function getBaseUrl() {
  const ENV = getEnv();
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  
  if (ENV === 'release') {
    // For release environment, synchronously get the URL that was pre-fetched and stored in env var
    const releaseUrl = process.env.RELEASE_URL;
    if (!releaseUrl) {
      throw new Error('Release URL not available. The test runner should have set RELEASE_URL environment variable.');
    }
    return releaseUrl.replace(/\/$/, '');
  }
  
  return (environments[ENV] || environments.develop).replace(/\/$/, '');
}

export async function getBaseUrlAsync(): Promise<string> {
  const ENV = getEnv();
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  
  if (ENV === 'release') {
    await initializeReleaseUrl();
  }
  
  const envUrl = await getEnvironmentUrl(ENV);
  return envUrl.replace(/\/$/, '');
}

// Helper to append flags as URL parameters
export function appendFlagsToUrl(url: string): string {
  const flags = process.env.TEST_FLAGS;
  if (!flags) {
    return url;
  }
  // Parse existing params from url
  let [base, query = ''] = url.split('?');
  const urlParams = new URLSearchParams(query);
  // Split flags on comma, space, or plus (robust for shell quirks)
  flags.split(/[\s,+]+/).filter(Boolean).forEach(f => {
    const [k, v] = f.split('=');
    if (k) urlParams.set(k, v ?? '');
  });
  const paramStr = urlParams.toString();
  const finalUrl = paramStr ? `${base}?${paramStr}` : base;
  return finalUrl;
}

// Scroll an open dropdown/listbox menu (not the page) to the bottom so far options become visible
export async function scrollOpenDropdownToBottom(driver: WebDriver): Promise<boolean> {
  // Small delay to allow the menu to render
  await driver.sleep(300);
  const didScroll = await driver.executeScript(`
    const candidates = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [id^="menu-list-"], [id^="headlessui-menu-items-"]'));
    const panel = candidates.find(el => el && el.offsetParent !== null && el.scrollHeight > el.clientHeight);
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
      return true;
    }
    return false;
  `);
  return Boolean(didScroll);
}

/**
 * Verifies that the wallet is connected by checking the header-accountMenu element
 * for the expected wallet address or any wallet address pattern
 */
export async function verifyWalletConnected(test: any, maxRetries: number = 3): Promise<boolean> {
  const { By, until } = await import('selenium-webdriver');
  const { defaultWalletAddress } = await import('../config/test-settings');
  
  // Extract partial address for matching (first 6 and last 4 characters)
  const expectedPartial = `${defaultWalletAddress.slice(0, 6)}...${defaultWalletAddress.slice(-4)}`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Look for the header account menu element
      const accountMenuElement = await test.driver!.wait(
        until.elementLocated(By.css("[data-testid='header-accountMenu']")), 
        2000
      );
      
      if (accountMenuElement) {
        const menuText = await accountMenuElement.getText();
        
        // Check if it shows the expected wallet address (partial match)
        if (menuText.includes(expectedPartial)) {
          return true;
        }
        
        // Check if it shows any wallet address pattern (0x followed by characters, not "connect wallet")
        if (menuText.match(/0x[0-9a-fA-F]{4,}/i) && !menuText.toLowerCase().includes('connect')) {
          return true;
        }
      }

      // If wallet not connected and not last attempt, refresh and wait
      if (attempt < maxRetries) {
        await test.driver!.navigate().refresh();
        await test.driver!.sleep(3000);
      }
    } catch (error) {
      if (attempt < maxRetries) {
        await test.driver!.sleep(2000);
      } else {
        console.warn(`[WalletVerification] Failed to verify wallet connection: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  console.warn(`[WalletVerification] Could not verify wallet connection after ${maxRetries} attempts`);
  return false;
}
