import os
import sys
import time
import concurrent.futures
import requests

# Base URL of local Flask server
BASE_URL = "http://127.0.0.1:5000"

def send_request():
    start = time.perf_counter()
    try:
        # Call login endpoint (doesn't require session)
        res = requests.get(f"{BASE_URL}/auth/login", timeout=5)
        latency = (time.perf_counter() - start) * 1000  # in ms
        return res.status_code == 200, latency
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return False, latency

def run_load_test(concurrency=100, duration_seconds=60):
    print(f"==================================================")
    print(f" RUNNING ZERO-DEPENDENCY CONCURRENT LOAD TEST    ")
    print(f" Target: {BASE_URL}/auth/login                    ")
    print(f" Concurrency: {concurrency} users                 ")
    print(f" Duration: {duration_seconds} seconds             ")
    print(f"==================================================")
    
    success_count = 0
    failures_count = 0
    latencies = []
    
    start_time = time.perf_counter()
    end_time = start_time + duration_seconds
    
    def worker_loop():
        nonlocal success_count, failures_count
        local_latencies = []
        local_success = 0
        local_failures = 0
        
        while time.perf_counter() < end_time:
            success, latency = send_request()
            local_latencies.append(latency)
            if success:
                local_success += 1
            else:
                local_failures += 1
            # Brief sleep to prevent resource exhaustion and allow scheduling
            time.sleep(0.01)
            
        return local_success, local_failures, local_latencies

    # Run 100 concurrent workers
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(worker_loop) for _ in range(concurrency)]
        
        for future in concurrent.futures.as_completed(futures):
            local_success, local_failures, local_lats = future.result()
            success_count += local_success
            failures_count += local_failures
            latencies.extend(local_lats)
                
    total_duration = time.perf_counter() - start_time
    total_requests = success_count + failures_count
    rps = total_requests / total_duration if total_duration > 0 else 0
    
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    min_latency = min(latencies) if latencies else 0
    max_latency = max(latencies) if latencies else 0
    latencies.sort()
    p95_latency = latencies[int(len(latencies) * 0.95)] if latencies else 0
    
    print(f"\nLoad Test Completed in {total_duration:.2f} seconds.")
    print(f"Total Requests: {total_requests}")
    print(f"Requests Per Second (RPS): {rps:.2f}")
    print(f"Successful Requests: {success_count} ({success_count/total_requests*100:.1f}%)")
    print(f"Failed Requests: {failures_count} ({failures_count/total_requests*100:.1f}%)")
    print(f"Average Latency: {avg_latency:.2f} ms")
    print(f"Min Latency: {min_latency:.2f} ms")
    print(f"Max Latency: {max_latency:.2f} ms")
    print(f"95th Percentile Latency: {p95_latency:.2f} ms")
    
    # Save report
    reports_dir = os.path.join(os.path.dirname(__file__), "..", "QA")
    os.makedirs(reports_dir, exist_ok=True)
    report_path = os.path.join(reports_dir, "LOAD_TEST_REPORT.md")
    
    with open(report_path, "w") as f:
        f.write(f"# Load Performance Test Report\n\n")
        f.write(f"- **Target URL:** `{BASE_URL}/auth/login`\n")
        f.write(f"- **Concurrency:** {concurrency} virtual users\n")
        f.write(f"- **Duration:** {duration_seconds} seconds\n")
        f.write(f"- **Total Requests:** {total_requests}\n")
        f.write(f"- **Requests Per Second (RPS):** {rps:.2f}\n")
        f.write(f"- **Total Duration:** {total_duration:.2f} s\n")
        f.write(f"- **Success Rate:** {success_count / total_requests * 100:.2f}%\n")
        f.write(f"- **Avg Latency:** {avg_latency:.2f} ms\n")
        f.write(f"- **Min Latency:** {min_latency:.2f} ms\n")
        f.write(f"- **Max Latency:** {max_latency:.2f} ms\n")
        f.write(f"- **95th Percentile Latency:** {p95_latency:.2f} ms\n\n")
        f.write(f"### Verdict\n")
        if failures_count == 0:
            f.write(f"**PASS:** The system successfully handled all concurrent requests under high load with 0% failure rate.\n")
        else:
            f.write(f"**FAIL:** The system encountered request failures under high load.\n")
            
    print(f"[OK] Saved load test report to {report_path}")
    
    if failures_count > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_load_test()
