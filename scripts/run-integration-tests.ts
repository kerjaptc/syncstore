#!/usr/bin/env tsx

/**
 * Integration Test Runner
 * 
 * Runs comprehensive end-to-end and performance integration tests
 * for the SyncStore system.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface TestResult {
  testSuite: string;
  passed: boolean;
  duration: number;
  error?: string;
}

class IntegrationTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting SyncStore Integration Tests');
    console.log('=====================================\n');

    this.startTime = Date.now();

    // Test suites to run
    const testSuites = [
      {
        name: 'End-to-End Integration Tests',
        command: 'npx vitest run src/lib/__tests__/end-to-end-integration.test.ts --reporter=verbose'
      },
      {
        name: 'Performance Integration Tests',
        command: 'npx vitest run src/lib/__tests__/performance-integration.test.ts --reporter=verbose'
      }
    ];

    // Run each test suite
    for (const suite of testSuites) {
      await this.runTestSuite(suite.name, suite.command);
    }

    // Generate final report
    await this.generateReport();
  }

  private async runTestSuite(name: string, command: string): Promise<void> {
    console.log(`📋 Running: ${name}`);
    console.log(`Command: ${command}`);
    console.log('─'.repeat(50));

    const startTime = Date.now();

    try {
      // Run the test command
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 600000 // 10 minute timeout
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(output);
      console.log(`✅ ${name} - PASSED (${duration}ms)\n`);

      this.results.push({
        testSuite: name,
        passed: true,
        duration
      });

    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(`❌ ${name} - FAILED (${duration}ms)`);
      console.error('Error output:');
      console.error(error.stdout || error.message);
      console.error('');

      this.results.push({
        testSuite: name,
        passed: false,
        duration,
        error: error.stdout || error.message
      });
    }
  }

  private async generateReport(): Promise<void> {
    const totalTime = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;

    console.log('📊 Integration Test Results');
    console.log('===========================\n');

    // Summary
    console.log(`Total Test Suites: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Total Duration: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)\n`);

    // Detailed results
    console.log('Detailed Results:');
    console.log('-'.repeat(80));
    
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      
      console.log(`${index + 1}. ${result.testSuite}`);
      console.log(`   Status: ${status}`);
      console.log(`   Duration: ${duration}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error.substring(0, 200)}...`);
      }
      
      console.log('');
    });

    // Performance summary
    const performanceResults = this.results.filter(r => 
      r.testSuite.toLowerCase().includes('performance')
    );

    if (performanceResults.length > 0) {
      console.log('🏃 Performance Summary:');
      console.log('-'.repeat(40));
      
      performanceResults.forEach(result => {
        const throughput = result.passed ? 'ACCEPTABLE' : 'NEEDS_IMPROVEMENT';
        console.log(`${result.testSuite}: ${throughput} (${result.duration}ms)`);
      });
      console.log('');
    }

    // Save detailed report to file
    await this.saveReportToFile();

    // Final status
    const allPassed = this.results.every(r => r.passed);
    
    if (allPassed) {
      console.log('🎉 All integration tests PASSED!');
      console.log('System is ready for production deployment.');
    } else {
      console.log('⚠️  Some integration tests FAILED!');
      console.log('Please review the failures before proceeding.');
      process.exit(1);
    }
  }

  private async saveReportToFile(): Promise<void> {
    const reportDir = './docs/phase1';
    const reportPath = path.join(reportDir, 'integration-test-report.md');

    // Ensure directory exists
    await fs.mkdir(reportDir, { recursive: true });

    const totalTime = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;

    const report = `# Integration Test Report

**Generated:** ${new Date().toISOString()}  
**Total Duration:** ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)  
**Test Suites:** ${totalTests}  
**Passed:** ${passedTests}  
**Failed:** ${totalTests - passedTests}

## Summary

${this.results.every(r => r.passed) ? '✅ All tests passed successfully!' : '⚠️ Some tests failed - review required'}

## Test Results

${this.results.map((result, index) => `
### ${index + 1}. ${result.testSuite}

- **Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- **Duration:** ${result.duration}ms
${result.error ? `- **Error:** \`\`\`\n${result.error}\n\`\`\`` : ''}
`).join('\n')}

## Performance Analysis

${this.results.filter(r => r.testSuite.toLowerCase().includes('performance')).map(result => `
- **${result.testSuite}:** ${result.passed ? 'ACCEPTABLE' : 'NEEDS_IMPROVEMENT'} (${result.duration}ms)
`).join('')}

## Recommendations

${this.results.every(r => r.passed) 
  ? '- System is ready for production deployment\n- All performance targets met\n- Integration tests validate system reliability'
  : '- Review failed tests before proceeding\n- Address performance issues if any\n- Re-run tests after fixes'
}

---

*Report generated by SyncStore Integration Test Runner*
`;

    await fs.writeFile(reportPath, report, 'utf8');
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// System requirements check
async function checkSystemRequirements(): Promise<boolean> {
  console.log('🔍 Checking system requirements...');

  try {
    // Check if required files exist
    const requiredFiles = [
      'src/lib/__tests__/end-to-end-integration.test.ts',
      'src/lib/__tests__/performance-integration.test.ts'
    ];

    for (const file of requiredFiles) {
      try {
        await fs.access(file);
      } catch {
        console.error(`❌ Required test file not found: ${file}`);
        return false;
      }
    }

    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`Node.js version: ${nodeVersion}`);

    // Check available memory
    const memoryUsage = process.memoryUsage();
    const availableMemory = memoryUsage.heapTotal / 1024 / 1024;
    console.log(`Available memory: ${availableMemory.toFixed(2)}MB`);

    if (availableMemory < 100) {
      console.warn('⚠️  Low memory available - tests may be slower');
    }

    console.log('✅ System requirements check passed\n');
    return true;

  } catch (error) {
    console.error('❌ System requirements check failed:', error);
    return false;
  }
}

// Environment setup
async function setupTestEnvironment(): Promise<void> {
  console.log('🛠️  Setting up test environment...');

  // Create test data directories
  const testDirs = [
    './test-data',
    './test-data/e2e',
    './test-data/performance'
  ];

  for (const dir of testDirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.VITEST_POOL_TIMEOUT = '600000'; // 10 minutes

  console.log('✅ Test environment setup complete\n');
}

// Cleanup function
async function cleanup(): Promise<void> {
  console.log('🧹 Cleaning up test environment...');

  try {
    await fs.rm('./test-data', { recursive: true, force: true });
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.warn('⚠️  Cleanup warning:', error);
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    // Check system requirements
    const requirementsMet = await checkSystemRequirements();
    if (!requirementsMet) {
      console.error('❌ System requirements not met. Exiting.');
      process.exit(1);
    }

    // Setup test environment
    await setupTestEnvironment();

    // Run integration tests
    const runner = new IntegrationTestRunner();
    await runner.runAllTests();

  } catch (error) {
    console.error('💥 Integration test runner failed:', error);
    process.exit(1);
  } finally {
    // Always cleanup
    await cleanup();
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Cleaning up...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Cleaning up...');
  await cleanup();
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { IntegrationTestRunner };