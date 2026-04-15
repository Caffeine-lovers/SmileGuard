# Dummy Accounts Table Setup

## Overview

The `dummy_accounts` table is a Supabase table designed for internal testing and development purposes. It stores test account credentials and metadata but is **NOT accessible from the patient web application** due to Row Level Security (RLS) policies.

## Table Schema

```sql
CREATE TABLE public.dummy_accounts (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  account_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  password_hint TEXT,
  full_name TEXT,
  phone TEXT,
  clinic_name TEXT,
  specialization TEXT,
  notes TEXT,
  test_purpose TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
```

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `username` | TEXT | Unique username for testing |
| `email` | TEXT | Unique email address (NOT the auth email) |
| `account_type` | TEXT | Type of account: `doctor`, `patient`, `admin`, `receptionist`, `staff`, `other` |
| `status` | TEXT | Account status: `active`, `inactive`, `suspended`, `deleted` |
| `password_hint` | TEXT | Password hint (NOT actual password for security) |
| `full_name` | TEXT | Full name of the test user |
| `phone` | TEXT | Contact phone number |
| `clinic_name` | TEXT | Clinic name (if applicable) |
| `specialization` | TEXT | Specialization (if doctor) |
| `notes` | TEXT | Internal notes about the account |
| `test_purpose` | TEXT | What this account is being tested for |
| `created_by` | TEXT | Developer/admin who created the account |
| `created_at` | TIMESTAMPTZ | Timestamp of creation |
| `updated_at` | TIMESTAMPTZ | Timestamp of last update (auto-updated) |
| `last_used_at` | TIMESTAMPTZ | Timestamp of last usage |

## Security & Access Control

### Row Level Security (RLS) Policies

The table has RLS enabled with the following policy:

```sql
CREATE POLICY "dummy_accounts_restrict_access" ON public.dummy_accounts
  FOR SELECT
  USING (
    auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin'
    OR
    auth.jwt() ->> 'user_metadata' ->> 'role' = 'doctor'
  );
```

**Access Rules:**
- ✅ Accessible by users with `admin` role
- ✅ Accessible by users with `doctor` role (for testing)
- ❌ NOT accessible from patient web application
- ❌ NOT accessible by regular patient users

### Indexes

The following indexes are created for performance:
- `idx_dummy_accounts_username`
- `idx_dummy_accounts_email`
- `idx_dummy_accounts_account_type`
- `idx_dummy_accounts_status`

## Setup Instructions

### Step 1: Run the Migration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `supabase/migrations/005_create_dummy_accounts_table.sql`
6. Click **Run**

### Step 2: Add Test Accounts (Optional)

You can add test accounts directly through the Supabase dashboard:

```sql
INSERT INTO public.dummy_accounts (username, email, account_type, status, password_hint, full_name, notes)
VALUES
  ('doctor_test_001', 'doctor@test.example.com', 'doctor', 'active', 'Test@123456', 'Dr. John Smith', 'Main test doctor account'),
  ('patient_test_001', 'patient@test.example.com', 'patient', 'active', 'Test@123456', 'Jane Doe', 'Main test patient account'),
  ('admin_test_001', 'admin@test.example.com', 'admin', 'active', 'Test@123456', 'Admin User', 'Admin test account'),
  ('receptionist_test_001', 'receptionist@test.example.com', 'receptionist', 'active', 'Test@123456', 'Reception Staff', 'Receptionist test account');
```

### Step 3: Use the Service Layer

In your application code, use the `dummyAccountsService.ts` service:

```typescript
import {
  addDummyAccount,
  getAllDummyAccounts,
  getDummyAccountsByType,
  getDummyAccountByUsername,
} from './lib/dummyAccountsService';

// Add a new dummy account
const newAccount = await addDummyAccount({
  username: 'test_user_123',
  email: 'testuser@example.com',
  account_type: 'doctor',
  status: 'active',
  password_hint: 'MySecurePass123!',
  full_name: 'Test Doctor',
  notes: 'Testing new features',
});

// Get all dummy accounts
const allAccounts = await getAllDummyAccounts();

// Get accounts by type
const doctorAccounts = await getDummyAccountsByType('doctor');

// Get account by username
const account = await getDummyAccountByUsername('doctor_test_001');
```

## Available Service Functions

### Query Functions
- `getAllDummyAccounts()` - Get all dummy accounts
- `getDummyAccountsByType(type)` - Get accounts by type
- `getDummyAccountByUsername(username)` - Get account by username
- `getDummyAccountByEmail(email)` - Get account by email
- `getActiveDummyAccounts()` - Get only active accounts
- `searchDummyAccounts(query)` - Search accounts by username, email, or name

### Mutation Functions
- `addDummyAccount(data)` - Create a new dummy account
- `updateDummyAccount(id, updates)` - Update account details
- `updateDummyAccountStatus(id, status)` - Change account status
- `updateDummyAccountLastUsed(id)` - Update last used timestamp
- `deleteDummyAccount(id)` - Soft delete an account

## Best Practices

### ✅ DO:
- Use clear naming conventions (e.g., `doctor_test_001`, `patient_demo_qa`)
- Include descriptive notes about the account's purpose
- Regularly clean up unused test accounts
- Update `last_used_at` when testing with an account
- Use different accounts for different testing scenarios

### ❌ DON'T:
- Store actual user passwords
- Use this table for production data
- Share account details in unsecured channels
- Use the same account for multiple unrelated tests
- Leave test accounts in `suspended` state without cleanup

## Example Usage Scenarios

### Scenario 1: Testing Doctor Mobile App
```typescript
const testDoctor = await getDummyAccountByUsername('doctor_test_001');
if (testDoctor) {
  // Use this account to test doctor-specific features
  console.log('Testing with:', testDoctor.full_name);
}
```

### Scenario 2: Creating Multiple Test Accounts
```typescript
const testAccounts = [
  { username: 'doc1', email: 'doc1@test.com', account_type: 'doctor', full_name: 'Dr. Alice' },
  { username: 'doc2', email: 'doc2@test.com', account_type: 'doctor', full_name: 'Dr. Bob' },
  { username: 'patient1', email: 'pat1@test.com', account_type: 'patient', full_name: 'Patient One' },
];

for (const account of testAccounts) {
  await addDummyAccount({
    ...account,
    status: 'active',
    password_hint: 'TestPass123!',
  });
}
```

### Scenario 3: Updating Account Status
```typescript
// Deactivate an account after testing
await updateDummyAccountStatus(accountId, 'inactive');

// Reactivate when needed
await updateDummyAccountStatus(accountId, 'active');
```

## Troubleshooting

### Issue: "Permission denied" error
**Solution:** Ensure your user account has the `doctor` or `admin` role. Check Supabase user_metadata.

### Issue: Can't find the table
**Solution:** Verify the migration has been run successfully. Check Supabase SQL Editor history.

### Issue: RLS policies blocking access
**Solution:** Confirm your user's role in the authentication token matches the RLS policy requirements.

## Related Files

- Migration: `supabase/migrations/005_create_dummy_accounts_table.sql`
- Service: `apps/doctor-mobile/lib/dummyAccountsService.ts`
- Documentation: This file

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [SQL Editor Guide](https://supabase.com/docs/guides/database/sql-editor)
