import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { 
  Car, 
  Shield, 
  LogIn, 
  LogOut, 
  Clock, 
  AlertTriangle, 
  Scan, 
  KeyboardIcon,
  Users,
  Activity,
  Timer,
  Building
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// DA Logo URL
const DA_LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Department_of_Agriculture_of_the_Philippines.svg/490px-Department_of_Agriculture_of_the_Philippines.svg.png";

// Auth Context with improved error handling
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

class AuthService {
  static setAuthToken(token) {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }

  static getStoredToken() {
    return localStorage.getItem('token');
  }

  static async validateToken(token) {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { valid: true, user: response.data };
    } catch (error) {
      return { valid: false, error: error.response?.data?.detail };
    }
  }
}

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    const token = AuthService.getStoredToken();
    if (token) {
      const validation = await AuthService.validateToken(token);
      if (validation.valid) {
        AuthService.setAuthToken(token);
        setUser(validation.user);
      } else {
        AuthService.setAuthToken(null);
      }
    }
    setLoading(false);
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { 
        username: username.trim(), 
        password: password.trim() 
      });
      
      const { access_token, user: userData } = response.data;
      
      AuthService.setAuthToken(access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed. Please check your credentials.' 
      };
    }
  };

  const logout = () => {
    AuthService.setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component with DA theme
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(username, password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-20 h-20 mb-6 flex items-center justify-center">
            <img 
              src={DA_LOGO_URL} 
              alt="Department of Agriculture Philippines"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="w-20 h-20 bg-green-600 rounded-full hidden items-center justify-center">
              <Building className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 mb-2">DA Vehicle Gate Pass</CardTitle>
          <p className="text-gray-600">Department of Agriculture Region V</p>
          <p className="text-sm text-gray-500">Sign in to access the vehicle monitoring system</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter your username"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="mt-1"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button 
              type="submit" 
              className="w-full bg-green-600 hover:bg-green-700" 
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
              <LogIn className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Guard Interface Component with DA theme
const GuardInterface = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [scanMethod, setScanMethod] = useState('scanner');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchRecentLogs();
    const interval = setInterval(fetchRecentLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchRecentLogs = async () => {
    try {
      const response = await axios.get(`${API}/logs?limit=10`);
      setRecentLogs(response.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!plateNumber.trim()) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post(`${API}/scan`, {
        plate_number: plateNumber.toUpperCase().trim(),
        scan_method: scanMethod
      });

      setMessage({
        type: 'success',
        text: response.data.message,
        warning: response.data.warning
      });
      setPlateNumber('');
      fetchRecentLogs();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Scan failed'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
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
                <h1 className="text-2xl font-bold text-gray-900">Guard Station</h1>
                <p className="text-gray-600">Welcome, {user?.username}</p>
              </div>
            </div>
            <Badge variant="secondary" className="px-3 py-1 bg-green-100 text-green-800">
              <Shield className="w-4 h-4 mr-1" />
              Guard Access
            </Badge>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center text-green-700">
                <Scan className="w-5 h-5 mr-2" />
                Vehicle Scanner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScan} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="plate">Plate Number</Label>
                    <Input
                      id="plate"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value)}
                      placeholder="Enter or scan plate number"
                      className="text-lg font-mono mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label>Scan Method</Label>
                    <Select value={scanMethod} onValueChange={setScanMethod}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scanner">
                          <div className="flex items-center">
                            <Scan className="w-4 h-4 mr-2" />
                            Barcode Scanner
                          </div>
                        </SelectItem>
                        <SelectItem value="manual">
                          <div className="flex items-center">
                            <KeyboardIcon className="w-4 h-4 mr-2" />
                            Manual Input
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full md:w-auto bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Processing...' : 'Process Entry/Exit'}
                  {scanMethod === 'scanner' ? <Scan className="w-4 h-4 ml-2" /> : <KeyboardIcon className="w-4 h-4 ml-2" />}
                </Button>
              </form>

              {message && (
                <div className="mt-4">
                  <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                    <AlertDescription>
                      {message.text}
                      {message.warning && (
                        <div className="mt-2 text-orange-600 font-medium">
                          ⚠️ {message.warning}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-green-700">
                <Activity className="w-5 h-5 mr-2" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-center space-x-3">
                      <Badge variant={log.action === 'entry' ? 'default' : 'secondary'} className={log.action === 'entry' ? 'bg-green-600' : 'bg-gray-600'}>
                        {log.action === 'entry' ? <LogIn className="w-3 h-3 mr-1" /> : <LogOut className="w-3 h-3 mr-1" />}
                        {log.action.toUpperCase()}
                      </Badge>
                      <span className="font-mono font-semibold">{log.plate_number}</span>
                      <span className="text-sm text-gray-600">by {log.guard_username}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {recentLogs.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Admin Dashboard Component with DA theme
const AdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [vehicles, setVehicles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState([]);
  const [newVehicle, setNewVehicle] = useState({
    plate_number: '',
    vehicle_type: 'company',
    owner_name: '',
    department: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, vehiclesRes, logsRes, statusRes] = await Promise.all([
        axios.get(`${API}/dashboard-stats`),
        axios.get(`${API}/vehicles`),
        axios.get(`${API}/logs?limit=20`),
        axios.get(`${API}/vehicle-status`)
      ]);

      setStats(statsRes.data);
      setVehicles(vehiclesRes.data);
      setLogs(logsRes.data);
      setVehicleStatus(statusRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/vehicles`, {
        ...newVehicle,
        plate_number: newVehicle.plate_number.toUpperCase().trim()
      });
      setNewVehicle({
        plate_number: '',
        vehicle_type: 'company',
        owner_name: '',
        department: ''
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating vehicle:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <div className="max-w-7xl mx-auto">
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
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Department of Agriculture - Vehicle Monitoring</p>
              <p className="text-sm text-gray-500">Welcome, {user?.username}</p>
            </div>
          </div>
          <Badge variant="default" className="px-3 py-1 bg-green-600">
            <Shield className="w-4 h-4 mr-1" />
            Admin Access
          </Badge>
        </div>

        {/* Stats Cards with DA colors */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Today's Activity</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.today_entries_exits || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Car className="h-8 w-8 text-emerald-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_vehicles || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-teal-200">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-teal-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Inside Now</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.vehicles_inside || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-6">
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

        <Tabs defaultValue="status" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="status">Vehicle Status</TabsTrigger>
            <TabsTrigger value="logs">Entry/Exit Logs</TabsTrigger>
            <TabsTrigger value="vehicles">Manage Vehicles</TabsTrigger>
            <TabsTrigger value="add-vehicle">Add Vehicle</TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Vehicles Currently Inside DA Premises</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vehicleStatus.map((status) => (
                    <div key={status.plate_number} className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center space-x-4">
                        <Badge variant={status.is_overstaying ? 'destructive' : 'default'} className={!status.is_overstaying ? 'bg-green-600' : ''}>
                          {status.plate_number}
                        </Badge>
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

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Recent Entry/Exit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center space-x-3">
                        <Badge variant={log.action === 'entry' ? 'default' : 'secondary'} className={log.action === 'entry' ? 'bg-green-600' : ''}>
                          {log.action === 'entry' ? <LogIn className="w-3 h-3 mr-1" /> : <LogOut className="w-3 h-3 mr-1" />}
                          {log.action.toUpperCase()}
                        </Badge>
                        <span className="font-mono font-semibold">{log.plate_number}</span>
                        <Badge variant="outline">{log.scan_method}</Badge>
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

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Registered Vehicles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center space-x-4">
                        <Badge variant={vehicle.vehicle_type === 'private' ? 'secondary' : 'default'} className={vehicle.vehicle_type === 'company' ? 'bg-green-600' : ''}>
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

          <TabsContent value="add-vehicle">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Add New Vehicle</CardTitle>
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
                      />
                    </div>
                    <div>
                      <Label>Vehicle Type</Label>
                      <Select value={newVehicle.vehicle_type} onValueChange={(value) => setNewVehicle({...newVehicle, vehicle_type: value})}>
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
                  <Button type="submit" className="w-full md:w-auto bg-green-600 hover:bg-green-700">
                    Add Vehicle
                    <Car className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Main App Component
const AppContent = () => {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <img 
            src={DA_LOGO_URL} 
            alt="DA Logo"
            className="w-16 h-16 mx-auto mb-4 animate-pulse"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="w-16 h-16 bg-green-600 rounded-full hidden items-center justify-center mx-auto mb-4">
            <Building className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading DA Vehicle Gate Pass System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-green-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img 
                src={DA_LOGO_URL} 
                alt="DA Logo"
                className="w-8 h-8 mr-3"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="w-8 h-8 bg-green-600 rounded-full hidden items-center justify-center mr-3">
                <Building className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">DA Vehicle Gate Pass System</h1>
                <p className="text-xs text-gray-600">Department of Agriculture Philippines</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="border-green-200 text-green-700">
                {user.role.toUpperCase()}
              </Badge>
              <Button variant="outline" onClick={logout} className="border-green-200 text-green-700 hover:bg-green-50">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {user.role === 'admin' ? <AdminDashboard /> : <GuardInterface />}
      </main>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;