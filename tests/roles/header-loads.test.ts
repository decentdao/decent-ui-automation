import { getBaseUrl, appendFlagsToUrl } from '../test-helpers';
import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';

const PAGE_PATH = `${pages['roles']}?dao=${testDaos.ERC20.value}`;

const test = new BaseSeleniumTest('roles', 'roles/header-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + PAGE_PATH));
  const logo = await test.waitForElement(By.css('[data-testid="navigationLogo-homeLink"]'), 10000);
  const isDisplayed = await logo.isDisplayed();
  if (!isDisplayed) {
    throw new Error('Logo is not visible on the Roles page!');
  }
  console.log('Logo is present and visible on the Roles page.');
}, test);
