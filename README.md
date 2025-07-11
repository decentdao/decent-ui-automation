# Decent UI Automation

This project provides a setup for running automated UI regression tests on the Decent webapp using Selenium WebDriver. The project uses TypeScript as the primary coding language.

NOTE: Tests are currently run in parallel to reduce runtime. The number of parallel tests run is configurable in `test-settings.ts`.

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Ensure you have Chrome and ChromeDriver installed and available in your PATH.
3. Run all tests (default behavior - runs all governance types):
   ```sh
   npm test
   ```
4. Run a specific test file (cross-platform):
   ```sh
   npm run test:single -- tests/app-homepage/header-loads.test.ts
   ```
5. **Run only a subset of tests for quick feedback (debug mode):**
   ```sh
   npm run test:debug
   ```
   This will run only the first 5 tests from each governance type for faster iteration.

## Test Runner Behavior

The test runner has been unified to provide consistent behavior:

- **Default behavior (`npm test`)**: Runs all tests for all governance types (erc20, erc721, multisig) and generates a combined summary
- **Debug mode (`npm run test:debug`)**: Runs the first 5 tests for all governance types for quick feedback
- **Single governance**: Run tests for only one governance type using the governance-specific scripts

## Governance Types

Tests can be run against different governance types supported by the Decent platform:

- **erc20** (token voting)
- **erc721** (NFT voting)  
- **multisig** (multi-signature)

### Running All Governance Types (default)

```sh
npm test
```
This will run all tests for `erc20`, `erc721`, and `multisig` governance types in sequence, and generate a combined summary in `test-results/test-results-summary.html`.

### Running a Specific Governance Type

You can run tests for a specific governance type using the provided scripts:

- **ERC20:**
  ```sh
  npm run test:erc20
  ```
- **ERC721:**
  ```sh
  npm run test:erc721
  ```
- **Multisig:**
  ```sh
  npm run test:multisig
  ```

## Customizing
- Add more test files in the `tests/` directory.
- Update the test scripts in `package.json` as needed.

## Configuration Files

You can configure the following using the files in the `config` directory:
- The base url used for different environments: develop, production, release
- The paths used for pages in the app
- Addresses to specific test DAOs, namely the ones used for erc20, erc721, and multisig
- Top level test runner settings, such as number of parallel tests to run

## Test Environments

Test environments are defined in `config/environments.js`:
- `develop`: https://develop.decent-interface.pages.dev/
- `production`: https://app.decentdao.org/
- `release`: https://release-v0-16-0.decent-interface.pages.dev/

### Running Tests for a Specific Environment

Use the following npm scripts (now cross-platform with `cross-env`):

- Develop (default):
  ```sh
  npm run test:develop
  ```
- Production:
  ```sh
  npm run test:production
  ```
- Release:
  ```sh
  npm run test:release
  ```

> **Note:** The scripts for environment selection use [`cross-env`](https://www.npmjs.com/package/cross-env) for compatibility with Windows and Mac/Linux. This is installed as a dev dependency.

You can add more environments by editing `config/environments.js`.

### Overriding the Base URL

You can run tests against any custom base URL by setting the `BASE_URL` environment variable when running tests. This overrides the environment selection in `config/environments.js`.

**Example:**

```sh
BASE_URL=https://your.custom.url npm test
```

If `BASE_URL` is not set, the test will use the environment specified by `TEST_ENV` (default: `develop`).

### Passing Custom Flags to All Tests

You can pass custom flags as URL parameters to all tests using the `--flags` argument (or as a bare value) when running the test runner. These flags will be appended to the test URLs and are accessible in your tests for feature toggles, debug options, or other custom behaviors.

**Usage Examples:**

- With the npm test script:
  ```sh
  npm test -- --flags=flag_feature_1=on,flag_dev=on
  ```
- With a bare value (no --flags= prefix):
  ```sh
  npm test -- myflag1+myflag2
  ```
- With a specific test file:
  ```sh
  npm run test:single -- tests/app-homepage/header-loads.test.ts --flags=flag_feature_1=on
  ```

**Flag Delimiters:**
- Flags can be separated by commas, spaces, or plus signs (`,` ` ` `+`).
- All flags will be merged and appended to the test URLs as query parameters.

**How it works:**
- The test runner sets the `TEST_FLAGS` environment variable for each test process.
- All test files use a helper to append these flags to the URLs they load.
- Any flag passed will be visible in the URLs visited by Selenium.

**Example:**
If you run:
```sh
npm test -- --flags=flag_feature_1=on,flag_dev=on
```
All test URLs will include `?flags=flag_feature_1=on,flag_dev=on` (or merged with existing params).

See `tests/test-helpers.ts` for details on how flags are parsed and appended.

