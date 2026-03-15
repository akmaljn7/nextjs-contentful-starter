"""
Billboard API Tests for Lightban Ads Network
Tests LED Billboard detail page functionality and booking flow
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBillboardEndpoints:
    """Billboard API endpoint tests"""

    def test_get_billboards_list(self):
        """Test getting list of all billboards"""
        response = requests.get(f"{BASE_URL}/api/billboards")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Should have at least 1 billboard"
        
        # Check data structure
        billboard = data[0]
        assert "id" in billboard
        assert "location_name" in billboard
        assert "billboard_type" in billboard
        assert "price_monthly" in billboard
        print(f"Found {len(data)} billboards")

    def test_get_billboard_bb1_detail(self):
        """Test getting LED Billboard detail (bb-1)"""
        response = requests.get(f"{BASE_URL}/api/billboards/bb-1")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == "bb-1"
        assert data["billboard_type"] == "Digital LED"
        assert data["location_name"] == "LED Billboard"
        assert data["status"] == "approved"
        assert data["verified"] == True
        assert "image_url" in data
        print(f"Billboard bb-1: {data['location_name']} - {data['billboard_type']}")

    def test_get_billboard_not_found(self):
        """Test getting non-existent billboard returns 404"""
        response = requests.get(f"{BASE_URL}/api/billboards/nonexistent-billboard")
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        print("404 for non-existent billboard - correct behavior")

    def test_all_billboard_categories(self):
        """Test all 3 billboard categories exist"""
        response = requests.get(f"{BASE_URL}/api/billboards")
        assert response.status_code == 200
        
        data = response.json()
        billboard_types = [bb["billboard_type"] for bb in data]
        
        # Expected types based on the API data
        expected_types = {"Digital LED", "Static", "Lightbox Static"}
        actual_types = set(billboard_types)
        
        assert expected_types == actual_types, f"Expected {expected_types}, got {actual_types}"
        print(f"All 3 billboard types present: {actual_types}")


class TestOrderFlow:
    """Order creation flow tests"""
    
    @pytest.fixture
    def test_user_token(self):
        """Register/login test user and return token"""
        unique_email = f"test_billboard_{uuid.uuid4().hex[:8]}@test.com"
        
        # Try to register
        register_data = {
            "name": "Billboard Test User",
            "email": unique_email,
            "password": "TestPass123!",
            "phone": "08012345678",
            "role": "advertiser"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        
        if response.status_code == 200:
            data = response.json()
            return data["access_token"]
        
        pytest.skip("Could not create test user for order flow")
        return None

    def test_create_order_for_billboard(self, test_user_token):
        """Test creating an order for billboard package"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        order_data = {
            "listing_type": "billboard",
            "listing_id": "bb-1",
            "package_details": {
                "packageId": "bb-1-monthly",
                "packageTitle": "Monthly Package",
                "deliverables": ["Digital LED display for entire month", "Up to 200 plays per day"],
                "turnaround": "30 Days"
            },
            "total_amount": 1866666
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["listing_type"] == "billboard"
        assert data["listing_id"] == "bb-1"
        assert data["total_amount"] == 1866666
        assert data["payment_status"] == "pending"
        print(f"Order created successfully: {data['id']}")
        
        return data["id"]

    def test_mock_payment_flow(self, test_user_token):
        """Test mock payment for billboard order"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # First create an order
        order_data = {
            "listing_type": "billboard",
            "listing_id": "bb-1",
            "package_details": {
                "packageId": "bb-1-weekly",
                "packageTitle": "Weekly Package",
                "deliverables": ["Digital LED display for 7 days"],
                "turnaround": "7 Days"
            },
            "total_amount": 489333
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert create_response.status_code == 200
        
        order_id = create_response.json()["id"]
        
        # Process mock payment
        payment_response = requests.post(
            f"{BASE_URL}/api/payments/mock-payment",
            params={"order_id": order_id},
            headers=headers
        )
        assert payment_response.status_code == 200
        
        data = payment_response.json()
        assert data["status"] == "success"
        assert data["payment_status"] == "paid"
        print(f"Mock payment successful for order: {order_id}")

    def test_get_user_orders(self, test_user_token):
        """Test getting user orders"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"User has {len(data)} orders")


class TestAuthRequired:
    """Test authentication requirements"""
    
    def test_orders_require_auth(self):
        """Test that orders endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/orders")
        assert response.status_code in [401, 403], "Orders should require auth"
        print("Orders endpoint properly requires authentication")

    def test_create_order_requires_auth(self):
        """Test that creating order requires authentication"""
        order_data = {
            "listing_type": "billboard",
            "listing_id": "bb-1",
            "package_details": {},
            "total_amount": 1000
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code in [401, 403], "Order creation should require auth"
        print("Order creation properly requires authentication")
