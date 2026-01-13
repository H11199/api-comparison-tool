#!/usr/bin/env node

/**
 * Validation Test Script
 * Tests all core functionality of the API comparison tool
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Import utilities
const { parseUrlString, buildUrlWithValues, parseUrlFiles } = require('./utils/parser');
const { compareJson } = require('./utils/json-comparator');

console.log(chalk.bold.blue('\n==========================================================='));
console.log(chalk.bold.blue('API COMPARISON TOOL - VALIDATION TESTS'));
console.log(chalk.bold.blue('===========================================================\n'));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, testFn) {
    totalTests++;
    try {
        console.log(chalk.cyan(`\nTest ${totalTests}: ${testName}`));
        testFn();
        passedTests++;
        console.log(chalk.green('   PASSED'));
        return true;
    } catch (error) {
        failedTests++;
        console.log(chalk.red('   FAILED'));
        console.log(chalk.red(`   Error: ${error.message}`));
        return false;
    }
}

// Test 1: Parse Old URL Format
runTest('Parse Old URL Format - Simple Case', () => {
    const url = '/content/hdfc_pl_forms/api/FetchMasterData.PL.BRAN_CHA_MAP.DSACODE-" + agentDsaCodeVal+ "~isExact.CITY-" + cityId + "~isExact.json/CITY.DSACODE.json';
    const result = parseUrlString(url);
    
    console.log('   Input:', url);
    console.log('   Product:', result.product);
    console.log('   Master:', result.master);
    console.log('   Variables:', result.variables);
    console.log('   Field Mapping:', JSON.stringify(result.fieldMapping));
    
    if (result.product !== 'PL') throw new Error('Product parsing failed');
    if (result.master !== 'BRAN_CHA_MAP') throw new Error('Master parsing failed');
    if (!result.variables.includes('agentDsaCodeVal')) throw new Error('Variable extraction failed');
    if (!result.variables.includes('cityId')) throw new Error('Variable extraction failed');
    if (result.fieldMapping['agentDsaCodeVal'] !== 'DSACODE') throw new Error('Field mapping failed');
    if (result.fieldMapping['cityId'] !== 'CITY') throw new Error('Field mapping failed');
});

// Test 2: Parse New URL Format
runTest('Parse New URL Format - Query Parameters', () => {
    const url = '/content/hdfc_commonforms/api/masterdatafetchv2.PL.BRAN_CHA_MAP.json/CITY.DSACODE.json?DSACODE="+agentDsaCodeVal+"&CITY="+cityId+"&isExact=DSACODE,CITY';
    const result = parseUrlString(url);
    
    console.log('   Input:', url);
    console.log('   Product:', result.product);
    console.log('   Master:', result.master);
    console.log('   Base URL:', result.baseUrl);
    console.log('   Field Selection:', result.fieldSelection);
    console.log('   isExact Fields:', result.isExactFields);
    
    if (result.product !== 'PL') throw new Error('Product parsing failed');
    if (result.master !== 'BRAN_CHA_MAP') throw new Error('Master parsing failed');
    if (!result.hasFieldSelection) throw new Error('Field selection not detected');
    if (!result.fieldSelection.includes('CITY')) throw new Error('Field selection parsing failed');
    if (!result.isExactFields || !result.isExactFields.includes('DSACODE')) throw new Error('isExact parsing failed');
});

// Test 3: Build URL with Values
runTest('Build URL with Variable Values', () => {
    const template = '/api/FetchMasterData.PL.MASTER.FIELD1-" + var1 + "~isExact.FIELD2-" + var2 + ".json';
    const values = { var1: '12345', var2: '67890' };
    const result = buildUrlWithValues(template, values);
    
    console.log('   Template:', template);
    console.log('   Values:', JSON.stringify(values));
    console.log('   Result:', result);
    
    if (!result.includes('12345')) throw new Error('var1 substitution failed');
    if (!result.includes('67890')) throw new Error('var2 substitution failed');
    if (result.includes('var1') || result.includes('var2')) throw new Error('Variables not replaced');
    if (result.includes('" + ')) throw new Error('Concatenation artifacts remaining');
});

// Test 4: Parse URL Files
runTest('Parse URL Files - Line Matching', () => {
    const oldContent = `1. /api/FetchMasterData.PL.MASTER1.FIELD-" + val + ".json
2. /api/FetchMasterData.PL.MASTER2.FIELD-" + val + ".json`;
    
    const newContent = `1. /api/masterdatafetchv2.PL.MASTER1.json?FIELD=" + val
2. /api/masterdatafetchv2.PL.MASTER2.json?FIELD=" + val`;
    
    const testCases = parseUrlFiles(oldContent, newContent);
    
    console.log('   Test Cases Found:', testCases.length);
    console.log('   Case 1 Master:', testCases[0].master);
    console.log('   Case 2 Master:', testCases[1].master);
    
    if (testCases.length !== 2) throw new Error('Should find 2 test cases');
    if (testCases[0].master !== 'MASTER1') throw new Error('Master1 parsing failed');
    if (testCases[1].master !== 'MASTER2') throw new Error('Master2 parsing failed');
    if (testCases[0].lineNumber !== 1) throw new Error('Line number tracking failed');
});

// Test 5: JSON Comparison - Match
runTest('JSON Comparison - Matching Objects', () => {
    const obj1 = [
        { id: 1, name: 'Test', value: 100 },
        { id: 2, name: 'Demo', value: 200 }
    ];
    const obj2 = [
        { id: 1, name: 'Test', value: 100 },
        { id: 2, name: 'Demo', value: 200 }
    ];
    
    const result = compareJson(obj1, obj2, { ignoreFieldOrder: true });
    
    console.log('   Objects Match:', result.isMatch);
    console.log('   Differences:', result.differences.length);
    
    if (!result.isMatch) throw new Error('Should match identical objects');
    if (result.differences.length > 0) throw new Error('Should have no differences');
});

// Test 6: JSON Comparison - Differences
runTest('JSON Comparison - Different Values', () => {
    const obj1 = { id: 1, name: 'Test', value: 100 };
    const obj2 = { id: 1, name: 'Test', value: 200 };
    
    const result = compareJson(obj1, obj2, {});
    
    console.log('   Objects Match:', result.isMatch);
    console.log('   Differences Found:', result.differences.length);
    console.log('   Difference Type:', result.differences[0]?.type);
    
    if (result.isMatch) throw new Error('Should detect differences');
    if (result.differences.length === 0) throw new Error('Should find differences');
    if (result.differences[0].type !== 'EDITED') throw new Error('Should detect EDITED type');
});

// Test 7: Configuration Loading
runTest('Configuration File Loading', () => {
    const configPath = path.join(__dirname, 'config/config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('   Base URL:', config.environment.baseUrl);
    console.log('   Timeout:', config.options.timeout);
    console.log('   Old URLs File:', config.files.oldUrls);
    console.log('   New URLs File:', config.files.newUrls);
    
    if (!config.environment.baseUrl) throw new Error('Base URL not configured');
    if (!config.options.timeout) throw new Error('Timeout not configured');
    if (!config.files.oldUrls) throw new Error('Old URLs file not configured');
    if (!config.files.newUrls) throw new Error('New URLs file not configured');
});

// Test 8: Data Files Existence
runTest('Data Files Existence Check', () => {
    const oldPath = path.join(__dirname, 'data/old.txt');
    const newPath = path.join(__dirname, 'data/new.txt');
    
    const oldExists = fs.existsSync(oldPath);
    const newExists = fs.existsSync(newPath);
    
    console.log('   old.txt exists:', oldExists);
    console.log('   new.txt exists:', newExists);
    
    if (!oldExists) throw new Error('old.txt not found');
    if (!newExists) throw new Error('new.txt not found');
    
    const oldContent = fs.readFileSync(oldPath, 'utf8');
    const newContent = fs.readFileSync(newPath, 'utf8');
    
    console.log('   old.txt lines:', oldContent.split('\n').filter(l => l.trim()).length);
    console.log('   new.txt lines:', newContent.split('\n').filter(l => l.trim()).length);
});

// Test 9: Complex URL Pattern
runTest('Complex URL Pattern - Multiple Fields with isExact', () => {
    const url = '/content/hdfc_pl_forms/api/FetchMasterData.PL.ADOBE_IRR_PF_MASTER_BASIS_DAP.EMPLOYEE_CAT-" + category + ".LOWER_INCOME-" + nearest_lower_income + ".isExact-true.json/EMPLOYEE_CAT.LOWER_INCOME.HIGHER_INCOME.COMBINEDKEY.PF.MAXLOANAMT.IRR.json';
    const result = parseUrlString(url);
    
    console.log('   Product:', result.product);
    console.log('   Master:', result.master);
    console.log('   Variables:', result.variables);
    console.log('   Field Selection:', result.fieldSelection);
    
    if (result.product !== 'PL') throw new Error('Product parsing failed');
    if (result.master !== 'ADOBE_IRR_PF_MASTER_BASIS_DAP') throw new Error('Master parsing failed');
    if (!result.variables.includes('category')) throw new Error('category variable not found');
    if (!result.variables.includes('nearest_lower_income')) throw new Error('nearest_lower_income variable not found');
    if (!result.hasFieldSelection) throw new Error('Field selection not detected');
});

// Test 10: URL with Nested Object Variable
runTest('URL with Nested Variable Reference', () => {
    const template = '/api/FetchMasterData.PL.MASTER.FIELD-" + PL.currentFormContext.customerOriginalPermanentCityId + ".json';
    const values = { 'PL.currentFormContext.customerOriginalPermanentCityId': '12345' };
    const result = buildUrlWithValues(template, values);
    
    console.log('   Template:', template);
    console.log('   Result:', result);
    
    if (!result.includes('12345')) throw new Error('Nested variable substitution failed');
});

// Summary
console.log(chalk.bold.blue('\n==========================================================='));
console.log(chalk.bold.blue('TEST SUMMARY'));
console.log(chalk.bold.blue('==========================================================='));
console.log(`Total Tests: ${chalk.cyan(totalTests)}`);
console.log(`Passed: ${chalk.green(passedTests)} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
console.log(`Failed: ${chalk.red(failedTests)}`);

if (failedTests === 0) {
    console.log(chalk.bold.green('\nAll tests passed! The tool is working correctly.\n'));
    process.exit(0);
} else {
    console.log(chalk.bold.red(`\n${failedTests} test(s) failed. Please review the errors above.\n`));
    process.exit(1);
}
