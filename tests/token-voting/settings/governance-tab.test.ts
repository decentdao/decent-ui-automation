import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

// Parse governance type from CLI args
const governanceArg = process.argv.find(arg => arg.startsWith('--governance='));
const governanceType = governanceArg ? governanceArg.split('=')[1].toLowerCase() : 'erc20';

const test = new BaseSeleniumTest('settings', 'governance-tab');
BaseSeleniumTest.run(async (test) => {
  // Load the DAO homepage
  await test.start();
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao(governanceType).value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  // Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
  await manageBtn.click();
  
  // Retry logic for clicking the Governance tab (handles click interception)
  const maxRetries = 3;
  let retryCount = 0;
  let governanceTabClicked = false;
  
  while (!governanceTabClicked && retryCount < maxRetries) {
    try {
      console.log(`Attempting to click Governance tab (attempt ${retryCount + 1}/${maxRetries})`);
      
      // Click on the 'Governance' tab
      const governanceTab = await test.waitForElement(By.xpath("//p[text()='Governance']"));
      await governanceTab.click();
      
      // Wait for the chakra form label element to confirm tab loaded
      await test.waitForElement(By.css('[class*="chakra-form__label"]'), { extra: 5000 });
      
      // If we get here without an exception, the tab was clicked successfully
      governanceTabClicked = true;
      console.log(`Governance tab clicked successfully on attempt ${retryCount + 1} - form label element found.`);
      
    } catch (error) {
      retryCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Failed to click Governance tab on attempt ${retryCount}, error: ${errorMessage}`);
      
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to click Governance tab after ${maxRetries} attempts. Last error: ${errorMessage}`);
      }
      
      // Wait a bit before retrying
      await test.driver!.sleep(2000);
    }
  }
}, test);
