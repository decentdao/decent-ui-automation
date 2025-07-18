import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';

const ROLES_PATH = `${pages['roles']}?dao=${getTestDao('multisig').value}&demo_mode=on`;

const test = new BaseSeleniumTest('roles', 'add-role');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  // Load the roles page
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + ROLES_PATH));
  // Click the button with text "Edit Roles"
  const editRolesBtn = await test.waitForElement(By.xpath("//button[contains(., 'Edit Roles')]"));
  await editRolesBtn.click();
  // Click the button with text "Add Role"
  const addRoleBtn = await test.waitForElement(By.xpath("//button[contains(., 'Add Role')]"));
  await addRoleBtn.click();
  // Wait for the input with data-testid="role-name"
  await test.waitForElement(By.css('input[data-testid="role-name"]'));
  console.log('Add Role flow loaded and role name input found.');
}, test);
