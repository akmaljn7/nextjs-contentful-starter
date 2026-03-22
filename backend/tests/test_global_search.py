"""
Test Global Search API functionality
Tests search across all service categories (Influencers, Billboards, Digital Ads, Kannywood, LED Billboards, Static Billboards)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ads-kano.preview.emergentagent.com').rstrip('/')


class TestGlobalSearchAPI:
    """Test the /api/search endpoint"""
    
    def test_search_basic_query(self):
        """Test basic search with query parameter"""
        response = requests.get(f"{BASE_URL}/api/search", params={"q": "kano"})
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "results" in data
        assert "total" in data
        assert "filters" in data
        assert isinstance(data["results"], list)
        assert data["total"] >= 0
        print(f"✓ Basic search returned {data['total']} results for 'kano'")
    
    def test_search_result_structure(self):
        """Test that search results have correct structure"""
        response = requests.get(f"{BASE_URL}/api/search", params={"q": "kano"})
        assert response.status_code == 200
        data = response.json()
        
        if data["results"]:
            result = data["results"][0]
            # Verify required fields in result
            required_fields = ["id", "type", "category", "title", "price", "url"]
            for field in required_fields:
                assert field in result, f"Missing field: {field}"
            print(f"✓ Search result structure is correct with fields: {list(result.keys())}")
    
    def test_search_category_filter_influencer(self):
        """Test filtering by influencer category"""
        response = requests.get(f"{BASE_URL}/api/search", params={"category": "influencer"})
        assert response.status_code == 200
        data = response.json()
        
        # All results should be influencers
        for result in data["results"]:
            assert result["type"] == "influencer", f"Expected influencer, got {result['type']}"
        print(f"✓ Category filter 'influencer' returned {len(data['results'])} influencers")
    
    def test_search_category_filter_billboard(self):
        """Test filtering by billboard category"""
        response = requests.get(f"{BASE_URL}/api/search", params={"category": "billboard"})
        assert response.status_code == 200
        data = response.json()
        
        for result in data["results"]:
            assert result["type"] == "billboard", f"Expected billboard, got {result['type']}"
        print(f"✓ Category filter 'billboard' returned {len(data['results'])} billboards")
    
    def test_search_category_filter_led_billboard(self):
        """Test filtering by LED billboard category"""
        response = requests.get(f"{BASE_URL}/api/search", params={"category": "led_billboard"})
        assert response.status_code == 200
        data = response.json()
        
        for result in data["results"]:
            assert result["type"] == "led_billboard", f"Expected led_billboard, got {result['type']}"
        print(f"✓ Category filter 'led_billboard' returned {len(data['results'])} LED billboards")
    
    def test_search_category_filter_static_billboard(self):
        """Test filtering by static billboard category"""
        response = requests.get(f"{BASE_URL}/api/search", params={"category": "static_billboard"})
        assert response.status_code == 200
        data = response.json()
        
        for result in data["results"]:
            assert result["type"] in ["static_banner", "lightbox", "static_billboard"], f"Unexpected type: {result['type']}"
        print(f"✓ Category filter 'static_billboard' returned {len(data['results'])} static billboards")
    
    def test_search_category_filter_digital_ad(self):
        """Test filtering by digital ad category"""
        response = requests.get(f"{BASE_URL}/api/search", params={"category": "digital_ad"})
        assert response.status_code == 200
        data = response.json()
        
        for result in data["results"]:
            assert result["type"] == "digital_ad", f"Expected digital_ad, got {result['type']}"
        print(f"✓ Category filter 'digital_ad' returned {len(data['results'])} digital ads")
    
    def test_search_category_filter_kannywood(self):
        """Test filtering by kannywood category"""
        response = requests.get(f"{BASE_URL}/api/search", params={"category": "kannywood"})
        assert response.status_code == 200
        data = response.json()
        
        for result in data["results"]:
            assert result["type"] == "kannywood", f"Expected kannywood, got {result['type']}"
        print(f"✓ Category filter 'kannywood' returned {len(data['results'])} kannywood placements")
    
    def test_search_city_filter(self):
        """Test filtering by city"""
        response = requests.get(f"{BASE_URL}/api/search", params={"city": "Kano"})
        assert response.status_code == 200
        data = response.json()
        
        # Results should have Kano in location
        for result in data["results"]:
            location = (result.get("location") or "").lower()
            # Some results may be online services
            if location and location != "online":
                assert "kano" in location.lower() or result["type"] == "digital_ad", f"Location mismatch: {location}"
        print(f"✓ City filter 'Kano' returned {len(data['results'])} results")
    
    def test_search_price_range_filter(self):
        """Test filtering by price range"""
        min_price = 50000
        max_price = 100000
        response = requests.get(f"{BASE_URL}/api/search", params={
            "min_price": min_price,
            "max_price": max_price
        })
        assert response.status_code == 200
        data = response.json()
        
        # Results should be within price range (excluding digital ads which may have 0 price)
        for result in data["results"]:
            price = result.get("price", 0)
            if result["type"] != "digital_ad" and price > 0:
                assert price >= min_price, f"Price {price} below min {min_price}"
                assert price <= max_price, f"Price {price} above max {max_price}"
        print(f"✓ Price range filter returned {len(data['results'])} results between ₦{min_price} and ₦{max_price}")
    
    def test_search_combined_filters(self):
        """Test combining multiple filters"""
        response = requests.get(f"{BASE_URL}/api/search", params={
            "q": "kano",
            "category": "influencer",
            "min_price": 50000,
            "max_price": 150000
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify filters are returned in response
        assert data["filters"]["query"] == "kano"
        assert data["filters"]["category"] == "influencer"
        assert data["filters"]["min_price"] == 50000
        assert data["filters"]["max_price"] == 150000
        print(f"✓ Combined filters returned {len(data['results'])} results")
    
    def test_search_empty_results(self):
        """Test search with no matching results"""
        response = requests.get(f"{BASE_URL}/api/search", params={"q": "xyznonexistent123"})
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 0
        assert len(data["results"]) == 0
        print("✓ Empty search returns 0 results correctly")
    
    def test_search_no_params(self):
        """Test search with no parameters (browse all)"""
        response = requests.get(f"{BASE_URL}/api/search")
        assert response.status_code == 200
        data = response.json()
        
        # Should return all approved listings
        assert data["total"] >= 0
        print(f"✓ Browse all returned {data['total']} results")


class TestSearchSuggestionsAPI:
    """Test the /api/search/suggestions endpoint"""
    
    def test_suggestions_basic(self):
        """Test basic suggestions"""
        response = requests.get(f"{BASE_URL}/api/search/suggestions", params={"q": "kan"})
        assert response.status_code == 200
        data = response.json()
        
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        print(f"✓ Suggestions for 'kan': {data['suggestions']}")
    
    def test_suggestions_short_query(self):
        """Test suggestions with short query (< 2 chars)"""
        response = requests.get(f"{BASE_URL}/api/search/suggestions", params={"q": "k"})
        assert response.status_code == 200
        data = response.json()
        
        # Should return empty for short queries
        assert data["suggestions"] == []
        print("✓ Short query returns empty suggestions")
    
    def test_suggestions_limit(self):
        """Test suggestions limit parameter"""
        response = requests.get(f"{BASE_URL}/api/search/suggestions", params={"q": "ka", "limit": 3})
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["suggestions"]) <= 3
        print(f"✓ Suggestions limit works: {len(data['suggestions'])} suggestions")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
