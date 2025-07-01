import { getBaseUrl, appendFlagsToUrl } from '../test-helpers';
import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';

const DAO_HOME_PATH = `${pages['dao-homepage']}?dao=${testDaos.ERC20.value}`;

const test = new BaseSeleniumTest('proposal-overview', 'proposal-overview/content-loads');
BaseSeleniumTest.run(async (test) => {
  let proposalNumber: string | null = null;
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + DAO_HOME_PATH));
  // Find the first proposal link
  const proposalLink = await test.waitForElement(By.css('a[href^="/proposals/"]'), 20000);
  const href = await proposalLink.getAttribute('href');
  const match = href.match(/\/proposals\/(\d+)/);
  if (!match) throw new Error('No proposal link found!');
  proposalNumber = match[1];
  await proposalLink.click();
  await test.driver!.sleep(500);
  // Wait for the proposal number to appear on the overview page
  await test.waitForElement(By.xpath(`//*[contains(text(), '#${proposalNumber}')]`), 10000);
  console.log(`Proposal overview page loaded and found #${proposalNumber}.`);
}, test);
