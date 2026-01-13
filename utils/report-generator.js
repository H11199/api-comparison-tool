const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

function generateConsoleReport(testResults, config) {
    console.log('\n' + chalk.bold.blue('='.repeat(80)));
    console.log(chalk.bold.blue('API COMPARISON TEST RESULTS'));
    console.log(chalk.bold.blue('='.repeat(80)));
    console.log(`Environment: ${chalk.cyan(config.environment.baseUrl)}`);
    console.log(`Date: ${chalk.cyan(new Date().toISOString())}`);
    console.log(`Total Test Cases: ${chalk.cyan(testResults.length)}\n`);

    testResults.forEach((result, index) => {
        console.log(chalk.bold(`\nTest Case #${result.testCase}: ${result.master}`));
        console.log('─'.repeat(80));
        
        console.log(`Base URL: ${chalk.gray(result.baseUrl)}`);
        
        if (result.variables && Object.keys(result.variables).length > 0) {
            const varStr = Object.entries(result.variables)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ');
            console.log(`Variables: ${chalk.yellow(varStr)}`);
        }

        // Old API
        console.log(`\n${chalk.bold('Old API:')}`);
        console.log(`  URL: ${chalk.gray(result.oldUrl)}`);
        console.log(`  Status: ${getStatusColor(result.oldResponse.status)} | Time: ${chalk.cyan(result.oldResponse.responseTime + 'ms')}`);

        // New API
        console.log(`\n${chalk.bold('New API:')}`);
        console.log(`  URL: ${chalk.gray(result.newUrl)}`);
        console.log(`  Status: ${getStatusColor(result.newResponse.status)} | Time: ${chalk.cyan(result.newResponse.responseTime + 'ms')}`);

        console.log(`\n${chalk.bold('Result:')} ${result.passed ? chalk.green('PASS') : chalk.red('FAIL')}`);
        
        if (result.comparisonResult && result.comparisonResult.report) {
            console.log(`  ${result.comparisonResult.report.message}`);
            
            if (!result.passed && result.comparisonResult.report.details) {
                console.log(chalk.yellow('\n  Differences:'));
                result.comparisonResult.report.details.forEach(detail => {
                    console.log(chalk.yellow(`    • ${detail.description}`));
                });
            }
        }

        if (result.error) {
            console.log(chalk.red(`  Error: ${result.error}`));
        }
    });

    // Summary
    console.log('\n' + chalk.bold.blue('═'.repeat(80)));
    console.log(chalk.bold.blue('SUMMARY'));
    console.log(chalk.bold.blue('═'.repeat(80)));

    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    const total = testResults.length;
    const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

    console.log(`Total Tests: ${chalk.cyan(total)}`);
    console.log(`Passed: ${chalk.green(passed)} (${percentage}%)`);
    console.log(`Failed: ${chalk.red(failed)}`);
    
    const totalTime = testResults.reduce((sum, r) => {
        return sum + (r.oldResponse?.responseTime || 0) + (r.newResponse?.responseTime || 0);
    }, 0);
    console.log(`Total Time: ${chalk.cyan((totalTime / 1000).toFixed(2) + 's')}`);
    
    console.log(chalk.bold.blue('═'.repeat(80)) + '\n');

    return { passed, failed, total, percentage };
}

function getStatusColor(status) {
    if (status >= 200 && status < 300) {
        return chalk.green(status + ' OK');
    } else if (status >= 300 && status < 400) {
        return chalk.yellow(status);
    } else if (status >= 400) {
        return chalk.red(status + ' ERROR');
    }
    return chalk.gray(status);
}

function generateHtmlReport(testResults, config, summary) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const reportDir = config.output.reportDirectory;
    
    // Ensure report directory exists
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, `test-report-${timestamp}.html`);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Comparison Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header .meta { opacity: 0.9; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; background: #f9fafb; }
        .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .summary-card h3 { color: #6b7280; font-size: 14px; text-transform: uppercase; margin-bottom: 10px; }
        .summary-card .value { font-size: 32px; font-weight: bold; color: #111827; }
        .summary-card.passed .value { color: #10b981; }
        .summary-card.failed .value { color: #ef4444; }
        .test-case { padding: 30px; border-bottom: 1px solid #e5e7eb; }
        .test-case:last-child { border-bottom: none; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .test-header h2 { font-size: 20px; color: #111827; }
        .badge { padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .badge.pass { background: #d1fae5; color: #065f46; }
        .badge.fail { background: #fee2e2; color: #991b1b; }
        .info-section { background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
        .info-section .label { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
        .info-section .value { color: #111827; font-size: 14px; word-break: break-all; }
        .api-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .api-box { background: #f9fafb; padding: 20px; border-radius: 6px; border: 2px solid #e5e7eb; }
        .api-box h3 { color: #111827; margin-bottom: 15px; font-size: 16px; }
        .api-box .url { background: white; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; margin-bottom: 10px; }
        .api-box .stats { display: flex; gap: 20px; margin-top: 10px; }
        .api-box .stat { display: flex; flex-direction: column; }
        .api-box .stat .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
        .api-box .stat .value { font-size: 16px; font-weight: 600; color: #111827; }
        .status-ok { color: #10b981; }
        .status-error { color: #ef4444; }
        .differences { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin-top: 20px; }
        .differences h4 { color: #92400e; margin-bottom: 10px; }
        .differences ul { list-style: none; padding-left: 0; }
        .differences li { color: #92400e; padding: 5px 0; font-size: 14px; }
        .differences li:before { content: "▸ "; margin-right: 5px; }
        .variables { background: #ede9fe; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
        .variables h4 { color: #5b21b6; margin-bottom: 10px; font-size: 14px; }
        .variables .var-list { display: flex; flex-wrap: wrap; gap: 10px; }
        .variables .var { background: white; padding: 8px 12px; border-radius: 4px; font-size: 13px; font-family: monospace; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>API Comparison Test Report</h1>
            <div class="meta">
                <div>Environment: ${config.environment.baseUrl}</div>
                <div>Generated: ${new Date().toLocaleString()}</div>
            </div>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">${summary.total}</div>
            </div>
            <div class="summary-card passed">
                <h3>Passed</h3>
                <div class="value">${summary.passed}</div>
            </div>
            <div class="summary-card failed">
                <h3>Failed</h3>
                <div class="value">${summary.failed}</div>
            </div>
            <div class="summary-card">
                <h3>Success Rate</h3>
                <div class="value">${summary.percentage}%</div>
            </div>
        </div>

        ${testResults.map(result => generateTestCaseHtml(result)).join('')}

        <div class="footer">
            Generated by API Comparison Tool v1.0.0
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(reportPath, html);
    return reportPath;
}

function generateTestCaseHtml(result) {
    const variablesHtml = result.variables && Object.keys(result.variables).length > 0 ? `
        <div class="variables">
            <h4>Variables Used</h4>
            <div class="var-list">
                ${Object.entries(result.variables).map(([k, v]) => 
                    `<div class="var">${k} = ${v}</div>`
                ).join('')}
            </div>
        </div>
    ` : '';

    const differencesHtml = !result.passed && result.comparisonResult?.report?.details ? `
        <div class="differences">
            <h4>Differences Found</h4>
            <ul>
                ${result.comparisonResult.report.details.map(d => 
                    `<li>${d.description}</li>`
                ).join('')}
            </ul>
        </div>
    ` : '';

    return `
        <div class="test-case">
            <div class="test-header">
                <h2>Test Case #${result.testCase}: ${result.master || 'Unknown'}</h2>
                <span class="badge ${result.passed ? 'pass' : 'fail'}">${result.passed ? '✓ PASS' : '✗ FAIL'}</span>
            </div>

            ${result.baseUrl ? `
            <div class="info-section">
                <div class="label">Base URL</div>
                <div class="value">${result.baseUrl}</div>
            </div>
            ` : ''}

            ${variablesHtml}

            <div class="api-comparison">
                <div class="api-box">
                    <h3>Old API (FetchMasterData)</h3>
                    <div class="url">${result.oldUrl}</div>
                    <div class="stats">
                        <div class="stat">
                            <span class="label">Status</span>
                            <span class="value ${result.oldResponse.success ? 'status-ok' : 'status-error'}">${result.oldResponse.status}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Response Time</span>
                            <span class="value">${result.oldResponse.responseTime}ms</span>
                        </div>
                    </div>
                </div>

                <div class="api-box">
                    <h3>New API (MasterDataFetchV2)</h3>
                    <div class="url">${result.newUrl}</div>
                    <div class="stats">
                        <div class="stat">
                            <span class="label">Status</span>
                            <span class="value ${result.newResponse.success ? 'status-ok' : 'status-error'}">${result.newResponse.status}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Response Time</span>
                            <span class="value">${result.newResponse.responseTime}ms</span>
                        </div>
                    </div>
                </div>
            </div>

            ${differencesHtml}
        </div>
    `;
}

module.exports = {
    generateConsoleReport,
    generateHtmlReport
};
