"""
Test LED Billboard Order Flow
Tests the complete flow: Add to cart -> Place Order -> Order creation with listing_type='led_billboard'
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ads-kano.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "admin@lightban.com"
TEST_USER_PASSWORD = "LightbanAdmin2024"


class TestLEDBillboardOrderFlow:
    """Test LED Billboard order creation flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.user = login_response.json().get("user")
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_get_led_states(self):
        """Test GET /api/led-billboard/states returns states with roads"""
        response = self.session.get(f"{BASE_URL}/api/led-billboard/states")
        assert response.status_code == 200
        
        states = response.json()
        assert isinstance(states, list)
        assert len(states) > 0
        
        # Verify state structure
        state = states[0]
        assert "id" in state
        assert "name" in state
        assert "roads" in state
        print(f"✓ Found {len(states)} states")
    
    def test_get_led_sizes(self):
        """Test GET /api/led-billboard/sizes returns sizes"""
        response = self.session.get(f"{BASE_URL}/api/led-billboard/sizes")
        assert response.status_code == 200
        
        sizes = response.json()
        assert isinstance(sizes, list)
        assert len(sizes) > 0
        
        # Verify size structure
        size = sizes[0]
        assert "id" in size
        assert "name" in size
        print(f"✓ Found {len(sizes)} sizes")
    
    def test_get_led_packages_with_filters(self):
        """Test GET /api/led-billboard/packages with state/road/size filters"""
        # First get a valid state and size
        states_response = self.session.get(f"{BASE_URL}/api/led-billboard/states")
        sizes_response = self.session.get(f"{BASE_URL}/api/led-billboard/sizes")
        
        states = states_response.json()
        sizes = sizes_response.json()
        
        # Find Kano state
        kano_state = next((s for s in states if "kano" in s["name"].lower()), None)
        if not kano_state:
            pytest.skip("Kano state not found")
        
        # Get packages for Kano state
        response = self.session.get(f"{BASE_URL}/api/led-billboard/packages", params={
            "state_id": kano_state["id"]
        })
        assert response.status_code == 200
        
        packages = response.json()
        print(f"✓ Found {len(packages)} packages for Kano state")
    
    def test_create_led_billboard_order(self):
        """Test creating an order with listing_type='led_billboard' - CRITICAL TEST"""
        # Get a valid LED package
        packages_response = self.session.get(f"{BASE_URL}/api/led-billboard/packages")
        packages = packages_response.json()
        
        if not packages:
            pytest.skip("No LED packages available")
        
        # Use the first available package
        package = packages[0]
        
        # Create order with led_billboard listing type
        order_data = {
            "listing_type": "led_billboard",
            "listing_id": package["id"],
            "package_details": {
                "packageId": package["id"],
                "packageTitle": package["title"],
                "deliverables": package.get("deliverables", []),
                "turnaround": package.get("duration", "1 Month"),
                "price": package["price"],
                "location": f"{package.get('state_name', '')}, {package.get('road_name', '')}",
                "size": package.get("size_name", ""),
                "state_name": package.get("state_name", ""),
                "road_name": package.get("road_name", ""),
                "size_name": package.get("size_name", "")
            },
            "total_amount": package["price"] * 1.1,  # Price + 10% platform fee
            "package_price": package["price"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        
        # CRITICAL: This should return 200, not 400 or 404
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        order = response.json()
        
        # Verify order structure
        assert "id" in order
        assert order["listing_type"] == "led_billboard"
        assert order["listing_id"] == package["id"]
        assert order["supplier_id"] == "lightban-platform"  # Platform-managed
        assert "platform_fee" in order
        assert "supplier_payout" in order
        
        print(f"✓ LED Billboard order created successfully: {order['id']}")
        print(f"  - Listing Type: {order['listing_type']}")
        print(f"  - Supplier ID: {order['supplier_id']}")
        print(f"  - Total Amount: {order['total_amount']}")
        print(f"  - Platform Fee: {order['platform_fee']}")
        
        # Store order ID for cleanup
        self.created_order_id = order["id"]
        
        return order
    
    def test_verify_order_persisted(self):
        """Test that created LED billboard order can be retrieved"""
        # First create an order
        order = self.test_create_led_billboard_order()
        
        # Verify it can be retrieved
        response = self.session.get(f"{BASE_URL}/api/orders/{order['id']}")
        assert response.status_code == 200
        
        retrieved_order = response.json()
        assert retrieved_order["id"] == order["id"]
        assert retrieved_order["listing_type"] == "led_billboard"
        
        print(f"✓ Order persisted and retrieved successfully")
    
    def test_order_appears_in_user_orders(self):
        """Test that LED billboard order appears in user's order list"""
        # First create an order
        order = self.test_create_led_billboard_order()
        
        # Get user's orders
        response = self.session.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200
        
        orders = response.json()
        order_ids = [o["id"] for o in orders]
        
        assert order["id"] in order_ids, "Created order not found in user's orders"
        print(f"✓ Order appears in user's order list")


class TestLEDBillboardOrderEdgeCases:
    """Test edge cases for LED billboard orders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_led_billboard_order_without_package_price(self):
        """Test order creation when package_price is not provided (should calculate from total)"""
        packages_response = self.session.get(f"{BASE_URL}/api/led-billboard/packages")
        packages = packages_response.json()
        
        if not packages:
            pytest.skip("No LED packages available")
        
        package = packages[0]
        
        # Create order WITHOUT package_price field
        order_data = {
            "listing_type": "led_billboard",
            "listing_id": package["id"],
            "package_details": {
                "packageId": package["id"],
                "packageTitle": package["title"],
                "price": package["price"]
            },
            "total_amount": package["price"] * 1.1
            # Note: package_price is NOT included
        }
        
        response = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        order = response.json()
        assert order["listing_type"] == "led_billboard"
        print(f"✓ Order created without explicit package_price")
    
    def test_led_billboard_order_with_cash_payment(self):
        """Test LED billboard order with cash payment method"""
        packages_response = self.session.get(f"{BASE_URL}/api/led-billboard/packages")
        packages = packages_response.json()
        
        if not packages:
            pytest.skip("No LED packages available")
        
        package = packages[0]
        
        order_data = {
            "listing_type": "led_billboard",
            "listing_id": package["id"],
            "package_details": {
                "packageId": package["id"],
                "packageTitle": package["title"],
                "price": package["price"]
            },
            "total_amount": package["price"] * 1.1,
            "package_price": package["price"],
            "payment_method": "cash"
        }
        
        response = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        order = response.json()
        assert order["payment_method"] == "cash"
        assert order["payment_status"] == "pending_cash"
        print(f"✓ Cash payment LED billboard order created")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
