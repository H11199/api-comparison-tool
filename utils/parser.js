function parseUrlString(urlString) {
    const result = {
        staticParts: [],
        variables: [],
        fieldMapping: {},
        baseUrl: '',
        queryParams: {},
        hasFieldSelection: false,
        fieldSelection: []
    };

    // Remove line number prefix if present (e.g., "1. ")
    urlString = urlString.replace(/^\d+\.\s*/, '').trim();

    // Split by query parameters first
    const [pathPart, queryPart] = urlString.split('?');
    
    // Extract variables from path (format: " + varName + ")
    const pathVariablePattern = /"\s*\+\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\s*\+\s*"/g;
    let match;
    const pathVariables = [];
    
    while ((match = pathVariablePattern.exec(pathPart)) !== null) {
        pathVariables.push(match[1]);
    }

    // Build base URL from path part (remove all variable concatenations)
    let basePath = pathPart.replace(/"\s*\+\s*[^+]+\+\s*"/g, '{VAR}');
    
    // Extract field selection from suffix (e.g., /FIELD1.FIELD2.json)
    const fieldSelectionMatch = basePath.match(/\/([A-Z_]+(?:\.[A-Z_]+)*\.json)$/);
    if (fieldSelectionMatch) {
        result.hasFieldSelection = true;
        const fields = fieldSelectionMatch[1].replace('.json', '').split('.');
        result.fieldSelection = fields;
    }

    // For new URL format: Extract base URL before query params
    if (basePath.includes('masterdatafetchv2') || basePath.includes('query-mdm')) {
        // Extract product and master from URL
        const newUrlMatch = basePath.match(/masterdatafetchv2\.([^.]+)\.([^.]+)\.json/);
        if (newUrlMatch) {
            result.product = newUrlMatch[1];
            result.master = newUrlMatch[2];
            result.baseUrl = basePath.split('.json')[0] + '.json';
        }
    }

    // For old URL format: Extract from FetchMasterData pattern
    if (basePath.includes('FetchMasterData')) {
        const oldUrlMatch = basePath.match(/FetchMasterData\.([^.]+)\.([^.]+)\./);
        if (oldUrlMatch) {
            result.product = oldUrlMatch[1];
            result.master = oldUrlMatch[2];
            // Base URL is product.master.json
            result.baseUrl = basePath.split('FetchMasterData.')[0] + 
                           'masterdatafetchv2.' + result.product + '.' + result.master + '.json';
        }
    }

    // Parse old URL format to extract field mappings
    // Pattern: FIELDNAME-" + varName + "~isExact or FIELDNAME-" + varName + "
    const oldFieldPattern = /([A-Z_]+)-"\s*\+\s*([^+]+?)\s*\+\s*"(?:~isExact)?/g;
    while ((match = oldFieldPattern.exec(pathPart)) !== null) {
        const fieldName = match[1];
        const varName = match[2].trim();
        result.fieldMapping[varName] = fieldName;
        if (!result.variables.includes(varName)) {
            result.variables.push(varName);
        }
    }

    // Parse query parameters if present
    if (queryPart) {
        const queryVariablePattern = /([A-Z_]+)="\s*\+\s*([^+&]+?)\s*\+\s*"/g;
        while ((match = queryVariablePattern.exec(queryPart)) !== null) {
            const fieldName = match[1];
            const varName = match[2].trim();
            result.fieldMapping[varName] = fieldName;
            if (!result.variables.includes(varName)) {
                result.variables.push(varName);
            }
        }

        // Extract isExact fields
        const isExactMatch = queryPart.match(/isExact=([A-Z_,]+)/);
        if (isExactMatch) {
            result.isExactFields = isExactMatch[1].split(',').map(f => f.trim());
        }
    }

    return result;
}

function buildUrlWithValues(urlTemplate, variableValues) {
    let finalUrl = urlTemplate;
    
    // Remove line number prefix if present
    finalUrl = finalUrl.replace(/^\d+\.\s*/, '').trim();

    // Replace each variable with its value
    for (const [varName, value] of Object.entries(variableValues)) {
        // Handle different concatenation patterns
        const patterns = [
            new RegExp(`"\\s*\\+\\s*${escapeRegex(varName)}\\s*\\+\\s*"`, 'g'),
            new RegExp(`\\+\\s*${escapeRegex(varName)}\\s*\\+`, 'g')
        ];
        
        for (const pattern of patterns) {
            finalUrl = finalUrl.replace(pattern, value);
        }
    }

    // Clean up any remaining concatenation artifacts
    finalUrl = finalUrl.replace(/"\s*\+\s*"/g, '');
    finalUrl = finalUrl.replace(/^\s*"\s*|\s*"\s*$/g, '');

    return finalUrl;
}

function extractBaseUrl(parsedNewUrl, baseUrl) {
    if (parsedNewUrl.baseUrl) {
        // Remove field selection from base URL if present
        let base = parsedNewUrl.baseUrl.split('/').slice(0, -1).join('/') + '/' +
                   parsedNewUrl.baseUrl.split('/').slice(-1)[0].split('.json')[0] + '.json';
        return baseUrl + base;
    }
    return null;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseUrlFiles(oldContent, newContent) {
    const oldLines = oldContent.split('\n').filter(line => line.trim());
    const newLines = newContent.split('\n').filter(line => line.trim());
    
    const testCases = [];
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
        if (oldLines[i] && newLines[i]) {
            const oldParsed = parseUrlString(oldLines[i]);
            const newParsed = parseUrlString(newLines[i]);

            testCases.push({
                lineNumber: i + 1,
                oldUrl: oldLines[i].replace(/^\d+\.\s*/, '').trim(),
                newUrl: newLines[i].replace(/^\d+\.\s*/, '').trim(),
                oldParsed,
                newParsed,
                variables: newParsed.variables,
                fieldMapping: newParsed.fieldMapping,
                product: newParsed.product,
                master: newParsed.master,
                baseUrl: newParsed.baseUrl
            });
        }
    }

    return testCases;
}

module.exports = {
    parseUrlString,
    buildUrlWithValues,
    extractBaseUrl,
    parseUrlFiles
};
