# API Comparison Tool

> A practical testing tool I built during our servlet migration to ensure old and new API implementations return identical results.

## The Problem

When migrating from `MasterDataFetchServlet` to `MasterDataFetchV2Servlet`, I needed a way to verify that both implementations return the same data. Manually comparing responses for dozens of API endpoints was tedious and error-prone. So I built this tool.

## Demo Video

Watch the tool in action: [API Comparison Tool Demo](https://drive.google.com/file/d/1zsVNmjFz0e4xi81Yd9LnTmpdU-PgDNbi/view?usp=sharing)

## What It Does

This tool takes your old and new API URLs, executes both, and tells you if the responses match. Simple as that.

Here's what happens under the hood:
1. Reads your URL patterns from text files
2. Fetches sample data to fill in the variables
3. Calls both old and new APIs with real values
4. Compares the JSON responses
5. Generates a detailed report showing any differences

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. ⚙️ Configure Your Environment (Important!)

**This is crucial** - update `config/config.json` with your environment details. The file comes with sample credentials that you need to replace with yours:

```json
{
  "environment": {
    "baseUrl": "https://your-server.com",      // Replace with your server URL
    "username": "your-username",                // Replace with your username
    "password": "your-password"                 // Replace with your password
  }
}
```

### 3. Add Your API URLs

For now (v1.0), you'll need to manually add your URLs to the text files. I know it's a bit tedious, but trust me, it's worth it.

**Edit `data/old.txt`** - Add your old API URLs:
```javascript
1. /content/hdfc_pl_forms/api/FetchMasterData.PL.BRAN_CHA_MAP.DSACODE-" + agentDsaCodeVal+ "~isExact.CITY-" + cityId + "~isExact.json/CITY.DSACODE.json

2. /content/hdfc_pl_forms/api/FetchMasterData.PL.PINCODE_FN_BRANCH.STATEID-" + stateId + "~isExact.CITY-" + cityVal + ".json
```

**Edit `data/new.txt`** - Add corresponding new URLs (same line numbers!):
```javascript
1. /content/hdfc_commonforms/api/masterdatafetchv2.PL.BRAN_CHA_MAP.json/CITY.DSACODE.json?DSACODE="+agentDsaCodeVal+"&CITY="+cityId+"&isExact=DSACODE,CITY

2. /content/hdfc_commonforms/api/masterdatafetchv2.PL.PINCODE_FN_BRANCH.json?STATEID=" + stateId + "&CITY=" + cityVal + "&isExact=STATEID
```

**💡 Pro Tip:** Use GitHub Copilot or ChatGPT to help convert your old URL patterns to the new format. Just give it a few examples and it'll catch on to the pattern. Saves a ton of time!

### 4. Run It

```bash
npm start
```

Watch the magic happen. You'll get a nice console output plus an HTML report in the `reports/` folder.

## Configuration Options

### Different Environments

Everyone's setup is different. Here's what you can configure in `config/config.json`:

```json
{
  "environment": {
    "baseUrl": "https://your-server.com",  // Your environment URL
    "username": "your-username",            // Your login
    "password": "your-password"             // Your password
  },
  "options": {
    "timeout": 30000,                       // Request timeout in ms
    "ignoreFieldOrder": true,               // Ignore array order in comparison
    "ignoreFields": [],                     // Fields to skip (e.g., ["timestamp"])
    "maxRetries": 2,                        // Retry failed requests
    "delayBetweenTests": 500,              // Pause between tests (ms)
    "strictSSL": false                      // SSL certificate validation
  },
  "output": {
    "format": "both",                       // "console", "html", or "both"
    "reportDirectory": "reports"
  }
}
```

### Common Scenarios

**Ignoring timestamp fields:**
```json
{
  "options": {
    "ignoreFields": ["timestamp", "requestId", "lastModified"]
  }
}
```

**Longer timeout for slow APIs:**
```json
{
  "options": {
    "timeout": 60000
  }
}
```

## Project Structure

```
api-comparison-tool/
├── src/
│   └── api-comparator.js          # Main entry point
├── utils/
│   ├── parser.js                  # Parses those JS concatenation strings
│   ├── http-client.js             # Handles auth and requests
│   ├── json-comparator.js         # Deep JSON comparison
│   └── report-generator.js        # Pretty reports
├── config/
│   └── config.json                # Your environment settings
├── data/
│   ├── old.txt                    # Your old API URLs
│   └── new.txt                    # Your new API URLs
└── reports/                       # Generated reports land here
```

## How It Really Works

Let me walk you through what happens when you run this tool:

**Step 1: Parse Your URLs**
```javascript
Old: /api/FetchMasterData.PL.MASTER.FIELD-" + variable + ".json
```
It figures out you need a value for `variable` and maps it to the `FIELD` parameter.

**Step 2: Get Sample Data**
It calls the base API to grab real data:
```
GET /api/masterdatafetchv2.PL.MASTER.json
Response: [{"FIELD":"12345", ...}]
```

**Step 3: Build Complete URLs**
Now it substitutes the real values:
```
Old: https://server.com/api/FetchMasterData.PL.MASTER.FIELD-12345.json
New: https://server.com/api/masterdatafetchv2.PL.MASTER.json?FIELD=12345
```

**Step 4: Compare Results**
Calls both, compares the JSON, reports any differences.

## URL Conversion Examples

Here are some patterns I encountered during migration:

### Simple Filter
```javascript
// Old
/api/FetchMasterData.PL.MASTER.FIELD-" + value + ".json

// New
/api/masterdatafetchv2.PL.MASTER.json?FIELD=" + value
```

### With isExact Flag
```javascript
// Old
/api/FetchMasterData.PL.MASTER.FIELD-" + value + "~isExact.json

// New
/api/masterdatafetchv2.PL.MASTER.json?FIELD=" + value + "&isExact=FIELD
```

### Multiple Fields
```javascript
// Old
/api/FetchMasterData.PL.MASTER.FIELD1-" + val1 + "~isExact.FIELD2-" + val2 + ".json

// New
/api/masterdatafetchv2.PL.MASTER.json?FIELD1=" + val1 + "&FIELD2=" + val2 + "&isExact=FIELD1
```

### With Field Selection
```javascript
// Old
/api/FetchMasterData.PL.MASTER.FIELD-" + value + ".json/FIELD1.FIELD2.json

// New
/api/masterdatafetchv2.PL.MASTER.json/FIELD1.FIELD2.json?FIELD=" + value
```

## Reading the Output

### Console Output
You'll see something like this:

```
🚀 Starting API Comparison Tool...
✓ Found 2 test case(s)

📋 Running Test Case 1/2...
  ✓ Variables extracted: {"agentDsaCodeVal":"40757","cityId":"369"}
  ✓ Old API: 200 OK (245ms)
  ✓ New API: 200 OK (198ms)
  ✅ Test PASSED - Responses match!

═══════════════════════════════════════
SUMMARY
═══════════════════════════════════════
Total Tests: 2
Passed: 2 (100%)
Failed: 0
```

### HTML Report
Open `reports/test-report-[timestamp].html` in your browser. It's got:
- Dashboard with pass/fail counts
- Side-by-side URL comparison
- Response times
- Highlighted differences (if any)

## Troubleshooting

### "Authentication failed"
Check your credentials in `config/config.json`. Make sure you can login to the environment manually.

### "Variable extraction failed"
The base API probably didn't return data. Check that the endpoint is accessible and returns at least one record.

### "URLs not matching"
Make sure line numbers match between `old.txt` and `new.txt`. Line 1 in old.txt should correspond to line 1 in new.txt.

### SSL Certificate Errors
Set `"strictSSL": false` in your config if you're on a dev/test environment with self-signed certificates.

## Running the Tests

I've included a test suite to validate everything works:

```bash
node test-validation.js
```

All tests should pass. If they don't, something's broken - open an issue.

## Limitations & Future Plans

**Current Version (v1.0):**
- ✅ Compares responses accurately
- ✅ Handles complex URL patterns
- ✅ Generates detailed reports
- ⚠️ Requires manual URL entry (tedious for many endpoints)

**Future Ideas:**
- Auto-extract URLs from JavaScript files
- Browser extension to capture URLs in real-time
- Integration with your CI/CD pipeline
- Support for POST requests

## Contributing

Found a bug? Have an idea? Open an issue or submit a PR. I'm open to improvements!

## Need Help?

Check out:
- `TEST-REPORT.md` for validation results
- `test-validation.js` for usage examples
- Issues section on GitHub

---

Built this at late-night. Hope it helps you too! ☕
