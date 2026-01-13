const diff = require('deep-diff');

function compareJson(oldData, newData, options = {}) {
    const result = {
        isMatch: false,
        differences: [],
        summary: {
            added: 0,
            deleted: 0,
            edited: 0,
            unchanged: 0
        }
    };

    // Normalize data for comparison
    const normalizedOld = normalizeData(oldData, options);
    const normalizedNew = normalizeData(newData, options);

    // Perform deep comparison
    const differences = diff(normalizedOld, normalizedNew);

    if (!differences || differences.length === 0) {
        result.isMatch = true;
        return result;
    }

    // Process differences
    differences.forEach(change => {
        const diffDetail = formatDifference(change, normalizedOld, normalizedNew);
        result.differences.push(diffDetail);

        // Update summary counts
        if (change.kind === 'N') result.summary.added++;
        else if (change.kind === 'D') result.summary.deleted++;
        else if (change.kind === 'E') result.summary.edited++;
        else if (change.kind === 'A') result.summary.edited++;
    });

    return result;
}

function normalizeData(data, options) {
    if (!data) return data;

    let normalized = JSON.parse(JSON.stringify(data));

    // Remove fields to ignore
    if (options.ignoreFields && options.ignoreFields.length > 0) {
        normalized = removeFields(normalized, options.ignoreFields);
    }

    // Sort arrays if ignoreFieldOrder is true
    if (options.ignoreFieldOrder && Array.isArray(normalized)) {
        normalized = sortArrayRecursively(normalized);
    }

    return normalized;
}

function removeFields(obj, fieldsToRemove) {
    if (Array.isArray(obj)) {
        return obj.map(item => removeFields(item, fieldsToRemove));
    }

    if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (!fieldsToRemove.includes(key)) {
                result[key] = removeFields(value, fieldsToRemove);
            }
        }
        return result;
    }

    return obj;
}

function sortArrayRecursively(arr) {
    if (!Array.isArray(arr)) return arr;

    return arr.map(item => {
        if (Array.isArray(item)) {
            return sortArrayRecursively(item);
        } else if (item !== null && typeof item === 'object') {
            const sorted = {};
            Object.keys(item).sort().forEach(key => {
                sorted[key] = sortArrayRecursively(item[key]);
            });
            return sorted;
        }
        return item;
    }).sort((a, b) => {
        const strA = JSON.stringify(a);
        const strB = JSON.stringify(b);
        return strA.localeCompare(strB);
    });
}

function formatDifference(change, oldData, newData) {
    const path = change.path ? change.path.join('.') : 'root';
    
    switch (change.kind) {
        case 'N': // New property added
            return {
                type: 'ADDED',
                path: path,
                newValue: change.rhs,
                description: `New field added at ${path}: ${JSON.stringify(change.rhs)}`
            };
        
        case 'D': // Property deleted
            return {
                type: 'DELETED',
                path: path,
                oldValue: change.lhs,
                description: `Field deleted at ${path}: ${JSON.stringify(change.lhs)}`
            };
        
        case 'E': // Property edited
            return {
                type: 'EDITED',
                path: path,
                oldValue: change.lhs,
                newValue: change.rhs,
                description: `Field edited at ${path}: ${JSON.stringify(change.lhs)} → ${JSON.stringify(change.rhs)}`
            };
        
        case 'A': // Array change
            return {
                type: 'ARRAY_CHANGE',
                path: path,
                index: change.index,
                item: change.item,
                description: `Array changed at ${path}[${change.index}]`
            };
        
        default:
            return {
                type: 'UNKNOWN',
                path: path,
                description: `Unknown change at ${path}`
            };
    }
}

function generateComparisonReport(comparison) {
    const report = {
        status: comparison.isMatch ? 'PASS' : 'FAIL',
        message: '',
        details: []
    };

    if (comparison.isMatch) {
        report.message = 'Responses match perfectly';
    } else {
        report.message = `Found ${comparison.differences.length} difference(s)`;
        report.details = comparison.differences.map(diff => ({
            type: diff.type,
            path: diff.path,
            description: diff.description,
            oldValue: diff.oldValue,
            newValue: diff.newValue
        }));
    }

    return report;
}

function compareResponses(oldResponse, newResponse, options = {}) {
    const result = {
        statusMatch: oldResponse.status === newResponse.status,
        dataMatch: false,
        oldStatus: oldResponse.status,
        newStatus: newResponse.status,
        oldResponseTime: oldResponse.responseTime,
        newResponseTime: newResponse.responseTime,
        comparison: null,
        report: null
    };

    // Compare data only if both responses are successful
    if (oldResponse.success && newResponse.success) {
        const comparison = compareJson(oldResponse.data, newResponse.data, options);
        result.dataMatch = comparison.isMatch;
        result.comparison = comparison;
        result.report = generateComparisonReport(comparison);
    } else {
        result.report = {
            status: 'ERROR',
            message: 'One or both requests failed',
            details: [
                { old: `Status: ${oldResponse.status}`, new: `Status: ${newResponse.status}` },
                { old: oldResponse.error || 'N/A', new: newResponse.error || 'N/A' }
            ]
        };
    }

    return result;
}

function formatDifferencesForConsole(differences) {
    if (!differences || differences.length === 0) {
        return '  No differences found';
    }

    return differences.map(diff => {
        let output = `  ${diff.type}: ${diff.path}\n`;
        if (diff.oldValue !== undefined) {
            output += `    Old: ${JSON.stringify(diff.oldValue)}\n`;
        }
        if (diff.newValue !== undefined) {
            output += `    New: ${JSON.stringify(diff.newValue)}\n`;
        }
        return output;
    }).join('\n');
}

module.exports = {
    compareJson,
    compareResponses,
    generateComparisonReport,
    formatDifferencesForConsole
};
