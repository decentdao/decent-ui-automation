import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

// Always use the multisig DAO for this test
const PAGE_PATH = `${pages['dao-homepage']}?dao=${getTestDao('multisig').value}`;

const test = new BaseSeleniumTest('dao-homepage', 'header-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + PAGE_PATH));
  const logo = await test.waitForElement(By.css('[data-testid="navigationLogo-homeLink"]'), 10000);
  const isDisplayed = await logo.isDisplayed();
  if (!isDisplayed) {
    throw new Error('Logo is not visible on the DAO homepage (multisig)!');
  }
  console.log('Logo is present and visible on the DAO homepage (multisig).');
}, test);

