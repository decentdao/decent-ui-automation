import { getBaseUrl, appendFlagsToUrl, checkWalletConnectionStatus } from '../../test-helpers';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { setupWalletImpersonator } from '../../wallet-impersonator';
import { defaultWalletAddress } from '../../../config/test-settings';
import { getTestDao } from '../../../config/test-daos';
import { pages } from '../../../config/pages';
import { By } from 'selenium-webdriver';

const test = new BaseSeleniumTest('can-propose', 'erc721hats');

BaseSeleniumTest.run(async (test) => {
  await test.start();

  // Set up wallet impersonation in the first tab and get the new tab handle
  await setupWalletImpersonator(test.driver!, { walletAddress: defaultWalletAddress }, getBaseUrl());
  
  // Navigate to the ERC721-hats DAO homepage
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('erc721').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  
  // Give extra time for wallet connection state to propagate in CI
  await test.driver!.sleep(3000);
  
  // Check wallet connection and apply lightweight remediation if needed
  let walletStatus = await checkWalletConnectionStatus(test);
  if (!walletStatus.connected) {
    console.warn(`[Test] Wallet not connected on first check - header shows: "${walletStatus.menuText}"`);
    console.log('[Test] Applying lightweight remediation: refresh + wait');
    
    // Light remediation: refresh the page and wait a bit more
    await test.driver!.navigate().refresh();
    await test.driver!.sleep(3000);
    
    // Check again after remediation
    walletStatus = await checkWalletConnectionStatus(test);
    if (!walletStatus.connected) {
      console.error(`[Test] Wallet still not connected after remediation - header shows: "${walletStatus.menuText}"`);
      console.error('[Test] Proceeding with test (will likely fail at Create Proposal button)');
    } else {
      console.log('[Test] Wallet connection recovered after refresh');
    }
  }
  
  // Look for the Create Proposal button - if wallet isn't connected, this will fail as expected
  try {
    await test.waitForElement(By.css("[data-testid='desktop-createProposal']"), { extra: 3000 });
    console.log('Create Proposal button found, isProposer check succeeded.');
  } catch (error) {
    // One retry with refresh if button not found
    console.warn('[Test] Create Proposal button not found, trying refresh...');
    await test.driver!.navigate().refresh();
    await test.driver!.sleep(2000);
    
    await test.waitForElement(By.css("[data-testid='desktop-createProposal']"), { extra: 3000 });
    console.log('Create Proposal button found after refresh, isProposer check succeeded.');
  }
  
}, test);
