
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

// NOTE: This test has been modified to specifically work with multisig DAOs

// Parse governance type from CLI args
const governanceArg = process.argv.find(arg => arg.startsWith('--governance='));
const governanceType = governanceArg ? governanceArg.split('=')[1].toLowerCase() : 'erc20';

const test = new BaseSeleniumTest('proposal-overview', 'content-loads');
BaseSeleniumTest.run(async (test) => {
  let proposalHash: string | null = null;
  await test.start();
  const daoHomePath = `${pages['dao-homepage']}?dao=${getTestDao('multisig').value}`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + daoHomePath));
  
  // Find the first proposal link (needs extra time to load)
  const proposalLink = await test.waitForElement(By.css('a[href^="/proposals/"]'), { extra: 10000 });
  const proposalText = await proposalLink.getText();
  
  // Look for hash pattern: # followed by alphanumeric characters (like #4824 or #4a59)
  const hashMatch = proposalText.match(/#([a-fA-F0-9]+)/);
  if (!hashMatch) throw new Error('No proposal hash found in proposal text!');
  proposalHash = hashMatch[0]; // Keep the full hash including the # symbol
  
  await proposalLink.click();
  await test.driver!.sleep(500);
  
  // Wait for the proposal hash to appear on the overview page (should be in title, not breadcrumbs)
  await test.waitForElement(By.xpath(`//*[contains(text(), '${proposalHash}')]`));
  console.log(`Proposal overview page loaded and found ${proposalHash}.`);
}, test);
