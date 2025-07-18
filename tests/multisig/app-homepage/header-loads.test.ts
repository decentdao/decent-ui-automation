import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';

// Use the correct pageName for multisig
const test = new BaseSeleniumTest('app-homepage', 'header-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl()));
  const logo = await test.waitForElement(By.css('[data-testid="navigationLogo-homeLink"]'));
  const isDisplayed = await logo.isDisplayed();
  if (!isDisplayed) {
    throw new Error('Logo is not visible on the page!');
  }
  console.log('Logo is present and visible.');
}, test);
