import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';
import { getBaseUrl } from '../test-helpers';

const DAO_HOME_PATH = `${pages['dao-homepage']}?dao=${testDaos.ERC20.value}`;

const test = new BaseSeleniumTest('dao-homepage', 'dao-homepage/header-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  await test.driver!.get(getBaseUrl() + DAO_HOME_PATH);
  const logo = await test.waitForElement(By.css('[data-testid="navigationLogo-homeLink"]'), 10000);
  const isDisplayed = await logo.isDisplayed();
  if (!isDisplayed) {
    throw new Error('Logo is not visible on the DAO homepage!');
  }
  console.log('Logo is present and visible on the DAO homepage.');
}, test);
