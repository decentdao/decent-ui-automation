# Decent UI Automation

This project provides a basic setup for running automated UI regression tests on the Decent webapp using Selenium WebDriver. The project uses TypeScript as the primary coding language.

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Ensure you have Chrome and ChromeDriver installed and available in your PATH.
3. Run the example test:
   ```sh
   npm test
   ```

## Customizing
- Add more test files in the `tests/` directory.
- Update the test scripts in `package.json` as needed.

## Configuration Files

- Test environments are now defined in `config/environments.js`.
- Update your test imports to use this new path if you add new tests.

## Test Environments

Test environments are defined in `config/environments.js`:
- `develop`: https://develop.decent-interface.pages.dev/
- `production`: https://app.decentdao.org/
- `release`: https://release-v0-16-0.decent-interface.pages.dev/

### Running Tests for a Specific Environment

Use the following npm scripts:

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

You can add more environments by editing `config/environments.js`.

### Overriding the Base URL

You can run tests against any custom base URL by setting the `BASE_URL` environment variable when running tests. This overrides the environment selection in `config/environments.js`.

**Example:**

```sh
BASE_URL=https://your.custom.url npm test
```

or

```sh
BASE_URL=https://your.custom.url node run-all-tests.js
```

If `BASE_URL` is not set, the test will use the environment specified by `TEST_ENV` (default: `develop`).
