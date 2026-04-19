# Google OAuth Troubleshooting

## Issue: Browser doesn't open when clicking "Sign up with Google"

### Root Cause
`supabase.auth.signInWithOAuth()` is being called, but Supabase isn't configured to handle the redirect properly.

### Fix: Check These 3 Things

#### 1. **Supabase URL Configuration** ✅ CRITICAL
Go to: [Supabase Dashboard](https://app.supabase.com/)
**Navigate to:** Authentication → URL Configuration

**Add** `smileguard://redirect` to the Redirect URLs section if it's not there.

This tells Supabase where to redirect after Google auth completes.

#### 2. **Google Provider Enabled in Supabase** ✅
**Navigate to:** Authentication → Providers → Google

**Check:**
- ✅ Google is toggled ON
- ✅ Google Client ID is filled in
- ✅ Google Client Secret is filled in

#### 3. **Google Console Configuration** ✅  
**Go to:** [Google Cloud Console](https://console.cloud.google.com/)
**Find your OAuth 2.0 credentials for your mobile app**
**Authorized Redirect URIs must include:**
```
https://yffvnvusiazjnwmdylji.supabase.co/auth/v1/callback
```
(Replace `yffvnvusiazjnwmdylji` with YOUR Supabase project ID)

---

## Flow Explanation

Currently:
1. User clicks button
2. App calls `supabase.auth.signInWithOAuth()`
3. ❌ Browser should open but doesn't

This happens when Supabase doesn't have the redirect URL configured.

**After you add `smileguard://redirect` to Supabase:**
1. User clicks button
2. Browser opens with Google login
3. User authenticates
4. Browser redirects back to `smileguard://redirect`
5. App deep link fires
6. Profile form appears (Step 2)
7. After completion → Dashboard

---

## Test It

After fixing the config:

```bash
npx expo start --clear
```

Then click the button. You should see:
- Browser opens within 2 seconds
- Google login appears

If still blank after 5 seconds, check browser console for error messages.

---

## Registration Flow Summary

```
Step 1: Google OAuth ← Browser needs to open here
   ↓ (after browser redirect)
Step 2: Doctor Bio Form
   ↓ (after form submission)  
Dashboard
```

The browser should open **automatically** when you click the button. If it doesn't, it's a Supabase configuration issue, not a code issue.
