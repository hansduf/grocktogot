# Railway Deployment Guide

## Prerequisites
- Railway.app account
- GitHub repository connected

## Deployment Steps

### 1. Connect GitHub Repository
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Authorize and select `grocktogot` repository
5. Click "Deploy Now"

### 2. Environment Variables (in Railway Dashboard)
Add these variables in Railway project settings:

```
NODE_ENV=production
LOG=true
```

### 3. Build & Start Commands
Railway will automatically detect:
- **Build**: `npm ci` (handled by package.json)
- **Start**: `npm start` (defined in package.json)

### 4. Volume Setup (Optional)
For persistent WhatsApp session data:
- In Railway Dashboard → Settings → Volume
- Mount path: `/app/client_data`
- Size: 1GB

## How It Works

1. **Dockerfile**: Automatically builds the application
   - Installs Node.js 18 Alpine
   - Installs system dependencies (FFmpeg, Canvas libraries)
   - Installs npm packages
   - Starts the bot

2. **QR Code Authentication**:
   - Bot will display QR code in Railway logs
   - Scan with WhatsApp to authenticate
   - Session persists via volume mount

3. **Logs**: Monitor in Railway Dashboard
   - Real-time logs visible
   - Check for errors and QR code

## Troubleshooting

### Build Error: npm ci failed
✅ **Fixed by**: Updated Dockerfile with Alpine build tools

### Canvas/Native Module Issues
✅ **Fixed by**: Added build dependencies (cairo-dev, jpeg-dev, etc.)

### FFmpeg Not Found
✅ **Fixed by**: Added FFmpeg to Alpine packages

### Session Loss on Restart
- Enable Volume mount in Railway settings
- Data persists in `/app/client_data`

## Cost
- Railway.com free tier: $5/month credits
- Bot runs 24/7 on free tier (check current limits)
- Persistent volume adds slight cost

## Commands
Once deployed on Railway, interact with bot same way:
- `,textsticker <text>` - Create text sticker
- `,convert` - Convert media
- `,addtext <text>` - Add text to image
- etc.

## Next Steps
1. Push this Dockerfile to GitHub
2. Go to Railway.app
3. Connect your GitHub repo
4. Railway will auto-build and deploy!

---
*Deployment ready! 🚀*
