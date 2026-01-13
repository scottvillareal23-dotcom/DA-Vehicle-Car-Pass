import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import Tesseract from 'tesseract.js';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { Progress } from "./components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
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
  Building,
  Camera,
  UserPlus,
  FileText,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Smartphone,
  Wifi,
  WifiOff,
  Eye,
  Calendar,
  MapPin,
  Phone,
  CreditCard,
  Database,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  ArrowUpDown
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// DA Logo URL
const DA_LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Department_of_Agriculture_of_the_Philippines.svg/490px-Department_of_Agriculture_of_the_Philippines.svg.png";

// PWA and Offline Support
class PWAManager {
  static async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', registration);
        return registration;
      } catch (error) {
        console.error('SW registration failed:', error);
      }
    }
  }

  static async checkOnlineStatus() {
    return navigator.onLine;
  }

  static setupOnlineStatusListener(callback) {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  }
}

// Offline Storage Manager
class OfflineStorageManager {
  static DB_NAME = 'DAVehiclePassDB';
  static DB_VERSION = 1;

  static async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('offline_data')) {
          const store = db.createObjectStore('offline_data', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('endpoint', 'endpoint', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
        }
      };
    });
  }

  static async storeOfflineData(endpoint, data) {
    const db = await this.openDB();
    const transaction = db.transaction(['offline_data'], 'readwrite');
    const store = transaction.objectStore('offline_data');
    
    const offlineData = {
      endpoint,
      data,
      timestamp: new Date().toISOString(),
      synced: false
    };
    
    return store.add(offlineData);
  }

  static async getUnsyncedData() {
    const db = await this.openDB();
    const transaction = db.transaction(['offline_data'], 'readonly');
    const store = transaction.objectStore('offline_data');
    const index = store.index('synced');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(false);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async markAsSynced(id) {
    const db = await this.openDB();
    const transaction = db.transaction(['offline_data'], 'readwrite');
    const store = transaction.objectStore('offline_data');
    
    const item = await store.get(id);
    if (item) {
      item.synced = true;
      return store.put(item);
    }
  }
}

// OCR Service - Enhanced for Philippine Driver's License with Image Processing
class OCRService {
  static async extractLicenseData(imageFile, progressCallback) {
    try {
      console.log('Starting OCR processing...');
      progressCallback && progressCallback(10, 'Preparing image...');
      
      // Enhance image before OCR
      const enhancedImage = await this.enhanceImageForOCR(imageFile);
      progressCallback && progressCallback(30, 'Analyzing image...');
      
      const result = await Tesseract.recognize(enhancedImage, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const progress = 30 + (m.progress * 60); // 30-90%
            progressCallback && progressCallback(Math.round(progress), 'Reading text...');
          }
        },
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/., ',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO
      });
      
      progressCallback && progressCallback(95, 'Processing data...');
      
      const text = result.data.text;
      console.log('OCR Raw Text:', text);
      console.log('OCR Confidence:', result.data.confidence);
      
      // Parse license data using enhanced patterns
      const licenseData = this.parsePhilippineLicense(text);
      
      console.log('Extracted License Data:', licenseData);
      
      progressCallback && progressCallback(100, 'Complete!');
      
      // Validate extracted data
      const validationResult = this.validateExtractedData(licenseData);
      
      return {
        success: validationResult.isValid,
        data: licenseData,
        confidence: result.data.confidence,
        rawText: text,
        validationErrors: validationResult.errors
      };
    } catch (error) {
      console.error('OCR Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async enhanceImageForOCR(imageFile) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = function() {
        // Set canvas dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Enhance contrast and brightness
        for (let i = 0; i < data.length; i += 4) {
          // Increase contrast
          data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.5 + 128));     // Red
          data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.5 + 128)); // Green
          data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.5 + 128)); // Blue
          
          // Convert to grayscale for better OCR
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = data[i + 1] = data[i + 2] = gray > 128 ? 255 : 0; // Threshold
        }
        
        // Put enhanced image data back
        ctx.putImageData(imageData, 0, 0);
        
        // Convert to blob and resolve
        canvas.toBlob(resolve, 'image/png');
      };
      
      img.src = URL.createObjectURL(imageFile);
    });
  }

  static parsePhilippineLicense(text) {
    // Clean and normalize text
    const cleanText = text.replace(/[^\w\s\-\/.,]/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('Clean text for parsing:', cleanText);
    
    return {
      license_number: this.extractLicenseNumber(cleanText),
      last_name: this.extractLastName(cleanText),
      first_name: this.extractFirstName(cleanText),
      middle_name: this.extractMiddleName(cleanText),
      date_of_birth: this.extractDateOfBirth(cleanText),
      address: this.extractAddress(cleanText),
      gender: this.extractGender(cleanText)
    };
  }

  static validateExtractedData(data) {
    const errors = [];
    
    // Validate license number format
    if (!data.license_number || data.license_number.length < 8) {
      errors.push('Invalid license number format');
    }
    
    // Validate names
    if (!data.last_name || data.last_name.length < 2) {
      errors.push('Last name too short or missing');
    }
    
    if (!data.first_name || data.first_name.length < 2) {
      errors.push('First name too short or missing');
    }
    
    // Validate date format
    if (data.date_of_birth && !data.date_of_birth.match(/^\d{4}-\d{2}-\d{2}$/)) {
      errors.push('Invalid date format');
    }
    
    return {
      isValid: errors.length === 0 || errors.length <= 2, // Allow some errors
      errors
    };
  }

  static extractLicenseNumber(text) {
    // Enhanced patterns for Philippine driver's license numbers
    const patterns = [
      // Standard Philippine format: A00-00-000000
      /([A-Z]\d{2}-\d{2}-\d{6})/g,
      // Alternative formats
      /LICENSE\s*NO\.?\s*:?\s*([A-Z0-9\-]{8,15})/gi,
      /LIC\.?\s*NO\.?\s*:?\s*([A-Z0-9\-]{8,15})/gi,
      /NO\.?\s*([A-Z]\d{2}-\d{2}-\d{6})/gi,
      // Any sequence that looks like license format
      /([A-Z]\d{2}\s*-?\s*\d{2}\s*-?\s*\d{6})/gi,
      // Backup patterns
      /([A-Z0-9]{3,4}[-\s]\d{2}[-\s]\d{6})/gi
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const cleaned = match.replace(/[^A-Z0-9\-]/g, '');
          if (cleaned.length >= 8) {
            console.log('Found license number:', cleaned);
            return cleaned;
          }
        }
      }
    }
    return '';
  }

  static extractLastName(text) {
    // Enhanced patterns for Philippine names
    const patterns = [
      // Direct patterns
      /SURNAME\s*:?\s*([A-Z][A-Z\s]{2,30})/gi,
      /LAST\s*NAME\s*:?\s*([A-Z][A-Z\s]{2,30})/gi,
      /APELYIDO\s*:?\s*([A-Z][A-Z\s]{2,30})/gi,
      // Pattern before comma (common in Filipino names)
      /^([A-Z][A-Z\s]{2,30})\s*,/gmi,
      // After specific keywords
      /4b?\s*([A-Z][A-Z\s]{2,30})/gi,
      /RESTRICTION\s*CODE[^A-Z]*([A-Z][A-Z\s]{2,30})/gi
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 2 && name.length < 30) {
          console.log('Found last name:', name);
          return name;
        }
      }
    }
    return '';
  }

  static extractFirstName(text) {
    // Enhanced patterns for Philippine first names
    const patterns = [
      /FIRST\s*NAME\s*:?\s*([A-Z][A-Z\s]{2,30})/gi,
      /GIVEN\s*NAME\s*:?\s*([A-Z][A-Z\s]{2,30})/gi,
      /PANGALAN\s*:?\s*([A-Z][A-Z\s]{2,30})/gi,
      // After comma (Filipino name format: LASTNAME, FIRSTNAME)
      /,\s*([A-Z][A-Z\s]{2,30})/gi,
      // Between numbers and letters
      /\d+[A-Z]*\s+([A-Z][A-Z\s]{2,25})\s+[A-Z]/gi
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 2 && name.length < 30 && !name.includes('MALE') && !name.includes('FEMALE')) {
          console.log('Found first name:', name);
          return name;
        }
      }
    }
    return '';
  }

  static extractMiddleName(text) {
    const patterns = [
      /MIDDLE\s*NAME\s*:?\s*([A-Z][A-Z\s]{1,20})/gi,
      /M\.?I\.?\s*([A-Z][A-Z\s]{1,20})/gi,
      // Between two names pattern
      /([A-Z]+)\s+([A-Z])\s+([A-Z]+)/gi
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length >= 1 && name.length < 20) {
          console.log('Found middle name:', name);
          return name;
        }
      }
    }
    return '';
  }

  static extractDateOfBirth(text) {
    // Enhanced date patterns for Philippine format
    const patterns = [
      // MM/DD/YYYY format
      /DOB\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      /BIRTH\s*DATE\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      /DATE\s*OF\s*BIRTH\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      // DD/MM/YYYY format
      /(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      // MM-DD-YYYY format
      /(\d{1,2}-\d{1,2}-\d{4})/gi,
      // YYYY format (just year)
      /19\d{2}|20\d{2}/gi
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[0]) {
        const dateStr = match[0];
        try {
          // Try to parse and convert to YYYY-MM-DD format
          if (dateStr.includes('/') || dateStr.includes('-')) {
            const separator = dateStr.includes('/') ? '/' : '-';
            const parts = dateStr.split(separator);
            if (parts.length === 3) {
              const [part1, part2, part3] = parts;
              // Assume MM/DD/YYYY format for now
              const year = part3.length === 4 ? part3 : `20${part3}`;
              const month = part1.padStart(2, '0');
              const day = part2.padStart(2, '0');
              const formatted = `${year}-${month}-${day}`;
              console.log('Found date of birth:', formatted);
              return formatted;
            }
          }
        } catch (error) {
          console.error('Date parsing error:', error);
        }
      }
    }
    return '';
  }

  static extractAddress(text) {
    // Enhanced address patterns for Philippine addresses
    const patterns = [
      /ADDRESS\s*:?\s*([A-Z0-9\s,.#\-]{10,100})/gi,
      /TIRAHAN\s*:?\s*([A-Z0-9\s,.#\-]{10,100})/gi,
      // Look for common Philippine address patterns
      /([A-Z0-9\s,.#\-]*(?:STREET|ST|AVENUE|AVE|ROAD|RD|BARANGAY|BRGY|CITY|PROVINCE)[A-Z0-9\s,.#\-]*)/gi,
      // Multi-line address
      /\d+\s+[A-Z][A-Z0-9\s,.#\-]{10,80}/gi
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const address = match[1].trim();
        if (address.length > 10 && address.length < 100) {
          console.log('Found address:', address);
          return address;
        }
      }
    }
    return '';
  }

  static extractGender(text) {
    // Enhanced gender detection
    const malePatterns = /\b(MALE|M|LALAKI)\b/gi;
    const femalePatterns = /\b(FEMALE|F|BABAE)\b/gi;
    
    const maleMatch = text.match(malePatterns);
    const femaleMatch = text.match(femalePatterns);
    
    if (maleMatch) {
      console.log('Found gender: male');
      return 'male';
    }
    if (femaleMatch) {
      console.log('Found gender: female');
      return 'female';
    }
    return '';
  }
}

// Barcode Generator
class BarcodeGenerator {
  static generateBarcode(text) {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: 2,
      height: 100,
      displayValue: true
    });
    return canvas.toDataURL();
  }

  static generatePDF(plateNumber, barcodeData, expiresAt) {
    const pdf = new jsPDF();
    
    // Add header
    pdf.setFontSize(16);
    pdf.text('DA Vehicle Gate Pass System', 20, 20);
    pdf.setFontSize(12);
    pdf.text('Department of Agriculture Region V', 20, 30);
    
    // Add vehicle info
    pdf.setFontSize(14);
    pdf.text(`Plate Number: ${plateNumber}`, 20, 50);
    pdf.text(`Expires: ${new Date(expiresAt).toLocaleDateString()}`, 20, 60);
    
    // Generate barcode
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, barcodeData, {
      format: 'CODE128',
      width: 3,
      height: 80,
      displayValue: true
    });
    
    // Add barcode to PDF
    const barcodeImage = canvas.toDataURL();
    pdf.addImage(barcodeImage, 'PNG', 20, 70, 150, 40);
    
    // Add footer
    pdf.setFontSize(10);
    pdf.text('Generated by DA Vehicle Gate Pass System', 20, 120);
    
    return pdf;
  }
}

// Auth Context with offline support
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    initializeAuth();
    PWAManager.registerServiceWorker();
    PWAManager.setupOnlineStatusListener(setIsOnline);
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
    <AuthContext.Provider value={{ user, login, logout, loading, isOnline }}>
      {children}
    </AuthContext.Provider>
  );
};

// Offline Status Component
const OfflineStatus = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 text-center z-50">
      <div className="flex items-center justify-center space-x-2">
        <WifiOff className="w-4 h-4" />
        <span>You are offline. Data will sync when connection is restored.</span>
      </div>
    </div>
  );
};

// Mobile Registration Component
const MobileRegistration = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [licensePhoto, setLicensePhoto] = useState(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const { user, isOnline } = useAuth();
  const navigate = useNavigate();

  // Form data
  const [formData, setFormData] = useState({
    // Vehicle info
    plate_number: '',
    vehicle_type: 'private',
    purpose_of_visit: '',
    department_visiting: '',
    visit_duration: '8_hours',
    
    // Driver license info
    driver_license: {
      license_number: '',
      last_name: '',
      first_name: '',
      middle_name: '',
      gender: 'male',
      date_of_birth: '',
      address: ''
    }
  });

  const [message, setMessage] = useState('');
  const [registrationResult, setRegistrationResult] = useState(null);
  const [ocrDebugText, setOcrDebugText] = useState('');
  const [showOcrDebug, setShowOcrDebug] = useState(false);

  const handleCameraCapture = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setLicensePhoto(file);
      setOcrProcessing(true);
      setOcrProgress(0);

      try {
        const result = await OCRService.extractLicenseData(file, (progress, status) => {
          setOcrProgress(progress);
          setMessage({ type: 'info', text: status });
        });
        
        console.log('OCR Result:', result);
        
        if (result.success) {
          // Show preview of extracted data before proceeding
          setFormData(prev => ({
            ...prev,
            driver_license: {
              ...prev.driver_license,
              ...result.data
            }
          }));
          
          // Show what was extracted
          const extractedFields = Object.entries(result.data)
            .filter(([key, value]) => value && value.trim().length > 0)
            .map(([key, value]) => `${key.replace('_', ' ')}: ${value}`)
            .join(', ');
          
          if (extractedFields) {
            setMessage({ 
              type: 'success', 
              text: `OCR extracted: ${extractedFields}. Please verify and edit in the next step.` 
            });
          } else {
            setMessage({ 
              type: 'warning', 
              text: 'OCR completed but no clear data found. You can input manually in the next step.' 
            });
          }
          
          setTimeout(() => setStep(2), 2000);
        } else {
          setMessage({ 
            type: 'error', 
            text: `OCR failed: ${result.error || 'Unable to read license clearly'}. You can try again or input manually.` 
          });
        }
        
        // Store raw OCR text for debugging
        if (result.rawText) {
          setOcrDebugText(result.rawText);
          console.log('Raw OCR Text for debugging:', result.rawText);
        }
        
      } catch (error) {
        console.error('OCR processing error:', error);
        setMessage({ 
          type: 'error', 
          text: 'Error processing image. Please try again with better lighting or input manually.' 
        });
      } finally {
        setOcrProcessing(false);
      }
    }
  };

  const handleRetryOCR = () => {
    if (retryCount < 2) {
      setRetryCount(prev => prev + 1);
      // Trigger file input again
      document.getElementById('license-camera').click();
    } else {
      setMessage({ 
        type: 'info', 
        text: 'Please input the information manually.' 
      });
      setStep(2);
    }
  };

  const handleFormSubmit = async () => {
    if (!formData.plate_number || !formData.driver_license.license_number) {
      setMessage({ type: 'error', text: 'Please fill in required fields.' });
      return;
    }

    setLoading(true);
    
    try {
      console.log('Starting registration submission...');
      
      // Convert license photo to base64
      let licensePhotoBase64 = null;
      if (licensePhoto) {
        console.log('Converting license photo to base64...');
        licensePhotoBase64 = await fileToBase64(licensePhoto);
      }

      const registrationData = {
        ...formData,
        plate_number: formData.plate_number.toUpperCase(),
        license_photo_base64: licensePhotoBase64
      };

      console.log('Registration data prepared:', {
        ...registrationData,
        license_photo_base64: licensePhotoBase64 ? '[BASE64_DATA]' : null
      });

      if (isOnline) {
        console.log('Submitting registration to server...');
        const response = await axios.post(`${API}/visitor-registration`, registrationData);
        console.log('Registration response:', response.data);
        
        setRegistrationResult(response.data);
        setMessage({ type: 'success', text: 'Visitor registered successfully!' });
        setStep(4);
      } else {
        console.log('Storing registration offline...');
        await OfflineStorageManager.storeOfflineData('/visitor-registration', registrationData);
        setMessage({ 
          type: 'success', 
          text: 'Registration stored offline. Will sync when online.' 
        });
        setStep(4);
      }
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Error response:', error.response?.data);
      
      if (!isOnline) {
        console.log('Network error - storing offline...');
        await OfflineStorageManager.storeOfflineData('/visitor-registration', registrationData);
        setMessage({ 
          type: 'success', 
          text: 'Registration stored offline. Will sync when online.' 
        });
        setStep(4);
      } else {
        // Check if it's actually a success (status 200/201) but with error message
        if (error.response && (error.response.status === 200 || error.response.status === 201)) {
          console.log('Registration actually succeeded despite error');
          setRegistrationResult(error.response.data);
          setMessage({ type: 'success', text: 'Visitor registered successfully!' });
          setStep(4);
        } else {
          const errorMessage = error.response?.data?.detail || error.message || 'Registration failed';
          console.error('Registration failed with error:', errorMessage);
          setMessage({ 
            type: 'error', 
            text: `Registration failed: ${errorMessage}` 
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const downloadBarcode = () => {
    if (registrationResult) {
      const pdf = BarcodeGenerator.generatePDF(
        registrationResult.plate_number,
        registrationResult.barcode_data,
        registrationResult.expires_at
      );
      pdf.save(`${registrationResult.plate_number}_barcode.pdf`);
    }
  };

  // Step 1: Camera Capture
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-6">
              <img src={DA_LOGO_URL} alt="DA Logo" className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900">Visitor Registration</h2>
              <p className="text-gray-600">Step 1: Capture Driver's License</p>
            </div>

            {!ocrProcessing ? (
              <div className="space-y-4">
                {/* Photo Tips */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-800 mb-2">📷 Photo Tips for Best Results</h3>
                  <ul className="text-blue-700 text-sm space-y-1">
                    <li>• Ensure good lighting (avoid shadows)</li>
                    <li>• Hold phone steady and close to license</li>
                    <li>• Make sure all text is clearly visible</li>
                    <li>• Avoid glare or reflections</li>
                    <li>• Keep license flat and straight</li>
                  </ul>
                </div>

                {/* Photo Preview */}
                {licensePhoto && (
                  <div className="border-2 border-green-300 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-green-800 mb-2">📸 Captured Photo</h3>
                    <img 
                      src={URL.createObjectURL(licensePhoto)} 
                      alt="License Preview" 
                      className="w-full max-h-48 object-contain rounded border"
                    />
                    <Button
                      onClick={() => {
                        setLicensePhoto(null);
                        setMessage('');
                      }}
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                    >
                      Take New Photo
                    </Button>
                  </div>
                )}

                <div className="border-2 border-dashed border-green-300 rounded-lg p-8 text-center">
                  <Camera className="w-16 h-16 mx-auto text-green-600 mb-4" />
                  <p className="text-gray-600 mb-4">
                    {licensePhoto ? 'Retake photo if needed' : 'Take a clear photo of the driver\'s license'}
                  </p>
                  <input
                    id="license-camera"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                  />
                  <Button
                    onClick={() => document.getElementById('license-camera').click()}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    {licensePhoto ? 'Retake Photo' : 'Capture License Photo'}
                  </Button>
                </div>
                
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="w-full"
                >
                  Skip & Enter Manually
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <RefreshCw className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Processing license image...</p>
                  <Progress value={ocrProgress} className="w-full" />
                  <p className="text-sm text-gray-500 mt-2">{ocrProgress}% complete</p>
                </div>
              </div>
            )}

            {message && (
              <Alert className={`mt-4 ${
                message.type === 'error' ? 'border-red-200' : 
                message.type === 'warning' ? 'border-orange-200' : 
                'border-green-200'
              }`}>
                <AlertDescription className={
                  message.type === 'error' ? 'text-red-700' : 
                  message.type === 'warning' ? 'text-orange-700' : 
                  'text-green-700'
                }>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            {/* OCR Debug Panel */}
            {ocrDebugText && (
              <div className="mt-4">
                <Button
                  onClick={() => setShowOcrDebug(!showOcrDebug)}
                  variant="outline"
                  size="sm"
                  className="w-full mb-2"
                >
                  {showOcrDebug ? 'Hide' : 'Show'} What OCR Read
                </Button>
                
                {showOcrDebug && (
                  <div className="bg-gray-100 border rounded-lg p-3 text-xs">
                    <Label className="text-gray-600 font-medium">Raw OCR Text:</Label>
                    <pre className="mt-1 whitespace-pre-wrap text-gray-800 max-h-32 overflow-y-auto">
                      {ocrDebugText}
                    </pre>
                    <p className="mt-2 text-gray-500 text-xs">
                      This shows exactly what the OCR detected. Use this to manually input correct information.
                    </p>
                  </div>
                )}
              </div>
            )}

            {message?.type === 'error' && retryCount < 2 && (
              <Button
                onClick={handleRetryOCR}
                variant="outline"
                className="w-full mt-4"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Photo ({2 - retryCount} attempts left)
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Driver License Information
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-6">
              <img src={DA_LOGO_URL} alt="DA Logo" className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900">Driver Information</h2>
              <p className="text-gray-600">Step 2: Verify/Edit License Data</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>License Number *</Label>
                <Input
                  value={formData.driver_license.license_number}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    driver_license: { ...prev.driver_license, license_number: e.target.value }
                  }))}
                  placeholder="License Number"
                  className="text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Last Name *</Label>
                  <Input
                    value={formData.driver_license.last_name}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      driver_license: { ...prev.driver_license, last_name: e.target.value }
                    }))}
                    placeholder="Last Name"
                  />
                </div>
                <div>
                  <Label>First Name *</Label>
                  <Input
                    value={formData.driver_license.first_name}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      driver_license: { ...prev.driver_license, first_name: e.target.value }
                    }))}
                    placeholder="First Name"
                  />
                </div>
              </div>

              <div>
                <Label>Middle Name</Label>
                <Input
                  value={formData.driver_license.middle_name}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    driver_license: { ...prev.driver_license, middle_name: e.target.value }
                  }))}
                  placeholder="Middle Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gender</Label>
                  <Select 
                    value={formData.driver_license.gender} 
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      driver_license: { ...prev.driver_license, gender: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.driver_license.date_of_birth}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      driver_license: { ...prev.driver_license, date_of_birth: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div>
                <Label>Address</Label>
                <Textarea
                  value={formData.driver_license.address}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    driver_license: { ...prev.driver_license, address: e.target.value }
                  }))}
                  placeholder="Complete Address"
                  rows={2}
                />
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Vehicle Information
  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-6">
              <img src={DA_LOGO_URL} alt="DA Logo" className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900">Vehicle Information</h2>
              <p className="text-gray-600">Step 3: Vehicle & Visit Details</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Plate Number *</Label>
                <Input
                  value={formData.plate_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, plate_number: e.target.value }))}
                  placeholder="ABC-1234"
                  className="text-lg font-mono"
                />
              </div>

              <div>
                <Label>Vehicle Type</Label>
                <Select 
                  value={formData.vehicle_type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, vehicle_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private Vehicle</SelectItem>
                    <SelectItem value="company">DA Government Vehicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Purpose of Visit *</Label>
                <Textarea
                  value={formData.purpose_of_visit}
                  onChange={(e) => setFormData(prev => ({ ...prev, purpose_of_visit: e.target.value }))}
                  placeholder="Meeting, delivery, inspection, etc."
                  rows={2}
                />
              </div>

              <div>
                <Label>Department/Person Visiting</Label>
                <Input
                  value={formData.department_visiting}
                  onChange={(e) => setFormData(prev => ({ ...prev, department_visiting: e.target.value }))}
                  placeholder="Field Operations, Admin, etc."
                />
              </div>

              <div>
                <Label>Visit Duration</Label>
                <Select 
                  value={formData.visit_duration} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, visit_duration: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2_hours">2 Hours</SelectItem>
                    <SelectItem value="4_hours">4 Hours</SelectItem>
                    <SelectItem value="8_hours">8 Hours</SelectItem>
                    <SelectItem value="1_day">1 Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleFormSubmit}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Registering...' : 'Register'}
                </Button>
              </div>
            </div>

            {message && (
              <Alert className={`mt-4 ${message.type === 'error' ? 'border-red-200' : 'border-green-200'}`}>
                <AlertDescription className={message.type === 'error' ? 'text-red-700' : 'text-green-700'}>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Success & Barcode
  if (step === 4) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900">Registration Complete!</h2>
              <p className="text-gray-600">Visitor successfully registered</p>
            </div>

            {registrationResult && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800">Registration Details</h3>
                  <p className="text-green-700">Plate: {registrationResult.plate_number}</p>
                  <p className="text-green-700">
                    Valid until: {new Date(registrationResult.expires_at).toLocaleString()}
                  </p>
                </div>

                <div className="text-center">
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-4 mb-4">
                    <canvas 
                      ref={(canvas) => {
                        if (canvas && registrationResult.barcode_data) {
                          JsBarcode(canvas, registrationResult.barcode_data, {
                            format: 'CODE128',
                            width: 2,
                            height: 60,
                            displayValue: true
                          });
                        }
                      }}
                    />
                  </div>
                  
                  <Button
                    onClick={downloadBarcode}
                    className="w-full bg-green-600 hover:bg-green-700 mb-3"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Barcode PDF
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3 mt-6">
              <Button
                onClick={() => {
                  setStep(1);
                  setFormData({
                    plate_number: '',
                    vehicle_type: 'private',
                    purpose_of_visit: '',
                    department_visiting: '',
                    visit_duration: '8_hours',
                    driver_license: {
                      license_number: '',
                      last_name: '',
                      first_name: '',
                      middle_name: '',
                      gender: 'male',
                      date_of_birth: '',
                      address: ''
                    }
                  });
                  setLicensePhoto(null);
                  setMessage('');
                  setRegistrationResult(null);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Register Another Visitor
              </Button>
              
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Login Component (updated for mobile)
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isOnline } = useAuth();

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
      <OfflineStatus isOnline={isOnline} />
      
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-20 h-20 mb-6 flex items-center justify-center">
            <img 
              src={DA_LOGO_URL} 
              alt="Department of Agriculture Region V"
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
          
          {!isOnline && (
            <div className="mt-4 flex items-center justify-center space-x-2 text-orange-600">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm">Offline Mode</span>
            </div>
          )}
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
                className="mt-1 text-lg"
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
                className="mt-1 text-lg"
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
              className="w-full bg-green-600 hover:bg-green-700 text-lg py-3" 
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
              <LogIn className="w-5 h-5 ml-2" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Enhanced Guard Interface with Mobile Registration
const GuardInterface = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [scanMethod, setScanMethod] = useState('scanner');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);
  const { user, isOnline } = useAuth();
  const navigate = useNavigate();

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
      if (error.response?.status === 404) {
        setMessage({
          type: 'error',
          text: 'Vehicle not found. Would you like to register this visitor?',
          showRegisterButton: true
        });
      } else {
        setMessage({
          type: 'error',
          text: error.response?.data?.detail || 'Scan failed'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const isMobile = window.innerWidth <= 768;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <OfflineStatus isOnline={isOnline} />
      
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
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
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Guard Station</h1>
                <p className="text-gray-600">Welcome, {user?.username}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isOnline && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Offline
                </Badge>
              )}
              <Badge variant="secondary" className="px-3 py-1 bg-green-100 text-green-800">
                <Shield className="w-4 h-4 mr-1" />
                Guard Access
              </Badge>
            </div>
          </div>

          {/* Mobile Registration Button - Prominent on Mobile */}
          <div className="mb-6">
            <Button
              onClick={() => navigate('/register')}
              className={`bg-blue-600 hover:bg-blue-700 ${isMobile ? 'w-full text-lg py-4' : 'mb-4'}`}
              size={isMobile ? "lg" : "default"}
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Register New Visitor
            </Button>
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
                      className={`font-mono ${isMobile ? 'text-lg py-3' : 'text-lg'} mt-1`}
                      required
                    />
                  </div>
                  <div>
                    <Label>Scan Method</Label>
                    <Select value={scanMethod} onValueChange={setScanMethod}>
                      <SelectTrigger className={isMobile ? 'py-3 mt-1' : 'mt-1'}>
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
                  className={`bg-green-600 hover:bg-green-700 ${isMobile ? 'w-full text-lg py-3' : 'w-full md:w-auto'}`}
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
                      {message.showRegisterButton && (
                        <div className="mt-3">
                          <Button
                            onClick={() => navigate('/register')}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Register Visitor
                          </Button>
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
                      {log.registration_type === 'visitor' && (
                        <Badge variant="outline" className="text-xs">VISITOR</Badge>
                      )}
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

// Visitor Detail Modal Component
const VisitorDetailModal = ({ visitor, isOpen, onClose }) => {
  if (!visitor) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-green-700 flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Visitor Details - {visitor.plate_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Vehicle Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-600">Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Plate Number</Label>
                <p className="text-lg font-mono font-bold">{visitor.plate_number}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Vehicle Type</Label>
                <Badge variant="outline" className="ml-2">
                  {visitor.vehicle_type.toUpperCase()}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Purpose of Visit</Label>
                <p className="text-sm">{visitor.purpose_of_visit}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Department Visiting</Label>
                <p className="text-sm">{visitor.department_visiting || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Driver Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-600">Driver Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Full Name</Label>
                    <p className="font-semibold">
                      {visitor.driver_license.first_name} 
                      {visitor.driver_license.middle_name && ` ${visitor.driver_license.middle_name}`} 
                      {visitor.driver_license.last_name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 flex items-center">
                      <CreditCard className="w-4 h-4 mr-1" />
                      License Number
                    </Label>
                    <p className="font-mono text-sm">{visitor.driver_license.license_number}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Gender</Label>
                      <p className="capitalize">{visitor.driver_license.gender}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600 flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Date of Birth
                      </Label>
                      <p className="text-sm">{visitor.driver_license.date_of_birth || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      Address
                    </Label>
                    <p className="text-sm">{visitor.driver_license.address}</p>
                  </div>
                </div>

                {/* License Photo */}
                <div>
                  <Label className="text-sm font-medium text-gray-600">Driver's License Photo</Label>
                  <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {visitor.driver_license.license_photo_path ? (
                      <div className="text-center">
                        <img 
                          src={`${BACKEND_URL}/uploads/${visitor.driver_license.license_photo_path.split('/').pop()}`}
                          alt="Driver's License"
                          className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                        <div className="hidden text-gray-500">
                          <Camera className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-sm">License photo not available</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">
                        <Camera className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm">No license photo captured</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visit Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-600">Visit Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Visit Duration</Label>
                <Badge variant="outline" className="ml-2">
                  {visitor.visit_duration.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Registration Date</Label>
                <p className="text-sm">{formatDate(visitor.created_at)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Expires At</Label>
                <p className="text-sm font-medium text-orange-600">{formatDate(visitor.expires_at)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Status</Label>
                <Badge variant={new Date(visitor.expires_at) > new Date() ? 'default' : 'destructive'} className="ml-2">
                  {new Date(visitor.expires_at) > new Date() ? 'ACTIVE' : 'EXPIRED'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Barcode Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-600">Access Barcode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4 mb-4 inline-block">
                  <canvas 
                    ref={(canvas) => {
                      if (canvas && visitor.barcode_data) {
                        JsBarcode(canvas, visitor.barcode_data, {
                          format: 'CODE128',
                          width: 2,
                          height: 60,
                          displayValue: true,
                          fontSize: 12
                        });
                      }
                    }}
                  />
                </div>
                <p className="text-sm text-gray-600">Barcode Data: {visitor.barcode_data}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="flex justify-end space-x-2 mt-6">
          <Button
            onClick={() => {
              const pdf = BarcodeGenerator.generatePDF(
                visitor.plate_number,
                visitor.barcode_data,
                visitor.expires_at
              );
              pdf.save(`${visitor.plate_number}_visitor_pass.pdf`);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Pass
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Admin Dashboard with visitor management
const AdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [vehicles, setVehicles] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState([]);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    plate_number: '',
    vehicle_type: 'company',
    owner_name: '',
    department: ''
  });
  const { user, isOnline } = useAuth();

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

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
      <OfflineStatus isOnline={isOnline} />
      
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

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="border-green-200">
            <CardContent className="p-4">
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
          <Card className="border-blue-200">
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
          <Card className="border-teal-200">
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
          <Card className="border-red-200">
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

// Database Viewer Component
const DatabaseViewer = () => {
  const [collections, setCollections] = useState({});
  const [selectedCollection, setSelectedCollection] = useState('users');
  const [documents, setDocuments] = useState([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [editingDoc, setEditingDoc] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      fetchDocuments();
    }
  }, [selectedCollection, page]);

  const fetchCollections = async () => {
    try {
      const response = await axios.get(`${API}/database/collections`);
      setCollections(response.data);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/database/${selectedCollection}?skip=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`);
      setDocuments(response.data.documents);
      setTotalDocs(response.data.total);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (doc) => {
    setEditingDoc({ ...doc });
    setIsEditModalOpen(true);
  };

  const handleSave = async () => {
    try {
      await axios.put(`${API}/database/${selectedCollection}/${editingDoc.id}`, editingDoc);
      setIsEditModalOpen(false);
      setEditingDoc(null);
      fetchDocuments();
      alert('Document updated successfully!');
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Error updating document: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  const handleDelete = async (docId) => {
    if (deleteConfirm === docId) {
      try {
        await axios.delete(`${API}/database/${selectedCollection}/${docId}`);
        fetchDocuments();
        setDeleteConfirm(null);
        alert('Document deleted successfully!');
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Error deleting document: ' + (error.response?.data?.detail || 'Unknown error'));
      }
    } else {
      setDeleteConfirm(docId);
      setTimeout(() => setDeleteConfirm(null), 3000); // Reset after 3 seconds
    }
  };

  const renderValue = (value, key) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'object') {
      if (value instanceof Date || typeof value === 'string' && value.includes('ISODate')) {
        return new Date(value).toLocaleString();
      }
      return JSON.stringify(value, null, 2);
    }
    if (key === 'password') return '••••••••';
    return value.toString();
  };

  const renderEditField = (key, value) => {
    if (key === '_id' || key === 'id') {
      return (
        <Input
          value={value || ''}
          disabled
          className="bg-gray-100"
        />
      );
    }

    if (key === 'password') {
      return (
        <Input
          type="password"
          placeholder="Enter new password (leave blank to keep current)"
          value=""
          onChange={(e) => {
            if (e.target.value) {
              setEditingDoc(prev => ({ ...prev, [key]: e.target.value }));
            }
          }}
        />
      );
    }

    if (typeof value === 'boolean') {
      return (
        <Select 
          value={value.toString()} 
          onValueChange={(val) => setEditingDoc(prev => ({ ...prev, [key]: val === 'true' }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (typeof value === 'object') {
      return (
        <Textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setEditingDoc(prev => ({ ...prev, [key]: parsed }));
            } catch (err) {
              // Handle JSON parsing error
            }
          }}
          rows={5}
          className="font-mono text-xs"
        />
      );
    }

    return (
      <Input
        value={value || ''}
        onChange={(e) => setEditingDoc(prev => ({ ...prev, [key]: e.target.value }))}
      />
    );
  };

  const filteredDocuments = documents.filter(doc => {
    if (!searchTerm) return true;
    return JSON.stringify(doc).toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Database className="w-6 h-6 text-green-600" />
          <div>
            <h2 className="text-2xl font-bold text-green-700">Database Viewer</h2>
            <p className="text-gray-600">View, edit, and manage database collections</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
        </div>
      </div>

      {/* Collections Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.values(collections).map(collection => (
          <Card 
            key={collection.name}
            className={`cursor-pointer transition-colors ${selectedCollection === collection.name ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50'}`}
            onClick={() => {
              setSelectedCollection(collection.name);
              setPage(0);
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold capitalize">{collection.name.replace('_', ' ')}</h3>
                  <p className="text-sm text-gray-600">{collection.count} documents</p>
                </div>
                <Database className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Document Table */}
      {selectedCollection && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="capitalize text-green-700">
                {selectedCollection.replace('_', ' ')} Collection
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{totalDocs} total documents</Badge>
                <Button size="sm" onClick={fetchDocuments}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                <p>Loading documents...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2 text-left">ID</th>
                        {filteredDocuments[0] && Object.keys(filteredDocuments[0])
                          .filter(key => key !== '_id' && key !== 'id')
                          .slice(0, 5)
                          .map(key => (
                            <th key={key} className="border border-gray-200 px-4 py-2 text-left capitalize">
                              {key.replace('_', ' ')}
                            </th>
                          ))}
                        <th className="border border-gray-200 px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocuments.map(doc => (
                        <tr key={doc._id} className="hover:bg-gray-50">
                          <td className="border border-gray-200 px-4 py-2 font-mono text-xs">
                            {doc.id?.substring(0, 8) || doc._id?.substring(0, 8)}...
                          </td>
                          {Object.keys(doc)
                            .filter(key => key !== '_id' && key !== 'id')
                            .slice(0, 5)
                            .map(key => (
                              <td key={key} className="border border-gray-200 px-4 py-2 max-w-xs">
                                <div className="truncate" title={renderValue(doc[key], key)}>
                                  {renderValue(doc[key], key)}
                                </div>
                              </td>
                            ))}
                          <td className="border border-gray-200 px-4 py-2">
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(doc)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={deleteConfirm === doc.id ? "destructive" : "outline"}
                                onClick={() => handleDelete(doc.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                                {deleteConfirm === doc.id && <span className="ml-1">Confirm?</span>}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, totalDocs)} of {totalDocs} documents
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <span className="px-3 py-1 bg-gray-100 rounded">
                      Page {page + 1} of {Math.ceil(totalDocs / PAGE_SIZE)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(page + 1) * PAGE_SIZE >= totalDocs}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-green-700 flex items-center">
              <Edit className="w-5 h-5 mr-2" />
              Edit {selectedCollection} Document
            </DialogTitle>
          </DialogHeader>
          
          {editingDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {Object.entries(editingDoc).map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-sm font-medium text-gray-600 capitalize">
                      {key.replace('_', ' ')}
                    </Label>
                    <div className="mt-1">
                      {renderEditField(key, value)}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingDoc(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="status">Vehicle Status</TabsTrigger>
            <TabsTrigger value="logs">Entry/Exit Logs</TabsTrigger>
            <TabsTrigger value="visitors">Visitors</TabsTrigger>
            <TabsTrigger value="vehicles">Manage Vehicles</TabsTrigger>
            <TabsTrigger value="add-vehicle">Add Vehicle</TabsTrigger>
            <TabsTrigger value="mobile">Mobile Tools</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Vehicles Currently Inside DA Region V Premises</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vehicleStatus.map((status) => (
                    <div key={status.plate_number} className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center space-x-4">
                        <Badge variant={status.is_overstaying ? 'destructive' : 'default'} className={!status.is_overstaying ? 'bg-green-600' : ''}>
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

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Permanent Vehicle Registrations</CardTitle>
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
                      <li>2. Tap the browser menu and select "Add to Home Screen"</li>
                      <li>3. The app will work like a native mobile app</li>
                      <li>4. Camera permissions will be requested for license scanning</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="database">
            <DatabaseViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Main App Component with routing
const AppContent = () => {
  const { user, logout, loading, isOnline } = useAuth();
  const location = useLocation();

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
          <p className="text-center text-gray-500 py-8">Loading DA Vehicle Gate Pass System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div>
      {/* Header - only show on main pages, not during registration */}
      {!location.pathname.includes('/register') && (
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
                  <h1 className="text-lg md:text-xl font-semibold text-gray-900">DA Vehicle Gate Pass System</h1>
                  <p className="text-xs text-gray-600">Department of Agriculture Region V</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 md:space-x-4">
                {!isOnline && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Offline
                  </Badge>
                )}
                <Badge variant="outline" className="border-green-200 text-green-700 text-xs">
                  {user.role.toUpperCase()}
                </Badge>
                <Button variant="outline" onClick={logout} className="border-green-200 text-green-700 hover:bg-green-50" size="sm">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main>
        <Routes>
          <Route path="/" element={user.role === 'admin' ? <AdminDashboard /> : <GuardInterface />} />
          <Route path="/register" element={<MobileRegistration />} />
        </Routes>
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