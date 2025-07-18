
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('roles', 'header-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  const pagePath = `${pages['roles']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + pagePath));
  const logo = await test.waitForElement(By.css('[data-testid="navigationLogo-homeLink"]'));
  const isDisplayed = await logo.isDisplayed();
  if (!isDisplayed) {
    throw new Error('Logo is not visible on the Roles page!');
  }
  console.log('Logo is present and visible on the Roles page.');
}, test);
