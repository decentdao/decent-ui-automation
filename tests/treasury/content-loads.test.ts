import { getBaseUrl, appendFlagsToUrl } from '../test-helpers';
import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';

const PAGE_PATH = `${pages['treasury']}?dao=${testDaos.ERC20.value}`;

const test = new BaseSeleniumTest('treasury', 'treasury/content-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + PAGE_PATH));
  await test.waitForElement(By.xpath("//*[contains(text(), 'TSTK')]") , 10000);
  console.log('Treasury page loaded and string "TSTK" found.');
}, test);
