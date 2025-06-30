import { getBaseUrl } from '../test-helpers';
import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';

const DAO_HOME_PATH = `${pages['dao-homepage']}?dao=${testDaos.ERC20.value}`;

const test = new BaseSeleniumTest('settings', 'settings/content-loads');
BaseSeleniumTest.run(async (test) => {
  // Step 1: Load the DAO homepage
  await test.start();
  await test.driver!.get(getBaseUrl() + DAO_HOME_PATH);
  // Step 2: Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'), 10000);
  await manageBtn.click();
  // Step 3: Wait for the 'General' text in the modal
  await test.waitForElement(By.xpath("//p[text()='General']"), 10000);
  console.log('Settings modal opened and "General" text found.');
}, test);
