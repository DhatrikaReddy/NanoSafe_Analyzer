"""
automated_test/discover_endpoints.py
Discovers all registered routes in NanoSafe Analyzer, categorizes their access model,
and outputs endpoints.json and expectation_model.json.
"""

import json
import os
import sys

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app_factory import create_app

def discover():
    app = create_app()
    endpoints = []
    
    for rule in app.url_map.iter_rules():
        rule_str = str(rule.rule)
        if any(skip in rule_str for skip in ['/static', '/health', '/actuator', '/metrics']):
            continue
            
        methods = list(rule.methods - {'HEAD', 'OPTIONS'})
        endpoint_name = str(rule.endpoint)
        
        # Determine expected access role
        expected_role = "public"
        if endpoint_name.startswith("admin."):
            expected_role = "admin_only"
        elif any(endpoint_name.startswith(p) for p in ["main.", "participants.", "mobile."]):
            if any(public_main in rule_str for public_main in ["/auth/", "/clinical-guide", "/simulator"]):
                expected_role = "public"
            elif any(public_mob in rule_str for public_mob in ["/mobile/v1/auth/login", "/mobile/v1/auth/register", "/mobile/v1/auth/verify-otp", "/mobile/v1/auth/resend-otp"]):
                expected_role = "public"
            else:
                expected_role = "authenticated_user"
                
        for method in methods:
            endpoints.append({
                "path": rule_str,
                "endpoint": endpoint_name,
                "method": method,
                "expected_role": expected_role,
                "requires_auth": expected_role in ["authenticated_user", "admin_only"]
            })

    endpoints.sort(key=lambda x: (x["path"], x["method"]))
    
    out_dir = os.path.dirname(os.path.abspath(__file__))
    endpoints_file = os.path.join(out_dir, "endpoints.json")
    with open(endpoints_file, "w", encoding="utf-8") as f:
        json.dump(endpoints, f, indent=2)
        
    print(f"Discovered {len(endpoints)} unique endpoint methods.")
    print(f"Saved catalog to: {endpoints_file}")
    return endpoints

if __name__ == "__main__":
    discover()
