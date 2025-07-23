import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('create-dao', 'header-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + pages['create-dao']));
  const logo = await test.waitForElement(By.css('[data-testid="navigationLogo-homeLink"]'));
  const isDisplayed = await logo.isDisplayed();
  if (!isDisplayed) {
    throw new Error('Logo is not visible on the Create DAO essentials page!');
  }
  console.log('Logo is present and visible on the Create DAO essentials page.');
}, test);
