/**
 * load-test.js
 * Benchmarks application endpoints simulating 100 concurrent Virtual Users (VUs) for 1 minute.
 * Outputs metrics into reports/latest/summary.json.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';
const outputJson = path.join(__dirname, '../../reports/latest/summary.json');

const CONCURRENCY = 100;
const DURATION_MS = 60000; // 1 minute
const TARGET_PATHS = [
    '/auth/login',
    '/auth/register',
    '/clinical-guide'
];

async function runLoadTest() {
    console.log(`Starting Load Test against: ${BASE_URL}`);
    console.log(`Concurrency: ${CONCURRENCY} VUs | Duration: ${DURATION_MS / 1000}s...`);

    const latencies = [];
    const requestSamples = [];
    let totalRequests = 0;
    let failedRequests = 0;
    const endTime = Date.now() + DURATION_MS;

    async function sendRequest() {
        const pathStr = TARGET_PATHS[Math.floor(Math.random() * TARGET_PATHS.length)];
        const start = Date.now();
        return new Promise((resolve) => {
            const req = http.get(`${BASE_URL}${pathStr}`, {
                agent: new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY })
            }, (res) => {
                const duration = Date.now() - start;
                latencies.push(duration);
                totalRequests++;
                if (res.statusCode >= 400) {
                    failedRequests++;
                }
                if (requestSamples.length < 310) {
                    requestSamples.push({
                        id: `REQ-${String(requestSamples.length + 1).padStart(3, '0')}`,
                        path: pathStr,
                        latency_ms: duration,
                        status: res.statusCode >= 400 ? 'Failed' : 'Passed',
                        status_code: res.statusCode
                    });
                }
                // consume response data
                res.on('data', () => {});
                res.on('end', () => resolve());
            });

            req.on('error', (err) => {
                const duration = Date.now() - start;
                latencies.push(duration);
                totalRequests++;
                failedRequests++;
                if (requestSamples.length < 310) {
                    requestSamples.push({
                        id: `REQ-${String(requestSamples.length + 1).padStart(3, '0')}`,
                        path: pathStr,
                        latency_ms: duration,
                        status: 'Failed',
                        status_code: 500
                    });
                }
                resolve();
            });
            req.end();
        });
    }

    // Worker loops for each virtual user
    const workers = [];
    for (let vu = 0; vu < CONCURRENCY; vu++) {
        workers.push((async () => {
            while (Date.now() < endTime) {
                await sendRequest();
                // small dynamic sleep (10-50ms) to simulate user behavior
                await new Promise(r => setTimeout(r, 10 + Math.random() * 40));
            }
        })());
    }

    await Promise.all(workers);

    console.log("Load Test Completed. Parsing stats...");

    // Sort latencies to compute quantiles
    latencies.sort((a, b) => a - b);
    const totalCount = latencies.length || 1;
    const sum = latencies.reduce((a, b) => a + b, 0);
    const avg = sum / totalCount;
    const min = latencies[0] || 0;
    const max = latencies[latencies.length - 1] || 0;
    
    // Percentile 95
    const p95Idx = Math.floor(totalCount * 0.95);
    const p95 = latencies[p95Idx] || 0;

    const rps = totalRequests / (DURATION_MS / 1000);
    const failureRate = (failedRequests / totalCount) * 100;

    const summaryResult = {
        metrics: {
            vus: CONCURRENCY,
            duration_s: DURATION_MS / 1000,
            total_requests: totalRequests,
            requests_per_sec: parseFloat(rps.toFixed(2)),
            avg_response_time_ms: parseFloat(avg.toFixed(2)),
            min_response_time_ms: min,
            max_response_time_ms: max,
            p95_response_time_ms: p95,
            failure_rate_percent: parseFloat(failureRate.toFixed(2))
        },
        samples: requestSamples
    };

    // Ensure reports dir exists
    const dir = path.dirname(outputJson);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputJson, JSON.stringify(summaryResult, null, 2), 'utf8');
    console.log(`Summary JSON report saved to: ${outputJson}`);
}

if (require.main === module) {
    runLoadTest();
}

module.exports = { runLoadTest };
