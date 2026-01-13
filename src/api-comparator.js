#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const HttpClient = require('../utils/http-client');
const { parseUrlFiles, buildUrlWithValues, extractBaseUrl } = require('../utils/parser');
const { compareResponses } = require('../utils/json-comparator');
const { generateConsoleReport, generateHtmlReport } = require('../utils/report-generator');

const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function main() {
    console.log('Starting API Comparison Tool...\n');
    
    const startTime = Date.now();
    const testResults = [];
    let httpClient;

    try {
        console.log('Reading URL files...');
        const oldUrlsPath = path.join(__dirname, '..', config.files.oldUrls);
        const newUrlsPath = path.join(__dirname, '..', config.files.newUrls);

        if (!fs.existsSync(oldUrlsPath) || !fs.existsSync(newUrlsPath)) {
            throw new Error('URL files not found. Please ensure old.txt and new.txt exist in the data directory.');
        }

        const oldContent = fs.readFileSync(oldUrlsPath, 'utf8');
        const newContent = fs.readFileSync(newUrlsPath, 'utf8');

        const testCases = parseUrlFiles(oldContent, newContent);
        console.log(`Found ${testCases.length} test case(s)\n`);

        if (testCases.length === 0) {
            console.log('No test cases found. Please check your URL files.');
            return;
        }

        httpClient = new HttpClient(config);
        
        console.log('Authenticating...');
        await httpClient.authenticate();
        console.log('');

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log(`\nRunning Test Case ${testCase.lineNumber}/${testCases.length}...`);
            
            try {
                const result = await runTestCase(testCase, httpClient, config);
                testResults.push(result);
                
                // Add delay between tests if configured
                if (i < testCases.length - 1 && config.options.delayBetweenTests) {
                    await sleep(config.options.delayBetweenTests);
                }
            } catch (error) {
                console.error(`Test case ${testCase.lineNumber} failed:`, error.message);
                testResults.push({
                    testCase: testCase.lineNumber,
                    master: testCase.master,
                    oldUrl: testCase.oldUrl,
                    newUrl: testCase.newUrl,
                    passed: false,
                    error: error.message,
                    oldResponse: { status: 0, responseTime: 0, success: false },
                    newResponse: { status: 0, responseTime: 0, success: false }
                });
            }
        }

        console.log('\nGenerating reports...');
        const summary = generateConsoleReport(testResults, config);
        
        if (config.output.format === 'html' || config.output.format === 'both') {
            const reportPath = generateHtmlReport(testResults, config, summary);
            console.log(`\nHTML report generated: ${reportPath}`);
        }

        const endTime = Date.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`\nTotal execution time: ${totalTime}s`);

        process.exit(summary.failed > 0 ? 1 : 0);

    } catch (error) {
        console.error('\nFatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (httpClient) {
            httpClient.close();
        }
    }
}

/**
 * Run a single test case
 */
async function runTestCase(testCase, httpClient, config) {
    const result = {
        testCase: testCase.lineNumber,
        product: testCase.product,
        master: testCase.master,
        baseUrl: null,
        variables: {},
        oldUrl: null,
        newUrl: null,
        oldResponse: null,
        newResponse: null,
        comparisonResult: null,
        passed: false
    };

    try {
        const baseUrl = extractBaseUrl(testCase.newParsed, config.environment.baseUrl);
        result.baseUrl = baseUrl;
        
        console.log(`  Base URL: ${baseUrl}`);

        console.log('  Fetching base data for variable extraction...');
        const baseResponse = await httpClient.fetchJson(baseUrl);

        if (!baseResponse.success || !baseResponse.data) {
            throw new Error(`Failed to fetch base data: ${baseResponse.error || 'Unknown error'}`);
        }

        const variableValues = extractVariableValues(baseResponse.data, testCase.fieldMapping);
        result.variables = variableValues;
        
        console.log('  Variables extracted:', JSON.stringify(variableValues, null, 2));

        const oldUrlFinal = buildUrlWithValues(testCase.oldUrl, variableValues);
        const newUrlFinal = buildUrlWithValues(testCase.newUrl, variableValues);
        
        result.oldUrl = config.environment.baseUrl + oldUrlFinal;
        result.newUrl = config.environment.baseUrl + newUrlFinal;

        console.log(`  Old URL: ${oldUrlFinal}`);
        console.log(`  New URL: ${newUrlFinal}`);

        console.log('  Fetching old API...');
        const oldResponse = await httpClient.fetchJson(oldUrlFinal);
        result.oldResponse = oldResponse;
        console.log(`  Old API: ${oldResponse.status} (${oldResponse.responseTime}ms)`);

        console.log('  Fetching new API...');
        const newResponse = await httpClient.fetchJson(newUrlFinal);
        result.newResponse = newResponse;
        console.log(`  New API: ${newResponse.status} (${newResponse.responseTime}ms)`);

        console.log('  Comparing responses...');
        const comparison = compareResponses(oldResponse, newResponse, config.options);
        result.comparisonResult = comparison;

        result.passed = comparison.statusMatch && comparison.dataMatch;

        if (result.passed) {
            console.log('  Test PASSED - Responses match');
        } else {
            console.log('  Test FAILED - Responses differ');
            if (comparison.report && comparison.report.details) {
                console.log(`  Found ${comparison.report.details.length} difference(s)`);
            }
        }

    } catch (error) {
        console.error(`  Error: ${error.message}`);
        result.error = error.message;
        result.passed = false;
    }

    return result;
}

/**
 * Extract variable values from base data response
 */
function extractVariableValues(data, fieldMapping) {
    const values = {};

    let firstRecord = null;
    if (Array.isArray(data) && data.length > 0) {
        firstRecord = data[0];
    } else if (typeof data === 'object' && !Array.isArray(data)) {
        firstRecord = data;
    }

    if (!firstRecord) {
        throw new Error('No data found in base response to extract variable values');
    }

    for (const [varName, fieldName] of Object.entries(fieldMapping)) {
        if (firstRecord.hasOwnProperty(fieldName)) {
            values[varName] = firstRecord[fieldName];
        } else {
            console.warn(`  Field ${fieldName} not found in base data for variable ${varName}`);
            values[varName] = '';
        }
    }

    return values;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run main function
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { main, runTestCase };
