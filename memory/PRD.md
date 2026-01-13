# DA Vehicle Gate Pass System - Product Requirements Document
**Department of Agriculture Region V, Philippines**

## Overview
A web application that replaces a physical gate pass sticker system for employee vehicles using barcode scanning technology.

## Core Features

### 1. Authentication & Authorization
- **Admin Role**: Full access to dashboard, vehicle management, database viewer
- **Guard Role**: Access to scanner interface and visitor registration
- JWT-based authentication with secure password hashing (bcrypt)

### 2. Admin Dashboard
- Real-time statistics (today's activity, total vehicles, active visitors, inside count, overstaying alerts)
- **Tabs**:
  - Vehicle Status - shows vehicles currently inside premises
  - Entry/Exit Logs - recent scan history
  - Visitors - active visitor registrations with detail modal
  - Manage Vehicles - view all permanent vehicle registrations
  - Add Vehicle - form to add new permanent vehicles
  - Mobile Tools - PWA installation guide
  - Database - full CRUD database viewer

### 3. Guard Interface
- Mobile-responsive vehicle scanner
- Manual plate number input option
- Recent activity feed
- Quick access to visitor registration

### 4. Visitor Registration (PWA)
- 3-step wizard: License photo → Driver info → Vehicle info → Success
- OCR using Tesseract.js for driver's license
- Barcode generation (CODE128) with PDF download
- Offline support via IndexedDB

### 5. Database Viewer (Admin Only)
- View all collections (users, vehicles, visitor_registrations, entry_exit_logs)
- Document table with pagination (20 per page)
- Search functionality
- Edit documents with field-appropriate editors
- Delete with confirmation

## Technical Stack
- **Frontend**: React 18, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python 3.x)
- **Database**: MongoDB
- **Libraries**: Tesseract.js (OCR), JsBarcode, jsPDF

## Architecture (Refactored)
```
/app
├── backend/
│   └── server.py              # FastAPI app with routes, services, models
├── frontend/src/
│   ├── components/
│   │   ├── admin/             # AdminDashboard.js, DatabaseViewer.js
│   │   ├── auth/              # Login.js
│   │   ├── common/            # OfflineStatus.js, VisitorDetailModal.js
│   │   ├── guard/             # GuardInterface.js, MobileRegistration.js
│   │   └── ui/                # Shadcn components
│   ├── context/               # AuthContext.js
│   ├── services/              # constants.js, OCRService.js, BarcodeService.js, OfflineService.js
│   ├── App.js                 # Main routing
│   └── App.css                # Styles
└── tests/
    └── test_backend_api.py    # API test suite
```

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User authentication |
| `/api/auth/me` | GET | Get current user |
| `/api/dashboard-stats` | GET | Dashboard statistics |
| `/api/vehicle-status` | GET | Vehicles currently inside |
| `/api/vehicles` | GET/POST | Vehicle CRUD |
| `/api/visitors` | GET | Active visitors |
| `/api/visitor-registration` | POST | Register new visitor |
| `/api/logs` | GET | Entry/exit logs |
| `/api/scan` | POST | Process entry/exit |
| `/api/database/collections` | GET | List collections |
| `/api/database/{collection}` | GET | Get documents |
| `/api/database/{collection}/{id}` | PUT/DELETE | Update/delete doc |

## Test Credentials
- **Admin**: `admin` / `admin123`
- **Guard**: `guard1` / `guard123`

---

## What's Been Implemented (January 2026)

### ✅ Completed
1. Full authentication system with JWT
2. Admin dashboard with real-time stats
3. Guard interface with scanner
4. Visitor registration PWA wizard with OCR
5. Database viewer with full CRUD
6. Entry/exit logging with overstaying alerts
7. Barcode generation and PDF download
8. Offline support via IndexedDB
9. **Major Refactoring**: Split 3500+ line App.js into modular components

### ✅ Testing
- 21 backend API tests passing (pytest)
- Frontend integration tests passing
- All features verified working

---

## Backlog / Remaining Tasks

### P0 (Critical)
- None currently

### P1 (High Priority)
- [ ] **Improve OCR Accuracy**: Current Tesseract.js captures inconsistent results on Philippine driver's licenses. Consider server-side OCR or better preprocessing.
- [ ] **Recent Visitors Tab**: Add tab to show visitors who have exited with time filtering
- [ ] **Print Functionality**: Add print button for visitor passes (format TBD)

### P2 (Medium Priority)
- [ ] **Backend Refactoring**: Split server.py into `/routers`, `/models`, `/services`
- [ ] **Reports**: Add exportable reports (CSV/PDF) for entry/exit logs by date range

### P3 (Nice to Have)
- [ ] **Multi-language Support**: Add Filipino/Tagalog translations
- [ ] **Email Notifications**: Alert admins for overstaying vehicles
- [ ] **Vehicle Photo Capture**: Add option to photograph vehicles at entry
