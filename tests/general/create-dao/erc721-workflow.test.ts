import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
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
  
  // Select Sepolia network
  const sepoliaOption = await test.waitForElement(By.css('button[data-index="4"]'));
  await sepoliaOption.click();
  
  // Select the azorius-erc721 option
  const azoriusErc721Option = await test.waitForElement(By.css('[data-testid="choose-azorius-erc721"]'));
  await azoriusErc721Option.click();
  
  // Find and click the skip next button
  const skipNextButton = await test.waitForElement(By.css('[data-testid="create-skipNextButton"]'));
  await skipNextButton.click();
  
  // Enter NFT token address
  const tokenAddressInput = await test.waitForElement(By.css('[data-testid="erc721Token.nfts.0.tokenAddressInput"]'));
  await tokenAddressInput.sendKeys('0x31408f226E37FBF8715CA6eE45aaB4Ea213bA7A5');
  
  // Wait for field validation to complete
  await test.driver!.sleep(1000);
  
  // Enter NFT token weight
  const tokenWeightInput = await test.waitForElement(By.css('[data-testid="erc721Token.nfts.0.tokenWeightInput"]'));
  await tokenWeightInput.sendKeys('1');

  // Wait for field validation to complete
  await test.driver!.sleep(1000);
  
  // Click skip next button again
  const skipNextButton2 = await test.waitForElement(By.css('[data-testid="create-skipNextButton"]'));
  await skipNextButton2.click();

  // Enter quorum threshold
  const quorumThresholdInput = await test.waitForElement(By.css('[data-testid="govConfig-quorumThreshold"]'));
  await quorumThresholdInput.sendKeys('1');

  // Click deploy DAO button
  const deployButton = await test.waitForElement(By.css('[data-testid="create-deployDAO"]'));
  await deployButton.click();
  
  // Assert that the expected toast appears
  const toast = await test.waitForElement(By.xpath("//*[contains(text(), 'Connect an account to proceed!')]"));
  console.log('ERC721 DAO creation workflow completed and wallet connection prompt appeared.');
  
}, test);
