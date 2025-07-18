
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

const PAGE_PATH = `${pages['organization']}?dao=${getTestDao('multisig').value}`;

const test = new BaseSeleniumTest('organization', 'header-loads');
BaseSeleniumTest.run(
  async (test) => {
    await test.start();
    await test.driver!.get(appendFlagsToUrl(getBaseUrl() + PAGE_PATH));
    const logo = await test.waitForElement(By.css('[data-testid="navigationLogo-homeLink"]'));
    const isDisplayed = await logo.isDisplayed();
    if (!isDisplayed) {
      throw new Error('Logo is not visible on the Organization page!');
    }
    console.log('Logo is present and visible on the Organization page.');
  },
  test
);
