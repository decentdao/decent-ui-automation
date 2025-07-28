import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('settings', 'governance-tab');
BaseSeleniumTest.run(async (test) => {
  // Load the DAO homepage
  await test.start();
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  // Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
  await manageBtn.click();

  // Retry logic for Governance tab activation and input detection
  const maxRetries = 3;
  let attempt = 0;
  let success = false;
  let lastError;
  while (attempt < maxRetries && !success) {
    try {
      // Click on the 'Governance' tab using JavaScript to bypass click interception
      const governanceTab = await test.waitForElement(By.xpath("//p[text()='Governance']"));
      await test.driver!.executeScript("arguments[0].click();", governanceTab);
      // Wait for the signer input with value starting with "0x"
      await test.waitForElement(By.css('input[value^="0x"]'));
      success = true;
      console.log('Governance tab clicked and signer address found.');
    } catch (err) {
      lastError = err;
      attempt++;
      if (attempt < maxRetries) {
        console.log(`Governance tab not loaded, retrying (${attempt}/${maxRetries})...`);
        await test.driver!.sleep(1000);
      }
    }
  }
  if (!success) {
    throw lastError;
  }
}, test);
