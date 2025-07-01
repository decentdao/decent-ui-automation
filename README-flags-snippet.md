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
