import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('settings', 'permissions-tab');
BaseSeleniumTest.run(async (test) => {
  // Step 1: Load the DAO homepage
  await test.start();
  
  // Parse governance type from command line args
  const args = process.argv.slice(2);
  const governanceArg = args.find(arg => arg.startsWith('--governance='));
  const governance = governanceArg ? governanceArg.split('=')[1] : 'token-voting';
  
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao(governance as 'token-voting').value}&demo_mode=on`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  
  // Step 2: Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
  await manageBtn.click();
  
  // Step 3: Wait for the 'General' text in the modal
  await test.waitForElement(By.xpath("//p[text()='General']"));
  
  // Step 4: Click on the 'Permissions' tab
  const permissionsTab = await test.waitForElement(By.xpath("//p[text()='Permissions']"));
  await permissionsTab.click();
  
  // Step 5: Wait for a button with aria-label="edit"
  await test.waitForElement(By.css('button[aria-label="edit"]'));
  console.log('Permissions tab opened and edit button found.');
}, test);
