import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

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
  
  const maxRetries = 3;
  let retryCount = 0;
  
  const runTestSteps = async () => {
    await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
    // NOTE: This shouldn't be necessary, but works around an issue with the tab contents showing on first load
    await test.driver!.sleep(5000);
    await test.driver!.navigate().refresh();
    // Click the 'Manage DAO' button
    const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
    await manageBtn.click();
    // Click on the 'Staking' tab
    const modulesTab = await test.waitForElement(By.css("[data-testid='settings-nav-staking']"));
    await modulesTab.click();
    // Wait for the Staking contract address text
    await test.waitForElement(By.xpath("//p[text()='0x5844b5eEe93390aB0cE9C7B6544A109657389Aa4']"));
  };
  
  while (retryCount < maxRetries) {
    try {
      await runTestSteps();
      console.log('Staking tab opened and Staking contract address text found.');
      break; // Success, exit retry loop
    } catch (error) {
      retryCount++;
      console.log(`Test attempt ${retryCount} failed. ${retryCount < maxRetries ? 'Retrying...' : 'Max retries reached.'}`);
      
      if (retryCount >= maxRetries) {
        throw error; // Re-throw the error after max retries
      }
      
      // Wait a moment before retrying
      await test.driver!.sleep(2000);
    }
  }
}, test);
