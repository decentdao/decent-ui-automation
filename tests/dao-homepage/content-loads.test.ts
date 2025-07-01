import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';
import { getBaseUrl, appendFlagsToUrl } from '../test-helpers';

const DAO_HOME_PATH = `${pages['dao-homepage']}?dao=${testDaos.ERC20.value}`;

const test = new BaseSeleniumTest('dao-homepage', 'dao-homepage/content-loads');
BaseSeleniumTest.run(async (test) => {
  // Load the DAO homepage
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + DAO_HOME_PATH));
  // Confirm the settings button is present
  await test.waitForElement(By.css('[aria-label="Manage DAO"]'), 10000);
  console.log('DAO homepage loaded and settings button found.');
}, test);
