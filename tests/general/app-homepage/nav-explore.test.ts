import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('app-homepage', 'nav-explore');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + pages['app-homepage']));
  
  // Store the original window handle
  const originalWindow = await test.driver!.getWindowHandle();
  
  // Find and click the "Explore Docs" navigation link via test id
  const exploreDocsLink = await test.waitForElement(By.css('[data-testid="homepage-exploreDocs"]'));
  await exploreDocsLink.click();
  
  // Wait for new tab to open and switch to it
  await test.driver!.wait(async () => {
    const handles = await test.driver!.getAllWindowHandles();
    return handles.length > 1;
  }, 5000);
  
  const allWindows = await test.driver!.getAllWindowHandles();
  const newWindow = allWindows.find(handle => handle !== originalWindow);
  
  if (!newWindow) {
    throw new Error('New tab was not opened!');
  }
  
  await test.driver!.switchTo().window(newWindow);
  
  // Wait for the page to load and check the URL
  await test.driver!.wait(async () => {
    const currentUrl = await test.driver!.getCurrentUrl();
    return currentUrl.includes('docs.decentdao.org');
  }, 5000);
  
  const currentUrl = await test.driver!.getCurrentUrl();
  const expectedUrl = 'https://docs.decentdao.org/app';
  
  if (!currentUrl.includes(expectedUrl)) {
    throw new Error(`Expected URL to be ${expectedUrl}, but got ${currentUrl}`);
  }
  
  // Wait for the documentation page content to load
  await test.driver!.wait(async () => {
    const pageSource = await test.driver!.getPageSource();
    return pageSource.includes('Documentation') || pageSource.includes('Decent');
  }, 5000);
  
  console.log('Explore Docs navigation link opened correct URL in new tab and page loaded successfully.');
  
}, test);
