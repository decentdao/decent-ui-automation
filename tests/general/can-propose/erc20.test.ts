import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { setupWalletImpersonator } from '../../wallet-impersonator';
import { defaultWalletAddress } from '../../../config/test-settings';
import { getTestDao } from '../../../config/test-daos';
import { pages } from '../../../config/pages';
import { By } from 'selenium-webdriver';

const test = new BaseSeleniumTest('can-propose', 'erc20');

BaseSeleniumTest.run(async (test) => {
  await test.start();

  // Set up wallet impersonation in the first tab and get the new tab handle
  await setupWalletImpersonator(test.driver!, { walletAddress: defaultWalletAddress }, getBaseUrl());
  
  // Navigate to the ERC20 DAO homepage
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('erc20').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  
  // Look for the Create Proposal button
  await test.driver?.sleep(2000);
  await test.driver!.navigate().refresh();
  await test.waitForElement(By.css("[data-testid='desktop-createProposal']"));
  console.log('Create Proposal button found, isProposer check succeeded.');
  
}, test);
