#!/usr/bin/env python3
"""
Meta Marketing API Tester v2 - Rate Limit Safe
==============================================
Designed to avoid rate limiting by using longer delays and simpler endpoints.

Requirements:
- Python 3.7+
- requests library (pip install requests)
"""

import requests
import time
import json
from datetime import datetime
import sys

# ============================================
# CONFIGURATION
# ============================================

ACCESS_TOKEN = "EAFZBnyvJCPwYBRkVHwehZCwsdvo64DXxci1kzPywRzPx411DqSPWYCHa4ZAtYUHHZB92MKhi9YdtBbZBUM2UrW1USroVCWJBtwwaKnWBoaVwI9XxozJ6BwZAg7xpI6e3owbgfbjs5nYkbgwpkhZC8wIKMAX6UxE0hJBkAfo5ThUDh1sBWUB8Tc1DhX36reIiwZAS0j4rlyCI0522F5mRgQs8foufSFCYDjyKz6ZAfFOcyHxeZA7U7NdJ4D1ScGKK4BSv1WDrgoNuHjbBNZBKhZArOZCnC7Qc9D5uZAzyCS2wZDZD"
AD_ACCOUNT_ID = "342828819640091"

# ============================================
# SETTINGS - RATE LIMIT SAFE
# ============================================

TOTAL_CALLS_TARGET = 550
DELAY_BETWEEN_CALLS = 3.0  # 3 seconds - much safer for rate limits
API_VERSION = "v21.0"
BASE_URL = f"https://graph.facebook.com/{API_VERSION}"

# ============================================
# LIGHTWEIGHT ENDPOINTS (Less likely to rate limit)
# ============================================

def get_endpoints(ad_account_id):
    """Return lightweight Marketing API endpoints that are less likely to rate limit."""
    act_id = f"act_{ad_account_id}"
    
    # Use simple, lightweight read operations
    return [
        # Basic account info - very light
        f"/{act_id}?fields=name",
        f"/{act_id}?fields=account_status",
        f"/{act_id}?fields=currency",
        f"/{act_id}?fields=timezone_name",
        f"/{act_id}?fields=business_name",
        
        # Single field queries - minimal load
        f"/{act_id}?fields=amount_spent",
        f"/{act_id}?fields=balance",
        f"/{act_id}?fields=age",
        f"/{act_id}?fields=owner",
        f"/{act_id}?fields=spend_cap",
        
        # List endpoints with limit=1 - minimal data
        f"/{act_id}/campaigns?fields=id&limit=1",
        f"/{act_id}/adsets?fields=id&limit=1",
        f"/{act_id}/ads?fields=id&limit=1",
        f"/{act_id}/customaudiences?fields=id&limit=1",
        f"/{act_id}/adcreatives?fields=id&limit=1",
    ]

# ============================================
# MAIN SCRIPT
# ============================================

def make_api_call(endpoint, access_token, call_num):
    """Make a single API call and return success status."""
    url = f"{BASE_URL}{endpoint}"
    
    # Add access token
    separator = "&" if "?" in url else "?"
    url = f"{url}{separator}access_token={access_token}"
    
    try:
        response = requests.get(url, timeout=30)
        data = response.json()
        
        # Check for errors
        if "error" in data:
            error_msg = data["error"].get("message", "Unknown error")
            error_code = data["error"].get("code", 0)
            
            # Rate limit detection
            if error_code == 80004:
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "endpoint": endpoint.split("?")[0],
                    "error": "RATE_LIMITED",
                    "needs_backoff": True
                }
            
            return {
                "success": False,
                "status_code": response.status_code,
                "endpoint": endpoint.split("?")[0],
                "error": error_msg[:50],
                "needs_backoff": False
            }
        
        return {
            "success": True,
            "status_code": response.status_code,
            "endpoint": endpoint.split("?")[0],
            "error": None,
            "needs_backoff": False
        }
        
    except Exception as e:
        return {
            "success": False,
            "status_code": 0,
            "endpoint": endpoint.split("?")[0],
            "error": str(e)[:50],
            "needs_backoff": False
        }

def print_progress(current, total, success, failed, rate_limited):
    """Print progress status."""
    bar_length = 30
    progress = current / total
    filled = int(bar_length * progress)
    bar = "█" * filled + "░" * (bar_length - filled)
    
    success_rate = (success / current * 100) if current > 0 else 0
    
    # Clear line and print
    sys.stdout.write(f"\r[{bar}] {current}/{total} | ✅{success} ❌{failed} 🚫{rate_limited} | {success_rate:.1f}%")
    sys.stdout.flush()

def main():
    print("=" * 60)
    print("   META MARKETING API TESTER v2")
    print("   Rate Limit Safe - 3 second delays")
    print("=" * 60)
    print()
    
    endpoints = get_endpoints(AD_ACCOUNT_ID)
    
    estimated_time = (TOTAL_CALLS_TARGET * DELAY_BETWEEN_CALLS) / 60
    print(f"📊 Target: {TOTAL_CALLS_TARGET} API calls")
    print(f"📡 Ad Account: act_{AD_ACCOUNT_ID}")
    print(f"🔄 Delay: {DELAY_BETWEEN_CALLS}s between calls")
    print(f"⏱️  Estimated time: ~{estimated_time:.0f} minutes")
    print(f"📋 Endpoints: {len(endpoints)} (rotating)")
    print()
    print("Starting in 5 seconds...")
    time.sleep(5)
    print()
    
    # Track results
    results = {
        "success": 0,
        "failed": 0,
        "rate_limited": 0,
        "errors": {},
        "start_time": datetime.now(),
        "backoff_count": 0
    }
    
    call_count = 0
    endpoint_index = 0
    current_delay = DELAY_BETWEEN_CALLS
    
    try:
        while call_count < TOTAL_CALLS_TARGET:
            # Cycle through endpoints
            endpoint = endpoints[endpoint_index % len(endpoints)]
            endpoint_index += 1
            
            # Make the call
            result = make_api_call(endpoint, ACCESS_TOKEN, call_count)
            call_count += 1
            
            if result["success"]:
                results["success"] += 1
                # Reset delay if we've been backing off
                current_delay = DELAY_BETWEEN_CALLS
            else:
                if result.get("needs_backoff") or result.get("error") == "RATE_LIMITED":
                    results["rate_limited"] += 1
                    results["backoff_count"] += 1
                    # Exponential backoff: wait longer when rate limited
                    backoff_time = min(60, 10 * results["backoff_count"])
                    print(f"\n⚠️  Rate limited! Backing off for {backoff_time}s...")
                    time.sleep(backoff_time)
                    # Increase delay for future calls
                    current_delay = min(10, current_delay + 1)
                else:
                    results["failed"] += 1
                    error_key = result.get("error", "Unknown")
                    results["errors"][error_key] = results["errors"].get(error_key, 0) + 1
            
            # Print progress
            print_progress(call_count, TOTAL_CALLS_TARGET, results["success"], results["failed"], results["rate_limited"])
            
            # Delay to avoid rate limiting
            if call_count < TOTAL_CALLS_TARGET:
                time.sleep(current_delay)
        
        print()  # New line after progress bar
        
    except KeyboardInterrupt:
        print()
        print("\n⚠️  Interrupted by user!")
    
    # Print summary
    print()
    print("=" * 60)
    print("   SUMMARY")
    print("=" * 60)
    
    duration = (datetime.now() - results["start_time"]).total_seconds()
    total_attempts = results["success"] + results["failed"]
    success_rate = (results["success"] / total_attempts * 100) if total_attempts > 0 else 0
    
    print(f"⏱️  Duration: {duration/60:.1f} minutes")
    print(f"📊 Total Calls: {call_count}")
    print(f"✅ Successful: {results['success']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"🚫 Rate Limited: {results['rate_limited']}")
    print(f"📈 Success Rate: {success_rate:.1f}%")
    print()
    
    if success_rate >= 85:
        print("🎉 SUCCESS! Your success rate meets Meta's requirement (≥85%)")
    else:
        print("⚠️  WARNING: Success rate is below 85%")
        if results["errors"]:
            print("\nError breakdown:")
            for error, count in sorted(results["errors"].items(), key=lambda x: -x[1])[:5]:
                print(f"  • {error}: {count}")

if __name__ == "__main__":
    main()
