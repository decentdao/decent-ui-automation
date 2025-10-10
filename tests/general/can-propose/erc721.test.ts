import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { setupWalletImpersonator } from '../../wallet-impersonator';
import { defaultWalletAddress } from '../../../config/test-settings';
import { getTestDao } from '../../../config/test-daos';
import { pages } from '../../../config/pages';
import { By } from 'selenium-webdriver';

const test = new BaseSeleniumTest('can-propose', 'erc721');

BaseSeleniumTest.run(async (test) => {
  await test.start();
  
  // Retry logic for flaky can-propose test
  const maxRetries = 3;
  let retryCount = 0;
  let canProposeCheckSucceeded = false;
  
  while (!canProposeCheckSucceeded && retryCount < maxRetries) {
    try {
      console.log(`Attempting can-propose check (attempt ${retryCount + 1}/${maxRetries})`);
      
      // Set up wallet impersonation in the first tab and get the new tab handle
      await setupWalletImpersonator(test.driver!, { walletAddress: defaultWalletAddress }, getBaseUrl());
      
      // Navigate to the ERC721 DAO homepage
      const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('erc721nohats').value}`;
      await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
      
      // Look for the Create Proposal button
      await test.waitForElement(By.css("[data-testid='desktop-createProposal']"));
      
      // If we get here without an exception, the can-propose check succeeded
      canProposeCheckSucceeded = true;
      console.log(`Can-propose check succeeded on attempt ${retryCount + 1} - Create Proposal button found, isProposer check succeeded.`);
      
    } catch (error) {
      retryCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Failed can-propose check on attempt ${retryCount}, error: ${errorMessage}`);
      
      if (retryCount >= maxRetries) {
        throw new Error(`Failed can-propose check after ${maxRetries} attempts. Last error: ${errorMessage}`);
      }
      
      // Wait a moment before retrying
      await test.driver!.sleep(2000);
    }
  }
}, test);
