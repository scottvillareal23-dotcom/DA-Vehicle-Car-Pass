/**
 * Admin Dashboard Component
 * Main dashboard for administrators to monitor vehicles, visitors, and logs
 * Includes multiple tabs for different management functions
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { API, DA_LOGO_URL } from '../../services/constants';
import OfflineStatus from '../common/OfflineStatus';
import VisitorDetailModal from '../common/VisitorDetailModal';
import DatabaseViewer from './DatabaseViewer';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { 
  Car, 
  Shield, 
  LogIn, 
  LogOut, 
  AlertTriangle, 
  Users,
  Activity,
  Building,
  UserPlus,
  Camera,
  WifiOff,
  Eye,
  Smartphone,
  FileText,
  Timer
} from "lucide-react";

const AdminDashboard = () => {
  // Dashboard data state
  const [stats, setStats] = useState({});
  const [vehicles, setVehicles] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState([]);
  
  // Modal state
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);
  
  // New vehicle form state
  const [newVehicle, setNewVehicle] = useState({
    plate_number: '',
    vehicle_type: 'company',
    owner_name: '',
    department: ''
  });
  
  // Auth context
  const { user, isOnline } = useAuth();

  /**
   * Fetch all dashboard data in parallel
   */
  const fetchDashboardData = async () => {
    try {
      const [statsRes, vehiclesRes, visitorsRes, logsRes, statusRes] = await Promise.all([
        axios.get(`${API}/dashboard-stats`),
        axios.get(`${API}/vehicles`),
        axios.get(`${API}/visitors`),
        axios.get(`${API}/logs?limit=20`),
        axios.get(`${API}/vehicle-status`)
      ]);

      setStats(statsRes.data);
      setVehicles(vehiclesRes.data);
      setVisitors(visitorsRes.data);
      setLogs(logsRes.data);
      setVehicleStatus(statusRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Fetch dashboard data on mount and periodically
  useEffect(() => {
    // Initial fetch
    const loadData = async () => {
      await fetchDashboardData();
    };
    loadData();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 10000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Handle new vehicle creation
   */
  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/vehicles`, {
        ...newVehicle,
        plate_number: newVehicle.plate_number.toUpperCase().trim()
      });
      // Reset form
      setNewVehicle({
        plate_number: '',
        vehicle_type: 'company',
        owner_name: '',
        department: ''
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating vehicle:', error);
      alert('Error creating vehicle: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <OfflineStatus isOnline={isOnline} />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <img 
              src={DA_LOGO_URL} 
              alt="DA Logo"
              className="w-12 h-12 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="w-12 h-12 bg-green-600 rounded-full hidden items-center justify-center">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Department of Agriculture Region V - Vehicle Monitoring</p>
              <p className="text-sm text-gray-500">Welcome, {user?.username}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isOnline && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                <WifiOff className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}
            <Badge variant="default" className="px-3 py-1 bg-green-600">
              <Shield className="w-4 h-4 mr-1" />
              Admin Access
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="border-green-200" data-testid="stats-today-activity">
            <CardContent className="p-4">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Today&apos;s Activity</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.today_entries_exits || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-emerald-200" data-testid="stats-total-vehicles">
            <CardContent className="p-4">
              <div className="flex items-center">
                <Car className="h-8 w-8 text-emerald-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_vehicles || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-blue-200" data-testid="stats-active-visitors">
            <CardContent className="p-4">
              <div className="flex items-center">
                <UserPlus className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Visitors</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_visitors || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-teal-200" data-testid="stats-inside-now">
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-teal-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Inside Now</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.vehicles_inside || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-red-200" data-testid="stats-overstaying">
            <CardContent className="p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Overstaying</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overstaying_vehicles || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="status" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="status" data-testid="tab-status">Vehicle Status</TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">Entry/Exit Logs</TabsTrigger>
            <TabsTrigger value="visitors" data-testid="tab-visitors">Visitors</TabsTrigger>
            <TabsTrigger value="vehicles" data-testid="tab-vehicles">Manage Vehicles</TabsTrigger>
            <TabsTrigger value="add-vehicle" data-testid="tab-add-vehicle">Add Vehicle</TabsTrigger>
            <TabsTrigger value="mobile" data-testid="tab-mobile">Mobile Tools</TabsTrigger>
            <TabsTrigger value="database" data-testid="tab-database">Database</TabsTrigger>
          </TabsList>

          {/* Vehicle Status Tab */}
          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Vehicles Currently Inside DA Region V Premises</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vehicleStatus.map((status) => (
                    <div 
                      key={status.plate_number} 
                      className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200"
                    >
                      <div className="flex items-center space-x-4">
                        <Badge 
                          variant={status.is_overstaying ? 'destructive' : 'default'} 
                          className={!status.is_overstaying ? 'bg-green-600' : ''}
                        >
                          {status.plate_number}
                        </Badge>
                        {status.registration_type === 'visitor' && (
                          <Badge variant="outline" className="text-blue-600 border-blue-200">VISITOR</Badge>
                        )}
                        <div>
                          <p className="font-medium">Inside since: {new Date(status.entry_time).toLocaleString()}</p>
                          <p className="text-sm text-gray-600">
                            Duration: {status.duration_hours ? `${status.duration_hours.toFixed(1)} hours` : 'N/A'}
                          </p>
                        </div>
                      </div>
                      {status.is_overstaying && (
                        <Badge variant="destructive">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          OVERSTAYING
                        </Badge>
                      )}
                    </div>
                  ))}
                  {vehicleStatus.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No vehicles currently inside</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Entry/Exit Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Recent Entry/Exit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200"
                    >
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={log.action === 'entry' ? 'default' : 'secondary'} 
                          className={log.action === 'entry' ? 'bg-green-600' : ''}
                        >
                          {log.action === 'entry' ? <LogIn className="w-3 h-3 mr-1" /> : <LogOut className="w-3 h-3 mr-1" />}
                          {log.action.toUpperCase()}
                        </Badge>
                        <span className="font-mono font-semibold">{log.plate_number}</span>
                        <Badge variant="outline">{log.scan_method}</Badge>
                        {log.registration_type === 'visitor' && (
                          <Badge variant="outline" className="text-blue-600 border-blue-200">VISITOR</Badge>
                        )}
                        <span className="text-sm text-gray-600">Guard: {log.guard_username}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visitors Tab */}
          <TabsContent value="visitors">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Active Visitor Registrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {visitors.map((visitor) => (
                    <div 
                      key={visitor.id} 
                      className="p-4 border rounded-lg bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedVisitor(visitor);
                        setIsVisitorModalOpen(true);
                      }}
                      data-testid={`visitor-card-${visitor.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Badge className="bg-blue-600">{visitor.plate_number}</Badge>
                          <Badge variant="outline">{visitor.vehicle_type.toUpperCase()}</Badge>
                          <Badge 
                            variant={new Date(visitor.expires_at) > new Date() ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {new Date(visitor.expires_at) > new Date() ? 'ACTIVE' : 'EXPIRED'}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Eye className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-blue-600 font-medium">View Details</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><span className="font-medium">Driver:</span> {visitor.driver_license.first_name} {visitor.driver_license.last_name}</p>
                          <p><span className="font-medium">License:</span> {visitor.driver_license.license_number}</p>
                        </div>
                        <div>
                          <p><span className="font-medium">Purpose:</span> {visitor.purpose_of_visit}</p>
                          <p><span className="font-medium">Visiting:</span> {visitor.department_visiting || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        <span>Expires: {new Date(visitor.expires_at).toLocaleString()}</span>
                        {visitor.driver_license.license_photo_path && (
                          <span className="ml-4 inline-flex items-center">
                            <Camera className="w-3 h-3 mr-1" />
                            License photo available
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {visitors.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No active visitor registrations</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Visitor Detail Modal */}
            <VisitorDetailModal 
              visitor={selectedVisitor}
              isOpen={isVisitorModalOpen}
              onClose={() => {
                setIsVisitorModalOpen(false);
                setSelectedVisitor(null);
              }}
            />
          </TabsContent>

          {/* Manage Vehicles Tab */}
          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Permanent Vehicle Registrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vehicles.map((vehicle) => (
                    <div 
                      key={vehicle.id} 
                      className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200"
                    >
                      <div className="flex items-center space-x-4">
                        <Badge 
                          variant={vehicle.vehicle_type === 'private' ? 'secondary' : 'default'} 
                          className={vehicle.vehicle_type === 'company' ? 'bg-green-600' : ''}
                        >
                          {vehicle.plate_number}
                        </Badge>
                        <div>
                          <p className="font-medium">{vehicle.owner_name}</p>
                          <p className="text-sm text-gray-600">
                            {vehicle.vehicle_type.toUpperCase()} 
                            {vehicle.department && ` • ${vehicle.department}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Added: {new Date(vehicle.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add Vehicle Tab */}
          <TabsContent value="add-vehicle">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Add New Permanent Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateVehicle} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="plate_number">Plate Number</Label>
                      <Input
                        id="plate_number"
                        value={newVehicle.plate_number}
                        onChange={(e) => setNewVehicle({...newVehicle, plate_number: e.target.value})}
                        placeholder="ABC-1234"
                        className="font-mono mt-1"
                        required
                        data-testid="new-vehicle-plate-input"
                      />
                    </div>
                    <div>
                      <Label>Vehicle Type</Label>
                      <Select 
                        value={newVehicle.vehicle_type} 
                        onValueChange={(value) => setNewVehicle({...newVehicle, vehicle_type: value})}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="company">DA Government Vehicle</SelectItem>
                          <SelectItem value="private">Private Vehicle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="owner_name">Owner Name</Label>
                      <Input
                        id="owner_name"
                        value={newVehicle.owner_name}
                        onChange={(e) => setNewVehicle({...newVehicle, owner_name: e.target.value})}
                        placeholder="Juan Dela Cruz"
                        className="mt-1"
                        required
                        data-testid="new-vehicle-owner-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Department (Optional)</Label>
                      <Input
                        id="department"
                        value={newVehicle.department}
                        onChange={(e) => setNewVehicle({...newVehicle, department: e.target.value})}
                        placeholder="Field Operations"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full md:w-auto bg-green-600 hover:bg-green-700"
                    data-testid="add-vehicle-submit-btn"
                  >
                    Add Vehicle
                    <Car className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mobile Tools Tab */}
          <TabsContent value="mobile">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700 flex items-center">
                  <Smartphone className="w-5 h-5 mr-2" />
                  Mobile PWA Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">Progressive Web App (PWA)</h3>
                    <p className="text-blue-700 text-sm">
                      This system works as a mobile app with offline capabilities, camera access, and home screen installation.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <Camera className="w-5 h-5 text-green-600 mr-2" />
                        <h4 className="font-medium">Camera & OCR</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        Automatic license data extraction from photos with manual fallback option.
                      </p>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <WifiOff className="w-5 h-5 text-orange-600 mr-2" />
                        <h4 className="font-medium">Offline Support</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        Continues working without internet. Data syncs automatically when online.
                      </p>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <FileText className="w-5 h-5 text-purple-600 mr-2" />
                        <h4 className="font-medium">Barcode Generation</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        Generates printable 1D barcodes with PDF download capability.
                      </p>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <Timer className="w-5 h-5 text-red-600 mr-2" />
                        <h4 className="font-medium">Visit Duration</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        Configurable visit durations (2, 4, 8 hours, 1 day) with automatic expiry.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-2">Installation Instructions</h3>
                    <ol className="text-green-700 text-sm space-y-1">
                      <li>1. Open this site on your mobile device</li>
                      <li>2. Tap the browser menu and select &quot;Add to Home Screen&quot;</li>
                      <li>3. The app will work like a native mobile app</li>
                      <li>4. Camera permissions will be requested for license scanning</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Tab */}
          <TabsContent value="database">
            <DatabaseViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
