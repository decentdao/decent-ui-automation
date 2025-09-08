import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('settings', 'distribution-tab');
BaseSeleniumTest.run(async (test) => {
  // Load the DAO homepage
  await test.start();
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('multisigStaking').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  // Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
  await manageBtn.click();
  // Click on the 'Revenue Sharing' tab
  const modulesTab = await test.waitForElement(By.css("[data-testid='settings-nav-revenue-sharing']"));
  await modulesTab.click();
  // Wait for the Split address text
  await test.waitForElement(By.xpath("//p[text()='0x33bb...f535']"));
  console.log('Revenue Sharing tab opened and Split address text found.');
}, test);
