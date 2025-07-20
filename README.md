# Decent UI Automation

Automated UI regression testing for the Decent webapp using Selenium WebDriver and TypeScript.

## Quick Start

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Run all tests:**
   ```sh
   npm test
   ```

## Running Tests

### Basic Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests for all governance types (default) |
| `npm run test:debug` | Quick feedback - first 5 tests per governance type |
| `npm run test:single -- <file>` | Run a specific test file |

### Governance Types

Run tests for specific governance types:

```sh
npm run test:erc20     # Token voting
npm run test:erc721    # NFT voting  
npm run test:multisig  # Multi-signature
```

### Environments

Run tests against different environments:

```sh
npm run test:develop     # https://develop.decent-interface.pages.dev/ (default)
npm run test:production  # https://app.decentdao.org/
npm run test:release     # https://release-v0-16-0.decent-interface.pages.dev/
```

### Custom Base URL

Override the environment with a custom URL:

```sh
npm run test:url BASE_URL=https://your.custom.url
```

**Alternative methods:**
- macOS/Linux: `BASE_URL=https://your.custom.url npm test`
- Cross-platform: `npx cross-env BASE_URL=https://your.custom.url npm test`

### Feature Flags

Pass custom flags to all tests as URL parameters:

```sh
npm test -- --flags=feature_1=on,debug=on
npm test -- feature_1+debug              # Alternative syntax
npm run test:single -- tests/app-homepage/header-loads.test.ts --flags=feature_1=on
```

**Flag formats:** Comma, space, or plus-separated (`flag1,flag2` or `flag1+flag2`)

## Configuration

Configure test behavior via files in the `config/` directory:

- **environments.ts** - Base URLs for different environments
- **pages.ts** - Page paths within the app
- **test-daos.ts** - DAO addresses for each governance type
- **test-settings.ts** - Test runner settings (parallelism, timeouts)

## Project Structure

```
tests/
├── multisig/           # Multi-signature governance tests
├── token-voting/       # ERC20/ERC721 governance tests  
└── base-selenium-test.ts

config/
├── environments.ts     # Environment URLs
├── pages.ts           # Page routes
├── test-daos.ts       # Test DAO addresses
└── test-settings.ts   # Test configuration

test-results/          # Generated test reports and screenshots
```

## Development

- **Chrome & ChromeDriver** must be installed and in PATH
- Tests run in **parallel** by default (configurable in `test-settings.ts`)
- **Screenshots** are automatically captured on test completion
- **Combined HTML reports** generated for multi-governance runs

