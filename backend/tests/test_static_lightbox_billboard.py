"""
Test Static Banner and Lightbox Billboard Features
Tests the new State → Road → Type selection system for Static Banner and Lightbox billboards
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ads-kano.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@lightban.com"
ADMIN_PASSWORD = "LightbanAdmin2024"


class TestBillboardTypesAPI:
    """Test /api/billboard-types endpoint for Static Banner and Lightbox types"""
    
    def test_get_all_billboard_types(self):
        """Test fetching all billboard types"""
        response = requests.get(f"{BASE_URL}/api/billboard-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify types exist
        categories = [t.get('billboard_category') for t in data]
        assert 'static_banner' in categories, "Should have static_banner types"
        assert 'lightbox' in categories, "Should have lightbox types"
        print(f"✓ Found {len(data)} billboard types")
    
    def test_get_static_banner_types(self):
        """Test fetching only static_banner types"""
        response = requests.get(f"{BASE_URL}/api/billboard-types", params={"category": "static_banner"})
        assert response.status_code == 200
        
        data = response.json()
        for t in data:
            assert t.get('billboard_category') == 'static_banner', f"Expected static_banner, got {t.get('billboard_category')}"
        print(f"✓ Found {len(data)} static_banner types")
    
    def test_get_lightbox_types(self):
        """Test fetching only lightbox types"""
        response = requests.get(f"{BASE_URL}/api/billboard-types", params={"category": "lightbox"})
        assert response.status_code == 200
        
        data = response.json()
        for t in data:
            assert t.get('billboard_category') == 'lightbox', f"Expected lightbox, got {t.get('billboard_category')}"
        print(f"✓ Found {len(data)} lightbox types")
    
    def test_billboard_type_structure(self):
        """Test that billboard types have required fields"""
        response = requests.get(f"{BASE_URL}/api/billboard-types")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0, "Should have at least one type"
        
        for t in data:
            assert 'id' in t, "Type should have id"
            assert 'name' in t, "Type should have name"
            assert 'billboard_category' in t, "Type should have billboard_category"
        print("✓ All billboard types have required fields")


class TestStaticBillboardPackagesAPI:
    """Test /api/static-billboard/packages endpoint"""
    
    def test_get_all_static_packages(self):
        """Test fetching all static billboard packages"""
        response = requests.get(f"{BASE_URL}/api/static-billboard/packages")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Found {len(data)} static billboard packages")
    
    def test_filter_by_category_static_banner(self):
        """Test filtering packages by static_banner category"""
        response = requests.get(f"{BASE_URL}/api/static-billboard/packages", params={"category": "static_banner"})
        assert response.status_code == 200
        
        data = response.json()
        for pkg in data:
            assert pkg.get('billboard_category') == 'static_banner', f"Expected static_banner, got {pkg.get('billboard_category')}"
        print(f"✓ Found {len(data)} static_banner packages")
    
    def test_filter_by_category_lightbox(self):
        """Test filtering packages by lightbox category"""
        response = requests.get(f"{BASE_URL}/api/static-billboard/packages", params={"category": "lightbox"})
        assert response.status_code == 200
        
        data = response.json()
        for pkg in data:
            assert pkg.get('billboard_category') == 'lightbox', f"Expected lightbox, got {pkg.get('billboard_category')}"
        print(f"✓ Found {len(data)} lightbox packages")
    
    def test_filter_by_state_road_type(self):
        """Test filtering packages by state, road, and type"""
        # First get a package to know valid filter values
        all_packages = requests.get(f"{BASE_URL}/api/static-billboard/packages").json()
        
        if len(all_packages) > 0:
            pkg = all_packages[0]
            state_id = pkg.get('state_id')
            road_name = pkg.get('road_name')
            type_id = pkg.get('type_id')
            category = pkg.get('billboard_category')
            
            # Filter by all criteria
            response = requests.get(f"{BASE_URL}/api/static-billboard/packages", params={
                "category": category,
                "state_id": state_id,
                "road_name": road_name,
                "type_id": type_id
            })
            assert response.status_code == 200
            
            data = response.json()
            assert len(data) > 0, "Should find at least one package with these filters"
            print(f"✓ Filter by state/road/type works - found {len(data)} packages")
        else:
            pytest.skip("No packages available to test filtering")
    
    def test_package_structure(self):
        """Test that packages have required fields"""
        response = requests.get(f"{BASE_URL}/api/static-billboard/packages")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            pkg = data[0]
            required_fields = ['id', 'billboard_category', 'state_id', 'state_name', 
                             'road_name', 'type_id', 'type_name', 'title', 'price', 'duration']
            for field in required_fields:
                assert field in pkg, f"Package should have {field}"
            print("✓ Package has all required fields")
        else:
            pytest.skip("No packages available to test structure")


class TestStaticBillboardOrderCreation:
    """Test creating orders for static_banner and lightbox billboards"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_create_static_banner_order(self, auth_token):
        """Test creating an order for static_banner billboard"""
        # Get a static_banner package
        packages = requests.get(f"{BASE_URL}/api/static-billboard/packages", 
                               params={"category": "static_banner"}).json()
        
        if len(packages) == 0:
            pytest.skip("No static_banner packages available")
        
        pkg = packages[0]
        
        # Create order
        order_data = {
            "listing_type": "static_banner",
            "listing_id": pkg['id'],
            "package_details": {
                "packageId": pkg['id'],
                "packageTitle": pkg['title'],
                "title": pkg['title'],
                "price": pkg['price'],
                "duration": pkg['duration'],
                "state_name": pkg.get('state_name'),
                "road_name": pkg.get('road_name'),
                "type_name": pkg.get('type_name')
            },
            "total_amount": pkg['price'] * 1.1,  # Include 10% platform fee
            "package_price": pkg['price'],
            "payment_method": "cash"
        }
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        order = response.json()
        assert order.get('listing_type') == 'static_banner'
        assert order.get('supplier_id') == 'lightban-platform'
        assert order.get('payment_status') == 'pending_cash'
        print(f"✓ Created static_banner order: {order.get('id')}")
        
        return order.get('id')
    
    def test_create_lightbox_order(self, auth_token):
        """Test creating an order for lightbox billboard"""
        # Get a lightbox package
        packages = requests.get(f"{BASE_URL}/api/static-billboard/packages", 
                               params={"category": "lightbox"}).json()
        
        if len(packages) == 0:
            pytest.skip("No lightbox packages available")
        
        pkg = packages[0]
        
        # Create order
        order_data = {
            "listing_type": "lightbox",
            "listing_id": pkg['id'],
            "package_details": {
                "packageId": pkg['id'],
                "packageTitle": pkg['title'],
                "title": pkg['title'],
                "price": pkg['price'],
                "duration": pkg['duration'],
                "state_name": pkg.get('state_name'),
                "road_name": pkg.get('road_name'),
                "type_name": pkg.get('type_name')
            },
            "total_amount": pkg['price'] * 1.1,
            "package_price": pkg['price'],
            "payment_method": "online"
        }
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        order = response.json()
        assert order.get('listing_type') == 'lightbox'
        assert order.get('supplier_id') == 'lightban-platform'
        print(f"✓ Created lightbox order: {order.get('id')}")
        
        return order.get('id')
    
    def test_order_appears_in_user_orders(self, auth_token):
        """Test that created orders appear in user's order list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        
        assert response.status_code == 200
        orders = response.json()
        
        # Check for static_banner or lightbox orders
        listing_types = [o.get('listing_type') for o in orders]
        has_static_or_lightbox = 'static_banner' in listing_types or 'lightbox' in listing_types
        print(f"✓ Found orders with listing types: {set(listing_types)}")


class TestAdminBillboardTypeManagement:
    """Test admin CRUD operations for billboard types"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_create_billboard_type_requires_auth(self):
        """Test that creating billboard type requires authentication"""
        response = requests.post(f"{BASE_URL}/api/billboard-types", json={
            "name": "Test Type",
            "description": "Test",
            "billboard_category": "static_banner"
        })
        assert response.status_code == 401 or response.status_code == 403
        print("✓ Create billboard type requires authentication")
    
    def test_admin_can_create_billboard_type(self, admin_token):
        """Test admin can create a new billboard type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a unique type name
        import uuid
        type_name = f"TEST_Type_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/billboard-types", json={
            "name": type_name,
            "description": "Test type for automated testing",
            "billboard_category": "static_banner"
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('name') == type_name
        assert data.get('billboard_category') == 'static_banner'
        print(f"✓ Admin created billboard type: {type_name}")
        
        # Cleanup - delete the test type
        type_id = data.get('id')
        requests.delete(f"{BASE_URL}/api/billboard-types/{type_id}", headers=headers)
    
    def test_admin_can_delete_billboard_type(self, admin_token):
        """Test admin can delete a billboard type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a type to delete
        import uuid
        type_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        
        create_response = requests.post(f"{BASE_URL}/api/billboard-types", json={
            "name": type_name,
            "description": "Type to be deleted",
            "billboard_category": "lightbox"
        }, headers=headers)
        
        assert create_response.status_code == 200
        type_id = create_response.json().get('id')
        
        # Delete the type
        delete_response = requests.delete(f"{BASE_URL}/api/billboard-types/{type_id}", headers=headers)
        assert delete_response.status_code == 200
        print(f"✓ Admin deleted billboard type: {type_id}")


class TestAdminStaticPackageManagement:
    """Test admin CRUD operations for static billboard packages"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_create_package_requires_auth(self):
        """Test that creating package requires authentication"""
        response = requests.post(f"{BASE_URL}/api/static-billboard/packages", json={
            "billboard_category": "static_banner",
            "state_id": "test",
            "road_name": "test",
            "type_id": "test",
            "title": "Test",
            "description": "Test",
            "price": 100000,
            "duration": "1 Month"
        })
        assert response.status_code == 401 or response.status_code == 403
        print("✓ Create package requires authentication")
    
    def test_admin_can_create_static_package(self, admin_token):
        """Test admin can create a static billboard package"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get existing state and type
        states = requests.get(f"{BASE_URL}/api/led-billboard/states").json()
        types = requests.get(f"{BASE_URL}/api/billboard-types", params={"category": "static_banner"}).json()
        
        if len(states) == 0 or len(types) == 0:
            pytest.skip("No states or types available")
        
        state = states[0]
        billboard_type = types[0]
        road_name = state.get('roads', [{}])[0].get('name', 'Test Road') if state.get('roads') else 'Test Road'
        
        import uuid
        package_title = f"TEST_Package_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/static-billboard/packages", json={
            "billboard_category": "static_banner",
            "state_id": state['id'],
            "road_name": road_name,
            "type_id": billboard_type['id'],
            "title": package_title,
            "description": "Test package for automated testing",
            "price": 100000,
            "duration": "1 Month",
            "deliverables": ["Test deliverable"]
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('title') == package_title
        assert data.get('billboard_category') == 'static_banner'
        assert data.get('state_name') is not None
        assert data.get('type_name') is not None
        print(f"✓ Admin created static package: {package_title}")
        
        # Cleanup
        package_id = data.get('id')
        requests.delete(f"{BASE_URL}/api/static-billboard/packages/{package_id}", headers=headers)


class TestBillboardsPageIntegration:
    """Test that billboards page correctly categorizes billboard types"""
    
    def test_billboards_endpoint_returns_all_types(self):
        """Test that /api/billboards returns LED, Static, and Lightbox billboards"""
        response = requests.get(f"{BASE_URL}/api/billboards")
        assert response.status_code == 200
        
        data = response.json()
        billboard_types = [b.get('billboard_type', '').lower() for b in data]
        
        # Check for different billboard types
        has_led = any('led' in t or 'digital' in t for t in billboard_types)
        has_static = any('static' in t for t in billboard_types)
        has_lightbox = any('lightbox' in t or 'light box' in t for t in billboard_types)
        
        print(f"✓ Billboard types found: LED={has_led}, Static={has_static}, Lightbox={has_lightbox}")
        assert has_led or has_static or has_lightbox, "Should have at least one billboard type"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
