import { getBaseUrl, appendFlagsToUrl } from '../test-helpers';
import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';

const PROPOSAL_TEMPLATES_PATH = `${pages['proposal-templates']}?dao=${testDaos.ERC20.value}`;

const test = new BaseSeleniumTest('proposal-templates', 'proposal-templates/content-loads');
BaseSeleniumTest.run(async (test) => {
  // Directly load the proposal templates page
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + PROPOSAL_TEMPLATES_PATH));
  // Confirm the paragraph with text "Airdrop" is present
  await test.waitForElement(By.xpath("//p[contains(text(), 'Airdrop')]"), 10000);
  console.log('Proposal Templates page loaded and "Airdrop" paragraph found.');
}, test);
