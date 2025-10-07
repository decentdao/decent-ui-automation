import { BaseSeleniumTest } from '../../base-selenium-test';
import { By, Key } from 'selenium-webdriver';
import { getBaseUrl, appendFlagsToUrl, scrollOpenDropdownToBottom } from '../../test-helpers';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('create-dao', 'erc721-workflow');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + pages['create-dao']));
  
  // Wait for the essentials DAO name input to appear
  const daoNameInput = await test.waitForElement(By.css('[data-testid="essentials-daoName"]'));
  
  // Enter "test" into the DAO name field
  await daoNameInput.sendKeys('test');
  
  // Open the network dropdown menu
  const networkDropdown = await test.waitForElement(By.css('#menu-button-\\:r9\\:'));
  await networkDropdown.click();
  // Scroll the dropdown menu itself to the bottom so the target option is visible
  await scrollOpenDropdownToBottom(test.driver!);
  
  // Select Sepolia network
  const sepoliaOption = await test.waitForElement(By.css('button[data-index="4"]'));
  await sepoliaOption.click();
  
  // Select the azorius-erc721 option
  const azoriusErc721Option = await test.waitForElement(By.css('[data-testid="choose-azorius-erc721"]'));
  await azoriusErc721Option.click();
  
  // Find and click the skip next button
  const skipNextButton = await test.waitForElement(By.css('[data-testid="create-skipNextButton"]'));
  await skipNextButton.click();
  
  // Enter NFT token inputs with retry logic for form validation
  const maxRetries = 3;
  let retryCount = 0;
  let formValidationPassed = false;
  
  while (!formValidationPassed && retryCount < maxRetries) {
    try {
      console.log(`Attempting to fill NFT token form (attempt ${retryCount + 1}/${maxRetries})`);
      
      // Clear and enter NFT token address
      const tokenAddressInput = await test.waitForElement(By.css('[data-testid="erc721Token.nfts.0.tokenAddressInput"]'));
      await tokenAddressInput.click();
      await tokenAddressInput.sendKeys(Key.CONTROL + 'a');
      await tokenAddressInput.sendKeys('0x31408f226E37FBF8715CA6eE45aaB4Ea213bA7A5');
      await test.driver!.sleep(500);
      
      // Clear and enter NFT token weight
      const tokenWeightInput = await test.waitForElement(By.css('[data-testid="erc721Token.nfts.0.tokenWeightInput"]'));
      await tokenWeightInput.click();
      await tokenWeightInput.sendKeys(Key.CONTROL + 'a');
      await tokenWeightInput.sendKeys('2');
      await test.driver!.sleep(500);
      
      // Tab out of the weight input to trigger form validation
      await tokenWeightInput.sendKeys(Key.TAB);
      await test.driver!.sleep(1000);
      
      // Check if the next button becomes enabled (indicates form validation passed)
      const nextButton = await test.waitForElement(By.css('[data-testid="create-skipNextButton"]'));
      const isEnabled = await nextButton.isEnabled();
      
      if (isEnabled) {
        formValidationPassed = true;
        console.log(`Form validation passed on attempt ${retryCount + 1}`);
      } else {
        throw new Error('Next button is not enabled - form validation failed');
      }
      
    } catch (error) {
      retryCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Form validation failed on attempt ${retryCount}, error: ${errorMessage}`);
      
      if (retryCount >= maxRetries) {
        throw new Error(`Form validation failed after ${maxRetries} attempts. Last error: ${errorMessage}`);
      }
      
      // Wait a bit before retrying
      await test.driver!.sleep(2000);
    }
  }

  // Click skip next button to proceed to next page
  const skipNextButton2 = await test.waitForElement(By.css('[data-testid="create-skipNextButton"]'));
  await skipNextButton2.click();
  
  // Wait for the next page to load
  const quorumThresholdInput = await test.waitForElement(By.css('[data-testid="govConfig-quorumThreshold"]'), 8000);

  // Enter quorum threshold
  await quorumThresholdInput!.sendKeys('1');

  // Click deploy DAO button
  const deployButton = await test.waitForElement(By.css('[data-testid="create-deployDAO"]'));
  
  // Assert that the deploy button is clickable
  const isClickable = await deployButton.isEnabled();
  if (!isClickable) {
    throw new Error('Deploy DAO button is not clickable');
  }
  
  console.log('DAO creation workflow completed and deploy button is clickable.');
  
}, test);
