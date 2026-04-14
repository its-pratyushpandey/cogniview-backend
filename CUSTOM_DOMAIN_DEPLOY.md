# Custom Domain Deployment Guide
## Deploy Cogniview to `cogniview.pratyushpandey.me`

This guide will help you deploy your Next.js application to Vercel with your custom domain.

---

## 🚀 Part 1: Deploy to Vercel (Production)

### Step 1: Commit and Push Your Code

```powershell
# Make sure all changes are committed
git add .
git commit -m "chore: Prepare for production deployment"
git push origin main
```

### Step 2: Add Environment Variables to Vercel

⚠️ **CRITICAL:** Before deployment works, add these to Vercel Dashboard:

1. Go to https://vercel.com/dashboard
2. Select your **Cogniview** project
3. Go to **Settings** → **Environment Variables**
4. Add each variable below (click "Add New" for each):

**Copy these from your `.env.local` file:**

```bash
# AI API Keys
GROQ_API_KEY=your-groq-api-key-here
NEXT_PUBLIC_APP_NAME=Cogniview

# VAPI Voice AI
NEXT_PUBLIC_VAPI_WEB_TOKEN=af824672-b5cb-41e1-b8d2-31907f9bdb05

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=voice-interview-platform
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@voice-interview-platform.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCvhdOhE94IsEnl\nLGs5vgPUDDhbE3KfVsvh1d1D2b8kFNE2r9v2WC2sAUvP5jx+w8UIFle1YVFn6efw\nkn6E/Zv+rIhqOQqiQubfNbHDDfZARMtKR3BTZcE7SFO5AvWFc7i1Bz5mLBbsHRG7\ngHxw3IGCKpJSzUBOxaQgKLgEIiJ5j3Ym5lBlA78zP2gVeuHiSm6f0esOSYJA9l18\nOLlokEQWtYDg9THvo5vf/8a5uoYunL6GwuH0PPWLDFNO5yhpZ0+J9e9xfBFE/QMh\nCZQwDjy+8VFUd8Ch14Kh6/Wx+Vcnme448wtA1+3LTV/WY70nxvBhq7TLaexN5lLR\nXKabuKsbAgMBAAECggEAA/nPj+P/0QmROvA1I5MyygBW3HVF0Ocp6h0qjGlnw3z3\nOjpkjKF1s2I6IeTwtNxhX6wF45VnPyfUuaXP2NpXyL6GvoU5QPCsAx1Xv/fWfqEw\nS6fvmuwAowOh5dxzzEiRRAR8fNr9z+5eovUnnHTaOCUXuGluzfn7HEFf3bQaPM+h\n6W9uxVf5uck/W+aHN50w8bpAeV9SmSCIHPa5by108u9JvgaUyL42m5zNQwzy1zJW\nQVVDzFXaZZsgcY95P4JnxLDujj5Rpw8LUveDVvbKmrvWNjsz6cQ1C7EGNRdTeHyt\nkxwsLtgjL8Xf52euhhftWGiaMzdXQN9bu9eM0AddjQKBgQDxqjm8XSJYTs3721Z7\nvtoqhgpqDUKhcBubN0sl6JCtzD4RiN+ll9UEz3DC3zOtTSVz91JBLurT0sOIPTnL\nqXSiDESWY+cwRYCSbp7lHBoxT+UtuXoo3O8yulBr0JkKdZoC6v48p2K81Szg6A9m\nvws76AJeIY1lRQYjmkWc6VaQNQKBgQC57zTzFqsnpRKjIGFs7PXnVlx2+wa1+JTg\nMJtsBrMVk6FPNusSidFJ7IhPq5WcPW/MTHCxDMZScZOKin3ivszzJMLPEFzDyf46\nX6tir+kVFikImwFcn+V/xtSM4Nph8FBxKUSvum0qxMvLBNG4T/7MTS3Cpc1FYZTO\nWcoZYERYDwKBgQDMYYzGs3WSfcNTV6MCsNxNzmMMYf6SDgAq+06A1vlVI0DzD3El\n2Qz9LntNM/u+e1pLg0V7fzR2xO89T5qLldrgGcP/9KnXd1BPh2K2nVfBkLJgQ1b/\nLCrYGh5dsGNeJyuDgD5YCbBFx3xXEavE15mmpocqGPI+TWvtvFFXbTgaaQKBgQCk\nquXw972C8d3MnKvL5Rxu0fw33191H37yAfpTtKc7z7BH0HJly6qP1qxuKp7obTyq\n6XPQSWkGsNGjG74bZzFpkL/61Bnjx+ugVQQa9YHui96xYV3WY0HEZRnu3mBp5oPH\nhG3xV6DBBOMbnNwDaM1WsG97eI2QCbjY+4pR6QD+HwKBgQDv7CgSttEfTdfV6NVs\n4U4CkLsZbakYWC7si3urltWpLaY7AyStS6DpIXzDpPZ+MaR8DcuL6qpYITIE9tZr\nh1nDZPuP/qk8Raffo5KVWf/msQAdMuHPDEEbcwtESQxYU3+hgBL091nU3h5ae1Na\nQcKISIpOrVwtgl1qoiL4fSwJnA==\n-----END PRIVATE KEY-----\n"

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAb031kDCgyYXyKip1XNQ9z-2J4aWRSmAI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=voice-interview-platform.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=voice-interview-platform
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=voice-interview-platform.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=798077308559
NEXT_PUBLIC_FIREBASE_APP_ID=1:798077308559:web:3a946d727fee9e065deafa
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-B7CZG01XPT
```

**For each variable:**
- ✅ Check: **Production**
- ✅ Check: **Preview**  
- ✅ Check: **Development**
- Click **Save**

### Step 3: Deploy to Vercel

Option A: **Automatic (Recommended)**
- Vercel auto-deploys when you push to GitHub
- Wait 2-3 minutes after pushing
- Check https://vercel.com/dashboard for deployment status

Option B: **Manual Deploy**
```powershell
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

---

## 🌐 Part 2: Configure Custom Domain

### Step 1: Add Domain in Vercel

1. Go to https://vercel.com/dashboard
2. Select your **Cogniview** project
3. Click **Settings** → **Domains**
4. Click **Add Domain**
5. Enter: `cogniview.pratyushpandey.me`
6. Click **Add**

Vercel will show you DNS records to configure. **Keep this page open.**

### Step 2: Configure DNS Records

You need to add DNS records where you manage `pratyushpandey.me` (e.g., Cloudflare, Namecheap, GoDaddy, Route53, etc.).

**Option A: CNAME Record (Recommended)**

Go to your DNS provider and add:

| Type  | Name       | Value/Target            | TTL  |
|-------|------------|-------------------------|------|
| CNAME | cogniview  | cname.vercel-dns.com    | Auto |

**Option B: A Record (If CNAME not supported for subdomain)**

| Type | Name       | Value/Target     | TTL  |
|------|------------|------------------|------|
| A    | cogniview  | 76.76.21.21      | Auto |

**Cloudflare Users:**
- ⚠️ Turn OFF "Proxy status" (orange cloud) initially
- Click the cloud icon until it's gray (DNS only)
- After domain is verified, you can turn it back ON

### Step 3: Verify Domain

1. After adding DNS records, go back to Vercel
2. Click **Verify** or **Refresh**
3. Wait 5-60 minutes for DNS propagation
4. You'll see a ✅ checkmark when verified

### Step 4: Set as Primary Domain (Optional)

In Vercel → Settings → Domains:
1. Find `cogniview.pratyushpandey.me`
2. Click **⋯** (three dots)
3. Click **Set as Primary Domain**

This makes Vercel redirect from `.vercel.app` to your custom domain.

---

## 🔐 Part 3: Update Firebase Authentication

Your app uses Firebase Auth, which needs to allow your custom domain.

### Step 1: Add Authorized Domain to Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **voice-interview-platform**
3. Click **⚙️ Settings** → **Authentication**
4. Go to **Settings** tab
5. Scroll to **Authorized domains**
6. Click **Add domain**
7. Enter: `cogniview.pratyushpandey.me`
8. Click **Add**

**Also keep these domains authorized:**
- `voice-interview-platform.firebaseapp.com` (default)
- `localhost` (for development)
- Your Vercel preview domain (e.g., `cogniview-*.vercel.app`)

### Step 2: Update Firebase Auth Redirects (if needed)

If you're using email sign-in links or OAuth redirects:

1. In Firebase Console → Authentication → Settings
2. Update redirect URLs to include your domain
3. Example: `https://cogniview.pratyushpandey.me/sign-in`

---

## ✅ Part 4: Test Your Deployment

### Test Checklist

1. **Basic access:**
   - Visit: `https://cogniview.pratyushpandey.me`
   - Should load the home page

2. **SSL Certificate:**
   - Check for 🔒 padlock in browser
   - Vercel auto-provisions SSL (may take 5-10 min)

3. **Authentication:**
   - Try sign up/sign in
   - Should redirect properly after auth

4. **Voice Interview:**
   - Test VAPI integration
   - Check microphone permissions

5. **Chat/AI:**
   - Test Gemini chat functionality
   - Verify AI responses work

### Check Build Logs (if issues)

If something doesn't work:
1. Go to Vercel → Deployments
2. Click latest deployment
3. Check **Build Logs** and **Function Logs**
4. Look for errors related to:
   - Missing environment variables
   - TypeScript errors
   - API connection issues

---

## 🔧 Common Issues & Fixes

### Issue 1: Domain shows "404 - Not Found"

**Fix:**
- DNS not propagated yet (wait 30-60 minutes)
- Check DNS records are correct
- Try incognito/private browsing
- Clear DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

### Issue 2: "Firebase Auth: This domain is not authorized"

**Fix:**
- Add `cogniview.pratyushpandey.me` to Firebase Authorized Domains (see Part 3)
- Wait 2-3 minutes after adding
- Clear browser cache and retry

### Issue 3: Build fails on Vercel

**Fix:**
- Check all environment variables are added correctly
- Verify `FIREBASE_PRIVATE_KEY` includes `\n` (backslash-n)
- Check build logs for specific error
- Test build locally: `npm run build`

### Issue 4: SSL Certificate not issued

**Fix:**
- Wait 10-15 minutes (Vercel auto-provisions)
- Check domain is verified in Vercel
- If using Cloudflare, set SSL/TLS to "Full" (not "Flexible")

### Issue 5: Voice interview (VAPI) not working

**Fix:**
- Check `NEXT_PUBLIC_VAPI_WEB_TOKEN` in Vercel env vars
- Make sure it's set for **Production** environment
- Test VAPI dashboard: https://dashboard.vapi.ai
- Check browser console for errors

---

## 📋 Final Checklist

- [ ] Code pushed to GitHub (`main` branch)
- [ ] All environment variables added to Vercel Dashboard
- [ ] Environment variables set for Production, Preview, Development
- [ ] DNS records configured (CNAME or A record)
- [ ] Domain verified in Vercel (shows ✅)
- [ ] Custom domain added: `cogniview.pratyushpandey.me`
- [ ] Firebase Authorized Domains includes custom domain
- [ ] SSL certificate issued (🔒 padlock shows)
- [ ] Website loads at custom domain
- [ ] Authentication working (sign up/sign in)
- [ ] Voice interview (VAPI) functional
- [ ] Gemini chat working

---

## 🎯 Expected URLs After Setup

| Purpose | URL |
|---------|-----|
| **Production (Custom Domain)** | `https://cogniview.pratyushpandey.me` |
| **Production (Vercel)** | `https://cogniview.vercel.app` (or similar) |
| **Preview Deployments** | `https://cogniview-git-[branch].vercel.app` |
| **Vercel Dashboard** | `https://vercel.com/[your-username]/cogniview` |

---

## 🚀 Quick Deploy Commands Summary

```powershell
# 1. Commit and push
git add .
git commit -m "chore: Production deployment"
git push origin main

# 2. Check deployment status
# Visit: https://vercel.com/dashboard

# 3. After deployment succeeds:
# - Add domain in Vercel Dashboard
# - Configure DNS records
# - Update Firebase Authorized Domains
# - Test at https://cogniview.pratyushpandey.me
```

---

## 📞 Need Help?

If you encounter issues:

1. **Check Vercel logs:**
   - Dashboard → Your Project → Deployments → [Click deployment] → Logs

2. **Check Firebase Console:**
   - Authentication → Settings → Authorized domains

3. **Test DNS propagation:**
   - Visit: https://dnschecker.org
   - Enter: `cogniview.pratyushpandey.me`
   - Should show your Vercel IP or CNAME

4. **Browser console:**
   - Press F12 → Console tab
   - Look for errors (especially Firebase Auth or VAPI errors)

---

## 🎉 Success!

Once everything is configured:
- Your app will be live at `https://cogniview.pratyushpandey.me`
- Auto-deploys on every push to `main` branch
- SSL automatically managed by Vercel
- Preview deployments for PRs and branches

**Next Steps:**
- Share your link!
- Monitor usage in Vercel Analytics
- Check Firebase Analytics for user data
- Monitor VAPI usage in their dashboard
