
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';

const ORG_PATH = `${pages['organization']}?dao=${getTestDao('multisig').value}`;

const test = new BaseSeleniumTest('organization', 'content-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  // Load the organization page
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + ORG_PATH));
  // Confirm the toggle favorite Safes button is present
  await test.waitForElement(By.css('[aria-label="Toggle your favorite Safes."]'), 10000);
  console.log('Organization page loaded and favorite Safes toggle button found.');
}, test);
