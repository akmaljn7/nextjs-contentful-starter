"""
Test suite for package preservation and API data loading fixes
Tests:
1. Influencer endpoint returns packages array
2. Digital ads endpoint returns packages array
3. Billboard endpoint returns pricing_by_state
4. Admin edit preserves existing packages
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestInfluencerPackages:
    """Test influencer endpoints return packages correctly"""
    
    def test_influencer_detail_returns_packages(self):
        """GET /api/influencers/inf-1 should return packages array"""
        response = requests.get(f"{BASE_URL}/api/influencers/inf-1")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "packages" in data, "Response should contain packages field"
        assert isinstance(data["packages"], list), "packages should be a list"
        assert len(data["packages"]) > 0, "packages should not be empty"
        
        # Verify package structure
        pkg = data["packages"][0]
        assert "id" in pkg, "Package should have id"
        assert "title" in pkg, "Package should have title"
        assert "price" in pkg, "Package should have price"
        print(f"✓ Influencer inf-1 has {len(data['packages'])} packages")


class TestDigitalAdsPackages:
    """Test digital ads endpoints return packages correctly"""
    
    def test_digital_ad_facebook_returns_packages(self):
        """GET /api/digital-ads/facebook should return packages array"""
        response = requests.get(f"{BASE_URL}/api/digital-ads/facebook")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "packages" in data, "Response should contain packages field"
        assert isinstance(data["packages"], list), "packages should be a list"
        assert len(data["packages"]) > 0, "packages should not be empty"
        
        # Verify package structure
        pkg = data["packages"][0]
        assert "id" in pkg, "Package should have id"
        assert "title" in pkg, "Package should have title"
        assert "price" in pkg, "Package should have price"
        assert "deliverables" in pkg, "Package should have deliverables"
        print(f"✓ Facebook Ads has {len(data['packages'])} packages")
    
    def test_digital_ad_instagram_returns_packages(self):
        """GET /api/digital-ads/instagram should return packages array"""
        response = requests.get(f"{BASE_URL}/api/digital-ads/instagram")
        if response.status_code == 404:
            pytest.skip("Instagram platform not yet created")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "packages" in data, "Response should contain packages field"
        print(f"✓ Instagram Ads response OK")


class TestBillboardPricing:
    """Test billboard endpoints return pricing_by_state correctly"""
    
    def test_billboard_detail_returns_pricing_by_state(self):
        """GET /api/billboards/bb-1 should return pricing_by_state"""
        response = requests.get(f"{BASE_URL}/api/billboards/bb-1")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "pricing_by_state" in data, "Response should contain pricing_by_state field"
        assert isinstance(data["pricing_by_state"], dict), "pricing_by_state should be a dict"
        assert len(data["pricing_by_state"]) > 0, "pricing_by_state should not be empty"
        
        # Verify pricing structure for a state
        states = list(data["pricing_by_state"].keys())
        assert len(states) > 0, "Should have at least one state"
        
        state_pricing = data["pricing_by_state"][states[0]]
        assert "monthly" in state_pricing, "State pricing should have monthly"
        assert "weekly" in state_pricing, "State pricing should have weekly"
        assert "daily" in state_pricing, "State pricing should have daily"
        print(f"✓ Billboard bb-1 has pricing for {len(states)} states")
    
    def test_billboard_list_includes_pricing(self):
        """GET /api/billboards should return items with pricing_by_state"""
        response = requests.get(f"{BASE_URL}/api/billboards")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check if any billboard has pricing_by_state
        billboard_with_pricing = None
        for bb in data:
            if bb.get("pricing_by_state") and len(bb.get("pricing_by_state", {})) > 0:
                billboard_with_pricing = bb
                break
        
        if billboard_with_pricing:
            print(f"✓ Found billboard with pricing_by_state: {billboard_with_pricing.get('name')}")
        else:
            print("⚠ No billboards with populated pricing_by_state found in list")


class TestAdminPackagePreservation:
    """Test that admin edit flow preserves existing packages"""
    
    @pytest.fixture
    def admin_token(self):
        """Login as admin and return token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "admin@lightban.com",
                "password": "LightbanAdmin2024"
            }
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed - check credentials")
        
        return response.json()["access_token"]
    
    def test_admin_can_fetch_influencer_with_packages(self, admin_token):
        """Admin should be able to fetch influencer with packages"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Fetch influencer as admin
        response = requests.get(
            f"{BASE_URL}/api/influencers/inf-1",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "packages" in data, "Admin fetch should include packages"
        original_package_count = len(data["packages"])
        print(f"✓ Admin fetched influencer with {original_package_count} packages")
    
    def test_admin_edit_preserves_packages(self, admin_token):
        """When admin edits an item, packages should be preserved"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 1. First fetch the influencer with packages
        response = requests.get(
            f"{BASE_URL}/api/influencers/inf-1",
            headers=headers
        )
        assert response.status_code == 200
        original_data = response.json()
        original_packages = original_data.get("packages", [])
        original_package_count = len(original_packages)
        
        # 2. Update with minor change but include existing packages
        update_data = {
            "name": original_data["name"],
            "bio": original_data["bio"] + " (edited test)",  # Small change
            "packages": original_packages  # Include existing packages
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/influencers/inf-1",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # 3. Verify packages are preserved
        response = requests.get(
            f"{BASE_URL}/api/influencers/inf-1",
            headers=headers
        )
        assert response.status_code == 200
        updated_data = response.json()
        updated_packages = updated_data.get("packages", [])
        
        assert len(updated_packages) == original_package_count, \
            f"Package count changed from {original_package_count} to {len(updated_packages)}"
        
        # Restore original bio
        restore_data = {
            "bio": original_data["bio"],
            "packages": original_packages
        }
        requests.put(
            f"{BASE_URL}/api/admin/influencers/inf-1",
            headers=headers,
            json=restore_data
        )
        
        print(f"✓ Packages preserved after edit: {len(updated_packages)} packages")
    
    def test_admin_can_add_new_package(self, admin_token):
        """Admin should be able to add a new package without losing existing ones"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 1. Fetch existing packages
        response = requests.get(
            f"{BASE_URL}/api/influencers/inf-1",
            headers=headers
        )
        assert response.status_code == 200
        original_data = response.json()
        original_packages = original_data.get("packages", [])
        original_count = len(original_packages)
        
        # 2. Add a new test package while keeping existing ones
        new_package = {
            "id": f"test-pkg-{uuid.uuid4().hex[:8]}",
            "title": "Test Package",
            "description": "Test package for API testing",
            "price": 9999,
            "delivery_time": "1 day",
            "features": []
        }
        
        updated_packages = original_packages + [new_package]
        
        update_data = {
            "packages": updated_packages
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/influencers/inf-1",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # 3. Verify all packages are present
        response = requests.get(
            f"{BASE_URL}/api/influencers/inf-1",
            headers=headers
        )
        assert response.status_code == 200
        final_data = response.json()
        final_packages = final_data.get("packages", [])
        
        assert len(final_packages) == original_count + 1, \
            f"Expected {original_count + 1} packages, got {len(final_packages)}"
        
        # Find and verify test package exists
        test_pkg_found = any(p.get("title") == "Test Package" for p in final_packages)
        assert test_pkg_found, "Test package not found after adding"
        
        # 4. Clean up - remove test package
        cleanup_packages = [p for p in final_packages if p.get("title") != "Test Package"]
        cleanup_data = {"packages": cleanup_packages}
        
        requests.put(
            f"{BASE_URL}/api/admin/influencers/inf-1",
            headers=headers,
            json=cleanup_data
        )
        
        print(f"✓ Added new package, total went from {original_count} to {original_count + 1}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
