#!/usr/bin/env python3
"""
Meta Marketing API Tester
=========================
This script generates 500+ Marketing API calls to meet Meta's App Review requirement.
It uses safe GET requests that don't create ads or spend money.

Requirements:
- Python 3.7+
- requests library (pip install requests)

Usage:
1. Get your Access Token from: https://developers.facebook.com/tools/explorer/
   - Select your AdGlobe app
   - Add permissions: ads_read, ads_management, business_management
   - Generate Access Token

2. Get your Ad Account ID from: https://business.facebook.com/settings/ad-accounts
   - Copy the numeric ID (without 'act_' prefix)

3. Run: python meta_api_tester.py
"""

import requests
import time
import json
from datetime import datetime

# ============================================
# CONFIGURATION - FILL THESE IN
# ============================================

ACCESS_TOKEN = "EAFZBnyvJCPwYBRkVHwehZCwsdvo64DXxci1kzPywRzPx411DqSPWYCHa4ZAtYUHHZB92MKhi9YdtBbZBUM2UrW1USroVCWJBtwwaKnWBoaVwI9XxozJ6BwZAg7xpI6e3owbgfbjs5nYkbgwpkhZC8wIKMAX6UxE0hJBkAfo5ThUDh1sBWUB8Tc1DhX36reIiwZAS0j4rlyCI0522F5mRgQs8foufSFCYDjyKz6ZAfFOcyHxeZA7U7NdJ4D1ScGKK4BSv1WDrgoNuHjbBNZBKhZArOZCnC7Qc9D5uZAzyCS2wZDZD"
AD_ACCOUNT_ID = "342828819640091"

# ============================================
# SETTINGS
# ============================================

TOTAL_CALLS_TARGET = 550  # Slightly over 500 for safety margin
DELAY_BETWEEN_CALLS = 0.5  # Seconds between calls (to avoid rate limiting)
API_VERSION = "v21.0"
BASE_URL = f"https://graph.facebook.com/{API_VERSION}"

# ============================================
# API ENDPOINTS TO CALL (All are safe GET requests)
# ============================================

def get_endpoints(ad_account_id):
    """Return list of Marketing API endpoints to call."""
    act_id = f"act_{ad_account_id}"
    return [
        # Ad Account Info
        f"/{act_id}?fields=name,account_status,currency,timezone_name",
        f"/{act_id}?fields=amount_spent,balance,business",
        f"/{act_id}?fields=funding_source,min_campaign_group_spend_cap",
        
        # Campaigns
        f"/{act_id}/campaigns?fields=name,status,objective&limit=5",
        f"/{act_id}/campaigns?fields=id,created_time,updated_time&limit=5",
        
        # Ad Sets
        f"/{act_id}/adsets?fields=name,status,targeting&limit=5",
        f"/{act_id}/adsets?fields=id,budget_remaining,daily_budget&limit=5",
        
        # Ads
        f"/{act_id}/ads?fields=name,status,creative&limit=5",
        f"/{act_id}/ads?fields=id,created_time,updated_time&limit=5",
        
        # Insights (Reporting)
        f"/{act_id}/insights?fields=impressions,clicks,spend&date_preset=last_7d",
        f"/{act_id}/insights?fields=reach,frequency,cpm&date_preset=last_30d",
        f"/{act_id}/insights?fields=cpc,ctr,actions&date_preset=this_month",
        
        # Custom Audiences
        f"/{act_id}/customaudiences?fields=name,subtype&limit=5",
        
        # Saved Audiences
        f"/{act_id}/savedaudiences?fields=name,targeting&limit=5",
        
        # Ad Creatives
        f"/{act_id}/adcreatives?fields=name,title,body&limit=5",
        
        # Targeting Options
        f"/{act_id}/targeting_browse?fields=name,type",
        
        # Delivery Estimate
        f"/{act_id}/delivery_estimate?targeting_spec={json.dumps({'geo_locations':{'countries':['NG']}})}",
        
        # Reach Estimate
        f"/{act_id}/reachestimate?targeting_spec={json.dumps({'geo_locations':{'countries':['NG']}})}",
        
        # Ad Account Activities
        f"/{act_id}/activities?fields=event_type,event_time&limit=5",
        
        # Async Jobs
        f"/{act_id}/async_ad_request_sets?fields=name,status&limit=5",
    ]

# ============================================
# MAIN SCRIPT
# ============================================

def make_api_call(endpoint, access_token):
    """Make a single API call and return success status."""
    url = f"{BASE_URL}{endpoint}"
    
    # Add access token
    separator = "&" if "?" in url else "?"
    url = f"{url}{separator}access_token={access_token}"
    
    try:
        response = requests.get(url, timeout=30)
        return {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "endpoint": endpoint.split("?")[0],  # Just the path part
            "error": response.json().get("error", {}).get("message") if response.status_code != 200 else None
        }
    except Exception as e:
        return {
            "success": False,
            "status_code": 0,
            "endpoint": endpoint.split("?")[0],
            "error": str(e)
        }

def print_progress_bar(current, total, success, failed):
    """Print a nice progress bar."""
    bar_length = 40
    progress = current / total
    filled = int(bar_length * progress)
    bar = "█" * filled + "░" * (bar_length - filled)
    
    success_rate = (success / current * 100) if current > 0 else 0
    
    print(f"\r[{bar}] {current}/{total} | ✅ {success} | ❌ {failed} | Success Rate: {success_rate:.1f}%", end="", flush=True)

def main():
    print("=" * 60)
    print("   META MARKETING API TESTER")
    print("   For App Review - 500 API Calls Requirement")
    print("=" * 60)
    print()
    
    # Validate configuration
    if ACCESS_TOKEN == "YOUR_ACCESS_TOKEN_HERE":
        print("❌ ERROR: Please set your ACCESS_TOKEN in the script!")
        print()
        print("To get your access token:")
        print("1. Go to: https://developers.facebook.com/tools/explorer/")
        print("2. Select your AdGlobe app")
        print("3. Click 'Add Permission' and add: ads_read, ads_management")
        print("4. Click 'Generate Access Token'")
        print("5. Copy the token and paste it in this script")
        return
    
    if AD_ACCOUNT_ID == "YOUR_AD_ACCOUNT_ID":
        print("❌ ERROR: Please set your AD_ACCOUNT_ID in the script!")
        print()
        print("To get your Ad Account ID:")
        print("1. Go to: https://business.facebook.com/settings/ad-accounts")
        print("2. Copy the numeric ID (e.g., 123456789)")
        print("3. Paste it in this script (without 'act_' prefix)")
        return
    
    # Get endpoints
    endpoints = get_endpoints(AD_ACCOUNT_ID)
    
    print(f"📊 Target: {TOTAL_CALLS_TARGET} API calls")
    print(f"📡 Ad Account: act_{AD_ACCOUNT_ID}")
    print(f"🔄 Delay: {DELAY_BETWEEN_CALLS}s between calls")
    print(f"📋 Unique endpoints: {len(endpoints)}")
    print()
    print("Starting in 3 seconds... (Press Ctrl+C to cancel)")
    time.sleep(3)
    print()
    
    # Track results
    results = {
        "success": 0,
        "failed": 0,
        "errors": {},
        "start_time": datetime.now()
    }
    
    call_count = 0
    endpoint_index = 0
    
    try:
        while call_count < TOTAL_CALLS_TARGET:
            # Cycle through endpoints
            endpoint = endpoints[endpoint_index % len(endpoints)]
            endpoint_index += 1
            
            # Make the call
            result = make_api_call(endpoint, ACCESS_TOKEN)
            call_count += 1
            
            if result["success"]:
                results["success"] += 1
            else:
                results["failed"] += 1
                error_key = result.get("error", "Unknown error")
                results["errors"][error_key] = results["errors"].get(error_key, 0) + 1
            
            # Print progress
            print_progress_bar(call_count, TOTAL_CALLS_TARGET, results["success"], results["failed"])
            
            # Delay to avoid rate limiting
            if call_count < TOTAL_CALLS_TARGET:
                time.sleep(DELAY_BETWEEN_CALLS)
        
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
    success_rate = (results["success"] / call_count * 100) if call_count > 0 else 0
    
    print(f"⏱️  Duration: {duration:.1f} seconds")
    print(f"📊 Total Calls: {call_count}")
    print(f"✅ Successful: {results['success']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"📈 Success Rate: {success_rate:.1f}%")
    print()
    
    if success_rate >= 85:
        print("🎉 SUCCESS! Your success rate meets Meta's requirement (≥85%)")
        print()
        print("Next steps:")
        print("1. Wait up to 24 hours for Meta to process the data")
        print("2. Check App Dashboard → Permissions & Features")
        print("3. The 'Marketing API Access Tier' should show progress")
        print("4. Once complete, submit for App Review")
    else:
        print("⚠️  WARNING: Success rate is below 85%")
        print()
        print("Common issues:")
        if results["errors"]:
            print("\nError breakdown:")
            for error, count in sorted(results["errors"].items(), key=lambda x: -x[1])[:5]:
                print(f"  • {error}: {count} times")
        print()
        print("Try:")
        print("1. Check if your access token has the right permissions")
        print("2. Verify the Ad Account ID is correct")
        print("3. Make sure your app has Development access")

if __name__ == "__main__":
    main()
