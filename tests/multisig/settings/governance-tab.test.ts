import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

/* This test is extremely flaky for some reason. It seems identical to the token-voting test, but it struggles
to click the governance tab. Most failures have been when the test thinks that the tab has been clicked, but
the tab contents have not loaded. There have been many attempts at addressing this, but the underlying issue
seems to have to do with the modal/overlay resulting in clicks being intercepted by other elements. */

const test = new BaseSeleniumTest('settings', 'governance-tab');
BaseSeleniumTest.run(async (test) => {
  // Load the DAO homepage
  await test.start();

  // Maybe setting the window size will help with the click interception issue
  await test.driver!.manage().window().setRect({ width: 1400, height: 1000 });


  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  // Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
  await manageBtn.click();
  // Click on the 'Governance' tab using JavaScript to bypass click interception
  const governanceTab = await test.waitForElement(By.xpath("//p[text()='Governance']"));

  // Try using the actions API to click the tab
  const actions = test.driver!.actions({ bridge: true });
  await actions.move({ origin: governanceTab }).click().perform();

  // This is the method that should work, as it works with token-voting
  // await test.driver!.executeScript("arguments[0].click();", governanceTab);

  // Wait for the signer input with value starting with "0x"
  await test.waitForElement(By.css('input[value^="0x"]'));
  console.log('Governance tab clicked and signer address found.');
}, test);
