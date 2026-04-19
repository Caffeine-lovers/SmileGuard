# OAuth Debug Flow - Log Sequence

## Expected Log Sequence When Clicking "Sign up with Google"

### Step 1: AuthModal - OAuth Initiated
```
🔓 Starting Google OAuth...
  Mode: register
  Redirect URL: smileguard://redirect
✅ OAuth URL generated: https://...
Browser result: { type: "success", url: "smileguard://redirect#access_token=...&refresh_token=..." }
✅ Successfully returned from browser with URL
[AuthModal] Browser result URL: smileguard://redirect#access_token=...
[AuthModal] Hash portion: access_token=...&refresh_token=...
[AuthModal] Parsed params keys: ["access_token", "refresh_token", ...]
[AuthModal] Has access token: true
[AuthModal] Has refresh token: true
Found tokens, setting session manually...
[AuthModal] setSession result - error: null
[AuthModal] setSession result - user: user@gmail.com
Session set for: user@gmail.com
[AuthModal] Updating role to doctor...
[AuthModal] Role updated
[AuthModal] Checking for doctor profile...
[AuthModal] Profile check - found: false, error: PGRST116
[AuthModal] New user, routing to complete-profile
```

### Step 2: Root Layout Detects New Session
```
[RootLayout] Auth state changed: SIGNED_IN Session Found
[RootLayout] Setting user from auth state. Role: doctor
[RootLayout] Routing logic - Ready: true User: true Segments: ["complete-profile"]
```

### Step 3: Complete Profile Route Loaded
```
[CompleteProfile] Mounted - user: user@gmail.com
```

### Step 4: User Fills Profile and Submits
```
[CompleteProfile] Form submission started
[CompleteProfile] Updating user metadata...
[CompleteProfile] User metadata updated
[CompleteProfile] Inserting doctor profile...
[CompleteProfile] Doctor profile inserted
✅ Profile completed successfully
[CompleteProfile] Routing to dashboard
```

### Step 5: OAuthRedirect Handler (if called)
```
[OAuthRedirect] Handler called
[OAuthRedirect] Search params: { ... }
[OAuthRedirect] Session after auth: Found
[OAuthRedirect] Session user email: user@gmail.com
[OAuthRedirect] Session user ID: uuid
✅ OAuth successful, user: user@gmail.com
[OAuthRedirect] User metadata: { role: "doctor", ... }
[OAuthRedirect] Checking for doctor profile...
[OAuthRedirect] Profile query result - data: { id: uuid }, error: null
✅ Existing user - routing to dashboard
```

### Step 6: Doctor Layout Checks Session
```
[DoctorLayout] Initial session check: Found
```

### Step 7: Dashboard Loads
```
(dashboard renders successfully)
```

## Potential Issues & What to Look For

### Issue: "Browser result shows error"
- Look for: `{ type: "dismiss" }` or `{ type: "cancel" }`
- Cause: User cancelled OAuth login
- Solution: This is user action, not a bug

### Issue: "No hash in browser URL"
- Look for: `[AuthModal] No hash in browser URL`
- Cause: Browser URL doesn't have OAuth tokens
- Solution: Check Supabase URL config has `smileguard://redirect`

### Issue: "Missing tokens in URL"
- Look for: `[AuthModal] Has access token: false`
- Cause: Token parsing failed
- Solution: Check URL encoding of tokens

### Issue: "Route Stuck on Loading"
- Look for: No logs after `[AuthModal] New user, routing to complete-profile`
- Cause: Router.replace() not working
- Solution: Check Expo Router setup

### Issue: "Profile Not Inserted"
- Look for: No `[CompleteProfile] Inserting doctor profile...` log
- Cause: User never gets to `/complete-profile` page
- Solution: Check app routing and layout exemptions

### Issue: "Dashboard Won't Load After Profile"
- Look for: `[DoctorLayout] Initial session check: Null`
- Cause: Session was cleared
- Solution: Check auth persistence in Supabase client config

## How to Read Logs Real-Time

1. **Expo Go**: Open developer menu (shake phone) → View logs
2. **Terminal**: Look at `npx expo start` output
3. **Filter by**: Search for `[AuthModal]`, `[OAuthRedirect]`, `[CompleteProfile]`, etc.
4. **Check timestamps**: Ensure logs flow in correct sequence

## Reproduction Steps

1. Clear app state if needed
2. Click "Sign up with Google" in Register mode
3. Authenticate with Google account
4. Watch console logs flow through the expected sequence
5. Fill out and submit profile form
6. Verify dashboard appears

## Debug Commands

To clear logs between tests:
- Close Expo Dev Client and reopen
- Or use `npx expo start --clear` to reset
