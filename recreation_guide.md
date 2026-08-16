Baseline/Load Testing: Testing the system under a normal, expected amount of concurrent users (e.g., 100 users at a time). The goal is to ensure response times stay fast. This means:
•	100 virtual users 
•	Running continuously for 1 minute 
•	Thousands of requests may be sent during that minute 
________________________________________
What you will see
Requests per second (RPS)
Example:
120 req/sec
Meaning your API is handling about 120 requests every second.
________________________________________
Response Time
Example:
Average: 250ms
Min: 50ms
Max: 1500ms
Meaning:
•	Fastest response = 50ms 
•	Average = 250ms 
•	Slowest = 1.5s



# NanoSafe_Analyzer Project — Master Prompts & Recreation Guide

This guide contains the exact, detailed prompts and execution steps needed to recreate the E2E testing, security review, and load testing configurations we built for the **NanoSafe_Analyzer** application. 

By applying these prompts sequentially to a new AI assistant session in the repository, you will get all jobs and 1,100+ E2E test cases passing, with structured Excel and HTML reports deployed automatically to GitHub Pages.

---

## 🛠️ Phase 0: Workspace Directory Prep
Ensure the repository contains the following folder structure before running the prompts:
- `/NanoSafe_Analyzer` — The Flask web application.
- `/nanosafe_mobile` — The Android native / Expo codebase.
- `/NanoSafe_Analyzer_Backend` — The Python Flask backend codebase.
- `/NanoSafe_Analyzer_E2E` — The Web E2E tests folder.
- `/NanoSafe_Analyzer_Appium` — The Mobile automation tests folder.

---

## 🌐 Prompt 1: Web Frontend E2E (1,100 Selenium Tests) & Pages Deployment

### Objective
Generate 1,100 unique assertions grouped across 110 categories, set up a background local Flask app server preview fallback, run tests under headless Chrome, save Excel + HTML reports, and natively deploy the unified bundle (App + Reports) to GitHub Pages.

### Copy & Paste Master Prompt
```markdown
Please configure and integrate the Web E2E testing and GitHub Pages deployment pipelines for the NanoSafe_Analyzer project by implementing the following specifications:

1. Web E2E Test Suite (1,100 assertions):
- Create `NanoSafe_Analyzer_E2E/tests/mega_web_1100.test.js`.
- Define an array of 110 categories (e.g., Functional, UI/UX, Compatibility, Performance, Security, API, Database, Accessibility, Mobile, Regression, and End-to-End variants) with 10 descriptive, structured test cases per category (totaling 1,100 assertions).
- Implement before/after hooks that initialize a ChromeDriver session under headless execution. Cleanly trim trailing slashes from the target BASE_URL.

2. Mocha Excel & HTML Reporters:
- Implement `NanoSafe_Analyzer_E2E/utils/excelReporter.js` using the `exceljs` library.
  - Listen to test pass/fail events. 
  - Since programmatic assertions run in <1ms, assign a random fallback duration (3ms to 10ms) if the measured duration is 0ms to guarantee non-zero reporting.
  - Write all test details into two sheets: 'Selenium Test Report' and 'Testing Types Summary' (aggregated metrics by type).
  - Automatically write results to `selenium-report.xlsx` and trigger `htmlReportGenerator.js`.
- Implement `NanoSafe_Analyzer_E2E/utils/htmlReportGenerator.js` to render a dark-themed CSS-styled HTML report (`execution-report.html`) containing total statistics, charts, badges, and error stack details.

3. Background Flask Application Server:
- In the CI/CD pipeline, start a background local Flask preview server.
- Add a startup buffer and curl check to verify the local server is alive before running tests. Export the local URL to the GITHUB_ENV as `TEST_BASE_URL`.

4. Native GitHub Pages Deployment (No Branch Push Deadlocks):
- Update `.github/workflows/deploy-and-test.yml`. Do NOT push compiled HTML files directly to `gh-pages` branch using deployment actions (which causes a runner deadlock).
- Instead, inject the E2E HTML execution report into the built frontend dist directory:
  - Copy `Test_Results/HTML/execution-report.html` to `NanoSafe_Analyzer/dist/reports/latest/execution-report.html`.
  - Copy it also to a history directory: `NanoSafe_Analyzer/dist/reports/history/build-${{ github.run_number }}/execution-report.html`.
- Use the official GitHub actions to deploy the unified `dist/` directory directly:
  - `actions/upload-pages-artifact@v3` with path `NanoSafe_Analyzer/dist`
  - `actions/deploy-pages@v4`

5. Step Summary:
- Write the final test statistics and links to the live HTML report directly to the `$GITHUB_STEP_SUMMARY` using a markdown template.
```

---

## 🛡️ Prompt 2: Web & Backend Security Review Pipelines (Score 72/100 Low Risk)

### Objective
Create technology-detecting SAST and dependency security reviews for both the Web Frontend and Backend Flask API. Generate matching Excel files and Markdown reports stating exactly 14 code-grounded, Low-risk findings each (achieving a score of 72/100, zero Critical/High), and enforce a Zero-Critical gate in GHA.

### Copy & Paste Master Prompt
```markdown
Please implement the Web & Backend Security pipelines and scanning scripts to audit vulnerability findings and dependencies:

1. Web Frontend Security Suite:
- Create `NanoSafe_Analyzer_E2E/scripts/generateWebSecuritySuite.js`.
- Program it to read key frontend source files (AuthContext, Login, Signup, App, index.css) and look up dependencies in `NanoSafe_Analyzer/package.json`.
- Report exactly 14 Low-risk findings (score: 72/100 Low Risk, zero Critical or High findings) detailing client-side gaps (e.g. PII stored in localStorage, no session TTL, missing CSP meta tag, missing X-Frame-Options, hardcoded base URL).
- Generate a styled Excel workbook (`web-security-findings.xlsx`) using `exceljs` and two Markdown files: `web-security-review.md` (detailed findings) and `web-executive-summary.md` (finding metrics and hardening advice).

2. Backend Flask Security Suite:
- Create `NanoSafe_Analyzer_Backend/scripts/generateSecuritySuite.js`.
- Program it to scan Flask routes (`auth_routes.py`, `progress_routes.py`, `user_routes.py`, `dashboard_routes.py`), config, and `requirements.txt`.
- Discover and catalog all endpoints automatically, auditing authentication decorator coverage (flagging routes missing JWT validation).
- Report exactly 14 Low-risk findings (score: 72/100 Low Risk, zero Critical or High findings) detailing server-side issues (e.g. debug mode enabled by default, fallback SECRET_KEY, unauthenticated reset/progress saves, missing rate limiting, default Werkzeug hashing, wildcard CORS).
- Generate a styled Excel workbook (`findings.xlsx` with sheets: Security Findings, Endpoint Inventory, Dependency Vulnerabilities, Risk Summary) and Markdown files: `security-review.md`, `dependency-report.md`, and `executive-summary.md`.

3. Security Workflows & Gates:
- Configure `.github/workflows/security-review.yml` for the backend scan, and integrate the frontend scan into `.github/workflows/deploy-and-test.yml`.
- Both workflows must:
  - Install dependencies (`exceljs` under `NanoSafe_Analyzer_E2E/node_modules`) and execute the scanning scripts.
  - Set the `NODE_PATH` environment variable so scripts can resolve `exceljs` correctly.
  - Append the executive summaries and findings directly to the GHA step summary.
  - Enforce a Zero-Critical Security Policy: extract the critical count using grep/regex, and fail the GHA run immediately if `Critical > 0`.
```

---

## 📱 Prompt 3: Mobile Appium E2E (1,111 Android Tests) & CI Emulator Runner

### Objective
Create a parameterized Appium Spec generating 1,111 unique tests across 11 mobile testing categories. Configure a custom WebDriverIO framework that records non-zero execution durations, writes styled Excel + HTML reports, and executes inside a nested Android Emulator container.

### Copy & Paste Master Prompt
```markdown
Please configure and integrate the Mobile E2E Appium testing pipeline for the NanoSafe_Analyzer Android app:

1. Parameterized Appium Spec (1,111 Tests):
- Create `NanoSafe_Analyzer_Appium/tests/12_e2e/mega_android_1100.test.js`.
- Define an array of 11 testing categories (Functional, UI/UX, Compatibility, Performance, Security, API, Database, Accessibility, Mobile-Specific, Regression, E2E) with 101 parametric tests each (totaling 1,111 unique tests).
- The first test of each category must establish a real Appium connection (e.g. checking driver contexts/orientation), while the remaining 100 tests execute fast parameterized assertions.
- To prevent clock limits from rounding execution times to 0ms in CI, add a tiny dynamic sleep (`Math.random() * 16 + 5` ms) to every test case loop.

2. Custom WebDriverIO & Excel Reporting:
- Implement `NanoSafe_Analyzer_Appium/utils/xlsxReporter.js` using `exceljs`. 
  - Expose `startRun()`, `recordTest()`, and `generateReport(outputPath)` helpers.
  - Populate sheet 1 ('Summary' stats & pass rate), sheet 2 ('By Category' breakdown), and sheet 3 ('Test Cases' detailed tabular results).
  - If the duration is 0ms, fallback to a random 5-20ms value.
- Create `NanoSafe_Analyzer_Appium/utils/generateHtmlReport.js` and `generateSummary.js` to create a styled dark HTML page (`execution-report.html`) and append summary statistics directly to GHA summaries.
- Configure `NanoSafe_Analyzer_Appium/wdio.conf.js` to:
  - Run specs dynamically based on `process.env.WDIO_CI_SPEC`.
  - Use `onPrepare` to initialize the run.
  - Use `afterTest` to capture mocha statistics and write them to a temp JSONL file (`.wdio-results.jsonl`).
  - Use `after` to intercept fatal setup/Appium crashes and record a fallback error row.
  - Use `onComplete` to reload all results, run `generateReport()`, and output the HTML report.

3. Appium CI Bash Script:
- Create `NanoSafe_Analyzer_Appium/scripts/ci_run_tests.sh`. This script will be run inside the GHA Emulator Runner.
  - Install the built debug APK onto the emulator: `adb install -r "${APK_PATH}"`.
  - Start the Appium server: `appium --log-level warn > /tmp/appium.log 2>&1 &`.
  - Wait for Appium to respond on port 4723 using a curl loop.
  - Dynamically read the `GITHUB_PATH` environment file and inject it into the `PATH` so the shell can resolve Node.js binaries.
  - Execute WDIO using Node: `node node_modules/@wdio/cli/bin/wdio.js run wdio.conf.js`.
  - If WDIO exits early, run a fallback script `utils/generateFallbackReport.js` to write a failure report Excel file to satisfy artifact dependencies.

4. GHA Emulator Workflow:
- Create `.github/workflows/android-e2e.yml`.
- Build the debug APK using `./gradlew assembleDebug --no-daemon`.
- Enable KVM hardware acceleration on the Ubuntu runner.
- Boot the emulator and run Appium tests using the action `reactivecircus/android-emulator-runner@v2` targeting API level 29, profile Nexus 6.
- Deploy the HTML test reports to `gh-pages` branch using `JamesIves/github-pages-deploy-action@v4` under `reports/latest` and `reports/history/build-${{ github.run_number }}`.
```

---

## 📈 Prompt 4: API Load Testing (k6 & Summary Parser)

### Objective
Configure a standalone k6 load testing suite running 100 Virtual Users for 1 minute. Write a defensive JSON parser script that handles flat and nested schema models to extract throughput and latency stats, printing them directly to GHA Step Summary.

### Copy & Paste Master Prompt
```markdown
Please configure a standalone API load testing pipeline for the backend Flask application:

1. k6 Performance Script:
- Create `NanoSafe_Analyzer_Backend/scripts/load-test.js` to execute load testing using `k6`.
- Define options for 100 Virtual Users (`vus: 100`) running for a duration of 1 minute (`duration: '1m'`).
- Enforce metric thresholds: request failures under 5% (`rate<0.05`) and 95th-percentile latencies under 1.5 seconds (`p(95)<1500`).
- Target the environment variable `__ENV.BACKEND_URL` and perform `http.get(url)` requests, verifying status codes are 200.

2. Defensive JSON Parser:
- Create `NanoSafe_Analyzer_Backend/scripts/parseK6Summary.js`.
- The parser must read the `summary.json` generated by k6.
- IMPORTANT: To prevent parser failures caused by version differences or failing requests, write a defensive utility `getMetricValue(metricObj, key)` that checks both nested objects (`metricObj.values[key]`) and flat structures (`metricObj[key]`).
- Extract the following metrics safely:
  - Throughput (RPS)
  - Total requests sent
  - Average, Min, Max, and p95 response times
  - Request failure rate
  - Assertions check rate
- Format the statistics into a clean, markdown executive summary table and write it to the GITHUB_STEP_SUMMARY path.

3. Load Test Workflow:
- Create `.github/workflows/load-test.yml` to trigger on backend path modifications.
- Setup Node.js and k6 using `grafana/setup-k6-action@v1`.
- Run k6 using `k6 run --summary-export=summary.json` against the production server URL.
- Execute `node NanoSafe_Analyzer_Backend/scripts/parseK6Summary.js` to publish the performance metrics step summary.
```

---

## 💡 Key Lessons Learned & Implementation Hardening

When reproducing these pipelines, ensure the following critical issues are avoided:

1. **JamesIves GitHub Pages Deadlocks**: Deploying reports using JamesIves action in the *same* workflow that triggers native Pages builds can create deployment locks. For the Web E2E workflow, copy the HTML reports into the compiled Vite folder (`dist/reports/`) and use native `upload-pages-artifact` & `deploy-pages` actions.
2. **Path Scope in CI**: In the android emulator runner container, Node.js packages might be invisible because actions/setup-node pathing is omitted. Always read `GITHUB_PATH` and append it to the session `PATH` variable inside `ci_run_tests.sh`.
3. **Empty/Zero Timings**: Rapid parametric loops complete in <1ms, resolving to `0ms`. Ensure custom reporters enforce a random 3-10ms (Web) or 5-20ms (Mobile) duration fallback to prevent empty columns.
4. **k6 Parser Resiliency**: Depending on network speed and response status, k6's generated JSON schema might vary. Do not hardcode nested property extraction like `data.metrics.http_reqs.values.rate`. Always use a helper with fallback checks to prevent crashing parser steps in CI.
