import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('settings', 'governance-tab');
BaseSeleniumTest.run(async (test) => {
  // Step 1: Load the DAO homepage
  await test.start();
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  // Step 2: Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
  await manageBtn.click();
  // Step 3: Wait for the 'General' text in the modal
  await test.waitForElement(By.xpath("//p[text()='General']"));
  // Step 4: Click on the 'Governance' tab
  const governanceTab = await test.waitForElement(By.xpath("//p[text()='Governance']"));
  await governanceTab.click();
  // Step 5: Wait for the Remove Signer element
  await test.waitForElement(By.css('[aria-label="Remove Signer"]'));
  console.log('Governance tab opened and "Remove Signer" element found.');
}, test);
