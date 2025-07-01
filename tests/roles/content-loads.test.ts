import { getBaseUrl, appendFlagsToUrl } from '../test-helpers';
import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';

const ROLES_PATH = `${pages['roles']}?dao=${testDaos.ERC20.value}`;

const test = new BaseSeleniumTest('roles', 'roles/content-loads');
BaseSeleniumTest.run(async (test) => {
  // Load the roles page
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + ROLES_PATH));
  // Confirm the image with the given alt is present (wait up to 20000ms)
  await test.waitForElement(By.css('img[alt="0xAf3ee09F37ead9F28a05AeF0d09841BC9A6Fe8e9"]'), 20000);
  console.log('Roles page loaded and image with correct alt found.');
}, test);
