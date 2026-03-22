"""
Test LED Billboard Configuration System
Tests for: States, Roads, Sizes, and Packages CRUD operations
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ads-kano.preview.emergentagent.com').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@lightban.com"
ADMIN_PASSWORD = "LightbanAdmin2024"


class TestLEDBillboardAPIs:
    """Test LED Billboard Configuration APIs"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    
    # ============= States API Tests =============
    
    def test_get_states_empty_or_list(self):
        """Test GET /led-billboard/states returns list (empty or with data)"""
        response = requests.get(f"{BASE_URL}/api/led-billboard/states")
        assert response.status_code == 200, f"Failed to get states: {response.text}"
        data = response.json()
        assert isinstance(data, list), "States response should be a list"
        print(f"GET /led-billboard/states: {len(data)} states found")
    
    def test_create_state_requires_auth(self):
        """Test POST /led-billboard/states requires authentication"""
        response = requests.post(f"{BASE_URL}/api/led-billboard/states", json={
            "name": "Test State",
            "roads": []
        })
        assert response.status_code == 401, "Should require authentication"
        print("POST /led-billboard/states correctly requires auth")
    
    def test_create_state_success(self, auth_headers):
        """Test creating a new state with roads"""
        unique_name = f"TEST_Kano_State_{uuid.uuid4().hex[:6]}"
        state_data = {
            "name": unique_name,
            "roads": [
                {"name": "Zoo Road", "description": "Major commercial road"},
                {"name": "Murtala Mohammed Way", "description": "Central business district"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/led-billboard/states",
            headers=auth_headers,
            json=state_data
        )
        assert response.status_code == 200, f"Failed to create state: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain state ID"
        assert data["name"] == unique_name, "State name mismatch"
        assert len(data["roads"]) == 2, "Should have 2 roads"
        
        # Store for cleanup
        self.__class__.created_state_id = data["id"]
        self.__class__.created_state_name = unique_name
        print(f"Created state: {data['id']} - {unique_name}")
        return data
    
    def test_update_state(self, auth_headers):
        """Test updating a state"""
        if not hasattr(self.__class__, 'created_state_id'):
            pytest.skip("No state created to update")
        
        state_id = self.__class__.created_state_id
        updated_data = {
            "name": self.__class__.created_state_name,
            "roads": [
                {"name": "Zoo Road", "description": "Updated description"},
                {"name": "Murtala Mohammed Way", "description": "CBD"},
                {"name": "Kofar Mata Road", "description": "New road added"}
            ]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/led-billboard/states/{state_id}",
            headers=auth_headers,
            json=updated_data
        )
        assert response.status_code == 200, f"Failed to update state: {response.text}"
        print(f"Updated state {state_id} with 3 roads")
    
    # ============= Sizes API Tests =============
    
    def test_get_sizes_empty_or_list(self):
        """Test GET /led-billboard/sizes returns list"""
        response = requests.get(f"{BASE_URL}/api/led-billboard/sizes")
        assert response.status_code == 200, f"Failed to get sizes: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Sizes response should be a list"
        print(f"GET /led-billboard/sizes: {len(data)} sizes found")
    
    def test_create_size_requires_auth(self):
        """Test POST /led-billboard/sizes requires authentication"""
        response = requests.post(f"{BASE_URL}/api/led-billboard/sizes", json={
            "name": "40ft x 12ft",
            "description": "Large billboard"
        })
        assert response.status_code == 401, "Should require authentication"
        print("POST /led-billboard/sizes correctly requires auth")
    
    def test_create_size_success(self, auth_headers):
        """Test creating a new LED size"""
        unique_name = f"TEST_40ft_x_12ft_{uuid.uuid4().hex[:6]}"
        size_data = {
            "name": unique_name,
            "description": "Large highway billboard"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/led-billboard/sizes",
            headers=auth_headers,
            json=size_data
        )
        assert response.status_code == 200, f"Failed to create size: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain size ID"
        assert data["name"] == unique_name, "Size name mismatch"
        
        # Store for cleanup
        self.__class__.created_size_id = data["id"]
        self.__class__.created_size_name = unique_name
        print(f"Created size: {data['id']} - {unique_name}")
        return data
    
    def test_update_size(self, auth_headers):
        """Test updating a size"""
        if not hasattr(self.__class__, 'created_size_id'):
            pytest.skip("No size created to update")
        
        size_id = self.__class__.created_size_id
        updated_data = {
            "name": self.__class__.created_size_name,
            "description": "Updated: Large highway billboard for maximum visibility"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/led-billboard/sizes/{size_id}",
            headers=auth_headers,
            json=updated_data
        )
        assert response.status_code == 200, f"Failed to update size: {response.text}"
        print(f"Updated size {size_id}")
    
    # ============= Packages API Tests =============
    
    def test_get_packages_empty_or_list(self):
        """Test GET /led-billboard/packages returns list"""
        response = requests.get(f"{BASE_URL}/api/led-billboard/packages")
        assert response.status_code == 200, f"Failed to get packages: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Packages response should be a list"
        print(f"GET /led-billboard/packages: {len(data)} packages found")
    
    def test_create_package_requires_auth(self):
        """Test POST /led-billboard/packages requires authentication"""
        response = requests.post(f"{BASE_URL}/api/led-billboard/packages", json={
            "state_id": "test",
            "road_name": "Test Road",
            "size_id": "test",
            "title": "Test Package",
            "description": "Test",
            "price": 100000,
            "duration": "1 Month"
        })
        assert response.status_code == 401, "Should require authentication"
        print("POST /led-billboard/packages correctly requires auth")
    
    def test_create_package_success(self, auth_headers):
        """Test creating a new LED package"""
        if not hasattr(self.__class__, 'created_state_id') or not hasattr(self.__class__, 'created_size_id'):
            pytest.skip("No state or size created for package")
        
        package_data = {
            "state_id": self.__class__.created_state_id,
            "road_name": "Zoo Road",
            "size_id": self.__class__.created_size_id,
            "title": f"TEST_Premium_Package_{uuid.uuid4().hex[:6]}",
            "description": "Premium LED billboard package with 24/7 display",
            "price": 500000,
            "duration": "1 Month",
            "deliverables": ["24/7 Display", "Design Support", "Monthly Report"],
            "image_url": "https://example.com/billboard.jpg"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/led-billboard/packages",
            headers=auth_headers,
            json=package_data
        )
        assert response.status_code == 200, f"Failed to create package: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain package ID"
        assert data["title"] == package_data["title"], "Package title mismatch"
        assert data["price"] == 500000, "Package price mismatch"
        assert data["state_name"] is not None, "State name should be populated"
        assert data["size_name"] is not None, "Size name should be populated"
        
        # Store for cleanup
        self.__class__.created_package_id = data["id"]
        print(f"Created package: {data['id']} - {data['title']}")
        return data
    
    def test_get_packages_with_filters(self, auth_headers):
        """Test GET /led-billboard/packages with filters"""
        if not hasattr(self.__class__, 'created_state_id'):
            pytest.skip("No state created for filter test")
        
        # Filter by state_id
        response = requests.get(
            f"{BASE_URL}/api/led-billboard/packages",
            params={"state_id": self.__class__.created_state_id}
        )
        assert response.status_code == 200, f"Failed to filter packages: {response.text}"
        data = response.json()
        print(f"Filtered packages by state: {len(data)} found")
        
        # Filter by road_name
        response = requests.get(
            f"{BASE_URL}/api/led-billboard/packages",
            params={"road_name": "Zoo Road"}
        )
        assert response.status_code == 200
        print(f"Filtered packages by road: {len(response.json())} found")
    
    def test_update_package(self, auth_headers):
        """Test updating a package"""
        if not hasattr(self.__class__, 'created_package_id'):
            pytest.skip("No package created to update")
        
        package_id = self.__class__.created_package_id
        updated_data = {
            "state_id": self.__class__.created_state_id,
            "road_name": "Zoo Road",
            "size_id": self.__class__.created_size_id,
            "title": f"TEST_Updated_Package_{uuid.uuid4().hex[:6]}",
            "description": "Updated premium package",
            "price": 600000,
            "duration": "1 Month",
            "deliverables": ["24/7 Display", "Design Support", "Monthly Report", "Priority Support"],
            "image_url": "https://example.com/billboard-updated.jpg"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/led-billboard/packages/{package_id}",
            headers=auth_headers,
            json=updated_data
        )
        assert response.status_code == 200, f"Failed to update package: {response.text}"
        print(f"Updated package {package_id}")
    
    # ============= Cleanup Tests (Delete) =============
    
    def test_delete_package(self, auth_headers):
        """Test deleting a package"""
        if not hasattr(self.__class__, 'created_package_id'):
            pytest.skip("No package created to delete")
        
        package_id = self.__class__.created_package_id
        response = requests.delete(
            f"{BASE_URL}/api/led-billboard/packages/{package_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to delete package: {response.text}"
        print(f"Deleted package {package_id}")
    
    def test_delete_size(self, auth_headers):
        """Test deleting a size"""
        if not hasattr(self.__class__, 'created_size_id'):
            pytest.skip("No size created to delete")
        
        size_id = self.__class__.created_size_id
        response = requests.delete(
            f"{BASE_URL}/api/led-billboard/sizes/{size_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to delete size: {response.text}"
        print(f"Deleted size {size_id}")
    
    def test_delete_state(self, auth_headers):
        """Test deleting a state"""
        if not hasattr(self.__class__, 'created_state_id'):
            pytest.skip("No state created to delete")
        
        state_id = self.__class__.created_state_id
        response = requests.delete(
            f"{BASE_URL}/api/led-billboard/states/{state_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to delete state: {response.text}"
        print(f"Deleted state {state_id}")


class TestLEDBillboardValidation:
    """Test validation and error handling for LED Billboard APIs"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    
    def test_create_package_invalid_state_id(self, auth_headers):
        """Test creating package with invalid state_id"""
        package_data = {
            "state_id": "invalid-state-id",
            "road_name": "Test Road",
            "size_id": "invalid-size-id",
            "title": "Test Package",
            "description": "Test",
            "price": 100000,
            "duration": "1 Month"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/led-billboard/packages",
            headers=auth_headers,
            json=package_data
        )
        # Should return 400 for invalid state_id
        assert response.status_code == 400, f"Expected 400 for invalid state_id, got {response.status_code}"
        print("Package creation correctly rejects invalid state_id")
    
    def test_delete_nonexistent_state(self, auth_headers):
        """Test deleting a non-existent state"""
        response = requests.delete(
            f"{BASE_URL}/api/led-billboard/states/nonexistent-id",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Delete correctly returns 404 for non-existent state")
    
    def test_delete_nonexistent_size(self, auth_headers):
        """Test deleting a non-existent size"""
        response = requests.delete(
            f"{BASE_URL}/api/led-billboard/sizes/nonexistent-id",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Delete correctly returns 404 for non-existent size")
    
    def test_delete_nonexistent_package(self, auth_headers):
        """Test deleting a non-existent package"""
        response = requests.delete(
            f"{BASE_URL}/api/led-billboard/packages/nonexistent-id",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Delete correctly returns 404 for non-existent package")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
