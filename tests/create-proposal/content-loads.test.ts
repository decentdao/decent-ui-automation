import { getBaseUrl, appendFlagsToUrl } from '../test-helpers';
import { testDaos } from '../../config/test-daos';
import { BaseSeleniumTest } from '../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../config/pages';

const CREATE_PROPOSAL_PATH = `${pages['create-proposal']}?dao=${testDaos.ERC20.value}`;

const test = new BaseSeleniumTest('create-proposal', 'create-proposal/content-loads');
BaseSeleniumTest.run(async (test) => {
  // Directly load the create proposal page
  await test.start();
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + CREATE_PROPOSAL_PATH));
  // Confirm the metadata title field is present
  await test.waitForElement(By.css('[data-testid="metadata.title"]'), 10000);
  console.log('Create Proposal page loaded and metadata title field found.');
}, test);
