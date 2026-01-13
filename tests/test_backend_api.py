"""
Backend API Tests for DA Vehicle Gate Pass System
Tests authentication, vehicles, visitors, scanning, and database management endpoints
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}
GUARD_CREDENTIALS = {"username": "guard1", "password": "guard123"}


class TestHealthAndAuth:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "admin"
        print(f"SUCCESS: Admin login - token received")
    
    def test_guard_login_success(self):
        """Test guard login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=GUARD_CREDENTIALS)
        assert response.status_code == 200, f"Guard login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data["user"]["username"] == "guard1"
        assert data["user"]["role"] == "guard"
        print(f"SUCCESS: Guard login - token received")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "invalid_user",
            "password": "wrong_password"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"SUCCESS: Invalid login correctly rejected")
    
    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        token = login_response.json()["access_token"]
        
        # Test /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        
        data = response.json()
        assert data["username"] == "admin"
        assert data["role"] == "admin"
        print(f"SUCCESS: Auth/me endpoint working")


class TestDashboardStats:
    """Dashboard statistics endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard-stats", headers=self.headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        # Verify all expected fields are present
        expected_fields = ["today_entries_exits", "total_vehicles", "total_visitors", "vehicles_inside", "overstaying_vehicles"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
            assert isinstance(data[field], int), f"Field {field} should be integer"
        
        print(f"SUCCESS: Dashboard stats - Today: {data['today_entries_exits']}, Vehicles: {data['total_vehicles']}, Inside: {data['vehicles_inside']}")
    
    def test_vehicle_status(self):
        """Test vehicle status endpoint"""
        response = requests.get(f"{BASE_URL}/api/vehicle-status", headers=self.headers)
        assert response.status_code == 200, f"Vehicle status failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Vehicle status should return a list"
        print(f"SUCCESS: Vehicle status - {len(data)} vehicles currently inside")


class TestVehicleManagement:
    """Vehicle CRUD endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_all_vehicles(self):
        """Test getting all vehicles"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=self.headers)
        assert response.status_code == 200, f"Get vehicles failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Vehicles should return a list"
        print(f"SUCCESS: Get vehicles - {len(data)} vehicles found")
    
    def test_create_vehicle_and_verify(self):
        """Test creating a new vehicle and verify persistence"""
        # Generate unique plate number
        plate_number = f"TEST-{uuid.uuid4().hex[:6].upper()}"
        
        vehicle_data = {
            "plate_number": plate_number,
            "vehicle_type": "company",
            "owner_name": "Test Owner",
            "department": "Test Department"
        }
        
        # Create vehicle
        response = requests.post(f"{BASE_URL}/api/vehicles", json=vehicle_data, headers=self.headers)
        assert response.status_code == 200, f"Create vehicle failed: {response.text}"
        
        created = response.json()
        assert created["plate_number"] == plate_number.upper()
        assert created["owner_name"] == "Test Owner"
        assert "id" in created
        
        # Verify by fetching
        get_response = requests.get(f"{BASE_URL}/api/vehicles/{plate_number}", headers=self.headers)
        assert get_response.status_code == 200, f"Get vehicle failed: {get_response.text}"
        
        fetched = get_response.json()
        assert fetched["plate_number"] == plate_number.upper()
        print(f"SUCCESS: Created and verified vehicle {plate_number}")
    
    def test_create_duplicate_vehicle_fails(self):
        """Test that creating duplicate vehicle fails"""
        # Generate unique plate number
        plate_number = f"TEST-DUP-{uuid.uuid4().hex[:4].upper()}"
        
        vehicle_data = {
            "plate_number": plate_number,
            "vehicle_type": "private",
            "owner_name": "Duplicate Test"
        }
        
        # Create first vehicle
        response1 = requests.post(f"{BASE_URL}/api/vehicles", json=vehicle_data, headers=self.headers)
        assert response1.status_code == 200, f"First create failed: {response1.text}"
        
        # Try to create duplicate
        response2 = requests.post(f"{BASE_URL}/api/vehicles", json=vehicle_data, headers=self.headers)
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
        print(f"SUCCESS: Duplicate vehicle correctly rejected")
    
    def test_guard_cannot_create_vehicle(self):
        """Test that guards cannot create vehicles"""
        # Login as guard
        guard_login = requests.post(f"{BASE_URL}/api/auth/login", json=GUARD_CREDENTIALS)
        guard_token = guard_login.json()["access_token"]
        guard_headers = {"Authorization": f"Bearer {guard_token}"}
        
        vehicle_data = {
            "plate_number": f"GUARD-{uuid.uuid4().hex[:4].upper()}",
            "vehicle_type": "company",
            "owner_name": "Guard Test"
        }
        
        response = requests.post(f"{BASE_URL}/api/vehicles", json=vehicle_data, headers=guard_headers)
        assert response.status_code == 403, f"Expected 403 for guard, got {response.status_code}"
        print(f"SUCCESS: Guard correctly denied vehicle creation")


class TestVisitorRegistration:
    """Visitor registration endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get guard token for authenticated requests"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=GUARD_CREDENTIALS)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_active_visitors(self):
        """Test getting active visitors"""
        response = requests.get(f"{BASE_URL}/api/visitors", headers=self.headers)
        assert response.status_code == 200, f"Get visitors failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Visitors should return a list"
        print(f"SUCCESS: Get visitors - {len(data)} active visitors")
    
    def test_register_visitor(self):
        """Test registering a new visitor"""
        plate_number = f"VISITOR-{uuid.uuid4().hex[:4].upper()}"
        
        visitor_data = {
            "plate_number": plate_number,
            "vehicle_type": "private",
            "driver_license": {
                "last_name": "Test",
                "first_name": "Visitor",
                "middle_name": "M",
                "gender": "male",
                "date_of_birth": "1990-01-01",
                "address": "123 Test Street",
                "license_number": f"LIC-{uuid.uuid4().hex[:8].upper()}"
            },
            "purpose_of_visit": "Business Meeting",
            "department_visiting": "Admin Office",
            "visit_duration": "4_hours"
        }
        
        response = requests.post(f"{BASE_URL}/api/visitor-registration", json=visitor_data, headers=self.headers)
        assert response.status_code == 200, f"Register visitor failed: {response.text}"
        
        data = response.json()
        assert data["plate_number"] == plate_number.upper()
        assert "barcode_data" in data
        assert "expires_at" in data
        print(f"SUCCESS: Registered visitor {plate_number}, expires at {data['expires_at']}")


class TestScanningEndpoint:
    """Vehicle scanning endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get guard token and create test vehicle"""
        # Login as guard
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=GUARD_CREDENTIALS)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Login as admin to create vehicle
        admin_login = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create test vehicle
        self.test_plate = f"SCAN-{uuid.uuid4().hex[:4].upper()}"
        vehicle_data = {
            "plate_number": self.test_plate,
            "vehicle_type": "company",
            "owner_name": "Scan Test Owner"
        }
        requests.post(f"{BASE_URL}/api/vehicles", json=vehicle_data, headers=admin_headers)
    
    def test_scan_entry(self):
        """Test scanning vehicle entry"""
        scan_data = {
            "plate_number": self.test_plate,
            "scan_method": "scanner"
        }
        
        response = requests.post(f"{BASE_URL}/api/scan", json=scan_data, headers=self.headers)
        assert response.status_code == 200, f"Scan entry failed: {response.text}"
        
        data = response.json()
        assert data["action"] == "entry"
        assert "timestamp" in data
        print(f"SUCCESS: Scanned entry for {self.test_plate}")
    
    def test_scan_exit_after_entry(self):
        """Test scanning vehicle exit after entry"""
        scan_data = {
            "plate_number": self.test_plate,
            "scan_method": "manual"
        }
        
        # First scan (entry)
        response1 = requests.post(f"{BASE_URL}/api/scan", json=scan_data, headers=self.headers)
        assert response1.status_code == 200
        
        # Second scan (exit)
        response2 = requests.post(f"{BASE_URL}/api/scan", json=scan_data, headers=self.headers)
        assert response2.status_code == 200
        
        data = response2.json()
        assert data["action"] == "exit"
        print(f"SUCCESS: Scanned exit for {self.test_plate}")
    
    def test_scan_unknown_vehicle(self):
        """Test scanning unknown vehicle"""
        scan_data = {
            "plate_number": "UNKNOWN-999",
            "scan_method": "scanner"
        }
        
        response = requests.post(f"{BASE_URL}/api/scan", json=scan_data, headers=self.headers)
        assert response.status_code == 404, f"Expected 404 for unknown vehicle, got {response.status_code}"
        print(f"SUCCESS: Unknown vehicle correctly rejected")


class TestEntryExitLogs:
    """Entry/Exit logs endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_logs(self):
        """Test getting entry/exit logs"""
        response = requests.get(f"{BASE_URL}/api/logs?limit=20", headers=self.headers)
        assert response.status_code == 200, f"Get logs failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Logs should return a list"
        
        if len(data) > 0:
            log = data[0]
            assert "plate_number" in log
            assert "action" in log
            assert "timestamp" in log
        
        print(f"SUCCESS: Get logs - {len(data)} logs found")


class TestDatabaseViewer:
    """Database viewer endpoint tests (Admin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_collections(self):
        """Test getting database collections"""
        response = requests.get(f"{BASE_URL}/api/database/collections", headers=self.headers)
        assert response.status_code == 200, f"Get collections failed: {response.text}"
        
        data = response.json()
        expected_collections = ["users", "vehicles", "visitor_registrations", "entry_exit_logs"]
        for collection in expected_collections:
            assert collection in data, f"Missing collection: {collection}"
            assert "count" in data[collection]
        
        print(f"SUCCESS: Database collections - {list(data.keys())}")
    
    def test_get_collection_data(self):
        """Test getting data from a collection"""
        response = requests.get(f"{BASE_URL}/api/database/users?skip=0&limit=20", headers=self.headers)
        assert response.status_code == 200, f"Get collection data failed: {response.text}"
        
        data = response.json()
        assert "documents" in data
        assert "total" in data
        assert isinstance(data["documents"], list)
        
        print(f"SUCCESS: Users collection - {data['total']} total documents")
    
    def test_guard_cannot_access_database(self):
        """Test that guards cannot access database viewer"""
        guard_login = requests.post(f"{BASE_URL}/api/auth/login", json=GUARD_CREDENTIALS)
        guard_token = guard_login.json()["access_token"]
        guard_headers = {"Authorization": f"Bearer {guard_token}"}
        
        response = requests.get(f"{BASE_URL}/api/database/collections", headers=guard_headers)
        assert response.status_code == 403, f"Expected 403 for guard, got {response.status_code}"
        print(f"SUCCESS: Guard correctly denied database access")
    
    def test_update_document(self):
        """Test updating a document in database"""
        # First get a vehicle to update
        vehicles_response = requests.get(f"{BASE_URL}/api/database/vehicles?skip=0&limit=1", headers=self.headers)
        vehicles = vehicles_response.json()["documents"]
        
        if len(vehicles) > 0:
            vehicle = vehicles[0]
            vehicle_id = vehicle["id"]
            
            # Update the vehicle
            update_data = {**vehicle, "department": "Updated Department"}
            response = requests.put(
                f"{BASE_URL}/api/database/vehicles/{vehicle_id}",
                json=update_data,
                headers=self.headers
            )
            assert response.status_code == 200, f"Update document failed: {response.text}"
            print(f"SUCCESS: Updated vehicle document")
        else:
            pytest.skip("No vehicles to update")


class TestSyncEndpoint:
    """Offline sync endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get guard token for authenticated requests"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=GUARD_CREDENTIALS)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_sync_empty_data(self):
        """Test syncing empty data"""
        sync_data = {
            "visitor_registrations": [],
            "entry_exit_logs": []
        }
        
        response = requests.post(f"{BASE_URL}/api/sync", json=sync_data, headers=self.headers)
        assert response.status_code == 200, f"Sync failed: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["synced_registrations"] == 0
        assert data["synced_logs"] == 0
        print(f"SUCCESS: Empty sync completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
