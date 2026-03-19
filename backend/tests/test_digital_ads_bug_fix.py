"""
Test Digital Ads Bug Fix:
1. P0: Digital Ads created via admin should appear on public /digital-ads page
2. P2: Unauthenticated API requests should return 401 instead of 403
3. Admin CRUD operations for Digital Ads
4. Navigation to digital ad detail page
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials for testing
ADMIN_EMAIL = "admin@lightban.com"
ADMIN_PASSWORD = "LightbanAdmin2024"

class TestAuthStatusCodes:
    """P2 Bug Fix: Unauthenticated requests should return 401, not 403"""
    
    def test_unauthenticated_request_returns_401(self):
        """Protected endpoint without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✅ Unauthenticated request returns 401: {data['detail']}")
    
    def test_invalid_token_returns_401(self):
        """Protected endpoint with invalid token should return 401"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": "Bearer invalid_token_xyz"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid token returns 401")
    
    def test_valid_auth_returns_200(self):
        """Valid authentication should allow access"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Login failed"
        token = login_response.json()["access_token"]
        
        # Access protected endpoint
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✅ Valid token returns 200 for admin endpoint")


class TestPublicDigitalAdsEndpoint:
    """P0 Bug Fix: Admin-created Digital Ads should appear on public page"""
    
    def test_public_digital_ads_returns_data(self):
        """GET /api/digital-ads should return data without authentication"""
        response = requests.get(f"{BASE_URL}/api/digital-ads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one digital ad platform"
        print(f"✅ Public endpoint returns {len(data)} platforms")
        return data
    
    def test_youtube_platform_exists(self):
        """YouTube platform (admin-created) should be in the list"""
        response = requests.get(f"{BASE_URL}/api/digital-ads")
        assert response.status_code == 200
        data = response.json()
        
        # Find YouTube platform
        youtube = [p for p in data if p.get('platform', '').lower() == 'youtube' or p.get('id', '').lower() == 'youtube']
        assert len(youtube) > 0, "YouTube platform not found - admin-created ads not showing on public page!"
        
        yt = youtube[0]
        print(f"✅ YouTube platform found: id={yt.get('id')}, name={yt.get('name')}")
        assert yt.get('id') == 'youtube', "YouTube platform id mismatch"
    
    def test_digital_ads_have_required_fields(self):
        """All digital ads should have required fields"""
        response = requests.get(f"{BASE_URL}/api/digital-ads")
        assert response.status_code == 200
        data = response.json()
        
        for platform in data:
            assert 'id' in platform, f"Missing 'id' in platform: {platform}"
            assert 'platform' in platform or 'name' in platform, f"Missing platform/name: {platform}"
        
        print(f"✅ All {len(data)} platforms have required fields")
    
    def test_public_digital_ads_count(self):
        """Should return the expected number of platforms (7 according to context)"""
        response = requests.get(f"{BASE_URL}/api/digital-ads")
        assert response.status_code == 200
        data = response.json()
        
        # Context says there are 7 platforms including youtube
        assert len(data) >= 7, f"Expected at least 7 platforms, got {len(data)}"
        print(f"✅ Found {len(data)} digital ad platforms (expected 7)")


class TestDigitalAdDetailEndpoint:
    """Test navigation to digital ad detail page"""
    
    def test_get_digital_ad_by_id(self):
        """GET /api/digital-ads/{platform_id} should return platform details"""
        # Get list of platforms first
        list_response = requests.get(f"{BASE_URL}/api/digital-ads")
        assert list_response.status_code == 200
        platforms = list_response.json()
        assert len(platforms) > 0, "No platforms to test"
        
        # Test fetching each platform by ID
        for platform in platforms[:3]:  # Test first 3
            platform_id = platform.get('id')
            detail_response = requests.get(f"{BASE_URL}/api/digital-ads/{platform_id}")
            assert detail_response.status_code == 200, f"Failed to fetch platform {platform_id}"
            detail = detail_response.json()
            assert detail.get('id') == platform_id, f"ID mismatch for {platform_id}"
            print(f"✅ Detail endpoint works for platform: {platform_id}")
    
    def test_youtube_detail_page(self):
        """YouTube platform detail should be accessible"""
        response = requests.get(f"{BASE_URL}/api/digital-ads/youtube")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get('id') == 'youtube', "YouTube platform ID mismatch"
        assert 'packages' in data, "YouTube should have packages"
        print(f"✅ YouTube detail page accessible, has {len(data.get('packages', []))} packages")


class TestAdminDigitalAdsCRUD:
    """Admin CRUD operations for Digital Ads"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_get_all_digital_ads(self, admin_token):
        """Admin should be able to get all digital ads"""
        response = requests.get(
            f"{BASE_URL}/api/admin/digital-ads",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Admin can view {len(data)} digital ads")
    
    def test_admin_create_digital_ad(self, admin_token):
        """Admin should be able to create a new digital ad"""
        test_ad = {
            "platform": "test_platform",
            "name": "Test Platform Ads",
            "description": "Test platform for automated testing",
            "status": "approved",
            "packages": [
                {"title": "Starter", "price": 50000, "description": "Basic package"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/digital-ads",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_ad
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('status') == 'success', f"Creation failed: {data}"
        
        created_id = data.get('digital_ad', {}).get('id')
        print(f"✅ Created digital ad with id: {created_id}")
        return created_id
    
    def test_admin_update_digital_ad(self, admin_token):
        """Admin should be able to update a digital ad"""
        # First create one
        test_ad = {
            "platform": "update_test",
            "name": "Update Test Platform",
            "description": "Original description",
            "status": "approved"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/digital-ads",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_ad
        )
        assert create_response.status_code == 200
        created_id = create_response.json().get('digital_ad', {}).get('id')
        
        # Update it
        update_data = {"description": "Updated description", "name": "Updated Name"}
        update_response = requests.put(
            f"{BASE_URL}/api/admin/digital-ads/{created_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/digital-ads/{created_id}")
        assert get_response.status_code == 200
        updated = get_response.json()
        assert updated.get('description') == "Updated description", "Description not updated"
        print(f"✅ Updated digital ad: {created_id}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/digital-ads/{created_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_admin_delete_digital_ad(self, admin_token):
        """Admin should be able to delete a digital ad"""
        # Create one to delete
        test_ad = {
            "platform": "delete_test",
            "name": "Delete Test Platform",
            "description": "To be deleted",
            "status": "approved"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/digital-ads",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_ad
        )
        assert create_response.status_code == 200
        created_id = create_response.json().get('digital_ad', {}).get('id')
        
        # Delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/digital-ads/{created_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/digital-ads/{created_id}")
        assert get_response.status_code == 404, "Platform should not exist after deletion"
        print(f"✅ Deleted digital ad: {created_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
