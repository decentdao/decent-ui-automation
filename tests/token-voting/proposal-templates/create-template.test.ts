import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';
import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By } from 'selenium-webdriver';
import { pages } from '../../../config/pages';

// Parse governance type from CLI args
const governanceArg = process.argv.find(arg => arg.startsWith('--governance='));
const governanceType = governanceArg ? governanceArg.split('=')[1].toLowerCase() : 'erc20';

const test = new BaseSeleniumTest('proposal-templates', 'create-template');
BaseSeleniumTest.run(async (test) => {
  // Directly load the proposal templates page
  await test.start();
  const proposalTemplatesPath = `${pages['proposal-templates']}?dao=${getTestDao(governanceType).value}&demo_mode=on`;
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + proposalTemplatesPath));
  
  // Click the Create Template link via test id
  const createButton = await test.waitForElement(By.css('[data-testid="proposalTemplates-create"]'));
  await createButton.click();
  
  // Confirm the metadata title input is present
  await test.waitForElement(By.css('[data-testid="metadata.title"]'));
  console.log('Create template page loaded and metadata title field found.');
}, test);
