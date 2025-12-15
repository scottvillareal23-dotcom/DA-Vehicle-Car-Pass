import requests
import sys
import json
from datetime import datetime

class VehicleGatePassAPITester:
    def __init__(self, base_url="https://vehicleguard.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.guard_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_vehicles = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_guard_login(self):
        """Test guard login"""
        success, response = self.run_test(
            "Guard Login",
            "POST",
            "auth/login",
            200,
            data={"username": "guard1", "password": "guard123"}
        )
        if success and 'access_token' in response:
            self.guard_token = response['access_token']
            print(f"   Guard token obtained: {self.guard_token[:20]}...")
            return True
        return False

    def test_invalid_login(self):
        """Test invalid login credentials"""
        success, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"username": "invalid", "password": "wrong"}
        )
        return success

    def test_auth_me_admin(self):
        """Test getting current user info for admin"""
        success, response = self.run_test(
            "Get Admin User Info",
            "GET",
            "auth/me",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   User: {response.get('username')}, Role: {response.get('role')}")
        return success

    def test_auth_me_guard(self):
        """Test getting current user info for guard"""
        success, response = self.run_test(
            "Get Guard User Info",
            "GET",
            "auth/me",
            200,
            token=self.guard_token
        )
        if success:
            print(f"   User: {response.get('username')}, Role: {response.get('role')}")
        return success

    def test_create_vehicle_admin(self):
        """Test creating a vehicle as admin"""
        test_vehicle = {
            "plate_number": "TEST-001",
            "vehicle_type": "company",
            "owner_name": "Test User",
            "department": "Testing"
        }
        success, response = self.run_test(
            "Create Vehicle (Admin)",
            "POST",
            "vehicles",
            200,
            data=test_vehicle,
            token=self.admin_token
        )
        if success:
            self.created_vehicles.append(response.get('plate_number'))
            print(f"   Created vehicle: {response.get('plate_number')}")
        return success

    def test_create_vehicle_guard_forbidden(self):
        """Test that guard cannot create vehicles"""
        test_vehicle = {
            "plate_number": "GUARD-001",
            "vehicle_type": "private",
            "owner_name": "Guard Test",
            "department": "Security"
        }
        success, _ = self.run_test(
            "Create Vehicle (Guard - Should Fail)",
            "POST",
            "vehicles",
            403,
            data=test_vehicle,
            token=self.guard_token
        )
        return success

    def test_get_vehicles(self):
        """Test getting all vehicles"""
        success, response = self.run_test(
            "Get All Vehicles",
            "GET",
            "vehicles",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} vehicles")
            for vehicle in response[:3]:  # Show first 3
                print(f"   - {vehicle.get('plate_number')}: {vehicle.get('owner_name')}")
        return success

    def test_get_vehicle_by_plate(self):
        """Test getting specific vehicle by plate number"""
        success, response = self.run_test(
            "Get Vehicle by Plate (COM-001)",
            "GET",
            "vehicles/COM-001",
            200,
            token=self.guard_token
        )
        if success:
            print(f"   Vehicle: {response.get('plate_number')} - {response.get('owner_name')}")
        return success

    def test_get_nonexistent_vehicle(self):
        """Test getting non-existent vehicle"""
        success, _ = self.run_test(
            "Get Non-existent Vehicle",
            "GET",
            "vehicles/NONEXIST-999",
            404,
            token=self.guard_token
        )
        return success

    def test_scan_existing_vehicle_entry(self):
        """Test scanning existing vehicle for entry"""
        success, response = self.run_test(
            "Scan Vehicle Entry (COM-001)",
            "POST",
            "scan",
            200,
            data={"plate_number": "COM-001", "scan_method": "scanner"},
            token=self.guard_token
        )
        if success:
            print(f"   Action: {response.get('action')}")
            print(f"   Message: {response.get('message')}")
            if response.get('warning'):
                print(f"   Warning: {response.get('warning')}")
        return success

    def test_scan_existing_vehicle_exit(self):
        """Test scanning same vehicle for exit"""
        success, response = self.run_test(
            "Scan Vehicle Exit (COM-001)",
            "POST",
            "scan",
            200,
            data={"plate_number": "COM-001", "scan_method": "manual"},
            token=self.guard_token
        )
        if success:
            print(f"   Action: {response.get('action')}")
            print(f"   Message: {response.get('message')}")
        return success

    def test_scan_private_vehicle(self):
        """Test scanning private vehicle (should show timer warning)"""
        success, response = self.run_test(
            "Scan Private Vehicle (PVT-123)",
            "POST",
            "scan",
            200,
            data={"plate_number": "PVT-123", "scan_method": "scanner"},
            token=self.guard_token
        )
        if success:
            print(f"   Action: {response.get('action')}")
            print(f"   Message: {response.get('message')}")
            if response.get('warning'):
                print(f"   Warning: {response.get('warning')}")
        return success

    def test_scan_nonexistent_vehicle(self):
        """Test scanning non-existent vehicle"""
        success, _ = self.run_test(
            "Scan Non-existent Vehicle",
            "POST",
            "scan",
            404,
            data={"plate_number": "FAKE-999", "scan_method": "scanner"},
            token=self.guard_token
        )
        return success

    def test_get_logs(self):
        """Test getting entry/exit logs"""
        success, response = self.run_test(
            "Get Entry/Exit Logs",
            "GET",
            "logs?limit=10",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} log entries")
            for log in response[:3]:  # Show first 3
                print(f"   - {log.get('plate_number')}: {log.get('action')} by {log.get('guard_username')}")
        return success

    def test_get_vehicle_status(self):
        """Test getting current vehicle status"""
        success, response = self.run_test(
            "Get Vehicle Status",
            "GET",
            "vehicle-status",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Vehicles currently inside: {len(response)}")
            for status in response:
                duration = status.get('duration_hours', 0)
                overstaying = status.get('is_overstaying', False)
                print(f"   - {status.get('plate_number')}: {duration:.1f}h {'(OVERSTAYING)' if overstaying else ''}")
        return success

    def test_dashboard_stats(self):
        """Test getting dashboard statistics"""
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard-stats",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Today's entries/exits: {response.get('today_entries_exits')}")
            print(f"   Total vehicles: {response.get('total_vehicles')}")
            print(f"   Total visitors: {response.get('total_visitors')}")
            print(f"   Vehicles inside: {response.get('vehicles_inside')}")
            print(f"   Overstaying vehicles: {response.get('overstaying_vehicles')}")
        return success

    def test_visitor_registration(self):
        """Test visitor registration with complete data"""
        visitor_data = {
            "plate_number": "VIS-001",
            "vehicle_type": "private",
            "purpose_of_visit": "Meeting with Field Operations",
            "department_visiting": "Field Operations",
            "visit_duration": "4_hours",
            "driver_license": {
                "license_number": "N01-12-123456",
                "last_name": "Dela Cruz",
                "first_name": "Juan",
                "middle_name": "Santos",
                "gender": "male",
                "date_of_birth": "1990-01-15",
                "address": "123 Main St, Legazpi City, Albay"
            }
        }
        success, response = self.run_test(
            "Register Visitor",
            "POST",
            "visitor-registration",
            200,
            data=visitor_data,
            token=self.guard_token
        )
        if success:
            print(f"   Registered visitor: {response.get('plate_number')}")
            print(f"   Expires at: {response.get('expires_at')}")
            print(f"   Barcode: {response.get('barcode_data')}")
        return success

    def test_get_active_visitors(self):
        """Test getting active visitors"""
        success, response = self.run_test(
            "Get Active Visitors",
            "GET",
            "visitors",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} active visitors")
            for visitor in response[:3]:  # Show first 3
                print(f"   - {visitor.get('plate_number')}: {visitor.get('driver_license', {}).get('first_name')} {visitor.get('driver_license', {}).get('last_name')}")
        return success

    def test_get_visitor_by_plate(self):
        """Test getting visitor by plate number"""
        success, response = self.run_test(
            "Get Visitor by Plate (VIS-001)",
            "GET",
            "visitors/VIS-001",
            200,
            token=self.guard_token
        )
        if success:
            print(f"   Visitor: {response.get('plate_number')} - {response.get('driver_license', {}).get('first_name')} {response.get('driver_license', {}).get('last_name')}")
        return success

    def test_scan_visitor_vehicle(self):
        """Test scanning visitor vehicle"""
        success, response = self.run_test(
            "Scan Visitor Vehicle (VIS-001)",
            "POST",
            "scan",
            200,
            data={"plate_number": "VIS-001", "scan_method": "scanner"},
            token=self.guard_token
        )
        if success:
            print(f"   Action: {response.get('action')}")
            print(f"   Message: {response.get('message')}")
            if response.get('warning'):
                print(f"   Warning: {response.get('warning')}")
        return success

    def test_duplicate_visitor_registration(self):
        """Test registering duplicate visitor (should fail)"""
        visitor_data = {
            "plate_number": "VIS-001",  # Same as previous test
            "vehicle_type": "private",
            "purpose_of_visit": "Another meeting",
            "department_visiting": "Admin",
            "visit_duration": "2_hours",
            "driver_license": {
                "license_number": "N01-12-999999",
                "last_name": "Test",
                "first_name": "Duplicate",
                "gender": "female",
                "date_of_birth": "1995-05-20",
                "address": "456 Test St, Legazpi City"
            }
        }
        success, _ = self.run_test(
            "Duplicate Visitor Registration (Should Fail)",
            "POST",
            "visitor-registration",
            400,
            data=visitor_data,
            token=self.guard_token
        )
        return success

    def test_sync_offline_data(self):
        """Test syncing offline data"""
        sync_data = {
            "visitor_registrations": [],
            "entry_exit_logs": []
        }
        success, response = self.run_test(
            "Sync Offline Data",
            "POST",
            "sync",
            200,
            data=sync_data,
            token=self.guard_token
        )
        if success:
            print(f"   Synced registrations: {response.get('synced_registrations')}")
            print(f"   Synced logs: {response.get('synced_logs')}")
            print(f"   Success: {response.get('success')}")
        return success

    def test_unauthorized_access(self):
        """Test accessing admin endpoint without token"""
        success, _ = self.run_test(
            "Unauthorized Access (No Token)",
            "GET",
            "dashboard-stats",
            401
        )
        return success

def main():
    print("🚗 Vehicle Gate Pass System API Testing")
    print("=" * 50)
    
    tester = VehicleGatePassAPITester()
    
    # Authentication Tests
    print("\n📋 AUTHENTICATION TESTS")
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1
    
    if not tester.test_guard_login():
        print("❌ Guard login failed, stopping tests")
        return 1
    
    tester.test_invalid_login()
    tester.test_auth_me_admin()
    tester.test_auth_me_guard()
    tester.test_unauthorized_access()
    
    # Vehicle Management Tests
    print("\n🚗 VEHICLE MANAGEMENT TESTS")
    tester.test_create_vehicle_admin()
    tester.test_create_vehicle_guard_forbidden()
    tester.test_get_vehicles()
    tester.test_get_vehicle_by_plate()
    tester.test_get_nonexistent_vehicle()
    
    # Scanning Tests
    print("\n📱 VEHICLE SCANNING TESTS")
    tester.test_scan_existing_vehicle_entry()
    tester.test_scan_existing_vehicle_exit()
    tester.test_scan_private_vehicle()
    tester.test_scan_nonexistent_vehicle()
    
    # Visitor Registration Tests
    print("\n👥 VISITOR REGISTRATION TESTS")
    tester.test_visitor_registration()
    tester.test_get_active_visitors()
    tester.test_get_visitor_by_plate()
    tester.test_scan_visitor_vehicle()
    tester.test_duplicate_visitor_registration()
    
    # Offline Sync Tests
    print("\n🔄 OFFLINE SYNC TESTS")
    tester.test_sync_offline_data()
    
    # Logging and Status Tests
    print("\n📊 LOGGING AND STATUS TESTS")
    tester.test_get_logs()
    tester.test_get_vehicle_status()
    tester.test_dashboard_stats()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        failed = tester.tests_run - tester.tests_passed
        print(f"⚠️  {failed} test(s) failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())