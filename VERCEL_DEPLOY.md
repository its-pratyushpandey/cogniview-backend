# Vercel Deployment Guide for Cogniview

## ⚠️ Build Failed? Read This First!

Your build logs show:
```
Running "npm run build"
> ai-voice-interview@0.1.0 build
```

The build **STOPS** here because **environment variables are missing** on Vercel. Next.js tries to build and immediately fails when it can't find required API keys.

---

## 🔧 Quick Fix: Add Environment Variables to Vercel

### Step 1: Go to Vercel Dashboard
1. Visit: https://vercel.com/dashboard
2. Select your **Cogniview** project
3. Click **Settings** tab
4. Click **Environment Variables** in the left sidebar

### Step 2: Add ALL Required Variables

Copy these from your local `.env.local` file and add them to Vercel:

#### **CRITICAL - Add these first:**
```bash
GROQ_API_KEY=your-groq-api-key-here
NEXT_PUBLIC_VAPI_WEB_TOKEN=your-vapi-web-token-here
```

#### **Firebase Admin (Server-side):**
```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Actual-Private-Key\n-----END PRIVATE KEY-----\n"
```

#### **Firebase Client (Public):**
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-ABCDEF123
```

### Step 3: Important Settings for Each Variable

For **ALL** environment variables:
- ✅ **Environment**: Check **Production**, **Preview**, AND **Development**
- ✅ **Git Branch**: Leave empty (applies to all branches)

**Special note for `FIREBASE_PRIVATE_KEY`:**
- Make sure it includes `\n` (backslash-n) for line breaks
- Must be enclosed in quotes: `"-----BEGIN PRIVATE KEY-----\nYour-Key\n-----END PRIVATE KEY-----\n"`
- Copy it EXACTLY as it appears in your `.env.local` (including quotes)

### Step 4: Redeploy

After adding all variables:
1. Go to **Deployments** tab
2. Find your latest failed deployment
3. Click the **⋯** (three dots) menu
4. Click **Redeploy**
5. Check the box for **Use latest commit from Git**
6. Click **Redeploy**

---

## 🎯 Getting API Keys (If You Don't Have Them)

### 1. Groq API Key
1. Go to: https://makersuite.google.com/app/apikey
2. Click **Create API Key**
3. Copy the key (starts with `AI...`)
4. Add to Vercel as `GROQ_API_KEY`

### 2. VAPI Web Token
1. Go to: https://dashboard.vapi.ai
2. Sign up or log in
3. Navigate to **API Keys** or **Settings**
4. Copy your **Web Token** (starts with `pk_...`)
5. Add to Vercel as `NEXT_PUBLIC_VAPI_WEB_TOKEN`

### 3. Firebase Credentials

**For Admin SDK (Server-side):**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **⚙️ Settings** > **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file
7. Extract these values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep quotes and `\n`)

**For Client SDK (Public):**
1. In Firebase Console, go to **Project settings** > **General**
2. Scroll to **Your apps** section
3. Find your web app or click **Add app** > **Web**
4. Copy all the `firebaseConfig` values:
   ```javascript
   const firebaseConfig = {
     apiKey: "...",              // → NEXT_PUBLIC_FIREBASE_API_KEY
     authDomain: "...",          // → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
     projectId: "...",           // → NEXT_PUBLIC_FIREBASE_PROJECT_ID
     storageBucket: "...",       // → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
     messagingSenderId: "...",   // → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
     appId: "...",               // → NEXT_PUBLIC_FIREBASE_APP_ID
     measurementId: "..."        // → NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
   };
   ```

---

## 🚀 Alternative: Deploy from CLI

If you prefer command line (after adding env vars to Vercel dashboard):

```powershell
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

---

## 📋 Checklist Before Deployment

- [ ] All environment variables added to Vercel Dashboard
- [ ] Variables set for Production, Preview, AND Development
- [ ] `FIREBASE_PRIVATE_KEY` includes quotes and `\n` characters
- [ ] No placeholder values (like `your-api-key-here`)
- [ ] Firebase project is active and properly configured
- [ ] Gemini API key is valid and has quota remaining
- [ ] VAPI account is active

---

## 🐛 Troubleshooting

### Build still failing after adding env vars?

**Check build logs for specific errors:**
1. Go to Vercel Dashboard > Deployments
2. Click on the failed deployment
3. Click **View Build Logs**
4. Look for error messages

**Common issues:**

1. **"GROQ_API_KEY not configured"**
   - Make sure you added `GROQ_API_KEY` to Vercel env vars
   - Check spelling (case-sensitive!)
   - Ensure it's set for **Production** environment

2. **"Firebase admin initialization failed"**
   - Check `FIREBASE_PRIVATE_KEY` format
   - Must have `\n` for line breaks (not actual newlines)
   - Must be wrapped in quotes

3. **"VAPI is not configured"**
   - Add `NEXT_PUBLIC_VAPI_WEB_TOKEN` to Vercel
   - Make sure it starts with `pk_`

4. **TypeScript errors during build**
   - Run `npm run build` locally first
   - Fix any type errors in your code
   - Push fixed code to GitHub

### Still stuck?

1. **Test locally first:**
   ```powershell
   npm run build
   npm start
   ```
   If it fails locally, fix those errors first.

2. **Check Vercel logs:**
   - Look at the exact line where build fails
   - Google the specific error message

3. **Verify env vars are saved:**
   - Go to Vercel Dashboard > Settings > Environment Variables
   - Check that all variables show green checkmarks

---

## 📝 Summary

**Why your build failed:**
- Next.js build process requires environment variables at **build time**
- Your code references `process.env.GROQ_API_KEY` (or legacy `GEMINI_API_KEY`) and other vars
- Vercel doesn't have these variables, so the build crashes

**Solution:**
1. Add ALL environment variables to Vercel Dashboard
2. Make sure they're set for Production environment
3. Redeploy

**Expected result:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (8/8)
✓ Collecting build traces
✓ Finalizing page optimization

Build completed successfully!
```
