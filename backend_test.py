import requests
import sys
import json
from datetime import datetime

class LightbanAPITester:
    def __init__(self, base_url="https://ads-kano.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                return True, response.json() if response.text else {}
            else:
                self.failed_tests.append({
                    'test': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200] if response.text else 'No response'
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            self.failed_tests.append({
                'test': name,
                'error': str(e)
            })
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        return self.run_test("API Health Check", "GET", "", 200)

    def test_register_user(self):
        """Test user registration"""
        test_user = {
            "name": f"Test User {datetime.now().strftime('%H%M%S')}",
            "email": f"testuser_{datetime.now().strftime('%H%M%S')}@example.com",
            "phone": "+2348012345678",
            "password": "TestPass123!",
            "role": "advertiser",
            "language_preference": "en"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Registered user with ID: {self.user_id}")
        
        return success

    def test_login_user(self):
        """Test user login with existing credentials"""
        if not self.token:  # Only test if we don't have a token from registration
            login_data = {
                "email": "testuser@example.com",
                "password": "TestPass123!"
            }
            success, response = self.run_test(
                "User Login",
                "POST",
                "auth/login",
                200,
                data=login_data
            )
            
            if success and 'access_token' in response:
                self.token = response['access_token']
                self.user_id = response['user']['id']
            
            return success
        return True

    def test_get_current_user(self):
        """Test getting current user profile"""
        return self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            auth_required=True
        )[0]

    def test_get_influencers(self):
        """Test getting influencers list"""
        return self.run_test(
            "Get Influencers",
            "GET",
            "influencers",
            200
        )[0]

    def test_get_influencers_with_filters(self):
        """Test getting influencers with filters"""
        return self.run_test(
            "Get Influencers with Filters",
            "GET",
            "influencers?niche=lifestyle&min_followers=1000",
            200
        )[0]

    def test_get_billboards(self):
        """Test getting billboards list"""
        return self.run_test(
            "Get Billboards",
            "GET",
            "billboards",
            200
        )[0]

    def test_get_billboards_with_filters(self):
        """Test getting billboards with filters"""
        return self.run_test(
            "Get Billboards with Filters",
            "GET",
            "billboards?city=kano&billboard_type=Digital",
            200
        )[0]

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        return self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            auth_required=True
        )[0]

    def test_get_orders(self):
        """Test getting user orders"""
        return self.run_test(
            "Get User Orders",
            "GET",
            "orders",
            200,
            auth_required=True
        )[0]

    def test_mock_payment(self):
        """Test mock payment endpoint"""
        # First create a dummy order ID (this will fail but test the endpoint)
        dummy_order_id = "test-order-123"
        return self.run_test(
            "Mock Payment",
            "POST",
            f"payments/mock-payment?order_id={dummy_order_id}",
            404,  # Expected to fail since order doesn't exist
            auth_required=True
        )[0]

    def test_invalid_endpoints(self):
        """Test invalid endpoints return 404"""
        success = self.run_test(
            "Invalid Endpoint",
            "GET",
            "nonexistent/endpoint",
            404
        )[0]
        return success

    def test_unauthorized_access(self):
        """Test accessing protected endpoints without auth"""
        # Temporarily remove token
        temp_token = self.token
        self.token = None
        
        success = self.run_test(
            "Unauthorized Access",
            "GET",
            "dashboard/stats",
            401
        )[0]
        
        # Restore token
        self.token = temp_token
        return success

def main():
    print("🚀 Starting Lightban Ads Network API Testing")
    print("=" * 50)
    
    tester = LightbanAPITester()
    
    # Core API tests
    print("\n📋 Testing Core API Endpoints:")
    
    # Health check
    if not tester.test_health_check():
        print("❌ API is not responding. Exiting...")
        return 1
    
    # Authentication tests
    print("\n🔐 Testing Authentication:")
    if not tester.test_register_user():
        print("⚠️  Registration failed, trying login...")
        if not tester.test_login_user():
            print("❌ Both registration and login failed. Continuing without auth...")
        else:
            tester.test_get_current_user()
    else:
        tester.test_get_current_user()
    
    # Marketplace tests
    print("\n🛍️  Testing Marketplace Endpoints:")
    tester.test_get_influencers()
    tester.test_get_influencers_with_filters()
    tester.test_get_billboards()
    tester.test_get_billboards_with_filters()
    
    # Dashboard tests (if authenticated)
    if tester.token:
        print("\n📊 Testing Dashboard:")
        tester.test_dashboard_stats()
        tester.test_get_orders()
        tester.test_mock_payment()
    
    # Security tests
    print("\n🔒 Testing Security:")
    tester.test_unauthorized_access()
    tester.test_invalid_endpoints()
    
    # Print results
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")
    print(f"   Total Tests: {tester.tests_run}")
    print(f"   Passed: {tester.tests_passed}")
    print(f"   Failed: {len(tester.failed_tests)}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "0%")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests Details:")
        for failure in tester.failed_tests:
            if 'error' in failure:
                print(f"   • {failure.get('test', 'Unknown')}: {failure.get('error')}")
            else:
                expected = failure.get('expected', '?')
                actual = failure.get('actual', '?')
                print(f"   • {failure.get('test', 'Unknown')}: Expected {expected}, got {actual}")
    
    # Return appropriate exit code
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())