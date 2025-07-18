
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';


// Parse governance type from CLI args
const governanceArg = process.argv.find(arg => arg.startsWith('--governance='));
const governanceType = governanceArg ? governanceArg.split('=')[1].toLowerCase() : 'erc20';

const test = new BaseSeleniumTest('roles', 'header-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  const pagePath = `${pages['roles']}?dao=${getTestDao(governanceType).value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + pagePath));
  const logo = await test.waitForElement(By.css('[data-testid="navigationLogo-homeLink"]'));
  const isDisplayed = await logo.isDisplayed();
  if (!isDisplayed) {
    throw new Error('Logo is not visible on the Roles page!');
  }
  console.log('Logo is present and visible on the Roles page.');
}, test);
