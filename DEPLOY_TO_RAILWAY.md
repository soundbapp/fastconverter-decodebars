# Deploy Fast Converter to Railway

## Quick Fix for Failed Deployment

The Railway build failed because you deployed the wrong repository. Here's the correct way:

## ✅ **Step 1: Push This Repository to GitHub**

```bash
# From the fast-converter directory
gh repo create fastconverter-decodebars --public --source=. --remote=origin --push
```

Or manually:
1. Go to https://github.com/new
2. Create repository: `fastconverter-decodebars`
3. Add remote and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/fastconverter-decodebars.git
git branch -M main
git push -u origin main
```

## ✅ **Step 2: Deploy to Railway**

1. **Go to Railway**: https://railway.app
2. **New Project** → **Deploy from GitHub**
3. **Select your repository**: `YOUR_USERNAME/fastconverter-decodebars`
4. **Railway will auto-detect Node.js** and use our configuration
5. **Wait for build** (should succeed this time!)
6. **Copy your Railway URL** (e.g., `https://fastconverter-decodebars.up.railway.app`)

## ✅ **Step 3: Update DecodeBars**

In your DecodeBars `.env.local`:
```env
ENABLE_EXTERNAL_CONVERTER=true
FAST_CONVERTER_API_URL=https://YOUR_RAILWAY_URL.up.railway.app/api/convert
```

## ✅ **Expected Success:**

**Before (what failed):**
- Deployed wrong repo (just docs, no Node.js code)
- Railway couldn't find package.json

**After (what works):**
- Correct repo with package.json, server.js, and Railway config
- Railway builds successfully
- DecodeBars bypasses YouTube 403 errors

## 🧪 **Test the Deployment:**

Once deployed, test your Railway URL:
```bash
curl "https://YOUR_RAILWAY_URL.up.railway.app/api/convert?url=https://www.youtube.com/watch?v=GHRVUjn09Jk"
```

Expected response:
```json
{
  "success": true,
  "title": "LOADED LUX VS RUM NITTY | URLTV",
  "downloadUrl": "https://YOUR_RAILWAY_URL.up.railway.app/download/GHRVUjn09Jk"
}
```

## 🚀 **Alternative: Use Local Version**

For immediate testing, keep using the local converter:
```bash
# Terminal 1: Keep converter running
cd fast-converter
node server.js

# Terminal 2: DecodeBars with local converter
FAST_CONVERTER_API_URL=http://localhost:8080/api/convert
```

This gives you immediate YouTube bypass while you set up production deployment!