# Options Tracker App - Documentation

## Overview
A professional options trading tracker for monitoring cash-secured put options and covered calls with real-time price alerts. Built with React, FastAPI, and MongoDB.

## Features Implemented

### Core Functionality
- ✅ **Trade Management**: Add, view, and delete option positions
- ✅ **Real-Time Price Tracking**: Stock prices update every 15 seconds
- ✅ **Smart Alert System**: Visual alerts when positions approach critical thresholds
- ✅ **Push Notifications**: Browser push notifications for price alerts
- ✅ **Guest Mode**: Use the app without registration
- ✅ **Optional Authentication**: Register/login to save trades across devices
- ✅ **Separate Trade Rows**: Each trade is tracked independently (no grouping by ticker)

### Alert Thresholds

#### PUT Options (Cash-Secured Puts)
- **20%+ below strike**: Critical (Red badge) - Time to roll out
- **15%+ below strike**: High alert (Orange badge)
- **10%+ below strike**: Medium alert (Yellow badge)
- **5%+ below strike**: Low alert (Blue badge)
- **Safe zone**: Green badge

#### CALL Options (Covered Calls)
- **Within 1% of strike**: Critical (Red badge) - Risk of assignment
- **Within 2% of strike**: High alert (Orange badge)
- **Safe zone**: Green badge

### Technical Architecture

#### Backend (FastAPI)
- **Stock Prices**: Mock data with realistic variations (yfinance has container restrictions)
- **Background Monitoring**: Checks prices every 30 seconds
- **Push Notifications**: Web Push API with VAPID keys
- **MongoDB**: Stores trades and user data
- **Optional Auth**: JWT-based authentication

#### Frontend (React)
- **Dark Theme**: Zinc color palette with Manrope/Inter/JetBrains Mono fonts
- **Real-time Updates**: Price refresh every 15 seconds
- **Responsive Design**: Works on desktop and mobile
- **Service Worker**: Registered for push notifications
- **Toast Notifications**: Success/error feedback

## How to Use

### Adding a Trade
1. Click "Add Trade" button
2. Enter stock ticker symbol (e.g., AAPL, TSLA)
3. Enter strike price
4. Select type: Put Option or Covered Call
5. Enter expiry date
6. Optionally enter premium received
7. Click "Add Trade"

### Monitoring Trades
- **Current Price**: Updates automatically every 15 seconds
- **Alert Status**: Color-coded badges show proximity to strike price
- **Trade Details**: View strike, current price, expiry, and premium

### Push Notifications
1. Click "Alerts Off" button in top right
2. Grant browser notification permission
3. Receive alerts when prices breach thresholds
4. Notifications work even when app is closed

### Managing Trades
- **Delete**: Click trash icon on any trade
- **Refresh**: Click refresh icon to manually update prices
- **Login**: Click Login button to create account (optional)

## Environment Setup

### Backend Environment Variables
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET_KEY=your_secret_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

### Frontend Environment Variables
```bash
REACT_APP_BACKEND_URL=http://localhost:8001
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/guest-token` - Get guest access token

### Trades
- `POST /api/trades?user_id={id}` - Create new trade
- `GET /api/trades?user_id={id}` - Get all trades for user
- `DELETE /api/trades/{trade_id}?user_id={id}` - Delete trade

### Stock Prices
- `GET /api/stock-price/{ticker}` - Get current stock price

### Push Notifications
- `POST /api/push/subscribe?user_id={id}` - Subscribe to push notifications
- `POST /api/push/unsubscribe?user_id={id}` - Unsubscribe from notifications

## Important Notes

### Stock Price Data
**Current Implementation**: Uses mock price data with realistic variations due to container network restrictions.

**Production Recommendation**: Replace with one of these services:
- **Alpha Vantage** (500 free requests/day)
- **IEX Cloud** (50k free requests/month)
- **Finnhub** (60 requests/minute free tier)
- **Yahoo Finance** (via yfinance when network allows)

To implement real stock data:
1. Get API key from chosen provider
2. Replace `get_current_price()` function in `server.py`
3. Add error handling and rate limiting
4. Update environment variables

### Browser Compatibility
Push notifications require HTTPS in production and are supported in:
- Chrome/Edge 50+
- Firefox 44+
- Safari 16+ (macOS only)
- Not supported in iOS Safari

### Data Persistence
- Trades stored in MongoDB with user_id
- Guest users lose data on logout/token expiry
- Registered users can access data across devices

## Known Limitations

1. **Stock Price API**: Currently using mock data - needs real API integration for production
2. **Preview URL**: External preview URL not configured - app works on localhost
3. **Push Notifications**: Require HTTPS in production deployment
4. **Alert Frequency**: Background checks run every 30 seconds (adjustable)

## Design Philosophy

### Color Scheme
- Background: `#09090B` (near black)
- Surface: `#18181B` (dark zinc)
- Border: `#27272A` (zinc-800)
- Text: `#FAFAFA` (off-white)
- Accent: `#FFFFFF` (white buttons)

### Typography
- Headings: **Manrope** (bold, tight tracking)
- Body: **Inter** (clean, readable)
- Data/Numbers: **JetBrains Mono** (tabular, monospace)

### Alert Colors
- Red: `#EF4444` - Critical alerts
- Orange: `#F59E0B` - High alerts
- Yellow: `#F59E0B` - Medium alerts
- Blue: `#3B82F6` - Low alerts
- Green: `#10B981` - Safe zone

## Future Enhancements

### Recommended Features
1. **Real Stock Data Integration**: Alpha Vantage or IEX Cloud
2. **Historical Performance**: Track P&L over time
3. **Portfolio Analytics**: Total value, win rate, ROI
4. **Email Alerts**: Alternative to push notifications
5. **Export Data**: CSV download of trades
6. **Greek Calculations**: Delta, theta, gamma for positions
7. **Auto-Roll Suggestions**: ML-based recommendations
8. **Multi-Account Support**: Track multiple portfolios
9. **Tax Reports**: Generate 1099 summaries
10. **Mobile App**: Native iOS/Android versions

## Development

### Running Locally
```bash
# Backend
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Frontend
cd /app/frontend
yarn install
yarn start
```

### Testing
The testing agent verified:
- ✅ Guest access and auto-login
- ✅ Trade creation (PUT and CALL)
- ✅ Trade display with live prices
- ✅ Delete functionality
- ✅ Push notification subscription
- ✅ Service worker registration
- ✅ User registration and login
- ✅ Alert status calculation
- ✅ Data persistence in MongoDB

### Deployment Checklist
- [ ] Set up real stock data API (Alpha Vantage recommended)
- [ ] Configure HTTPS for production
- [ ] Generate production VAPID keys
- [ ] Set up MongoDB Atlas or managed MongoDB
- [ ] Configure CORS for production domain
- [ ] Set up environment variables in hosting platform
- [ ] Test push notifications on production
- [ ] Configure rate limiting for API
- [ ] Set up monitoring and error tracking
- [ ] Create backup strategy for user data

## Support

For issues or questions:
1. Check backend logs: `/var/log/supervisor/backend.err.log`
2. Check frontend logs: Browser DevTools Console
3. Verify MongoDB connection: `mongosh mongodb://localhost:27017`
4. Test API endpoints: `curl http://localhost:8001/api/stock-price/AAPL`

## Credits

Built with:
- **FastAPI** - Modern Python web framework
- **React** - UI library
- **MongoDB** - Database
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling
- **Web Push API** - Notifications
- **yfinance** - Stock data (when network allows)
