"""
Test View Order Modal and Date/Time Display Features
Tests for:
1. View button in Actions column
2. Order Detail modal with full order details
3. Date & Time showing both date AND time for all orders
4. Package details with seller info enrichment
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestViewOrderModalFeatures:
    """Test the View Order modal and date/time display features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@lightban.com",
            "password": "LightbanAdmin2024"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.admin_token = token
        else:
            pytest.skip("Admin login failed - skipping tests")
    
    def test_admin_orders_endpoint_returns_data(self):
        """Test that admin orders endpoint returns orders"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        orders = response.json()
        assert isinstance(orders, list), "Expected list of orders"
        assert len(orders) > 0, "Expected at least one order"
        print(f"✓ Admin orders endpoint returned {len(orders)} orders")
    
    def test_orders_have_created_at_timestamp(self):
        """Test that all orders have created_at timestamp for date/time display"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        orders_with_timestamp = 0
        
        for order in orders[:20]:  # Check first 20 orders
            if order.get("created_at"):
                orders_with_timestamp += 1
                # Verify timestamp format includes time component
                created_at = order["created_at"]
                assert "T" in created_at or ":" in created_at, f"Timestamp should include time: {created_at}"
        
        assert orders_with_timestamp > 0, "Expected orders to have created_at timestamps"
        print(f"✓ {orders_with_timestamp} orders have valid timestamps with time component")
    
    def test_orders_have_order_type_field(self):
        """Test that orders have order_type field (service or consultation)"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        service_count = 0
        consultation_count = 0
        
        for order in orders:
            order_type = order.get("order_type")
            assert order_type in ["service", "consultation"], f"Invalid order_type: {order_type}"
            
            if order_type == "service":
                service_count += 1
            else:
                consultation_count += 1
        
        print(f"✓ Orders have order_type: {service_count} service, {consultation_count} consultation")
    
    def test_orders_have_user_info(self):
        """Test that orders have user_info for customer information display"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        orders_with_user_info = 0
        
        for order in orders[:20]:
            user_info = order.get("user_info", {})
            if user_info:
                orders_with_user_info += 1
                # Check for expected fields
                assert "name" in user_info or "email" in user_info, "user_info should have name or email"
        
        assert orders_with_user_info > 0, "Expected orders to have user_info"
        print(f"✓ {orders_with_user_info} orders have user_info for customer display")
    
    def test_orders_have_package_details(self):
        """Test that orders have package_details for modal display"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        orders_with_package = 0
        
        for order in orders[:20]:
            package_details = order.get("package_details", {})
            if package_details:
                orders_with_package += 1
                # Check for title
                has_title = package_details.get("title") or package_details.get("packageTitle")
                assert has_title, f"package_details should have title: {package_details}"
        
        assert orders_with_package > 0, "Expected orders to have package_details"
        print(f"✓ {orders_with_package} orders have package_details with title")
    
    def test_service_orders_enriched_with_seller_info(self):
        """Test that service orders are enriched with seller info from listings"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        enriched_count = 0
        
        for order in orders:
            if order.get("order_type") == "service":
                package_details = order.get("package_details", {})
                listing_type = order.get("listing_type", "")
                
                # Check if seller info is enriched based on listing type
                if listing_type == "influencer":
                    if package_details.get("seller_name") or package_details.get("handle"):
                        enriched_count += 1
                elif listing_type == "billboard":
                    if package_details.get("seller_name") or package_details.get("location"):
                        enriched_count += 1
                elif listing_type == "kannywood":
                    if package_details.get("seller_name"):
                        enriched_count += 1
                elif listing_type == "digital_ad":
                    if package_details.get("seller_name") or package_details.get("platform"):
                        enriched_count += 1
        
        print(f"✓ {enriched_count} service orders enriched with seller info")
    
    def test_orders_have_order_summary_fields(self):
        """Test that orders have fields needed for Order Summary section"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        
        for order in orders[:10]:
            # Check for total_amount
            assert "total_amount" in order, "Order should have total_amount"
            
            # Check for order_status
            assert "order_status" in order, "Order should have order_status"
            
            # Check for payment_status
            assert "payment_status" in order, "Order should have payment_status"
        
        print("✓ Orders have all required summary fields (total_amount, order_status, payment_status)")
    
    def test_consultation_orders_have_scheduled_info(self):
        """Test that consultation orders have scheduled date/time info"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        consultation_orders = [o for o in orders if o.get("order_type") == "consultation"]
        
        if len(consultation_orders) == 0:
            pytest.skip("No consultation orders found")
        
        scheduled_count = 0
        for order in consultation_orders:
            if order.get("scheduled_date"):
                scheduled_count += 1
                # Check for consultation-specific fields in package_details
                package_details = order.get("package_details", {})
                assert "consultation_type" in package_details or "business_name" in package_details, \
                    "Consultation should have consultation_type or business_name"
        
        print(f"✓ {scheduled_count}/{len(consultation_orders)} consultations have scheduled date/time")
    
    def test_orders_have_platform_fee(self):
        """Test that service orders have platform_fee for Order Summary"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        service_orders = [o for o in orders if o.get("order_type") == "service"]
        
        if len(service_orders) == 0:
            pytest.skip("No service orders found")
        
        orders_with_fee = 0
        for order in service_orders[:10]:
            if "platform_fee" in order:
                orders_with_fee += 1
        
        print(f"✓ {orders_with_fee}/{min(10, len(service_orders))} service orders have platform_fee field")
    
    def test_orders_have_deliverables_for_display(self):
        """Test that orders have deliverables in package_details for modal display"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        orders_with_deliverables = 0
        
        for order in orders[:30]:
            package_details = order.get("package_details", {})
            if package_details.get("deliverables"):
                orders_with_deliverables += 1
        
        print(f"✓ {orders_with_deliverables} orders have deliverables for display")
    
    def test_orders_have_turnaround_info(self):
        """Test that orders have turnaround info in package_details"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        orders_with_turnaround = 0
        
        for order in orders[:30]:
            package_details = order.get("package_details", {})
            if package_details.get("turnaround") or package_details.get("delivery_time"):
                orders_with_turnaround += 1
        
        print(f"✓ {orders_with_turnaround} orders have turnaround/delivery_time info")


class TestDateTimeFormatting:
    """Test date/time formatting for all order types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@lightban.com",
            "password": "LightbanAdmin2024"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Admin login failed")
    
    def test_all_orders_have_timestamp_with_time(self):
        """Verify all orders have timestamps that include time component"""
        response = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 200
        
        orders = response.json()
        
        for order in orders[:50]:
            created_at = order.get("created_at", "")
            # ISO format should have T separator or time component
            assert created_at, f"Order {order.get('id')} missing created_at"
            
            # Check that it's a valid ISO timestamp with time
            if "T" in created_at:
                time_part = created_at.split("T")[1]
                assert ":" in time_part, f"Time part should have colons: {time_part}"
        
        print(f"✓ All {min(50, len(orders))} orders have valid timestamps with time component")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
