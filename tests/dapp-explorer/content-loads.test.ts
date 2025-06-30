import { getBaseUrl } from '../test-helpers';
import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';

const DAO_HOME_PATH = `${pages['dao-homepage']}?dao=${testDaos.ERC20.value}&demo_mode=on`;

const test = new BaseSeleniumTest('dapp-explorer', 'dapp-explorer/content-loads');
BaseSeleniumTest.run(async (test) => {
  // Load the DAO homepage with demo_mode enabled
  await test.start();
  await test.driver!.get(getBaseUrl() + DAO_HOME_PATH);
  // Open the dApp Explorer modal
  const createProposalBtn = await test.waitForElement(By.xpath("//button[contains(., 'Create Proposal')]"), 10000);
  await createProposalBtn.click();
  const useDappsOption = await test.waitForElement(By.css('[data-testid="optionMenu-Use dApps"]'), 10000);
  await useDappsOption.click();
  // Confirm the CoW Swap image is present
  await test.waitForElement(By.css('img[alt="CoW Swap"]'), 10000);
  console.log('dApp Explorer modal loaded and CoW Swap image found.');
}, test);
