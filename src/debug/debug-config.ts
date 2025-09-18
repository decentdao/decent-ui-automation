export interface DebugConfig {
  enabled: boolean;
  logLevel: 'verbose' | 'detailed' | 'minimal';
  captureScreenshots: boolean;
  captureDomSnapshots: boolean;
  trackNetworkRequests: boolean;
  logElementInteractions: boolean;
  outputFormat: 'json' | 'structured-text';
}

/**
 * Centralized configuration manager for test debugging features.
 * Activated by --debug-mode CLI argument or DEBUG_MODE=1 environment variable.
 */
export class DebugConfigManager {
  private static instance: DebugConfigManager;
  private config: DebugConfig;

  private constructor() {
    // Check for debug mode activation via CLI argument
    const isDebugEnabled = process.argv.includes('--debug-mode');

    this.config = {
      enabled: isDebugEnabled,
      logLevel: this.parseLogLevel(this.getCliArgValue('--debug-level')) || 'detailed',
      captureScreenshots: this.parseCliBoolean('--debug-screenshots', true),
      captureDomSnapshots: this.parseCliBoolean('--debug-dom-snapshots', true),
      trackNetworkRequests: this.parseCliBoolean('--debug-network', false),
      logElementInteractions: this.parseCliBoolean('--debug-elements', true),
      outputFormat: this.parseOutputFormat(this.getCliArgValue('--debug-format')) || 'structured-text'
    };

    if (this.config.enabled) {
      console.log('[DEBUG] Debug mode activated with configuration:', JSON.stringify(this.config, null, 2));
    }
  }

  static getInstance(): DebugConfigManager {
    if (!this.instance) {
      this.instance = new DebugConfigManager();
    }
    return this.instance;
  }

  getConfig(): DebugConfig {
    return { ...this.config };
  }

  isDebugEnabled(): boolean {
    return this.config.enabled;
  }

  private parseLogLevel(value?: string): 'verbose' | 'detailed' | 'minimal' | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    if (['verbose', 'detailed', 'minimal'].includes(normalized)) {
      return normalized as 'verbose' | 'detailed' | 'minimal';
    }
    return undefined;
  }

  private parseOutputFormat(value?: string): 'json' | 'structured-text' | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    if (['json', 'structured-text'].includes(normalized)) {
      return normalized as 'json' | 'structured-text';
    }
    return undefined;
  }

  /**
   * Get the value of a CLI argument (e.g., --debug-level=verbose)
   */
  private getCliArgValue(argName: string): string | undefined {
    const argWithEquals = `${argName}=`;
    const arg = process.argv.find(arg => arg.startsWith(argWithEquals));
    return arg ? arg.split('=')[1] : undefined;
  }

  /**
   * Parse boolean CLI arguments (e.g., --debug-screenshots=false)
   */
  private parseCliBoolean(argName: string, defaultValue: boolean): boolean {
    const value = this.getCliArgValue(argName);
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
  }
}