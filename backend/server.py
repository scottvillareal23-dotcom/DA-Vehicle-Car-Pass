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
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Create the main app without a prefix
app = FastAPI(title="Vehicle Gate Pass System")

# Create a router with the /api prefix
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

# Database Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: UserRole
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole

class UserLogin(BaseModel):
    username: str
    password: str

class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plate_number: str
    vehicle_type: VehicleType
    owner_name: str
    department: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VehicleCreate(BaseModel):
    plate_number: str
    vehicle_type: VehicleType
    owner_name: str
    department: Optional[str] = None

class EntryExitLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(username: str, role: str) -> str:
    payload = {
        'username': username,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get('username')
        role = payload.get('role')
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"username": username, "role": role}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Routes
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password and create user
    hashed_password = hash_password(user_data.password)
    user_dict = user_data.dict()
    user_dict['password'] = hashed_password
    user_obj = User(username=user_data.username, role=user_data.role)
    
    await db.users.insert_one({**user_obj.dict(), 'password': hashed_password})
    return {"message": "User created successfully", "user": user_obj}

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    # Find user
    user = await db.users.find_one({"username": login_data.username})
    if not user or not verify_password(login_data.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    token = create_jwt_token(user['username'], user['role'])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": user['username'],
            "role": user['role']
        }
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle_data: VehicleCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create vehicles")
    
    # Check if plate number exists
    existing_vehicle = await db.vehicles.find_one({"plate_number": vehicle_data.plate_number})
    if existing_vehicle:
        raise HTTPException(status_code=400, detail="Vehicle with this plate number already exists")
    
    vehicle_obj = Vehicle(**vehicle_data.dict())
    await db.vehicles.insert_one(vehicle_obj.dict())
    return vehicle_obj

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(current_user: dict = Depends(get_current_user)):
    vehicles = await db.vehicles.find({"is_active": True}).to_list(1000)
    return [Vehicle(**vehicle) for vehicle in vehicles]

@api_router.get("/vehicles/{plate_number}", response_model=Vehicle)
async def get_vehicle_by_plate(plate_number: str, current_user: dict = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one({"plate_number": plate_number, "is_active": True})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return Vehicle(**vehicle)

@api_router.post("/scan")
async def process_scan(scan_data: ScanInput, current_user: dict = Depends(get_current_user)):
    # Check if vehicle exists
    vehicle = await db.vehicles.find_one({"plate_number": scan_data.plate_number, "is_active": True})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found in system")
    
    # Get latest log for this vehicle
    latest_log = await db.entry_exit_logs.find_one(
        {"plate_number": scan_data.plate_number},
        sort=[("timestamp", -1)]
    )
    
    # Determine action (entry or exit)
    is_inside = latest_log['is_inside'] if latest_log else False
    action = LogAction.EXIT if is_inside else LogAction.ENTRY
    
    # Create log entry
    log_data = {
        "plate_number": scan_data.plate_number,
        "action": action,
        "scan_method": scan_data.scan_method,
        "guard_username": current_user['username'],
        "is_inside": not is_inside
    }
    
    if action == LogAction.ENTRY:
        log_data["entry_time"] = datetime.now(timezone.utc)
    else:
        log_data["exit_time"] = datetime.now(timezone.utc)
        if latest_log and latest_log.get('entry_time'):
            log_data["entry_time"] = latest_log['entry_time']
    
    log_obj = EntryExitLog(**log_data)
    await db.entry_exit_logs.insert_one(log_obj.dict())
    
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

@api_router.get("/logs", response_model=List[EntryExitLog])
async def get_entry_exit_logs(
    limit: int = 50,
    plate_number: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if plate_number:
        query["plate_number"] = plate_number
    
    logs = await db.entry_exit_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    return [EntryExitLog(**log) for log in logs]

@api_router.get("/vehicle-status")
async def get_vehicles_status(current_user: dict = Depends(get_current_user)):
    # Get all vehicles currently inside
    pipeline = [
        {
            "$sort": {"timestamp": -1}
        },
        {
            "$group": {
                "_id": "$plate_number",
                "latest_log": {"$first": "$$ROOT"}
            }
        },
        {
            "$match": {
                "latest_log.is_inside": True
            }
        }
    ]
    
    inside_vehicles = await db.entry_exit_logs.aggregate(pipeline).to_list(1000)
    
    status_list = []
    current_time = datetime.now(timezone.utc)
    
    for item in inside_vehicles:
        log = item['latest_log']
        vehicle = await db.vehicles.find_one({"plate_number": log['plate_number']})
        
        if vehicle:
            entry_time = log.get('entry_time')
            duration_hours = None
            is_overstaying = False
            
            if entry_time and isinstance(entry_time, datetime):
                # Ensure both datetimes are timezone-aware
                if entry_time.tzinfo is None:
                    entry_time = entry_time.replace(tzinfo=timezone.utc)
                duration = current_time - entry_time
                duration_hours = duration.total_seconds() / 3600
                
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

@api_router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Get today's logs
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    today_logs = await db.entry_exit_logs.count_documents({
        "timestamp": {"$gte": today, "$lt": tomorrow}
    })
    
    # Get total vehicles
    total_vehicles = await db.vehicles.count_documents({"is_active": True})
    
    # Get vehicles currently inside
    inside_count = len(await get_vehicles_status(current_user))
    
    # Get overstaying vehicles
    status_list = await get_vehicles_status(current_user)
    overstaying_count = sum(1 for status in status_list if status.is_overstaying)
    
    return {
        "today_entries_exits": today_logs,
        "total_vehicles": total_vehicles,
        "vehicles_inside": inside_count,
        "overstaying_vehicles": overstaying_count
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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