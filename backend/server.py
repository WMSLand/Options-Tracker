from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import asyncio
import yfinance as yf
from pywebpush import webpush, WebPushException
import json
from passlib.context import CryptContext
import jwt
from contextlib import asynccontextmanager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "options_tracker_secret_key_2025")
ALGORITHM = "HS256"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

monitor_task = None
should_monitor = False

class Trade(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    id: Optional[str] = None
    user_id: str
    ticker: str
    strike_price: float
    trade_type: Literal["put", "call"]
    expiry_date: str
    premium: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TradeCreate(BaseModel):
    ticker: str
    strike_price: float
    trade_type: Literal["put", "call"]
    expiry_date: str
    premium: Optional[float] = None

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

class User(BaseModel):
    id: Optional[str] = None
    email: str
    password: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class StockPrice(BaseModel):
    ticker: str
    price: float
    timestamp: datetime

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_price(ticker: str) -> Optional[float]:
    """
    Get current stock price from Alpha Vantage API.
    Falls back to mock data if API fails or rate limit exceeded.
    """
    try:
        import requests
        api_key = os.getenv("ALPHA_VANTAGE_KEY", "")
        
        if not api_key:
            logger.warning("ALPHA_VANTAGE_KEY not set, using mock data")
            return get_mock_price(ticker)
        
        url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={ticker}&apikey={api_key}"
        response = requests.get(url, timeout=5)
        data = response.json()
        
        if "Global Quote" in data and "05. price" in data["Global Quote"]:
            price = float(data["Global Quote"]["05. price"])
            logger.info(f"Alpha Vantage price for {ticker}: ${price:.2f}")
            return price
        elif "Note" in data:
            logger.warning(f"Alpha Vantage rate limit hit for {ticker}, using mock data")
            return get_mock_price(ticker)
        else:
            logger.warning(f"No data from Alpha Vantage for {ticker}, using mock data")
            return get_mock_price(ticker)
            
    except Exception as e:
        logger.error(f"Error fetching price for {ticker}: {e}")
        return get_mock_price(ticker)

def get_mock_price(ticker: str) -> Optional[float]:
    """Fallback mock prices when API unavailable"""
    mock_prices = {
        'AAPL': 175.50, 'MSFT': 380.20, 'GOOGL': 142.30,
        'AMZN': 178.90, 'TSLA': 190.45, 'NVDA': 720.80,
        'META': 468.35, 'NFLX': 610.20, 'AMD': 152.70,
        'SPY': 485.60, 'QQQ': 415.30, 'IWM': 198.40
    }
    
    ticker_upper = ticker.upper()
    if ticker_upper in mock_prices:
        import random
        base_price = mock_prices[ticker_upper]
        variation = random.uniform(-0.02, 0.02)
        price = base_price * (1 + variation)
        return round(price, 2)
    
    import random
    return round(random.uniform(50, 300), 2)

async def check_alerts_and_notify():
    global should_monitor
    while should_monitor:
        try:
            trades = await db.trades.find({}).to_list(None)
            
            ticker_prices = {}
            for trade in trades:
                ticker = trade['ticker']
                if ticker not in ticker_prices:
                    price = get_current_price(ticker)
                    if price:
                        ticker_prices[ticker] = price
            
            for trade in trades:
                ticker = trade['ticker']
                if ticker not in ticker_prices:
                    continue
                    
                current_price = ticker_prices[ticker]
                strike_price = trade['strike_price']
                trade_type = trade['trade_type']
                
                should_alert = False
                alert_message = ""
                
                if trade_type == "put":
                    pct_below = ((strike_price - current_price) / strike_price) * 100
                    if pct_below >= 20:
                        should_alert = True
                        alert_message = f"{ticker} is 20%+ below PUT strike ${strike_price:.2f}. Current: ${current_price:.2f}"
                    elif pct_below >= 15:
                        should_alert = True
                        alert_message = f"{ticker} is 15%+ below PUT strike ${strike_price:.2f}. Current: ${current_price:.2f}"
                    elif pct_below >= 10:
                        should_alert = True
                        alert_message = f"{ticker} is 10%+ below PUT strike ${strike_price:.2f}. Current: ${current_price:.2f}"
                    elif pct_below >= 5:
                        should_alert = True
                        alert_message = f"{ticker} is 5%+ below PUT strike ${strike_price:.2f}. Current: ${current_price:.2f}"
                
                elif trade_type == "call":
                    pct_below = ((strike_price - current_price) / strike_price) * 100
                    if pct_below <= 1 and pct_below >= 0:
                        should_alert = True
                        alert_message = f"{ticker} is within 1% of CALL strike ${strike_price:.2f}. Current: ${current_price:.2f}"
                    elif pct_below <= 2 and pct_below >= 0:
                        should_alert = True
                        alert_message = f"{ticker} is within 2% of CALL strike ${strike_price:.2f}. Current: ${current_price:.2f}"
                
                if should_alert:
                    user = await db.users.find_one({"_id": trade['user_id']})
                    if user and user.get('push_subscription'):
                        try:
                            subscription_info = user['push_subscription']
                            webpush(
                                subscription_info=subscription_info,
                                data=json.dumps({
                                    "title": f"Options Alert: {ticker}",
                                    "body": alert_message,
                                    "icon": "/logo192.png",
                                    "badge": "/logo192.png",
                                    "tag": f"alert-{ticker}-{trade['id']}"
                                }),
                                vapid_private_key=os.getenv("VAPID_PRIVATE_KEY"),
                                vapid_claims={
                                    "sub": "mailto:alerts@optionstrade.com"
                                }
                            )
                            logger.info(f"Alert sent for {ticker} to user {trade['user_id']}")
                        except WebPushException as e:
                            logger.error(f"Push notification failed: {e}")
                        except Exception as e:
                            logger.error(f"Error sending notification: {e}")
            
        except Exception as e:
            logger.error(f"Error in alert monitoring: {e}")
        
        await asyncio.sleep(30)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global should_monitor, monitor_task
    should_monitor = True
    monitor_task = asyncio.create_task(check_alerts_and_notify())
    logger.info("Background monitoring started")
    yield
    should_monitor = False
    if monitor_task:
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass
    client.close()
    logger.info("Application shutdown complete")

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

@api_router.post("/auth/register", response_model=Token)
async def register(user_create: UserCreate):
    existing_user = await db.users.find_one({"email": user_create.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = {
        "_id": user_create.email,
        "email": user_create.email,
        "password": hash_password(user_create.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "push_subscription": None
    }
    
    await db.users.insert_one(user_dict)
    access_token = create_access_token(data={"sub": user_create.email})
    
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/login", response_model=Token)
async def login(user_login: UserLogin):
    user = await db.users.find_one({"email": user_login.email})
    if not user or not verify_password(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user_login.email})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/guest-token", response_model=Token)
async def get_guest_token():
    guest_id = f"guest_{datetime.now(timezone.utc).timestamp()}"
    access_token = create_access_token(data={"sub": guest_id, "guest": True})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/trades")
async def create_trade(trade_create: TradeCreate, user_id: str):
    trade_dict = {
        "id": str(datetime.now(timezone.utc).timestamp()),
        "user_id": user_id,
        "ticker": trade_create.ticker.upper(),
        "strike_price": trade_create.strike_price,
        "trade_type": trade_create.trade_type,
        "expiry_date": trade_create.expiry_date,
        "premium": trade_create.premium,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.trades.insert_one(trade_dict)
    return {"message": "Trade created", "id": trade_dict["id"]}

@api_router.get("/trades")
async def get_trades(user_id: str):
    trades = await db.trades.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    return {"trades": trades}

@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str, user_id: str):
    result = await db.trades.delete_one({"id": trade_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trade not found")
    return {"message": "Trade deleted"}

@api_router.get("/stock-price/{ticker}")
async def get_stock_price(ticker: str):
    price = get_current_price(ticker.upper())
    if price is None:
        raise HTTPException(status_code=404, detail="Unable to fetch stock price")
    
    return {
        "ticker": ticker.upper(),
        "price": price,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.post("/push/subscribe")
async def subscribe_push(subscription: PushSubscription, user_id: str):
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"push_subscription": subscription.model_dump()}},
        upsert=True
    )
    return {"message": "Subscription saved"}

@api_router.post("/push/unsubscribe")
async def unsubscribe_push(user_id: str):
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"push_subscription": None}}
    )
    return {"message": "Unsubscribed"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)