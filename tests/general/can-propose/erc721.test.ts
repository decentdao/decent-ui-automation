import { getBaseUrl, appendFlagsToUrl, verifyWalletConnected } from '../../test-helpers';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { setupWalletImpersonator } from '../../wallet-impersonator';
import { defaultWalletAddress } from '../../../config/test-settings';
import { getTestDao } from '../../../config/test-daos';
import { pages } from '../../../config/pages';
import { By } from 'selenium-webdriver';

const test = new BaseSeleniumTest('can-propose', 'erc721');

BaseSeleniumTest.run(async (test) => {
  await test.start();

  // Set up wallet impersonation in the first tab and get the new tab handle
  await setupWalletImpersonator(test.driver!, { walletAddress: defaultWalletAddress }, getBaseUrl());
  
  // Navigate to the ERC721 DAO homepage
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('erc721nohats').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  
  // Verify wallet connection before proceeding with the main test
  const isWalletConnected = await verifyWalletConnected(test);
  if (!isWalletConnected) {
    console.warn('[Test] Wallet connection could not be verified, but proceeding with test...');
  }
  
  // Look for the Create Proposal button with extended timeout for better reliability
  try {
    await test.waitForElement(By.css("[data-testid='desktop-createProposal']"), { extra: 5000 });
    console.log('Create Proposal button found, isProposer check succeeded.');
  } catch (error) {
    // If button not found, try one more refresh and wait
    await test.driver!.navigate().refresh();
    await test.driver!.sleep(3000);
    
    await test.waitForElement(By.css("[data-testid='desktop-createProposal']"), { extra: 5000 });
    console.log('Create Proposal button found after refresh, isProposer check succeeded.');
  }
  
}, test);
