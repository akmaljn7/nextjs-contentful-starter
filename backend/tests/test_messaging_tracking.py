"""
Test suite for Messaging Center and Order Tracking APIs
Tests: GET /api/conversations, PUT /api/messages/{id}/read, GET /api/orders/{id}/tracking, POST /api/messages
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMessagingAndTracking:
    """Tests for Messaging Center and Order Tracking endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and get auth token"""
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@lightban.com",
            "password": "LightbanAdmin2024"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        self.token = data["access_token"]
        self.user = data["user"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Get an order ID for testing
        orders_response = requests.get(f"{BASE_URL}/api/orders", headers=self.headers)
        if orders_response.status_code == 200 and len(orders_response.json()) > 0:
            self.test_order_id = orders_response.json()[0]["id"]
        else:
            self.test_order_id = None
    
    # ============= Conversations API Tests =============
    
    def test_get_conversations_success(self):
        """Test GET /api/conversations returns list of conversations"""
        response = requests.get(f"{BASE_URL}/api/conversations", headers=self.headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are conversations, verify structure
        if len(data) > 0:
            conv = data[0]
            assert "id" in conv, "Conversation should have id"
            assert "type" in conv, "Conversation should have type"
            assert "title" in conv, "Conversation should have title"
            assert "subtitle" in conv, "Conversation should have subtitle"
            assert "status" in conv, "Conversation should have status"
            assert "unread_count" in conv, "Conversation should have unread_count"
            assert conv["type"] in ["order", "consultation"], f"Type should be order or consultation, got {conv['type']}"
            print(f"Found {len(data)} conversations")
    
    def test_get_conversations_unauthorized(self):
        """Test GET /api/conversations without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/conversations")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_conversations_sorted_by_recent(self):
        """Test conversations are sorted by most recent first"""
        response = requests.get(f"{BASE_URL}/api/conversations", headers=self.headers)
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) >= 2:
            # Check that conversations are sorted by last_message_time or created_at
            for i in range(len(data) - 1):
                time1 = data[i].get("last_message_time") or data[i].get("created_at") or ""
                time2 = data[i+1].get("last_message_time") or data[i+1].get("created_at") or ""
                assert time1 >= time2, "Conversations should be sorted by most recent first"
            print("Conversations are properly sorted by recency")
    
    # ============= Mark Messages Read API Tests =============
    
    def test_mark_messages_read_success(self):
        """Test PUT /api/messages/{order_id}/read marks messages as read"""
        if not self.test_order_id:
            pytest.skip("No orders available for testing")
        
        response = requests.put(
            f"{BASE_URL}/api/messages/{self.test_order_id}/read",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Expected success status, got {data}"
        print(f"Successfully marked messages as read for order {self.test_order_id}")
    
    def test_mark_messages_read_unauthorized(self):
        """Test PUT /api/messages/{id}/read without auth returns 401"""
        response = requests.put(f"{BASE_URL}/api/messages/test-id/read")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    # ============= Order Tracking API Tests =============
    
    def test_get_order_tracking_success(self):
        """Test GET /api/orders/{id}/tracking returns tracking info with timeline"""
        if not self.test_order_id:
            pytest.skip("No orders available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/orders/{self.test_order_id}/tracking",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "order" in data, "Response should have order"
        assert "listing_info" in data, "Response should have listing_info"
        assert "timeline" in data, "Response should have timeline"
        assert "type" in data, "Response should have type"
        
        # Verify order data
        order = data["order"]
        assert "id" in order, "Order should have id"
        assert order["id"] == self.test_order_id, "Order ID should match"
        
        # Verify timeline structure
        timeline = data["timeline"]
        assert isinstance(timeline, list), "Timeline should be a list"
        assert len(timeline) > 0, "Timeline should have at least one item"
        
        # Verify timeline item structure
        for item in timeline:
            assert "status" in item, "Timeline item should have status"
            assert "title" in item, "Timeline item should have title"
            assert "description" in item, "Timeline item should have description"
            assert "completed" in item, "Timeline item should have completed flag"
        
        print(f"Order tracking retrieved successfully with {len(timeline)} timeline items")
    
    def test_get_order_tracking_not_found(self):
        """Test GET /api/orders/{id}/tracking with invalid ID returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/orders/invalid-order-id-12345/tracking",
            headers=self.headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_get_order_tracking_unauthorized(self):
        """Test GET /api/orders/{id}/tracking without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/orders/test-id/tracking")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_order_tracking_timeline_has_placed_status(self):
        """Test that order tracking timeline always has 'Order Placed' status"""
        if not self.test_order_id:
            pytest.skip("No orders available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/orders/{self.test_order_id}/tracking",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        timeline = data["timeline"]
        placed_items = [item for item in timeline if item["status"] == "placed"]
        
        assert len(placed_items) > 0, "Timeline should have 'placed' status"
        assert placed_items[0]["completed"] == True, "Order Placed should be completed"
        print("Order tracking timeline has 'Order Placed' status")
    
    # ============= Send Message API Tests =============
    
    def test_send_message_success(self):
        """Test POST /api/messages sends a message successfully"""
        if not self.test_order_id:
            pytest.skip("No orders available for testing")
        
        test_message = "Test message from automated testing"
        
        response = requests.post(
            f"{BASE_URL}/api/messages",
            headers=self.headers,
            json={
                "order_id": self.test_order_id,
                "message": test_message
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have message id"
        assert data["message"] == test_message, "Message content should match"
        assert data["order_id"] == self.test_order_id, "Order ID should match"
        assert data["sender_id"] == self.user["id"], "Sender ID should match current user"
        print(f"Message sent successfully with ID: {data['id']}")
    
    def test_send_message_unauthorized(self):
        """Test POST /api/messages without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/messages",
            json={"order_id": "test", "message": "test"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_get_messages_for_order(self):
        """Test GET /api/messages/{order_id} returns messages for an order"""
        if not self.test_order_id:
            pytest.skip("No orders available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/messages/{self.test_order_id}",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are messages, verify structure
        if len(data) > 0:
            msg = data[0]
            assert "id" in msg, "Message should have id"
            assert "order_id" in msg, "Message should have order_id"
            assert "sender_id" in msg, "Message should have sender_id"
            assert "message" in msg, "Message should have message content"
            assert "created_at" in msg, "Message should have created_at"
        
        print(f"Found {len(data)} messages for order {self.test_order_id}")


class TestConsultationTracking:
    """Tests for consultation tracking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@lightban.com",
            "password": "LightbanAdmin2024"
        })
        assert login_response.status_code == 200
        
        data = login_response.json()
        self.token = data["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Get a consultation ID for testing
        consultations_response = requests.get(f"{BASE_URL}/api/consultations", headers=self.headers)
        if consultations_response.status_code == 200 and len(consultations_response.json()) > 0:
            self.test_consultation_id = consultations_response.json()[0]["id"]
        else:
            self.test_consultation_id = None
    
    def test_get_consultation_tracking(self):
        """Test GET /api/orders/{consultation_id}/tracking works for consultations"""
        if not self.test_consultation_id:
            pytest.skip("No consultations available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/orders/{self.test_consultation_id}/tracking",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["type"] == "consultation", f"Type should be consultation, got {data['type']}"
        assert "timeline" in data, "Response should have timeline"
        
        # Verify consultation timeline has expected statuses
        timeline = data["timeline"]
        statuses = [item["status"] for item in timeline]
        assert "submitted" in statuses, "Consultation timeline should have 'submitted' status"
        
        print(f"Consultation tracking retrieved successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
