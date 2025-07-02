
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';


// Parse governance type from CLI args
const governanceArg = process.argv.find(arg => arg.startsWith('--governance='));
const governanceType = governanceArg ? governanceArg.split('=')[1].toLowerCase() : 'erc20';

const test = new BaseSeleniumTest('proposal-overview', 'content-loads');
BaseSeleniumTest.run(async (test) => {
  let proposalNumber: string | null = null;
  await test.start();
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
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
