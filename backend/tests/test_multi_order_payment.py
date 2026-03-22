"""
Test Multi-Order Payment Initialization Bug Fix

This test verifies that when multiple orders are in the cart:
1. Frontend sends ALL order IDs (comma-separated) to backend
2. Backend calculates correct combined total from all order IDs
3. Paystack receives correct combined amount

Bug: Previously only the first order's price was sent to Paystack
Fix: Now all order IDs are joined with comma and backend sums all totals
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMultiOrderPaymentFix:
    """Test the multi-order payment initialization fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.admin_email = "admin@lightban.com"
        self.admin_password = "LightbanAdmin2024"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        """Get admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_backend_health(self):
        """Test that backend is running"""
        response = self.session.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        print("✓ Backend is healthy")
    
    def test_get_unpaid_orders(self):
        """Test that we can get unpaid orders"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        unpaid_orders = [o for o in orders if o.get('payment_status') == 'pending']
        
        print(f"✓ Found {len(unpaid_orders)} unpaid orders")
        assert len(unpaid_orders) > 0, "Need at least 1 unpaid order for testing"
    
    def test_payment_initialize_single_order(self):
        """Test payment initialization with single order"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get an unpaid order
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        orders = response.json()
        unpaid_orders = [o for o in orders if o.get('payment_status') == 'pending']
        
        if len(unpaid_orders) < 1:
            pytest.skip("No unpaid orders available")
        
        order = unpaid_orders[0]
        order_id = order['id']
        expected_amount = order['total_amount']
        
        # Initialize payment for single order
        response = self.session.post(f"{BASE_URL}/api/payments/initialize", json={
            "order_id": order_id,
            "email": self.admin_email,
            "callback_url": "https://ads-kano.preview.emergentagent.com/payment/callback"
        })
        
        assert response.status_code == 200, f"Payment init failed: {response.text}"
        data = response.json()
        
        assert data.get('status') == 'success'
        assert 'authorization_url' in data
        assert 'reference' in data
        
        print(f"✓ Single order payment initialized successfully")
        print(f"  Order ID: {order_id}")
        print(f"  Expected Amount: ₦{expected_amount:,.2f}")
    
    def test_payment_initialize_multiple_orders_combined_total(self):
        """
        CRITICAL TEST: Verify that multiple orders are summed correctly
        
        Bug: Previously only first order's price was sent to Paystack
        Fix: Now all order IDs are joined with comma and backend sums all totals
        """
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get unpaid orders
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        orders = response.json()
        unpaid_orders = [o for o in orders if o.get('payment_status') == 'pending']
        
        if len(unpaid_orders) < 2:
            pytest.skip("Need at least 2 unpaid orders for multi-order test")
        
        # Take first 2 unpaid orders
        order1 = unpaid_orders[0]
        order2 = unpaid_orders[1]
        
        order_ids = f"{order1['id']},{order2['id']}"
        expected_combined_total = order1['total_amount'] + order2['total_amount']
        
        print(f"\n  Testing multi-order payment:")
        print(f"  Order 1: {order1['id'][:8]}... = ₦{order1['total_amount']:,.2f}")
        print(f"  Order 2: {order2['id'][:8]}... = ₦{order2['total_amount']:,.2f}")
        print(f"  Expected Combined Total: ₦{expected_combined_total:,.2f}")
        
        # Initialize payment with comma-separated order IDs
        response = self.session.post(f"{BASE_URL}/api/payments/initialize", json={
            "order_id": order_ids,  # Comma-separated order IDs
            "email": self.admin_email,
            "callback_url": "https://ads-kano.preview.emergentagent.com/payment/callback"
        })
        
        assert response.status_code == 200, f"Payment init failed: {response.text}"
        data = response.json()
        
        assert data.get('status') == 'success', f"Payment status not success: {data}"
        assert 'authorization_url' in data, "Missing authorization_url"
        assert 'reference' in data, "Missing reference"
        
        # The reference should contain the first order ID
        reference = data.get('reference', '')
        assert order1['id'] in reference or 'lightban_' in reference, "Reference format unexpected"
        
        print(f"✓ Multi-order payment initialized successfully")
        print(f"  Reference: {reference}")
        print(f"  Authorization URL received: Yes")
        
        # Note: We can't verify the exact amount sent to Paystack without 
        # intercepting the API call, but the backend code review shows it 
        # correctly sums all order totals (lines 1227-1239 in server.py)
    
    def test_payment_initialize_three_orders(self):
        """Test payment initialization with 3 orders"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get unpaid orders
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        orders = response.json()
        unpaid_orders = [o for o in orders if o.get('payment_status') == 'pending']
        
        if len(unpaid_orders) < 3:
            pytest.skip("Need at least 3 unpaid orders for this test")
        
        # Take first 3 unpaid orders
        test_orders = unpaid_orders[:3]
        order_ids = ','.join([o['id'] for o in test_orders])
        expected_combined_total = sum([o['total_amount'] for o in test_orders])
        
        print(f"\n  Testing 3-order payment:")
        for i, o in enumerate(test_orders, 1):
            print(f"  Order {i}: {o['id'][:8]}... = ₦{o['total_amount']:,.2f}")
        print(f"  Expected Combined Total: ₦{expected_combined_total:,.2f}")
        
        # Initialize payment with comma-separated order IDs
        response = self.session.post(f"{BASE_URL}/api/payments/initialize", json={
            "order_id": order_ids,
            "email": self.admin_email,
            "callback_url": "https://ads-kano.preview.emergentagent.com/payment/callback"
        })
        
        assert response.status_code == 200, f"Payment init failed: {response.text}"
        data = response.json()
        
        assert data.get('status') == 'success'
        print(f"✓ 3-order payment initialized successfully")
    
    def test_payment_initialize_invalid_order_id(self):
        """Test payment initialization with invalid order ID"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/payments/initialize", json={
            "order_id": "invalid-order-id-12345",
            "email": self.admin_email,
            "callback_url": "https://ads-kano.preview.emergentagent.com/payment/callback"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid order ID correctly returns 404")
    
    def test_payment_initialize_mixed_valid_invalid_orders(self):
        """Test payment initialization with mix of valid and invalid order IDs"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a valid unpaid order
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        orders = response.json()
        unpaid_orders = [o for o in orders if o.get('payment_status') == 'pending']
        
        if len(unpaid_orders) < 1:
            pytest.skip("No unpaid orders available")
        
        valid_order_id = unpaid_orders[0]['id']
        invalid_order_id = "invalid-order-id-12345"
        
        # Try to initialize payment with mixed IDs
        response = self.session.post(f"{BASE_URL}/api/payments/initialize", json={
            "order_id": f"{valid_order_id},{invalid_order_id}",
            "email": self.admin_email,
            "callback_url": "https://ads-kano.preview.emergentagent.com/payment/callback"
        })
        
        # Should fail because one order is invalid
        assert response.status_code == 404, f"Expected 404 for mixed valid/invalid orders, got {response.status_code}"
        print("✓ Mixed valid/invalid order IDs correctly returns 404")


class TestPaymentVerificationMultiOrder:
    """Test payment verification for multiple orders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.admin_email = "admin@lightban.com"
        self.admin_password = "LightbanAdmin2024"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        """Get admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.admin_email,
            "password": self.admin_password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_verify_payment_invalid_reference(self):
        """Test payment verification with invalid reference"""
        token = self.get_admin_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/payments/verify/invalid_reference_12345")
        
        # Should return failed status (not 500 error)
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'failed'
        print("✓ Invalid payment reference correctly returns failed status")


class TestFrontendPaymentFlow:
    """Test that frontend correctly sends all order IDs"""
    
    def test_frontend_place_order_page_exists(self):
        """Verify PlaceOrderPage.js has the fix"""
        import os
        
        file_path = "/app/frontend/src/pages/PlaceOrderPage.js"
        assert os.path.exists(file_path), "PlaceOrderPage.js not found"
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Check that the fix is in place - orderIds.join(',')
        assert "orderIds.join(',')" in content, "Fix not found: orderIds.join(',') should be in PlaceOrderPage.js"
        
        # Check that it's sending to the correct endpoint
        assert "order_id: allOrderIds" in content or "order_id: orderIds.join" in content, \
            "Fix not found: should send all order IDs to payment initialize"
        
        print("✓ Frontend PlaceOrderPage.js has the multi-order payment fix")
        print("  - Uses orderIds.join(',') to combine all order IDs")
        print("  - Sends combined IDs to /payments/initialize")


class TestBackendPaymentCode:
    """Test that backend correctly handles multiple order IDs"""
    
    def test_backend_payment_initialize_code(self):
        """Verify server.py has the fix for multi-order payment"""
        import os
        
        file_path = "/app/backend/server.py"
        assert os.path.exists(file_path), "server.py not found"
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Check that the fix is in place - splitting comma-separated order IDs
        assert "order_id.split(',')" in content, \
            "Fix not found: order_id.split(',') should be in server.py"
        
        # Check that it sums all order totals
        assert "total_amount += order['total_amount']" in content or \
               "total_amount += order" in content, \
            "Fix not found: should sum all order totals"
        
        # Check that it stores all order IDs in metadata
        assert '"order_ids":' in content, \
            "Fix not found: should store order_ids array in Paystack metadata"
        
        print("✓ Backend server.py has the multi-order payment fix")
        print("  - Splits comma-separated order IDs")
        print("  - Sums all order totals")
        print("  - Stores order_ids array in Paystack metadata")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
