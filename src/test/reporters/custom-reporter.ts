/**
 * Custom Vitest reporter for enhanced test reporting and metrics
 */

import { Reporter, File, Task, TaskResultPack, UserConsoleLog } from 'vitest';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TestMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  performance: {
    slowestTests: Array<{
      name: string;
      duration: number;
      file: string;
    }>;
    averageTestDuration: number;
    totalDuration: number;
  };
  errors: Array<{
    test: string;
    file: string;
    error: string;
    stack?: string;
  }>;
}

export class CustomTestReporter implements Reporter {
  private startTime: number = 0;
  private metrics: TestMetrics = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    duration: 0,
    performance: {
      slowestTests: [],
      averageTestDuration: 0,
      totalDuration: 0,
    },
    errors: [],
  };

  onInit() {
    this.startTime = Date.now();
    console.log('🚀 Starting comprehensive test suite...\n');
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    // Update metrics as tests complete
    packs.forEach(([taskId, result]) => {
      if (result?.state) {
        this.updateMetrics(result);
      }
    });
  }

  onFinished(files?: File[]) {
    this.metrics.duration = Date.now() - this.startTime;
    
    // Calculate final metrics
    this.calculateFinalMetrics(files);
    
    // Generate reports
    this.generateConsoleReport();
    this.generateJsonReport();
    this.generateHtmlReport();
    
    console.log('\n✅ Test suite completed!');
  }

  private updateMetrics(result: any) {
    if (result.state === 'pass') {
      this.metrics.passedTests++;
    } else if (result.state === 'fail') {
      this.metrics.failedTests++;
      if (result.errors) {
        result.errors.forEach((error: any) => {
          this.metrics.errors.push({
            test: result.name || 'Unknown',
            file: result.file || 'Unknown',
            error: error.message || 'Unknown error',
            stack: error.stack,
          });
        });
      }
    } else if (result.state === 'skip') {
      this.metrics.skippedTests++;
    }
    
    this.metrics.totalTests = this.metrics.passedTests + this.metrics.failedTests + this.metrics.skippedTests;
  }

  private calculateFinalMetrics(files?: File[]) {
    if (!files) return;

    const testDurations: Array<{ name: string; duration: number; file: string }> = [];
    let totalDuration = 0;

    const collectTestDurations = (task: Task, file: File) => {
      if (task.type === 'test' && task.result?.duration) {
        const duration = task.result.duration;
        testDurations.push({
          name: task.name,
          duration,
          file: file.name,
        });
        totalDuration += duration;
      }
      
      if (task.tasks) {
        task.tasks.forEach(subtask => collectTestDurations(subtask, file));
      }
    };

    files.forEach(file => {
      file.tasks.forEach(task => collectTestDurations(task, file));
    });

    // Sort by duration and get slowest tests
    this.metrics.performance.slowestTests = testDurations
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    this.metrics.performance.totalDuration = totalDuration;
    this.metrics.performance.averageTestDuration = 
      testDurations.length > 0 ? totalDuration / testDurations.length : 0;
  }

  private generateConsoleReport() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Tests: ${this.metrics.totalTests}`);
    console.log(`✅ Passed: ${this.metrics.passedTests}`);
    console.log(`❌ Failed: ${this.metrics.failedTests}`);
    console.log(`⏭️  Skipped: ${this.metrics.skippedTests}`);
    console.log(`⏱️  Duration: ${(this.metrics.duration / 1000).toFixed(2)}s`);
    
    if (this.metrics.performance.slowestTests.length > 0) {
      console.log('\n🐌 Slowest Tests:');
      this.metrics.performance.slowestTests.slice(0, 5).forEach((test, index) => {
        console.log(`${index + 1}. ${test.name} - ${test.duration.toFixed(2)}ms (${test.file})`);
      });
    }
    
    if (this.metrics.errors.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.metrics.errors.slice(0, 5).forEach((error, index) => {
        console.log(`${index + 1}. ${error.test} (${error.file})`);
        console.log(`   Error: ${error.error}`);
      });
    }
    
    // Success rate
    const successRate = this.metrics.totalTests > 0 
      ? ((this.metrics.passedTests / this.metrics.totalTests) * 100).toFixed(1)
      : '0';
    console.log(`\n🎯 Success Rate: ${successRate}%`);
  }

  private generateJsonReport() {
    const reportDir = 'test-results';
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.metrics.totalTests,
        passed: this.metrics.passedTests,
        failed: this.metrics.failedTests,
        skipped: this.metrics.skippedTests,
        successRate: this.metrics.totalTests > 0 
          ? (this.metrics.passedTests / this.metrics.totalTests) * 100 
          : 0,
        duration: this.metrics.duration,
      },
      performance: this.metrics.performance,
      errors: this.metrics.errors,
      coverage: this.metrics.coverage,
    };

    writeFileSync(
      join(reportDir, 'test-metrics.json'),
      JSON.stringify(report, null, 2)
    );
  }

  private generateHtmlReport() {
    const reportDir = 'test-results';
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }

    const successRate = this.metrics.totalTests > 0 
      ? ((this.metrics.passedTests / this.metrics.totalTests) * 100).toFixed(1)
      : '0';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Results - SyncStore</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .duration { color: #17a2b8; }
        .success-rate { color: #6f42c1; }
        .section {
            margin-bottom: 30px;
        }
        .section h3 {
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        .test-list {
            list-style: none;
            padding: 0;
        }
        .test-item {
            padding: 10px;
            margin: 5px 0;
            background: #f8f9fa;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .error-item {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
        }
        .error-details {
            font-family: monospace;
            font-size: 0.8em;
            color: #666;
            margin-top: 5px;
        }
        .timestamp {
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 SyncStore Test Results</h1>
            <p>Comprehensive testing report generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value">${this.metrics.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value passed">${this.metrics.passedTests}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value failed">${this.metrics.failedTests}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value skipped">${this.metrics.skippedTests}</div>
                <div class="metric-label">Skipped</div>
            </div>
            <div class="metric-card">
                <div class="metric-value duration">${(this.metrics.duration / 1000).toFixed(2)}s</div>
                <div class="metric-label">Duration</div>
            </div>
            <div class="metric-card">
                <div class="metric-value success-rate">${successRate}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
        </div>
        
        ${this.metrics.performance.slowestTests.length > 0 ? `
        <div class="section">
            <h3>🐌 Slowest Tests</h3>
            <ul class="test-list">
                ${this.metrics.performance.slowestTests.slice(0, 10).map(test => `
                    <li class="test-item">
                        <span>${test.name}</span>
                        <span>${test.duration.toFixed(2)}ms</span>
                    </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}
        
        ${this.metrics.errors.length > 0 ? `
        <div class="section">
            <h3>❌ Failed Tests</h3>
            <ul class="test-list">
                ${this.metrics.errors.map(error => `
                    <li class="test-item error-item">
                        <div>
                            <strong>${error.test}</strong> (${error.file})
                            <div class="error-details">${error.error}</div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}
        
        <div class="timestamp">
            Report generated at ${new Date().toISOString()}
        </div>
    </div>
</body>
</html>
    `;

    writeFileSync(join(reportDir, 'test-report.html'), html);
  }

  onUserConsoleLog(log: UserConsoleLog) {
    // Handle console logs from tests if needed
  }
}

export default CustomTestReporter;