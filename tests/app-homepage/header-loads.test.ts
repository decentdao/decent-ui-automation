import { getBaseUrl } from '../test-helpers';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';

const test = new BaseSeleniumTest('app-homepage', 'app-homepage/header-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  await test.driver!.get(getBaseUrl());
  const logo = await test.waitForElement(By.css('[data-testid="navigationLogo-homeLink"]'), 10000);
  const isDisplayed = await logo.isDisplayed();
  if (!isDisplayed) {
    throw new Error('Logo is not visible on the page!');
  }
  console.log('Logo is present and visible.');
}, test);
