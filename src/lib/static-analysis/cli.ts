#!/usr/bin/env node
/**
 * CLI tool for running static analysis
 */

import { StaticAnalyzer } from './analyzer';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CLIOptions {
  projectRoot?: string;
  output?: string;
  format?: 'json' | 'html' | 'markdown';
  typescript?: boolean;
  eslint?: boolean;
  security?: boolean;
  parallel?: boolean;
  maxErrors?: number;
  help?: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--project-root':
      case '-p':
        options.projectRoot = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--format':
      case '-f':
        options.format = args[++i] as 'json' | 'html' | 'markdown';
        break;
      case '--no-typescript':
        options.typescript = false;
        break;
      case '--no-eslint':
        options.eslint = false;
        break;
      case '--no-security':
        options.security = false;
        break;
      case '--no-parallel':
        options.parallel = false;
        break;
      case '--max-errors':
        options.maxErrors = parseInt(args[++i], 10);
        break;
      default:
        if (!options.projectRoot && !arg.startsWith('-')) {
          options.projectRoot = arg;
        }
        break;
    }
  }
  
  return options;
}

function printHelp() {
  console.log(`
Static Analysis Tool

Usage: static-analysis [options] [project-root]

Options:
  -h, --help              Show this help message
  -p, --project-root      Project root directory (default: current directory)
  -o, --output            Output file path
  -f, --format            Output format: json, html, markdown (default: json)
  --no-typescript         Disable TypeScript analysis
  --no-eslint             Disable ESLint analysis
  --no-security           Disable security analysis
  --no-parallel           Run analyzers sequentially
  --max-errors            Maximum number of errors to report (default: 1000)

Examples:
  static-analysis                           # Analyze current directory
  static-analysis /path/to/project          # Analyze specific project
  static-analysis -o report.html -f html   # Generate HTML report
  static-analysis --no-security             # Skip security analysis
`);
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (options.help) {
    printHelp();
    process.exit(0);
  }
  
  const projectRoot = options.projectRoot || process.cwd();
  const outputFile = options.output;
  const format = options.format || 'json';
  
  console.log(`Running static analysis on: ${projectRoot}`);
  console.log(`Output format: ${format}`);
  
  try {
    const analyzer = new StaticAnalyzer(projectRoot, {
      enableTypeScript: options.typescript !== false,
      enableESLint: options.eslint !== false,
      enableSecurity: options.security !== false,
      parallel: options.parallel !== false,
      maxErrors: options.maxErrors || 1000
    });
    
    const result = await analyzer.analyze();
    const report = analyzer.generateReport(result, format);
    
    if (outputFile) {
      await fs.writeFile(outputFile, report, 'utf8');
      console.log(`Report saved to: ${outputFile}`);
    } else {
      console.log(report);
    }
    
    // Exit with error code if critical issues found
    if (result.summary.criticalIssues > 0) {
      console.error(`\nFound ${result.summary.criticalIssues} critical issues!`);
      process.exit(1);
    }
    
    if (result.summary.highIssues > 0) {
      console.warn(`\nFound ${result.summary.highIssues} high-priority issues.`);
    }
    
    console.log('\nStatic analysis completed successfully.');
    
  } catch (error) {
    console.error('Static analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export { main as runCLI };