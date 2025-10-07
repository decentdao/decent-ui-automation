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
 * Checks if wallet is connected by examining the header account menu.
 * Returns immediately with diagnostic info - no retries or remediation.
 */
export async function checkWalletConnectionStatus(test: any): Promise<{ connected: boolean; menuText: string }> {
  const { By, until } = await import('selenium-webdriver');
  const { defaultWalletAddress } = await import('../config/test-settings');
  
  try {
    const accountMenuElement = await test.driver!.wait(
      until.elementLocated(By.css("[data-testid='header-accountMenu']")), 
      3000
    );
    
    const menuText = await accountMenuElement.getText();
    const expectedPartial = `${defaultWalletAddress.slice(0, 6)}...${defaultWalletAddress.slice(-4)}`;
    
    // Check if connected
    const isConnected = menuText.includes(expectedPartial) || 
                       (menuText.match(/0x[0-9a-fA-F]{4,}/i) && !menuText.toLowerCase().includes('connect'));
    
    return { connected: isConnected, menuText };
    
  } catch (error) {
    return { connected: false, menuText: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}
