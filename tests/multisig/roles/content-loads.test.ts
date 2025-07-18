
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

const test = new BaseSeleniumTest('roles', 'content-loads');
BaseSeleniumTest.run(async (test) => {
  // Load the roles page
  await test.start();
  const rolesPath = `${pages['roles']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + rolesPath));
  // Confirm the image with the given alt is present (needs extra time to load)
  await test.waitForElement(By.css('img[alt="0xAf3ee09F37ead9F28a05AeF0d09841BC9A6Fe8e9"]'), { extra: 10000 });
  console.log('Roles page loaded and image with correct alt found.');
}, test);
