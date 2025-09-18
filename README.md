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

### Quick Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests for all governance types |
| `npm run test:debug` | Quick test (5 tests per governance type) |
| `npm run test:debug-mode` | Enable comprehensive debug logging |
| `npm run test:debug-verbose` | Debug mode with verbose logging |
| `npm run test:multisig` | Run only multisig tests |
| `npm run test:erc20` | Run only ERC20 token voting tests |
| `npm run test:erc721` | Run only ERC721 NFT voting tests |
| `npm run test:production` | Test against production environment |
| `npm run test:release` | Test against latest release |
| `npm run test:single -- <file>` | Run a specific test file |

### Runtime Arguments

For custom combinations or when you need more flexibility:

```bash
# Combine multiple options
npm test -- --debug --env=release --governance=erc20
```

**Available Arguments:**

| Argument | Values | Description |
|----------|--------|-------------|
| `--debug` | (flag) | Run only 5 tests per governance type |
| `--governance=` | `erc20`, `erc721`, `multisig` | Run tests for specific governance type |
| `--file=` | `tests/path/to/file.test.ts` | Run a single test file |
| `--env=` | `production`, `release` | Environment (default: `develop`) |
| `--base-url=` | Any URL | Override environment with custom URL |
| `--flags=` | `feature_1=on,flag_debug=on` | Pass feature flags as URL parameters |
| `--no-headless` | (flag) | Disable headless mode; run test in chrome tab |
| `--debug-mode` | (flag) | Enable comprehensive debug logging and analysis |

### Debug Mode

Enable comprehensive test debugging with structured logs, screenshots, and DOM snapshots:

```bash
# Enable debug mode
npm test -- --debug-mode

# Configure debug options
npm test -- --debug-mode --debug-level=verbose --debug-screenshots=true
```

**Debug CLI Arguments:**
- `--debug-mode` - Enable debug logging and analysis
- `--debug-level=verbose|detailed|minimal` - Set logging detail level  
- `--debug-screenshots=true|false` - Capture debug screenshots (default: true)
- `--debug-dom-snapshots=true|false` - Capture DOM snapshots (default: true)
- `--debug-format=json|structured-text` - Output format (default: structured-text)

Debug output is saved to `test-results/debug-logs/` with AI-parseable structured logs.

## Configuration

**Key files in `config/` directory:**
- `environments.ts` - Environment URLs and release fetching
- `test-daos.ts` - DAO addresses for each governance type  
- `test-settings.ts` - Parallelism, timeouts, browser settings
- `pages.ts` - Page routes within the app

## Project Structure

```
tests/
├── general/            # Cross-governance tests (app navigation, DAO creation)
├── multisig/           # Multi-signature governance tests
└── token-voting/       # ERC20/ERC721 governance tests

src/
└── debug/              # Debug logging and analysis tools (includes example test)

config/                 # Test configuration
test-results/           # Generated reports and screenshots
├── debug-logs/         # Debug mode output (when enabled)
└── screenshots/        # Test completion screenshots
```

## Development

**Requirements:**
- Chrome & ChromeDriver installed and in PATH
- Node.js and npm

**Key Features:**
- Tests run in parallel (configurable in `test-settings.ts`)
- Screenshots automatically captured on test completion  
- HTML and Markdown reports generated for all runs
- Cross-platform support (Windows, macOS, Linux)
- **Debug Mode**: Comprehensive test debugging with structured logs, DOM snapshots, and AI-parseable output for efficient failure analysis

