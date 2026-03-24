"""
Test suite for Independent Billboard Types feature
Tests CRUD operations for independent billboard types and their packages
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ads-kano.preview.emergentagent.com').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@lightban.com"
ADMIN_PASSWORD = "LightbanAdmin2024"


class TestIndependentBillboardTypes:
    """Test independent billboard types CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.auth_token = None
        self.created_type_id = None
        self.created_package_id = None
        
    def get_auth_token(self):
        """Get admin authentication token"""
        if self.auth_token:
            return self.auth_token
            
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            self.auth_token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
            return self.auth_token
        return None
    
    # ============= GET TESTS =============
    
    def test_get_all_billboard_types(self):
        """Test GET /api/billboard-types returns all types"""
        response = self.session.get(f"{BASE_URL}/api/billboard-types")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET /api/billboard-types returned {len(data)} types")
    
    def test_get_independent_types_only(self):
        """Test GET /api/billboard-types?independent_only=true returns only independent types"""
        response = self.session.get(f"{BASE_URL}/api/billboard-types?independent_only=true")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify all returned types are independent
        for item in data:
            assert item.get("is_independent") == True, f"Type {item.get('name')} should be independent"
        
        print(f"PASS: GET /api/billboard-types?independent_only=true returned {len(data)} independent types")
        
        # Check if LED CAR exists (created during development)
        led_car = next((t for t in data if t.get("name") == "LED CAR"), None)
        if led_car:
            print(f"  - Found existing 'LED CAR' type with id: {led_car.get('id')}")
            assert led_car.get("traffic_daily") == 75000, "LED CAR should have traffic_daily=75000"
            assert led_car.get("price_starting") == 150000.0, "LED CAR should have price_starting=150000"
    
    def test_get_category_specific_types(self):
        """Test GET /api/billboard-types?category=static_banner returns only static_banner types"""
        response = self.session.get(f"{BASE_URL}/api/billboard-types?category=static_banner")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify all returned types are static_banner category
        for item in data:
            assert item.get("billboard_category") == "static_banner", f"Type {item.get('name')} should be static_banner"
            assert item.get("is_independent") != True, f"Type {item.get('name')} should not be independent"
        
        print(f"PASS: GET /api/billboard-types?category=static_banner returned {len(data)} static_banner types")
    
    # ============= CREATE TESTS =============
    
    def test_create_independent_type_requires_auth(self):
        """Test POST /api/billboard-types requires authentication"""
        # Clear auth header
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/billboard-types", json={
            "name": "Test Type",
            "is_independent": True
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: POST /api/billboard-types requires authentication")
    
    def test_create_independent_type(self):
        """Test POST /api/billboard-types with is_independent=true creates independent type"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        unique_name = f"TEST_Mobile_Billboard_{uuid.uuid4().hex[:6]}"
        
        response = self.session.post(f"{BASE_URL}/api/billboard-types", json={
            "name": unique_name,
            "description": "Test mobile billboard advertising",
            "is_independent": True,
            "traffic_daily": 50000,
            "price_starting": 100000
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("name") == unique_name, "Name should match"
        assert data.get("is_independent") == True, "Should be independent"
        assert data.get("traffic_daily") == 50000, "Traffic should match"
        assert data.get("price_starting") == 100000, "Price should match"
        assert data.get("billboard_category") is None, "Category should be None for independent types"
        assert "id" in data, "Should have an id"
        
        self.created_type_id = data.get("id")
        print(f"PASS: Created independent type '{unique_name}' with id: {self.created_type_id}")
        
        # Cleanup
        if self.created_type_id:
            self.session.delete(f"{BASE_URL}/api/billboard-types/{self.created_type_id}")
    
    def test_create_independent_type_duplicate_name(self):
        """Test POST /api/billboard-types rejects duplicate independent type names"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        # Try to create another LED CAR (should fail)
        response = self.session.post(f"{BASE_URL}/api/billboard-types", json={
            "name": "LED CAR",
            "description": "Duplicate test",
            "is_independent": True
        })
        
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        print("PASS: Duplicate independent type name rejected")
    
    # ============= UPDATE TESTS =============
    
    def test_update_independent_type(self):
        """Test PUT /api/billboard-types/{id} updates independent type"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        # First create a type to update
        unique_name = f"TEST_Update_Type_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/billboard-types", json={
            "name": unique_name,
            "description": "Original description",
            "is_independent": True,
            "traffic_daily": 10000,
            "price_starting": 50000
        })
        
        assert create_response.status_code == 200, f"Failed to create type: {create_response.text}"
        created_id = create_response.json().get("id")
        
        # Update the type
        updated_name = f"TEST_Updated_Type_{uuid.uuid4().hex[:6]}"
        update_response = self.session.put(f"{BASE_URL}/api/billboard-types/{created_id}", json={
            "name": updated_name,
            "description": "Updated description",
            "is_independent": True,
            "traffic_daily": 20000,
            "price_starting": 75000
        })
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/billboard-types?independent_only=true")
        types = get_response.json()
        updated_type = next((t for t in types if t.get("id") == created_id), None)
        
        assert updated_type is not None, "Updated type should exist"
        assert updated_type.get("name") == updated_name, "Name should be updated"
        assert updated_type.get("description") == "Updated description", "Description should be updated"
        assert updated_type.get("traffic_daily") == 20000, "Traffic should be updated"
        assert updated_type.get("price_starting") == 75000, "Price should be updated"
        
        print(f"PASS: Updated independent type '{created_id}'")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/billboard-types/{created_id}")
    
    # ============= DELETE TESTS =============
    
    def test_delete_independent_type(self):
        """Test DELETE /api/billboard-types/{id} deletes independent type"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        # First create a type to delete
        unique_name = f"TEST_Delete_Type_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/billboard-types", json={
            "name": unique_name,
            "description": "To be deleted",
            "is_independent": True
        })
        
        assert create_response.status_code == 200, f"Failed to create type: {create_response.text}"
        created_id = create_response.json().get("id")
        
        # Delete the type
        delete_response = self.session.delete(f"{BASE_URL}/api/billboard-types/{created_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/billboard-types?independent_only=true")
        types = get_response.json()
        deleted_type = next((t for t in types if t.get("id") == created_id), None)
        
        assert deleted_type is None, "Deleted type should not exist"
        print(f"PASS: Deleted independent type '{created_id}'")


class TestIndependentBillboardPackages:
    """Test packages for independent billboard types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.auth_token = None
        
    def get_auth_token(self):
        """Get admin authentication token"""
        if self.auth_token:
            return self.auth_token
            
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            self.auth_token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
            return self.auth_token
        return None
    
    def get_led_car_type_id(self):
        """Get the LED CAR independent type ID"""
        response = self.session.get(f"{BASE_URL}/api/billboard-types?independent_only=true")
        if response.status_code == 200:
            types = response.json()
            led_car = next((t for t in types if t.get("name") == "LED CAR"), None)
            if led_car:
                return led_car.get("id")
        return None
    
    def get_state_and_road(self):
        """Get a valid state ID and road name for testing"""
        response = self.session.get(f"{BASE_URL}/api/led-billboard/states")
        if response.status_code == 200:
            states = response.json()
            if states and len(states) > 0:
                state = states[0]
                roads = state.get("roads", [])
                if roads and len(roads) > 0:
                    return state.get("id"), roads[0].get("name")
        return None, None
    
    def test_get_packages_for_independent_type(self):
        """Test GET /api/static-billboard/packages?billboard_type_id=xxx returns packages for independent type"""
        led_car_id = self.get_led_car_type_id()
        
        if not led_car_id:
            pytest.skip("LED CAR type not found")
        
        response = self.session.get(f"{BASE_URL}/api/static-billboard/packages?billboard_type_id={led_car_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify all packages belong to the independent type
        for pkg in data:
            assert pkg.get("billboard_type_id") == led_car_id, f"Package should belong to LED CAR type"
        
        print(f"PASS: GET /api/static-billboard/packages?billboard_type_id={led_car_id} returned {len(data)} packages")
    
    def test_create_package_for_independent_type(self):
        """Test POST /api/static-billboard/packages creates package for independent type"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        led_car_id = self.get_led_car_type_id()
        if not led_car_id:
            pytest.skip("LED CAR type not found")
        
        state_id, road_name = self.get_state_and_road()
        if not state_id or not road_name:
            pytest.skip("No states/roads configured")
        
        unique_title = f"TEST_LED_CAR_Package_{uuid.uuid4().hex[:6]}"
        
        response = self.session.post(f"{BASE_URL}/api/static-billboard/packages", json={
            "billboard_type_id": led_car_id,
            "state_id": state_id,
            "road_name": road_name,
            "title": unique_title,
            "description": "Test package for LED CAR",
            "price": 200000,
            "duration": "1 Month",
            "deliverables": ["Full city coverage", "GPS tracking", "24/7 operation"]
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("title") == unique_title, "Title should match"
        assert data.get("billboard_type_id") == led_car_id, "billboard_type_id should match"
        assert data.get("billboard_type_name") == "LED CAR", "billboard_type_name should be LED CAR"
        assert data.get("price") == 200000, "Price should match"
        assert "id" in data, "Should have an id"
        
        created_id = data.get("id")
        print(f"PASS: Created package '{unique_title}' for LED CAR with id: {created_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/static-billboard/packages/{created_id}")
    
    def test_create_package_invalid_independent_type(self):
        """Test POST /api/static-billboard/packages rejects invalid billboard_type_id"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        state_id, road_name = self.get_state_and_road()
        if not state_id or not road_name:
            pytest.skip("No states/roads configured")
        
        response = self.session.post(f"{BASE_URL}/api/static-billboard/packages", json={
            "billboard_type_id": "invalid-uuid-12345",
            "state_id": state_id,
            "road_name": road_name,
            "title": "Invalid Package",
            "description": "Should fail",
            "price": 100000,
            "duration": "1 Month"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Invalid billboard_type_id rejected")
    
    def test_get_packages_with_state_road_filter(self):
        """Test GET /api/static-billboard/packages with state and road filters for independent type"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        led_car_id = self.get_led_car_type_id()
        if not led_car_id:
            pytest.skip("LED CAR type not found")
        
        state_id, road_name = self.get_state_and_road()
        if not state_id or not road_name:
            pytest.skip("No states/roads configured")
        
        # First create a package
        unique_title = f"TEST_Filter_Package_{uuid.uuid4().hex[:6]}"
        create_response = self.session.post(f"{BASE_URL}/api/static-billboard/packages", json={
            "billboard_type_id": led_car_id,
            "state_id": state_id,
            "road_name": road_name,
            "title": unique_title,
            "description": "Test filter package",
            "price": 150000,
            "duration": "1 Week"
        })
        
        assert create_response.status_code == 200, f"Failed to create package: {create_response.text}"
        created_id = create_response.json().get("id")
        
        # Query with filters
        response = self.session.get(f"{BASE_URL}/api/static-billboard/packages", params={
            "billboard_type_id": led_car_id,
            "state_id": state_id,
            "road_name": road_name
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify the created package is in results
        found = any(pkg.get("id") == created_id for pkg in data)
        assert found, "Created package should be in filtered results"
        
        print(f"PASS: Filtered packages query returned {len(data)} packages")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/static-billboard/packages/{created_id}")


class TestBillboardsPageIntegration:
    """Test the public Billboards page integration with independent types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_billboards_endpoint_returns_data(self):
        """Test GET /api/billboards returns billboard data"""
        response = self.session.get(f"{BASE_URL}/api/billboards")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET /api/billboards returned {len(data)} billboards")
    
    def test_independent_types_available_for_public_page(self):
        """Test that independent types are available for the public Billboards page"""
        response = self.session.get(f"{BASE_URL}/api/billboard-types?independent_only=true")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify LED CAR exists and has required fields for display
        led_car = next((t for t in data if t.get("name") == "LED CAR"), None)
        assert led_car is not None, "LED CAR should exist"
        
        # Check required fields for public display
        assert "id" in led_car, "Should have id"
        assert "name" in led_car, "Should have name"
        assert "description" in led_car, "Should have description"
        assert "traffic_daily" in led_car, "Should have traffic_daily"
        assert "price_starting" in led_car, "Should have price_starting"
        assert led_car.get("is_independent") == True, "Should be independent"
        
        print(f"PASS: LED CAR independent type has all required fields for public display")
        print(f"  - Name: {led_car.get('name')}")
        print(f"  - Description: {led_car.get('description')}")
        print(f"  - Traffic: {led_car.get('traffic_daily')}")
        print(f"  - Starting Price: {led_car.get('price_starting')}")
    
    def test_states_and_roads_available(self):
        """Test that states and roads are available for package selection"""
        response = self.session.get(f"{BASE_URL}/api/led-billboard/states")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one state"
        
        # Check first state has roads
        first_state = data[0]
        assert "id" in first_state, "State should have id"
        assert "name" in first_state, "State should have name"
        assert "roads" in first_state, "State should have roads"
        
        print(f"PASS: States and roads available - {len(data)} states found")
        for state in data[:3]:  # Show first 3
            roads = state.get("roads", [])
            print(f"  - {state.get('name')}: {len(roads)} roads")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
