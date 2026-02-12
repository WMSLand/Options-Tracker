# Railway Deployment Guide - Options Tracker

## Prerequisites
- Free GitHub account (https://github.com/signup)
- Free Railway account (https://railway.app/)

## Step 1: Push Code to GitHub

1. Create a new repository on GitHub:
   - Go to https://github.com/new
   - Name it: `options-tracker`
   - Make it Public or Private
   - Don't initialize with README (we have code already)
   - Click "Create repository"

2. Push your code (run these commands in your terminal):
   ```bash
   cd /app
   git init
   git add .
   git commit -m "Initial commit - Options Tracker"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/options-tracker.git
   git push -u origin main
   ```

## Step 2: Deploy Backend on Railway

1. Go to https://railway.app/ and sign up/login
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account if not connected
5. Select your `options-tracker` repository
6. Railway will auto-detect Python and start deploying

## Step 3: Configure Backend Environment Variables

1. In Railway dashboard, click on your deployed service
2. Go to "Variables" tab
3. Add these environment variables:
   ```
   MONGO_URL=mongodb+srv://your_mongodb_connection_string
   DB_NAME=options_tracker
   JWT_SECRET_KEY=your_secret_key_here_make_it_random
   VAPID_PRIVATE_KEY=WxELLt7DH7kUbwNJv1iB0Q-hCYCCJZ9E7L0rNh9TwAc
   CORS_ORIGINS=*
   PORT=8000
   ```

4. For MongoDB, you have options:
   - **Easy Option**: Use Railway's MongoDB plugin (click "+ New" → "Database" → "Add MongoDB")
   - **Free Option**: Use MongoDB Atlas free tier (https://www.mongodb.com/cloud/atlas/register)

## Step 4: Get Your Backend URL

1. In Railway, go to "Settings" tab
2. Scroll to "Networking" section
3. Click "Generate Domain"
4. Copy the URL (will be like: `https://your-app.up.railway.app`)

## Step 5: Deploy Frontend on Vercel (Free)

1. Go to https://vercel.com/signup
2. Click "Add New" → "Project"
3. Import your `options-tracker` repository
4. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `yarn build`
   - **Output Directory**: `build`

5. Add Environment Variable:
   ```
   REACT_APP_BACKEND_URL=https://your-railway-backend-url.up.railway.app
   ```
   (Use the URL from Step 4)

6. Click "Deploy"

## Step 6: Update Backend CORS

1. Go back to Railway backend
2. Update CORS_ORIGINS variable:
   ```
   CORS_ORIGINS=https://your-vercel-app.vercel.app
   ```

3. Redeploy (Railway auto-redeploys on variable changes)

## Step 7: Test Your Deployed App!

Visit your Vercel URL and test:
- ✅ Guest auto-login works
- ✅ Add a trade
- ✅ See stock prices (mock data)
- ✅ Delete trades
- ✅ Push notifications (need HTTPS ✓)

## Costs

- **Railway**: Free tier includes 500 hours/month (plenty for 1 app)
- **Vercel**: Free tier for hobby projects
- **MongoDB Atlas**: Free tier 512MB storage
- **Total Cost**: $0/month!

## Adding Real Stock Data (Optional)

1. Get free Alpha Vantage API key: https://www.alphavantage.co/support/#api-key
2. Add to Railway variables:
   ```
   ALPHA_VANTAGE_KEY=your_api_key
   ```
3. Update the `get_current_price()` function in server.py (I can help with this)

## Continuous Updates

Whenever you want to update:
1. Make changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Updated feature X"
   git push
   ```
3. Railway and Vercel auto-deploy from GitHub!

## Troubleshooting

**Backend not responding:**
- Check Railway logs: Dashboard → "Deployments" → Click latest → "View Logs"
- Verify environment variables are set

**Frontend can't connect:**
- Verify REACT_APP_BACKEND_URL is correct
- Check CORS_ORIGINS includes your Vercel URL

**Database connection failed:**
- Check MONGO_URL is correct
- For Railway MongoDB, use the internal URL they provide

## Need Help?

If you get stuck at any step, just let me know which step and I'll guide you through it!
