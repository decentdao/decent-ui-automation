import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

// Parse governance type from CLI args
const governanceArg = process.argv.find(arg => arg.startsWith('--governance='));
const governanceType = governanceArg ? governanceArg.split('=')[1].toLowerCase() : 'erc20';

const test = new BaseSeleniumTest('treasury', 'transfer-action');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  const pagePath = `${pages['treasury']}?dao=${getTestDao(governanceType).value}&demo_mode=on`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + pagePath));
  // Click the menu button by data-testid
  const menuBtn = await test.waitForElement(By.css('[data-testid="treasury-treasuryActions"]'));
  await menuBtn.click();
  // Wait briefly for menu to open
  await test.driver!.sleep(500);
  // Click the transfer option via stable test id
  const transferBtn = await test.waitForElement(By.css('[data-testid="optionMenu-transfer"]'));
  await transferBtn.click();
  // Wait for the input field for ETH address
  await test.waitForElement(By.css('input#searchButActuallyEthAddress'));
  console.log('Transfer action flow loaded and ETH address input found.');
}, test);
