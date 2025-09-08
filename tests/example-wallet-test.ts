import { getBaseUrl, appendFlagsToUrl } from './test-helpers';
import { BaseSeleniumTest } from './base-selenium-test';
import { setupWalletImpersonator } from './wallet-impersonator';
import { defaultWalletAddress } from '../config/test-settings';
import { getTestDao } from '../config/test-daos';
import { pages } from '../config/pages';
import { By } from 'selenium-webdriver';

const test = new BaseSeleniumTest('general', 'wallet-example');

BaseSeleniumTest.run(async (test) => {
  await test.start();

  // Set up wallet impersonation in the first tab and get the new tab handle
  await setupWalletImpersonator(test.driver!, { walletAddress: defaultWalletAddress }, getBaseUrl());
  
  // Navigate to the ERC20 DAO homepage
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('erc20').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  
  // Look for a button with the text 'Delegate' to verify wallet impersonation is working
  await test.waitForElement(By.xpath("//button[contains(., 'Delegate')]"));
  console.log('Test completed successfully - Delegate button found, wallet impersonation is working!');
  
}, test);
