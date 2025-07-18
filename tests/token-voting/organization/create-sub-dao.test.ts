import { testDaos } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';

const ORG_PATH = `${pages['organization']}?dao=${testDaos.ERC20.value}&demo_mode=on`;

const test = new BaseSeleniumTest('organization', 'create-sub-dao');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  // Load the organization page
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + ORG_PATH));
  // Wait for the Create SubDAO button and click it
  const createBtn = await test.waitForElement(By.xpath("//button[contains(., 'Create SubDAO')]"));
  await createBtn.click();
  // Wait for the input with data-testid="essentials-daoName"
  await test.waitForElement(By.css('input[data-testid="essentials-daoName"]'));
  console.log('Create SubDAO flow loaded and DAO name input found.');
}, test);
