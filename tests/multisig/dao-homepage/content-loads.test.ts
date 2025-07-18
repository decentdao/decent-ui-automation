import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';

// Always use the multisig DAO for this test
const DAO_HOME_PATH = `${pages['dao-homepage']}?dao=${getTestDao('multisig').value}`;

const test = new BaseSeleniumTest('dao-homepage', 'content-loads');
BaseSeleniumTest.run(async (test) => {
  // Load the DAO homepage for multisig DAO
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + DAO_HOME_PATH));
  // Confirm the settings button is present
  await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
  console.log('DAO homepage loaded and settings button found (multisig).');
}, test);

