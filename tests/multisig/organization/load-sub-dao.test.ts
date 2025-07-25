import { getTestDao } from '../../../config/test-daos';
import { BaseSeleniumTest } from '../../base-selenium-test';
import { By, WebElement } from 'selenium-webdriver';
import { pages } from '../../../config/pages';
import { getBaseUrl, appendFlagsToUrl } from '../../test-helpers';

const ORG_PATH = `${pages['organization']}?dao=${getTestDao('multisig').value}`;

const test = new BaseSeleniumTest('organization', 'load-sub-dao');
BaseSeleniumTest.run(async (test) => {
  await test.start();
  // Load the organization page
  await test.driver!.get(appendFlagsToUrl(getBaseUrl() + ORG_PATH));

  // Robust wait loop for all DAO favorite buttons to appear (first is parent DAO, second+ are sub DAOs)
  const maxWaitMs = 15000;
  const pollIntervalMs = 500;
  let daoFavoriteElements: WebElement[] = [];
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    daoFavoriteElements = await test.driver!.findElements(By.css('div[data-testid="DAOInfo-favorite"]'));
    if (daoFavoriteElements.length >= 2) break;
    await new Promise(res => setTimeout(res, pollIntervalMs));
  }
  if (daoFavoriteElements.length < 2) throw new Error('Less than one sub DAO found on organization page after waiting!');

  // Sub DAOs may load in any order, so pick the last one found
  const anySubDaoFavorite = daoFavoriteElements[daoFavoriteElements.length - 1];
  // Move up to the immediate parent div of the favorite button (sub DAO block)
  const subDaoBlock = await anySubDaoFavorite.findElement(By.xpath('ancestor::div[1]'));

  // Get the sub DAO name from the block
  const subDaoNameElem = await subDaoBlock.findElement(By.css('p.chakra-text'));
  const subDaoName = await subDaoNameElem.getText();
  console.log(`Found sub DAO name: ${subDaoName}`);

  // Scroll the sub DAO block into view before clicking
  await test.driver!.executeScript('arguments[0].scrollIntoView({block: "center"});', subDaoBlock);
  await test.driver!.sleep(500); // Small delay to allow scroll animation
  await subDaoBlock.click();

  // Wait for the sub DAO homepage to load and check for the name using data-testid
  await test.driver!.sleep(5000); // Delay to allow name to load (without delay DAO address is shown instead)
  const nameElem = await test.waitForElement(By.css('[data-testid="DAOInfo-name"]'), { extra: 10000 });
  const loadedName = await nameElem.getText();
  if (loadedName !== subDaoName) {
    throw new Error(`Sub DAO homepage loaded, but name does not match. Expected: '${subDaoName}', Found: '${loadedName}'`);
  }
  console.log(`Sub DAO homepage loaded and name '${loadedName}' found.`);
}, test);
