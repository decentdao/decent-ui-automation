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

// Clean up browser state for retries when using wallet connect
export async function cleanupBrowserStateForRetry(driver: WebDriver): Promise<void> {
  try {
    const originalHandle = await driver.getWindowHandle();
    const allHandles = await driver.getAllWindowHandles();
    
    // Close all tabs except the original one
    for (const handle of allHandles) {
      if (handle !== originalHandle) {
        await driver.switchTo().window(handle);
        await driver.close();
      }
    }
    
    await driver.switchTo().window(originalHandle);
    
    // Clear browser state
    await driver.manage().deleteAllCookies();
    await driver.executeScript("localStorage.clear(); sessionStorage.clear();");
  } catch (error) {
    // Silently continue if cleanup fails
  }
}
