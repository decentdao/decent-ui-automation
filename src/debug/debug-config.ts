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
    // Check for debug toolset activation via --debug-mode flag
    // npm passes --debug-mode as --debug_mode in process.argv and as npm_config_debug_mode in env
    const isDebugEnabled = process.argv.includes('--debug-mode') || 
                          process.argv.includes('--debug_mode') ||
                          process.env.npm_config_debug_mode === 'true';

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
   * Handles both hyphen and underscore formats, plus npm environment variables
   */
  private getCliArgValue(argName: string): string | undefined {
    // Try hyphen format
    const argWithEquals = `${argName}=`;
    let arg = process.argv.find(arg => arg.startsWith(argWithEquals));
    if (arg) return arg.split('=')[1];
    
    // Try underscore format (npm converts hyphens to underscores)
    const underscoreArgName = argName.replace(/-/g, '_');
    const underscoreArgWithEquals = `${underscoreArgName}=`;
    arg = process.argv.find(arg => arg.startsWith(underscoreArgWithEquals));
    if (arg) return arg.split('=')[1];
    
    // Try npm environment variable
    const envVarName = `npm_config_${argName.replace(/^--/, '').replace(/-/g, '_')}`;
    const envValue = process.env[envVarName];
    if (envValue && envValue !== 'true' && envValue !== 'false') {
      return envValue;
    }
    
    return undefined;
  }

  /**
   * Parse boolean CLI arguments (e.g., --debug-screenshots=false)
   * Handles npm environment variables as well
   */
  private parseCliBoolean(argName: string, defaultValue: boolean): boolean {
    const value = this.getCliArgValue(argName);
    if (value !== undefined) {
      return value === 'true' || value === '1';
    }
    
    // Check npm environment variable for boolean flags
    const envVarName = `npm_config_${argName.replace(/^--/, '').replace(/-/g, '_')}`;
    const envValue = process.env[envVarName];
    if (envValue !== undefined) {
      return envValue === 'true' || envValue === '';  // npm sets empty string for boolean flags
    }
    
    return defaultValue;
  }
}