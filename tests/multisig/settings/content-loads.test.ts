
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('settings', 'content-loads');
BaseSeleniumTest.run(async (test) => {
  // Step 1: Load the DAO homepage
  await test.start();
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  // Step 2: Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'), 10000);
  await manageBtn.click();
  // Step 3: Wait for the 'General' text in the modal
  await test.waitForElement(By.xpath("//p[text()='General']"), 10000);
  console.log('Settings modal opened and "General" text found.');
}, test);
