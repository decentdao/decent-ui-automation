import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

// This test won't work until the staking tab shows content when not connected to a wallet...

/**
 * @governance erc20
 * This test does not apply for erc721 DAOs at this time
 */

// Parse governance type from CLI args
const governanceArg = process.argv.find(arg => arg.startsWith('--governance='));
const governanceType = governanceArg ? governanceArg.split('=')[1].toLowerCase() : 'erc20';

const test = new BaseSeleniumTest('settings', 'staking-tab');
BaseSeleniumTest.run(async (test) => {
  // Load the DAO homepage
  await test.start();
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao(governanceType).value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  // Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
  await manageBtn.click();
  // Click on the 'Staking' tab
  const modulesTab = await test.waitForElement(By.css("[data-testid='settings-nav-staking']"));
  await modulesTab.click();
  // Wait for the Staking contract address text
  await test.waitForElement(By.xpath("//p[text()='0xB7Aa4235F92544C6128CEE80Ccd9c039d3644e63']"));
  console.log('Staking tab opened and Staking contract address text found.');
}, test);
