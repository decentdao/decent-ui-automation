import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

// This test is kind of garbage because it can only test the zero state of the page at the moment. Need to consider how to simulate connecting to a wallet to make this better.

const test = new BaseSeleniumTest('staking', 'content-loads');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  const pagePath = `${pages['staking']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + pagePath));
  // Wait for the Go to Settings button to appear
  await test.waitForElement(By.xpath("//button[contains(., 'Go to Settings')]"));
  console.log('Staking page loaded and Go to Settings button found.');
}, test);
