# Mobile OAuth Implementation Guide

## ✅ What's Been Implemented

### 1. Deep Link Handler (`oauth-redirect.tsx`)
- Created a new route at `app/oauth-redirect.tsx` that handles OAuth callbacks
- Listens for the `smileguard://redirect` deep link
- Automatically checks Supabase session and redirect s to dashboard on success
- Shows loading indicator during the auth flow

### 2. Google OAuth Button in AuthModal
- Added "Sign in with Google" button below the email/password login form
- Button uses the `handleGoogleOAuth()` function
- Initiates OAuth flow via `supabase.auth.signInWithOAuth()`
- Redirect URL uses the new deep link: `smileguard://redirect`

### 3. App Configuration
- `app.json` already has `"scheme": "smileguard"` configured ✅
- This allows the app to handle `smileguard://` deep links automatically

---

## ⚠️ What You Need to Do

### 1. **Supabase URL Configuration (The Critical Step)**

Google does **NOT** accept app scheme deep links. Instead, Supabase acts as the intermediary:

**Google sees:** `https://yffvnvusiazjnwmdylji.supabase.co/auth/v1/callback`  
**Your app sees:** `smileguard://redirect`

**Steps:**

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to **Authentication** → **URL Configuration**
3. In the **Redirect URLs** section, add:
   ```
   smileguard://redirect
   ```
4. Save

**Google Console Redirect URIs:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Open your OAuth 2.0 credentials
3. Under "Authorized redirect URIs", ensure you have:
   ```
   https://yffvnvusiazjnwmdylji.supabase.co/auth/v1/callback
   ```
   (This should already be there from Supabase setup)

| Environment | Where to Register | Redirect URI |
|---|---|---|
| Mobile (Expo Go) | **Supabase URL Config** | `smileguard://redirect` |
| Mobile (Production) | **Supabase URL Config** | `com.smileguard.smileguard://redirect` |
| Web Dev | **Google Console** | `http://localhost:3000/auth/callback` |
| Web Prod | **Google Console** | `https://yourdomain.com/auth/callback` |
| All Mobile | **Google Console** | `https://yffvnvusiazjnwmdylji.supabase.co/auth/v1/callback` |

---

### 2. **Verify Your Google Client ID**

Make sure your Supabase project has YOUR Google OAuth client ID configured:

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to **Authentication** → **Providers**
3. Click **Google**
4. Verify:
   - ✅ **Enabled** is toggled ON
   - ✅ Your Google Client ID is filled in
   - ✅ Your Google Client Secret is filled in

Then verify Authentication → **URL Configuration** has your deep link:
   ```
   smileguard://redirect
   ```

---

### 3. **Test the OAuth Flow**

#### **On Expo Go (Development)**

```bash
cd apps/doctor-mobile
npx expo start
# Then press 'i' for iOS or 'a' for Android
```

**Test flow:**
1. Open the app in Expo Go
2. On login screen, tap **"Sign in with Google"**
3. Browser opens, you see Google login page
4. After sign-in, app automatically redirects to dashboard
5. ✅ If you see the dashboard → **OAuth works!**

#### **On Physical Device**

The same flow should work on a physical device on your local network.

---

## 🔍 How It Works (Behind the Scenes)

```
┌─────────────────────────────────────────┐
│  1. User taps "Sign in with Google"     │
│     in AuthModal                        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  2. handleGoogleOAuth() calls:          │
│     supabase.auth.signInWithOAuth({     │
│       provider: 'google',               │
│       redirectTo: 'smileguard://redirect'
│     })                                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  3. Browser opens Google login page             │
│     User authenticates with Google              │
│     (Google has Supabase callback URL)          │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  4. Google redirects to:                        │
│     https://yffvnvus.../auth/v1/callback?...   │
│     (Supabase receives auth token from Google) │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  5. Supabase (configured) redirects to:         │
│     smileguard://redirect?access_token=...     │
│     (Supabase knows about this deep link from  │
│      URL Configuration)                        │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  6. Expo captures the deep link          │
│     Routes to oauth-redirect.tsx        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  7. oauth-redirect.tsx checks for       │
│     Supabase session, then navigates    │
│     to /(doctor)/dashboard              │
└──────────────────────────────────────────┘
```

**Key Point:** Google only sees Supabase's URL. The deep link is a Supabase → App redirect, not Google → App.


---

## ⚠️ Key Differences from Web OAuth

| Aspect | Web | Mobile (Expo) |
|---|---|---|
| **Google sees** | Direct redirect URL (`https://...`) | Supabase callback URL only |
| **App receives via** | Direct HTTP response | Supabase → Deep link redirect |
| **Deep link scheme** | N/A | Custom app scheme (`smileguard://`) |
| **Where to register** | Google Console | Supabase URL Config |
| **Why separate?** | Google doesn't trust app schemes | Supabase is the trusted intermediary |

---

## 🧪 Testing Commands

**Reset and test from scratch:**
```bash
# Clear Supabase auth cache
rm -rf ~/.expo

# Reinstall dependencies if needed
npm install

# Start fresh
npx expo start --clear
```

---

## ✅ Troubleshooting

| Problem | Solution |
|---|---|
| **OAuth button does nothing** | Check Supabase Google provider is **enabled** in Authentication → Providers |
| **Browser opens but doesn't come back** | Verify `smileguard://redirect` is in Supabase **URL Configuration**, not Google Console |
| **"Cannot open URL" error** | Ensure both are configured: (1) Supabase URL Config has your deep link, (2) Google Console has Supabase callback URL |
| **Blank page after auth** | Check `oauth-redirect.tsx` exists at `app/oauth-redirect.tsx` |
| **Session not persisted** | Verify Supabase client is properly initialized in `_layout.tsx` |
| **Incorrect redirect URI error** | Don't register `smileguard://redirect` in Google Console — put it in Supabase URL Config instead |
| **Works in Expo Go but not in build** | Update Supabase URL Config to include `com.smileguard.smileguard://redirect` for production |

---

## 📋 Next Steps

1. ✅ Implement = **DONE**
2. ⏳ Register `smileguard://redirect` with Google Console ← **DO THIS NOW**
3. ⏳ Test in Expo Go on your device
4. ⏳ Test on physical devices on your network
5. ⏳ Once working, create production build with Android/iOS deep link support

---

## 🔗 References

- [Expo Deep Linking](https://docs.expo.dev/guides/deep-linking/)
- [Supabase Auth with Expo](https://supabase.com/docs/guides/auth/auth-mobile)
- [Google OAuth Redirect URIs](https://developers.google.com/identity/protocols/oauth2)
