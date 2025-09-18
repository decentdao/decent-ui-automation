import * as fs from 'fs';
import * as path from 'path';

export interface DebugLogEntry {
  timestamp: string;
  testName: string;
  action: string;
  element?: string;
  success: boolean;
  duration?: number;
  screenshot?: string;
  domSnapshot?: string;
  networkRequests?: any[];
  error?: string;
  context?: any;
}

export interface DebugReport {
  testName: string;
  startTime?: string;
  endTime?: string;
  totalActions: number;
  failures: number;
  duration: number;
  entries: DebugLogEntry[];
  summary: {
    actions: { [action: string]: number };
    failures: { [action: string]: number };
    averageDuration: { [action: string]: number };
  };
}

/**
 * Specialized logger for test debugging that outputs AI-parseable structured logs.
 * Creates both real-time log files and comprehensive debug reports.
 */
export class DebugLogger {
  private logEntries: DebugLogEntry[] = [];
  private testName: string;
  public debugDir: string;
  private startTime?: Date;

  constructor(testName: string) {
    this.testName = testName;
    
    // Create debug directory structure
    const baseDebugDir = path.join(process.cwd(), 'test-results', 'debug-logs');
    this.debugDir = path.join(baseDebugDir, testName);
    
    // Clean up existing debug files from previous runs
    this.cleanDebugDirectory();
    
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }

    this.startTime = new Date();
    console.log(`[DEBUG] Debug logging initialized for test: ${testName}`);
    console.log(`[DEBUG] Debug files will be saved to: ${this.debugDir}`);
  }

  /**
   * Clean up debug directory from previous runs to avoid stale files
   */
  private cleanDebugDirectory(): void {
    if (fs.existsSync(this.debugDir)) {
      try {
        // Get all files in the debug directory
        const files = fs.readdirSync(this.debugDir);
        
        for (const file of files) {
          const filePath = path.join(this.debugDir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isFile()) {
            fs.unlinkSync(filePath);
          }
        }
        
        console.log(`[DEBUG] Cleaned ${files.length} files from previous debug run`);
      } catch (error) {
        console.warn(`[DEBUG] Failed to clean debug directory: ${error}`);
      }
    }
  }

  /**
   * Log a debug entry with structured information
   */
  log(entry: Partial<DebugLogEntry>): void {
    const fullEntry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      testName: this.testName,
      action: entry.action || 'unknown',
      success: entry.success ?? true,
      ...entry
    };
    
    this.logEntries.push(fullEntry);
    
    // Real-time append to structured log file for immediate debugging
    const logLine = this.formatLogEntry(fullEntry);
    const logFile = path.join(this.debugDir, 'debug.log');
    
    try {
      fs.appendFileSync(logFile, logLine + '\n');
    } catch (error) {
      console.warn(`[DEBUG] Failed to write to debug log: ${error}`);
    }
  }

  /**
   * Format log entry in AI-parseable structured format
   */
  private formatLogEntry(entry: DebugLogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `ACTION: ${entry.action}`,
      `SUCCESS: ${entry.success}`,
      `ELEMENT: ${entry.element || 'N/A'}`,
      `DURATION: ${entry.duration || 0}ms`
    ];

    if (entry.error) {
      parts.push(`ERROR: ${entry.error}`);
    }

    if (entry.screenshot) {
      parts.push(`SCREENSHOT: ${path.basename(entry.screenshot)}`);
    }

    if (entry.domSnapshot) {
      parts.push(`DOM_SNAPSHOT: ${path.basename(entry.domSnapshot)}`);
    }

    if (entry.context) {
      try {
        parts.push(`CONTEXT: ${JSON.stringify(entry.context)}`);
      } catch (e) {
        parts.push(`CONTEXT: [Unable to serialize context]`);
      }
    }

    return parts.join(' | ');
  }

  /**
   * Generate comprehensive debug report with analytics
   */
  async saveDebugReport(): Promise<void> {
    if (this.logEntries.length === 0) {
      console.warn('[DEBUG] No log entries to save in debug report');
      return;
    }

    const endTime = new Date();
    const startEntry = this.logEntries[0];
    const endEntry = this.logEntries[this.logEntries.length - 1];
    
    const report: DebugReport = {
      testName: this.testName,
      startTime: startEntry?.timestamp,
      endTime: endEntry?.timestamp,
      totalActions: this.logEntries.length,
      failures: this.logEntries.filter(e => !e.success).length,
      duration: this.startTime ? endTime.getTime() - this.startTime.getTime() : 0,
      entries: this.logEntries,
      summary: this.generateSummary()
    };

    // Save JSON report
    const reportFile = path.join(this.debugDir, 'debug-report.json');
    try {
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      console.log(`[DEBUG] Debug report saved to: ${reportFile}`);
    } catch (error) {
      console.error(`[DEBUG] Failed to save debug report: ${error}`);
    }

    // Save human-readable summary
    const summaryFile = path.join(this.debugDir, 'debug-summary.md');
    try {
      fs.writeFileSync(summaryFile, this.generateMarkdownSummary(report));
      console.log(`[DEBUG] Debug summary saved to: ${summaryFile}`);
    } catch (error) {
      console.error(`[DEBUG] Failed to save debug summary: ${error}`);
    }

    // Auto-generate AI analysis request for failures
    await this.generateAIAnalysisRequest();
  }

  /**
   * Generate an AI-ready analysis request for test failures
   */
  async generateAIAnalysisRequest(): Promise<void> {
    const failures = this.logEntries.filter(e => !e.success);
    if (failures.length === 0) {
      return; // No failures to analyze
    }

    const lastFailure = failures[failures.length - 1];
    const contextEntries = this.logEntries.slice(
      Math.max(0, this.logEntries.indexOf(lastFailure) - 3),
      this.logEntries.indexOf(lastFailure) + 1
    );

    const analysisRequest = this.formatAIAnalysisRequest(lastFailure, contextEntries, failures);
    
    try {
      const aiRequestFile = path.join(this.debugDir, 'ai-analysis-request.md');
      fs.writeFileSync(aiRequestFile, analysisRequest);
      
      console.log(`[DEBUG] AI analysis request generated: ${aiRequestFile}`);
      console.log('[DEBUG] Copy the contents of ai-analysis-request.md to your AI assistant for analysis');
    } catch (error) {
      console.error(`[DEBUG] Failed to generate AI analysis request: ${error}`);
    }
  }

  /**
   * Format an AI-ready analysis request
   */
  private formatAIAnalysisRequest(failure: DebugLogEntry, context: DebugLogEntry[], allFailures: DebugLogEntry[]): string {
    const failureIndex = this.logEntries.indexOf(failure);
    const testDuration = this.startTime ? new Date().getTime() - this.startTime.getTime() : 0;

    // Pre-compute JSON stringifications to avoid repeated operations
    const failureContext = failure.context ? JSON.stringify(failure.context, null, 2) : 'None';
    
    // Pre-compute stringified contexts for context log entries
    const stringifiedContexts = context.map(entry => entry.context ? JSON.stringify(entry.context) : '');
    const contextLogEntries = context.map((entry, index) => {
      const prefix = entry === failure ? '❌ FAILURE →' : `${index + 1}.`;
      const contextStr = stringifiedContexts[index] ? ` | CONTEXT: ${stringifiedContexts[index]}` : '';
      const errorStr = entry.error ? ` | ERROR: ${entry.error}` : '';
      return `${prefix} [${entry.timestamp}] ACTION: ${entry.action} | SUCCESS: ${entry.success} | ELEMENT: ${entry.element || 'N/A'} | DURATION: ${entry.duration || 0}ms${errorStr}${contextStr}`;
    }).join('\n');

    // Pre-compute debug artifacts section
    const debugArtifacts = [
      failure.screenshot ? `- **Screenshot:** ${path.basename(failure.screenshot)}` : null,
      failure.domSnapshot ? `- **DOM Snapshot:** ${path.basename(failure.domSnapshot)}` : null,
      '- **Full Debug Log:** debug.log',
      '- **Debug Report:** debug-report.json',
      '- **Debug Summary:** debug-summary.md'
    ].filter(Boolean).join('\n');

    // Pre-compute multiple failures section if needed
    const multipleFailuresSection = allFailures.length > 1 
      ? `## Multiple Failures Detected (${allFailures.length} total)
${allFailures.map((f, i) => `${i + 1}. **${f.action}** at ${f.timestamp} - ${f.error || 'Unknown error'}`).join('\n')}

`
      : '';

    // Pre-compute performance issue section if needed
    const performanceIssueSection = failure.duration && failure.duration > 5000
      ? `## ⚠️ Performance Issue Detected
This action took ${failure.duration}ms, which is unusually long and may indicate:
- Network connectivity issues
- Element loading problems
- Timing/synchronization issues

`
      : '';

    // Build the complete markdown using a single template literal
    return `# Test Failure Analysis Request

## Test Information
- **Test Name:** ${this.testName}
- **Total Test Duration:** ${testDuration}ms
- **Total Actions:** ${this.logEntries.length}
- **Total Failures:** ${allFailures.length}
- **Failure Time:** ${failure.timestamp}
- **Failed Action:** ${failure.action}
- **Element:** ${failure.element || 'N/A'}
- **Error:** ${failure.error || 'Unknown error'}

## Primary Failure Details
- **Duration:** ${failure.duration || 0}ms
- **Success:** ${failure.success}
- **Context:** ${failureContext}

## Debug Log Context (Last 4 Actions Leading to Failure)
\`\`\`
${contextLogEntries}
\`\`\`

## Available Debug Artifacts
${debugArtifacts}

${multipleFailuresSection}${performanceIssueSection}## Questions for AI Analysis
1. **Root Cause:** What is the primary cause of this failure?
2. **Fix Strategy:** What specific steps should I take to fix this issue?
3. **Race Conditions:** Are there any timing issues or race conditions evident?
4. **Locator Strategy:** Should I modify the element locator strategy?
5. **Best Practices:** What best practices should I implement to prevent this type of failure?
6. **Test Stability:** How can I make this test more reliable?

## Additional Context
Please analyze the debug information above and provide:
- Specific, actionable recommendations for fixing this test failure
- Code examples if applicable
- Suggestions for improving test reliability
- Any patterns you notice that could indicate broader issues

---
*Generated automatically by Decent UI Automation Debug Toolset*`;
  }

  /**
   * Generate analytics summary of test execution
   */
  private generateSummary(): DebugReport['summary'] {
    const actions: { [action: string]: number } = {};
    const failures: { [action: string]: number } = {};
    const durations: { [action: string]: number[] } = {};

    this.logEntries.forEach(entry => {
      // Count actions
      actions[entry.action] = (actions[entry.action] || 0) + 1;

      // Count failures
      if (!entry.success) {
        failures[entry.action] = (failures[entry.action] || 0) + 1;
      }

      // Track durations
      if (entry.duration !== undefined) {
        if (!durations[entry.action]) {
          durations[entry.action] = [];
        }
        durations[entry.action].push(entry.duration);
      }
    });

    // Calculate average durations
    const averageDuration: { [action: string]: number } = {};
    Object.keys(durations).forEach(action => {
      const actionDurations = durations[action];
      if (actionDurations.length > 0) {
        averageDuration[action] = Math.round(
          actionDurations.reduce((sum, duration) => sum + duration, 0) / actionDurations.length
        );
      }
    });

    return { actions, failures, averageDuration };
  }

  /**
   * Generate human-readable markdown summary
   */
  private generateMarkdownSummary(report: DebugReport): string {
    const { summary } = report;
    
    let markdown = `# Debug Report: ${report.testName}\n\n`;
    markdown += `**Test Duration:** ${report.duration}ms\n`;
    markdown += `**Total Actions:** ${report.totalActions}\n`;
    markdown += `**Failures:** ${report.failures}\n`;
    markdown += `**Start Time:** ${report.startTime}\n`;
    markdown += `**End Time:** ${report.endTime}\n\n`;

    markdown += `## Action Summary\n\n`;
    markdown += `| Action | Count | Failures | Avg Duration (ms) |\n`;
    markdown += `|--------|-------|----------|------------------|\n`;
    
    Object.keys(summary.actions).forEach(action => {
      const count = summary.actions[action];
      const failureCount = summary.failures[action] || 0;
      const avgDuration = summary.averageDuration[action] || 0;
      markdown += `| ${action} | ${count} | ${failureCount} | ${avgDuration} |\n`;
    });

    if (report.failures > 0) {
      markdown += `\n## Failures\n\n`;
      const failedEntries = report.entries.filter(e => !e.success);
      failedEntries.forEach((entry, index) => {
        markdown += `### Failure ${index + 1}: ${entry.action}\n`;
        markdown += `- **Time:** ${entry.timestamp}\n`;
        markdown += `- **Element:** ${entry.element || 'N/A'}\n`;
        markdown += `- **Error:** ${entry.error || 'Unknown error'}\n`;
        if (entry.screenshot) {
          markdown += `- **Screenshot:** ${path.basename(entry.screenshot)}\n`;
        }
        if (entry.domSnapshot) {
          markdown += `- **DOM Snapshot:** ${path.basename(entry.domSnapshot)}\n`;
        }
        markdown += `\n`;
      });
    }

    return markdown;
  }

  /**
   * Get total number of logged entries
   */
  getEntryCount(): number {
    return this.logEntries.length;
  }

  /**
   * Get number of failed entries
   */
  getFailureCount(): number {
    return this.logEntries.filter(e => !e.success).length;
  }
}