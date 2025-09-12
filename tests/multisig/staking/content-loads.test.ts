import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('staking', 'content-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  const pagePath = `${pages['staking']}?dao=${getTestDao('multisigStaking').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + pagePath));
  
  // NOTE: This shouldn't be necessary, but works around page contents not showing on first load
  await test.driver!.sleep(5000);
  await test.driver!.navigate().refresh();

  // Wait for the input field to appear - extra wait due to the above
  const inputField = await test.waitForElement(By.xpath("//input[@type='text'][1]"), { extra: 5000 });
  console.log('Staking page loaded and input field found.');
  
  // Enter a test value
  const testValue = '123.45';
  await inputField.sendKeys(testValue);
  
  // Assert the value was entered correctly
  const enteredValue = await inputField.getAttribute('value');
  if (enteredValue === testValue) {
    console.log(`Successfully entered and verified value: ${testValue}`);
  } else {
    throw new Error(`Expected value '${testValue}' but got '${enteredValue}'`);
  }
}, test);
