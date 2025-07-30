import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

/* There are very specific things we need to do to ensure this test is stable.
Unfortunately, if the test runs in CI, it tends to run slower and this is where things fall apart.
For some reason, when the test runs quickly, it has no trouble using the paragraph text as reference
for the tab. But when the page has more time to load, it catches the wrong element, which is underneath
the settings modal. Therefore, the test must account for both possibilities. */

const test = new BaseSeleniumTest('settings', 'governance-tab');
BaseSeleniumTest.run(async (test) => {
  // Load the DAO homepage
  await test.start();

  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  // Click the 'Manage DAO' button
  const manageBtn = await test.waitForElement(By.css('[aria-label="Manage DAO"]'));
  await manageBtn.click();
  // Find all <p> elements with text 'Governance'
  const governanceTabs = await test.driver!.findElements(By.xpath("//p[text()='Governance']"));
  if (governanceTabs.length === 0) {
    throw new Error('Could not find any <p> element with text "Governance".');
  }

  // Try the first <p> element
  let found = false;
  const actions = test.driver!.actions({ bridge: true });
  await actions.move({ origin: governanceTabs[0] }).click().perform();
  try {
    await test.waitForElement(By.css('input[value^="0x"]'), 2000);
    found = true;
  } catch (e) {
    // Not found, try the second <p> element if it exists
    if (governanceTabs.length > 1) {
      await actions.move({ origin: governanceTabs[1] }).click().perform();
      await test.waitForElement(By.css('input[value^="0x"]'), 2000);
      found = true;
    }
  }
  if (!found) {
    throw new Error('Governance tab could not be activated by clicking either <p> element.');
  }
  console.log('Governance tab clicked and signer address found.');
}, test);
