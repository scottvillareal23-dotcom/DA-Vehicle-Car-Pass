from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import jwt
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
from abc import ABC, abstractmethod


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configuration Class
class Config:
    MONGO_URL = os.environ['MONGO_URL']
    DB_NAME = os.environ['DB_NAME']
    JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
    JWT_ALGORITHM = 'HS256'
    JWT_EXPIRATION_HOURS = 24
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')

# Database connection
client = AsyncIOMotorClient(Config.MONGO_URL)
db = client[Config.DB_NAME]

# Create the main app
app = FastAPI(
    title="DA Vehicle Gate Pass System",
    description="Department of Agriculture Philippines - Vehicle Gate Pass Management System",
    version="1.0.0"
)

# Create router
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    GUARD = "guard"

class VehicleType(str, Enum):
    PRIVATE = "private"
    COMPANY = "company"

class LogAction(str, Enum):
    ENTRY = "entry"
    EXIT = "exit"

# Base Model Classes
class BaseEntity(BaseModel):
    """Base entity with common fields"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TimestampMixin(BaseModel):
    """Mixin for timestamp fields"""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

# Database Models
class User(BaseEntity):
    username: str
    role: UserRole

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole

class UserLogin(BaseModel):
    username: str
    password: str

class Vehicle(BaseEntity):
    plate_number: str
    vehicle_type: VehicleType
    owner_name: str
    department: Optional[str] = None
    is_active: bool = True

class VehicleCreate(BaseModel):
    plate_number: str
    vehicle_type: VehicleType
    owner_name: str
    department: Optional[str] = None

class EntryExitLog(BaseEntity):
    plate_number: str
    action: LogAction
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    guard_username: str
    scan_method: str  # "scanner" or "manual"
    is_inside: bool  # True if vehicle is currently inside
    entry_time: Optional[datetime] = None  # For tracking duration
    exit_time: Optional[datetime] = None

class EntryExitLogCreate(BaseModel):
    plate_number: str
    action: LogAction
    scan_method: str = "scanner"

class ScanInput(BaseModel):
    plate_number: str
    scan_method: str = "scanner"

class VehicleStatus(BaseModel):
    plate_number: str
    is_inside: bool
    entry_time: Optional[datetime] = None
    duration_hours: Optional[float] = None
    is_overstaying: bool = False

# Service Classes (Business Logic Layer)
class PasswordService:
    """Service for password hashing and verification"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

class JWTService:
    """Service for JWT token operations"""
    
    @staticmethod
    def create_token(username: str, role: str) -> str:
        payload = {
            'username': username,
            'role': role,
            'exp': datetime.utcnow() + timedelta(hours=Config.JWT_EXPIRATION_HOURS)
        }
        return jwt.encode(payload, Config.JWT_SECRET, algorithm=Config.JWT_ALGORITHM)
    
    @staticmethod
    def decode_token(token: str) -> Dict:
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
            return {"success": True, "payload": payload}
        except jwt.ExpiredSignatureError:
            return {"success": False, "error": "Token expired"}
        except jwt.JWTError:
            return {"success": False, "error": "Invalid token"}

class DateTimeService:
    """Service for datetime operations"""
    
    @staticmethod
    def now_utc() -> datetime:
        return datetime.now(timezone.utc)
    
    @staticmethod
    def ensure_timezone_aware(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    
    @staticmethod
    def calculate_duration_hours(start_time: datetime, end_time: datetime) -> float:
        start_time = DateTimeService.ensure_timezone_aware(start_time)
        end_time = DateTimeService.ensure_timezone_aware(end_time)
        duration = end_time - start_time
        return duration.total_seconds() / 3600

# Repository Classes (Data Access Layer)
class BaseRepository(ABC):
    """Abstract base repository"""
    
    def __init__(self, collection_name: str):
        self.collection = db[collection_name]
    
    @abstractmethod
    async def create(self, data: dict) -> dict:
        pass
    
    @abstractmethod
    async def find_by_id(self, entity_id: str) -> Optional[dict]:
        pass

class UserRepository(BaseRepository):
    """User data access layer"""
    
    def __init__(self):
        super().__init__("users")
    
    async def create(self, data: dict) -> dict:
        result = await self.collection.insert_one(data)
        return {"id": str(result.inserted_id), **data}
    
    async def find_by_id(self, entity_id: str) -> Optional[dict]:
        return await self.collection.find_one({"id": entity_id})
    
    async def find_by_username(self, username: str) -> Optional[dict]:
        return await self.collection.find_one({"username": username})

class VehicleRepository(BaseRepository):
    """Vehicle data access layer"""
    
    def __init__(self):
        super().__init__("vehicles")
    
    async def create(self, data: dict) -> dict:
        result = await self.collection.insert_one(data)
        return {"id": str(result.inserted_id), **data}
    
    async def find_by_id(self, entity_id: str) -> Optional[dict]:
        return await self.collection.find_one({"id": entity_id})
    
    async def find_by_plate_number(self, plate_number: str) -> Optional[dict]:
        return await self.collection.find_one({"plate_number": plate_number, "is_active": True})
    
    async def find_all_active(self) -> List[dict]:
        cursor = self.collection.find({"is_active": True})
        return await cursor.to_list(1000)

class EntryExitLogRepository(BaseRepository):
    """Entry/Exit log data access layer"""
    
    def __init__(self):
        super().__init__("entry_exit_logs")
    
    async def create(self, data: dict) -> dict:
        result = await self.collection.insert_one(data)
        return {"id": str(result.inserted_id), **data}
    
    async def find_by_id(self, entity_id: str) -> Optional[dict]:
        return await self.collection.find_one({"id": entity_id})
    
    async def find_latest_by_plate(self, plate_number: str) -> Optional[dict]:
        return await self.collection.find_one(
            {"plate_number": plate_number},
            sort=[("timestamp", -1)]
        )
    
    async def find_all(self, limit: int = 50, plate_number: Optional[str] = None) -> List[dict]:
        query = {}
        if plate_number:
            query["plate_number"] = plate_number
        
        cursor = self.collection.find(query).sort("timestamp", -1).limit(limit)
        return await cursor.to_list(limit)
    
    async def count_today(self) -> int:
        today = DateTimeService.now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        return await self.collection.count_documents({
            "timestamp": {"$gte": today, "$lt": tomorrow}
        })

# Service Classes (Business Logic)
class AuthService:
    """Authentication service"""
    
    def __init__(self):
        self.user_repo = UserRepository()
        self.password_service = PasswordService()
        self.jwt_service = JWTService()
    
    async def register_user(self, user_data: UserCreate) -> Dict:
        # Check if username exists
        existing_user = await self.user_repo.find_by_username(user_data.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Hash password and create user
        hashed_password = self.password_service.hash_password(user_data.password)
        user_obj = User(username=user_data.username, role=user_data.role)
        
        await self.user_repo.create({**user_obj.dict(), 'password': hashed_password})
        return {"message": "User created successfully", "user": user_obj}
    
    async def login_user(self, login_data: UserLogin) -> Dict:
        # Find user
        user = await self.user_repo.find_by_username(login_data.username)
        if not user or not self.password_service.verify_password(login_data.password, user['password']):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create token
        token = self.jwt_service.create_token(user['username'], user['role'])
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "username": user['username'],
                "role": user['role']
            }
        }

class VehicleService:
    """Vehicle management service"""
    
    def __init__(self):
        self.vehicle_repo = VehicleRepository()
    
    async def create_vehicle(self, vehicle_data: VehicleCreate) -> Vehicle:
        # Check if plate number exists
        existing_vehicle = await self.vehicle_repo.find_by_plate_number(vehicle_data.plate_number)
        if existing_vehicle:
            raise HTTPException(status_code=400, detail="Vehicle with this plate number already exists")
        
        vehicle_obj = Vehicle(**vehicle_data.dict())
        await self.vehicle_repo.create(vehicle_obj.dict())
        return vehicle_obj
    
    async def get_all_vehicles(self) -> List[Vehicle]:
        vehicles = await self.vehicle_repo.find_all_active()
        return [Vehicle(**vehicle) for vehicle in vehicles]
    
    async def get_vehicle_by_plate(self, plate_number: str) -> Vehicle:
        vehicle = await self.vehicle_repo.find_by_plate_number(plate_number)
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        return Vehicle(**vehicle)

class ScanService:
    """Vehicle scanning service"""
    
    def __init__(self):
        self.vehicle_repo = VehicleRepository()
        self.log_repo = EntryExitLogRepository()
        self.datetime_service = DateTimeService()
    
    async def process_scan(self, scan_data: ScanInput, guard_username: str) -> Dict:
        # Check if vehicle exists
        vehicle = await self.vehicle_repo.find_by_plate_number(scan_data.plate_number)
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found in system")
        
        # Get latest log for this vehicle
        latest_log = await self.log_repo.find_latest_by_plate(scan_data.plate_number)
        
        # Determine action (entry or exit)
        is_inside = latest_log['is_inside'] if latest_log else False
        action = LogAction.EXIT if is_inside else LogAction.ENTRY
        
        # Create log entry
        log_data = {
            "plate_number": scan_data.plate_number,
            "action": action,
            "scan_method": scan_data.scan_method,
            "guard_username": guard_username,
            "is_inside": not is_inside,
            "timestamp": self.datetime_service.now_utc()
        }
        
        if action == LogAction.ENTRY:
            log_data["entry_time"] = self.datetime_service.now_utc()
        else:
            log_data["exit_time"] = self.datetime_service.now_utc()
            if latest_log and latest_log.get('entry_time'):
                log_data["entry_time"] = latest_log['entry_time']
        
        log_obj = EntryExitLog(**log_data)
        await self.log_repo.create(log_obj.dict())
        
        # Check for overstaying (private vehicles only)
        overstaying_warning = None
        if vehicle['vehicle_type'] == VehicleType.PRIVATE and action == LogAction.ENTRY:
            overstaying_warning = "Timer started: 8 hours allowed for private vehicles"
        
        return {
            "message": f"Vehicle {action.value} recorded successfully",
            "action": action,
            "vehicle": Vehicle(**vehicle),
            "timestamp": log_obj.timestamp,
            "warning": overstaying_warning
        }

class DashboardService:
    """Dashboard and reporting service"""
    
    def __init__(self):
        self.vehicle_repo = VehicleRepository()
        self.log_repo = EntryExitLogRepository()
        self.datetime_service = DateTimeService()
    
    async def get_vehicle_status(self) -> List[VehicleStatus]:
        # Get all vehicles currently inside using aggregation
        pipeline = [
            {"$sort": {"timestamp": -1}},
            {"$group": {
                "_id": "$plate_number",
                "latest_log": {"$first": "$$ROOT"}
            }},
            {"$match": {"latest_log.is_inside": True}}
        ]
        
        inside_vehicles = await self.log_repo.collection.aggregate(pipeline).to_list(1000)
        
        status_list = []
        current_time = self.datetime_service.now_utc()
        
        for item in inside_vehicles:
            log = item['latest_log']
            vehicle = await self.vehicle_repo.find_by_plate_number(log['plate_number'])
            
            if vehicle:
                entry_time = log.get('entry_time')
                duration_hours = None
                is_overstaying = False
                
                if entry_time and isinstance(entry_time, datetime):
                    entry_time = self.datetime_service.ensure_timezone_aware(entry_time)
                    duration_hours = self.datetime_service.calculate_duration_hours(entry_time, current_time)
                    
                    # Check overstaying for private vehicles (8 hours limit)
                    if vehicle['vehicle_type'] == VehicleType.PRIVATE and duration_hours > 8:
                        is_overstaying = True
                
                status_list.append(VehicleStatus(
                    plate_number=log['plate_number'],
                    is_inside=True,
                    entry_time=entry_time,
                    duration_hours=duration_hours,
                    is_overstaying=is_overstaying
                ))
        
        return status_list
    
    async def get_dashboard_stats(self) -> Dict:
        # Get today's logs count
        today_logs = await self.log_repo.count_today()
        
        # Get total vehicles
        total_vehicles = len(await self.vehicle_repo.find_all_active())
        
        # Get vehicles currently inside
        vehicle_status = await self.get_vehicle_status()
        inside_count = len(vehicle_status)
        
        # Get overstaying vehicles
        overstaying_count = sum(1 for status in vehicle_status if status.is_overstaying)
        
        return {
            "today_entries_exits": today_logs,
            "total_vehicles": total_vehicles,
            "vehicles_inside": inside_count,
            "overstaying_vehicles": overstaying_count
        }

# Initialize services
auth_service = AuthService()
vehicle_service = VehicleService()
scan_service = ScanService()
dashboard_service = DashboardService()

# Authentication dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    result = JWTService.decode_token(credentials.credentials)
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["error"])
    
    payload = result["payload"]
    username = payload.get('username')
    role = payload.get('role')
    if username is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"username": username, "role": role}

# API Routes
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    return await auth_service.register_user(user_data)

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    return await auth_service.login_user(login_data)

@api_router.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle_data: VehicleCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create vehicles")
    return await vehicle_service.create_vehicle(vehicle_data)

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(current_user: dict = Depends(get_current_user)):
    return await vehicle_service.get_all_vehicles()

@api_router.get("/vehicles/{plate_number}", response_model=Vehicle)
async def get_vehicle_by_plate(plate_number: str, current_user: dict = Depends(get_current_user)):
    return await vehicle_service.get_vehicle_by_plate(plate_number)

@api_router.post("/scan")
async def process_scan(scan_data: ScanInput, current_user: dict = Depends(get_current_user)):
    return await scan_service.process_scan(scan_data, current_user['username'])

@api_router.get("/logs", response_model=List[EntryExitLog])
async def get_entry_exit_logs(
    limit: int = 50,
    plate_number: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    log_repo = EntryExitLogRepository()
    logs = await log_repo.find_all(limit, plate_number)
    return [EntryExitLog(**log) for log in logs]

@api_router.get("/vehicle-status")
async def get_vehicles_status(current_user: dict = Depends(get_current_user)):
    return await dashboard_service.get_vehicle_status()

@api_router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    return await dashboard_service.get_dashboard_stats()

# Include router
app.include_router(api_router)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=Config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()