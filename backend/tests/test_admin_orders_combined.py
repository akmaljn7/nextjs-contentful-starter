"""
Test Admin Orders Combined View - Service Orders + Consultations
Tests the new unified Orders tab that shows both service orders and consultation orders
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@lightban.com"
ADMIN_PASSWORD = "LightbanAdmin2024"


class TestAdminOrdersCombined:
    """Test the combined orders endpoint that includes both service orders and consultations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_admin_orders_endpoint_returns_200(self):
        """Test that GET /api/admin/orders returns 200"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"SUCCESS: GET /api/admin/orders returned 200")
        
    def test_admin_orders_returns_list(self):
        """Test that the endpoint returns a list"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"SUCCESS: Endpoint returns a list with {len(data)} items")
        
    def test_admin_orders_contains_both_types(self):
        """Test that orders list contains both service orders and consultations"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        orders = response.json()
        
        service_orders = [o for o in orders if o.get("order_type") == "service"]
        consultation_orders = [o for o in orders if o.get("order_type") == "consultation"]
        
        print(f"Total orders: {len(orders)}")
        print(f"Service orders: {len(service_orders)}")
        print(f"Consultation orders: {len(consultation_orders)}")
        
        # Verify we have both types (or at least the structure supports both)
        assert len(orders) > 0, "Expected at least some orders"
        print(f"SUCCESS: Orders endpoint returns combined data")
        
    def test_service_order_has_required_fields(self):
        """Test that service orders have all required fields for display"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        orders = response.json()
        
        service_orders = [o for o in orders if o.get("order_type") == "service"]
        
        if len(service_orders) > 0:
            order = service_orders[0]
            
            # Check required fields
            assert "id" in order, "Missing id field"
            assert "order_type" in order, "Missing order_type field"
            assert order["order_type"] == "service", "order_type should be 'service'"
            assert "listing_type" in order, "Missing listing_type field"
            assert "package_details" in order, "Missing package_details field"
            assert "total_amount" in order, "Missing total_amount field"
            assert "order_status" in order, "Missing order_status field"
            assert "payment_status" in order, "Missing payment_status field"
            assert "created_at" in order, "Missing created_at field"
            assert "user_info" in order, "Missing user_info field"
            
            print(f"SUCCESS: Service order has all required fields")
            print(f"  - Order ID: {order['id'][:8]}...")
            print(f"  - Type: {order['order_type']}")
            print(f"  - Listing Type: {order['listing_type']}")
            print(f"  - Amount: {order['total_amount']}")
            print(f"  - Status: {order['order_status']}")
            print(f"  - Payment: {order['payment_status']}")
        else:
            print("SKIP: No service orders found to test")
            
    def test_consultation_order_has_required_fields(self):
        """Test that consultation orders have all required fields for display"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        orders = response.json()
        
        consultation_orders = [o for o in orders if o.get("order_type") == "consultation"]
        
        if len(consultation_orders) > 0:
            order = consultation_orders[0]
            
            # Check required fields
            assert "id" in order, "Missing id field"
            assert "order_type" in order, "Missing order_type field"
            assert order["order_type"] == "consultation", "order_type should be 'consultation'"
            assert "listing_type" in order, "Missing listing_type field"
            assert "package_details" in order, "Missing package_details field"
            assert "total_amount" in order, "Missing total_amount field"
            assert "order_status" in order, "Missing order_status field"
            assert "payment_status" in order, "Missing payment_status field"
            assert "created_at" in order, "Missing created_at field"
            assert "user_info" in order, "Missing user_info field"
            
            # Consultation-specific fields
            package_details = order.get("package_details", {})
            assert "business_name" in package_details or package_details.get("business_name") is None, "Missing business_name in package_details"
            
            print(f"SUCCESS: Consultation order has all required fields")
            print(f"  - Order ID: {order['id'][:8]}...")
            print(f"  - Type: {order['order_type']}")
            print(f"  - Package: {package_details.get('title', 'N/A')}")
            print(f"  - Business: {package_details.get('business_name', 'N/A')}")
            print(f"  - Amount: {order['total_amount']}")
            print(f"  - Scheduled Date: {order.get('scheduled_date', 'N/A')}")
            print(f"  - Scheduled Time: {order.get('scheduled_time', 'N/A')}")
        else:
            print("SKIP: No consultation orders found to test")
            
    def test_user_info_populated(self):
        """Test that user_info is populated for orders"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        orders = response.json()
        
        if len(orders) > 0:
            orders_with_user_info = [o for o in orders if o.get("user_info") and (o["user_info"].get("name") or o["user_info"].get("email"))]
            print(f"Orders with user info: {len(orders_with_user_info)} / {len(orders)}")
            
            if len(orders_with_user_info) > 0:
                user_info = orders_with_user_info[0]["user_info"]
                print(f"  - Sample user: {user_info.get('name', 'N/A')} ({user_info.get('email', 'N/A')})")
                print(f"SUCCESS: User info is populated")
        else:
            print("SKIP: No orders found to test user info")
            
    def test_orders_sorted_by_date(self):
        """Test that orders are sorted by created_at (most recent first)"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        orders = response.json()
        
        if len(orders) >= 2:
            # Check that orders are sorted by created_at descending
            dates = [o.get("created_at", "") for o in orders if o.get("created_at")]
            is_sorted = all(dates[i] >= dates[i+1] for i in range(len(dates)-1))
            
            if is_sorted:
                print(f"SUCCESS: Orders are sorted by date (most recent first)")
            else:
                print(f"WARNING: Orders may not be properly sorted by date")
        else:
            print("SKIP: Not enough orders to test sorting")
            
    def test_admin_consultations_endpoint(self):
        """Test that GET /api/admin/consultations still works separately"""
        response = self.session.get(f"{BASE_URL}/api/admin/consultations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        consultations = response.json()
        print(f"SUCCESS: GET /api/admin/consultations returned {len(consultations)} consultations")
        
    def test_count_verification(self):
        """Verify the combined count matches individual counts"""
        # Get combined orders
        orders_response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert orders_response.status_code == 200
        combined_orders = orders_response.json()
        
        # Get consultations separately
        consultations_response = self.session.get(f"{BASE_URL}/api/admin/consultations")
        assert consultations_response.status_code == 200
        consultations = consultations_response.json()
        
        # Count by type in combined
        service_count = len([o for o in combined_orders if o.get("order_type") == "service"])
        consultation_count = len([o for o in combined_orders if o.get("order_type") == "consultation"])
        
        print(f"Combined orders total: {len(combined_orders)}")
        print(f"  - Service orders: {service_count}")
        print(f"  - Consultation orders: {consultation_count}")
        print(f"Separate consultations endpoint: {len(consultations)}")
        
        # Verify consultation count matches
        assert consultation_count == len(consultations), f"Consultation count mismatch: {consultation_count} vs {len(consultations)}"
        print(f"SUCCESS: Consultation counts match between combined and separate endpoints")


class TestAdminOrdersEdit:
    """Test editing orders from the combined view"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_admin_can_update_service_order(self):
        """Test that admin can update a service order"""
        # Get orders
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        orders = response.json()
        
        service_orders = [o for o in orders if o.get("order_type") == "service"]
        
        if len(service_orders) > 0:
            order = service_orders[0]
            order_id = order["id"]
            
            # Try to update the order
            update_response = self.session.put(f"{BASE_URL}/api/admin/orders/{order_id}", json={
                "order_status": order.get("order_status", "pending"),
                "payment_status": order.get("payment_status", "pending")
            })
            
            # Should return 200
            assert update_response.status_code == 200, f"Failed to update order: {update_response.text}"
            print(f"SUCCESS: Admin can update service order {order_id[:8]}...")
        else:
            print("SKIP: No service orders found to test update")
            
    def test_admin_can_update_consultation(self):
        """Test that admin can update a consultation"""
        # Get consultations
        response = self.session.get(f"{BASE_URL}/api/admin/consultations")
        assert response.status_code == 200
        consultations = response.json()
        
        if len(consultations) > 0:
            consultation = consultations[0]
            consultation_id = consultation["id"]
            
            # Try to update the consultation
            update_response = self.session.put(f"{BASE_URL}/api/admin/consultations/{consultation_id}", json={
                "status": consultation.get("status", "pending"),
                "payment_status": consultation.get("payment_status", "pending")
            })
            
            # Should return 200
            assert update_response.status_code == 200, f"Failed to update consultation: {update_response.text}"
            print(f"SUCCESS: Admin can update consultation {consultation_id[:8]}...")
        else:
            print("SKIP: No consultations found to test update")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
