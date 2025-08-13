import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';

// Parse governance type from CLI args
const governanceArg = process.argv.find(arg => arg.startsWith('--governance='));
const governanceType = governanceArg ? governanceArg.split('=')[1].toLowerCase() : 'erc20';

const test = new BaseSeleniumTest('roles', 'add-role');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  // Load the roles page
  const rolesPath = `${pages['roles']}?dao=${getTestDao(governanceType).value}&demo_mode=on`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + rolesPath));
  // Click the Edit Roles button via stable test id
  const editRolesBtn = await test.waitForElement(By.css('[data-testid="roles-editRoles"]'));
  await editRolesBtn.click();
  // Click the Add Role button via stable test id
  const addRoleBtn = await test.waitForElement(By.css('[data-testid="roles-addRole"]'));
  await addRoleBtn.click();
  // Wait for the input with data-testid="role-name"
  await test.waitForElement(By.css('input[data-testid="role-name"]'));
  console.log('Add Role flow loaded and role name input found.');
}, test);
