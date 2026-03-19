"""
Test Image Upload Functionality
Tests: POST /api/upload/chunk, GET /api/uploads/{filename}
Features: Chunked upload, file serving, validation
"""
import pytest
import requests
import base64
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ads-kano.preview.emergentagent.com')
ADMIN_EMAIL = "admin@lightban.com"
ADMIN_PASSWORD = "LightbanAdmin2024"


class TestImageUpload:
    """Tests for image upload functionality"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_upload_chunk_without_auth(self):
        """Test that upload requires authentication"""
        # Create a small test image data
        fake_chunk = base64.b64encode(b"test image data").decode()
        
        response = requests.post(
            f"{BASE_URL}/api/upload/chunk",
            json={
                "filename": "test.png",
                "chunk": fake_chunk,
                "chunk_index": 0,
                "total_chunks": 1
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Upload without auth returns 401")
    
    def test_upload_invalid_file_type(self, admin_token):
        """Test that invalid file types are rejected"""
        fake_chunk = base64.b64encode(b"test data").decode()
        
        response = requests.post(
            f"{BASE_URL}/api/upload/chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "filename": "test.txt",
                "chunk": fake_chunk,
                "chunk_index": 0,
                "total_chunks": 1
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "not allowed" in response.json().get("detail", "").lower()
        print(f"✓ Invalid file type rejected correctly")
    
    def test_upload_single_chunk_png(self, admin_token):
        """Test uploading a small PNG file in a single chunk"""
        # Create minimal PNG image (1x1 pixel)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # width/height
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # bit depth etc
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        chunk = base64.b64encode(png_data).decode()
        
        response = requests.post(
            f"{BASE_URL}/api/upload/chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "filename": "test_upload.png",
                "chunk": chunk,
                "chunk_index": 0,
                "total_chunks": 1
            }
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert data["status"] == "complete"
        assert "url" in data
        assert data["url"].startswith("/api/uploads/")
        assert data["url"].endswith(".png")
        
        # Store the URL for subsequent tests
        self.__class__.uploaded_url = data["url"]
        self.__class__.uploaded_filename = data["filename"]
        print(f"✓ Single chunk PNG upload successful: {data['url']}")
    
    def test_serve_uploaded_file(self, admin_token):
        """Test that uploaded files can be served"""
        if not hasattr(self.__class__, 'uploaded_url'):
            pytest.skip("No uploaded file to test")
        
        # Access the uploaded file (no auth required for serving)
        response = requests.get(f"{BASE_URL}{self.__class__.uploaded_url}")
        
        assert response.status_code == 200, f"Failed to serve file: {response.status_code}"
        assert response.headers.get("content-type", "").startswith("image/")
        print(f"✓ Uploaded file served successfully")
    
    def test_serve_nonexistent_file(self):
        """Test that non-existent files return 404"""
        response = requests.get(f"{BASE_URL}/api/uploads/nonexistent_file_12345.png")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent file returns 404")
    
    def test_serve_existing_file(self):
        """Test serving an already existing uploaded file"""
        # This file was uploaded via curl earlier according to the file listing
        response = requests.get(f"{BASE_URL}/api/uploads/c0c094a2-298f-449c-a6bd-81473fc98676.png")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Existing uploaded file serves correctly")
    
    def test_upload_jpeg_extension(self, admin_token):
        """Test uploading with .jpg extension works"""
        # Simple JPEG header
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
            0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
        ])
        
        chunk = base64.b64encode(jpeg_data).decode()
        
        response = requests.post(
            f"{BASE_URL}/api/upload/chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "filename": "test_image.jpg",
                "chunk": chunk,
                "chunk_index": 0,
                "total_chunks": 1
            }
        )
        
        assert response.status_code == 200, f"JPEG upload failed: {response.text}"
        data = response.json()
        assert data["status"] == "complete"
        assert data["url"].endswith(".jpg")
        print(f"✓ JPEG upload successful: {data['url']}")
    
    def test_upload_webp_extension(self, admin_token):
        """Test uploading with .webp extension works"""
        # Minimal WebP header (RIFF + WEBP)
        webp_data = bytes([
            0x52, 0x49, 0x46, 0x46,  # RIFF
            0x1A, 0x00, 0x00, 0x00,  # size
            0x57, 0x45, 0x42, 0x50,  # WEBP
            0x56, 0x50, 0x38, 0x20,  # VP8
            0x0E, 0x00, 0x00, 0x00,
            0x30, 0x01, 0x00, 0x9D,
            0x01, 0x2A, 0x01, 0x00,
            0x01, 0x00, 0x00, 0x25,
            0xA4, 0x00
        ])
        
        chunk = base64.b64encode(webp_data).decode()
        
        response = requests.post(
            f"{BASE_URL}/api/upload/chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "filename": "test_image.webp",
                "chunk": chunk,
                "chunk_index": 0,
                "total_chunks": 1
            }
        )
        
        assert response.status_code == 200, f"WebP upload failed: {response.text}"
        data = response.json()
        assert data["status"] == "complete"
        assert data["url"].endswith(".webp")
        print(f"✓ WebP upload successful: {data['url']}")
    
    def test_upload_gif_extension(self, admin_token):
        """Test uploading with .gif extension works"""
        # Minimal GIF header
        gif_data = bytes([
            0x47, 0x49, 0x46, 0x38, 0x39, 0x61,  # GIF89a
            0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,  # 1x1, no global color table
            0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,  # image descriptor
            0x02, 0x02, 0x44, 0x01, 0x00,  # image data
            0x3B  # trailer
        ])
        
        chunk = base64.b64encode(gif_data).decode()
        
        response = requests.post(
            f"{BASE_URL}/api/upload/chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "filename": "test_image.gif",
                "chunk": chunk,
                "chunk_index": 0,
                "total_chunks": 1
            }
        )
        
        assert response.status_code == 200, f"GIF upload failed: {response.text}"
        data = response.json()
        assert data["status"] == "complete"
        assert data["url"].endswith(".gif")
        print(f"✓ GIF upload successful: {data['url']}")
    
    def test_multi_chunk_upload(self, admin_token):
        """Test uploading a file in multiple chunks"""
        # Create test data that will be split into 2 chunks
        png_data = bytes([0x89, 0x50, 0x4E, 0x47] * 100)  # PNG signature repeated
        
        # Split into 2 chunks
        mid = len(png_data) // 2
        chunk1 = base64.b64encode(png_data[:mid]).decode()
        chunk2 = base64.b64encode(png_data[mid:]).decode()
        
        # Upload first chunk
        response1 = requests.post(
            f"{BASE_URL}/api/upload/chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "filename": "multi_chunk_test.png",
                "chunk": chunk1,
                "chunk_index": 0,
                "total_chunks": 2
            }
        )
        
        assert response1.status_code == 200, f"First chunk failed: {response1.text}"
        data1 = response1.json()
        assert data1["status"] == "chunk_received"
        file_id = data1["file_id"]
        print(f"✓ First chunk received, file_id: {file_id}")
        
        # Upload second chunk
        response2 = requests.post(
            f"{BASE_URL}/api/upload/chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "filename": "multi_chunk_test.png",
                "chunk": chunk2,
                "chunk_index": 1,
                "total_chunks": 2,
                "file_id": file_id
            }
        )
        
        assert response2.status_code == 200, f"Second chunk failed: {response2.text}"
        data2 = response2.json()
        assert data2["status"] == "complete"
        assert "url" in data2
        print(f"✓ Multi-chunk upload complete: {data2['url']}")


class TestUploadedFilesInAdmin:
    """Test that uploaded file URLs work in admin context"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_influencer_with_uploaded_image(self, admin_token):
        """Test creating an influencer with an uploaded image URL"""
        # First upload an image
        png_data = bytes([0x89, 0x50, 0x4E, 0x47] * 10)
        chunk = base64.b64encode(png_data).decode()
        
        upload_response = requests.post(
            f"{BASE_URL}/api/upload/chunk",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "filename": "influencer_img.png",
                "chunk": chunk,
                "chunk_index": 0,
                "total_chunks": 1
            }
        )
        
        assert upload_response.status_code == 200
        image_url = f"{BASE_URL}{upload_response.json()['url']}"
        
        # Create influencer with the uploaded image URL
        influencer_data = {
            "name": "TEST_Upload_Influencer",
            "handle": "test_upload_handle",
            "platform": "Instagram",
            "followers": 10000,
            "niche": "Fashion",
            "bio": "Test bio",
            "location": "Lagos",
            "price_per_post": 50000,
            "image_url": image_url,
            "status": "approved"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/influencers",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=influencer_data
        )
        
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        created = create_response.json().get("influencer", {})
        assert created.get("image_url") == image_url
        print(f"✓ Influencer created with uploaded image URL")
        
        # Verify the image is accessible
        img_response = requests.get(image_url)
        assert img_response.status_code == 200, "Uploaded image not accessible"
        
        # Clean up - delete the test influencer
        if created.get("id"):
            requests.delete(
                f"{BASE_URL}/api/admin/influencers/{created['id']}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        print(f"✓ Image URL in influencer is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
