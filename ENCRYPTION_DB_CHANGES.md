# Database Changes for Client-Side Encryption

## Overview
This document outlines all database schema changes required to implement client-side encryption for Kitaab.

## How Encryption Works (No Double Encryption!)

**Key Concept:** Data is encrypted ONCE, but the key (DEK) is encrypted multiple times (once per user).

```
┌─────────────────────────────────────────────────────────┐
│ User A creates deed item: "Prayed Fajr"                │
├─────────────────────────────────────────────────────────┤
│ 1. Generate random DEK (Data Encryption Key)           │
│ 2. Encrypt "Prayed Fajr" with DEK → ciphertext          │
│ 3. Encrypt DEK with A's password → encrypted_DEK_A     │
│                                                          │
│ Database stores:                                        │
│ ├─ encrypted_data: ciphertext (ONE row)                 │
│ └─ encrypted_keys: encrypted_DEK_A (ONE row for A)      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ User A shares with User B                                │
├─────────────────────────────────────────────────────────┤
│ 1. A's client: Decrypt encrypted_DEK_A → get DEK      │
│ 2. B's client: Encrypt SAME DEK with B's password      │
│    → encrypted_DEK_B                                     │
│                                                          │
│ Database stores:                                        │
│ ├─ encrypted_data: ciphertext (SAME row, NOT changed)   │
│ └─ encrypted_keys: encrypted_DEK_B (NEW row for B)      │
│                                                          │
│ Result:                                                  │
│ - Data encrypted ONCE (ciphertext never changes)          │
│ - DEK encrypted TWICE (once per user)                    │
│ - Both users decrypt to SAME DEK → SAME plaintext      │
└─────────────────────────────────────────────────────────┘
```

**Important:** The ciphertext in `encrypted_data` is NEVER re-encrypted. Only the DEK gets encrypted again for each new user.

## Required Changes

### 1. Add Encryption Salt to Users Table

**Purpose:** Store unique PBKDF2 salt per user for deriving KEK (Key Encryption Key) from password.

```sql
ALTER TABLE users ADD COLUMN encryption_salt BYTEA;
-- Or if storing as base64 encoded string:
-- ALTER TABLE users ADD COLUMN encryption_salt VARCHAR(32);

-- Index (optional, for lookups)
CREATE INDEX idx_users_encryption_salt ON users(encryption_salt) WHERE encryption_salt IS NOT NULL;
```

**Notes:**
- Salt is 16 bytes (128 bits)
- Generated once during user registration
- Never changes (unless password reset with new salt)
- Required for all encrypted data decryption

---

### 2. Create Encrypted Keys Table (Modified for Option A)

**Note:** Since we're using Option A, encrypted data stays in original tables. We need a way to store encrypted DEKs and IVs per data item per user.

**Option A Approach:** Store encrypted DEKs with reference to original tables.

```sql
CREATE TABLE encrypted_keys (
    key_id BIGSERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL, -- 'deed_item', 'entry', 'reflection'
    reference_id BIGINT NOT NULL, -- Links to deed_item_id, entry_id, reflection_message_id
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    encrypted_dek BYTEA NOT NULL, -- DEK encrypted with user's KEK
    iv BYTEA NOT NULL, -- IV for DEK encryption (12 bytes for AES-GCM)
    data_iv BYTEA NOT NULL, -- IV for data encryption (12 bytes, stored here for convenience)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_data_type CHECK (data_type IN ('deed_item', 'entry', 'reflection')),
    UNIQUE(data_type, reference_id, user_id)
);

-- Indexes
CREATE INDEX idx_encrypted_keys_reference ON encrypted_keys(data_type, reference_id);
CREATE INDEX idx_encrypted_keys_user ON encrypted_keys(user_id);
CREATE INDEX idx_encrypted_keys_data_user ON encrypted_keys(data_type, reference_id, user_id);
```

**Data Mapping:**
- `data_type = 'deed_item'` → `reference_id` = `deed_item_id`
- `data_type = 'entry'` → `reference_id` = `entry_id`
- `data_type = 'reflection'` → `reference_id` = `reflection_message_id`

**Fields Encrypted (stored in original tables):**
- `deed_items.name` → encrypted ciphertext stored in `deed_items.name`
- `deed_items.description` → encrypted ciphertext stored in `deed_items.description`
- `entries.notes` → encrypted ciphertext stored in `entries.notes` (if column exists)
- `reflection_messages.message` → encrypted ciphertext stored in `reflection_messages.message`

**Note:** IV for data encryption is stored in `encrypted_keys.data_iv` for convenience, but could also be stored alongside ciphertext in original tables if preferred.

---


---

## Schema Modification Options

### ✅ Option A: Keep Encrypted Fields in Original Tables (CHOSEN)

**Approach:** Encrypt data before insert, store ciphertext in existing columns.

**Pros:**
- No schema changes to existing tables
- Simpler queries (no JOINs needed)
- Backward compatible
- Direct access to encrypted data

**Cons:**
- Mixed encrypted/unencrypted data in same columns
- Less clear separation of concerns
- Harder to audit encryption status

**Implementation:**
- `deed_items.name` and `deed_items.description` store encrypted ciphertext
- `entries.notes` stores encrypted ciphertext (if column exists)
- `reflection_messages.message` stores encrypted ciphertext
- `encrypted_keys` table stores encrypted DEKs per user
- No need for `encrypted_data` table (data stored in original tables)

**Example:**
```sql
-- deed_items table stays the same
-- name and description columns store encrypted values
UPDATE deed_items 
SET name = '<encrypted_ciphertext>', 
    description = '<encrypted_ciphertext>'
WHERE deed_item_id = 123;
```

---

### Option B: Move to Encrypted Data Table (NOT CHOSEN)

**Approach:** Remove sensitive columns from original tables, store all in `encrypted_data`.

**Pros:**
- Clear separation of encrypted vs unencrypted data
- Easier to audit and manage encryption
- Better security (encrypted data isolated)

**Cons:**
- Requires JOINs to fetch data
- More complex queries
- Migration needed for existing data

**Required Schema Changes:**

```sql
-- Remove sensitive columns from deed_items
ALTER TABLE deed_items DROP COLUMN name;
ALTER TABLE deed_items DROP COLUMN description;

-- Remove notes from entries (if exists)
ALTER TABLE entries DROP COLUMN notes;

-- Remove message from reflection_messages
ALTER TABLE reflection_messages DROP COLUMN message;
```

**Query Pattern:**
```sql
-- Fetch deed item with decrypted name
SELECT 
    di.deed_item_id,
    di.deed_id,
    ed.ciphertext,
    ed.iv,
    ek.encrypted_dek,
    ek.iv as dek_iv
FROM deed_items di
JOIN encrypted_data ed ON ed.reference_id = di.deed_item_id 
    AND ed.data_type = 'deed_item'
JOIN encrypted_keys ek ON ek.data_id = ed.data_id 
    AND ek.user_id = :current_user_id
WHERE di.deed_item_id = :deed_item_id;
```

---

## Migration Strategy

### Phase 1: Add New Tables (Non-Breaking)
```sql
-- 1. Add encryption_salt to users
ALTER TABLE users ADD COLUMN encryption_salt BYTEA;

-- 2. Create encrypted_data table
CREATE TABLE encrypted_data (...);

-- 3. Create encrypted_keys table
CREATE TABLE encrypted_keys (...);
```

### Phase 2: Migrate Existing Data
```sql
-- For each existing record:
-- 1. Generate DEK
-- 2. Encrypt existing plaintext data
-- 3. Insert into encrypted_data
-- 4. Encrypt DEK for owner
-- 5. Insert into encrypted_keys
-- 6. Remove plaintext from original table (if Option B)
```

### Phase 3: Update Application Code
- Update insert/update queries to use encryption
- Update select queries to decrypt data
- Handle decryption errors gracefully

---

## Data Relationships

### One-to-Many: Original Table → Encrypted Keys (Option A)
```
deed_items (1) ──< (N) encrypted_keys
entries (1) ──< (N) encrypted_keys
reflection_messages (1) ──< (N) encrypted_keys

- One data item (ciphertext stored in original table column)
- Multiple encrypted keys (one per authorized user)
- Each user has their own encrypted version of the SAME DEK
- All users decrypt to the SAME DEK, which decrypts the SAME ciphertext
```

**Example:**
```
deed_items:
  deed_item_id: 100
  name: <encrypted ciphertext stored here>
  description: <encrypted ciphertext stored here>

encrypted_keys:
  Row 1: data_type='deed_item', reference_id=100, user_id=A, 
         encrypted_dek=<DEK encrypted with A's password>
  Row 2: data_type='deed_item', reference_id=100, user_id=B,
         encrypted_dek=<DEK encrypted with B's password>
  
Both decrypt to: SAME DEK
Both use SAME DEK to decrypt: SAME ciphertext in deed_items.name
Result: Both see same plaintext
```

### Many-to-One: Encrypted Keys → Users
```
encrypted_keys (N) >── (1) users
- Multiple encrypted keys per user (one per shared data item)
- User can decrypt multiple data items
```

### Reference Links
```
encrypted_keys.reference_id links to:
- deed_items.deed_item_id (when data_type='deed_item')
- entries.entry_id (when data_type='entry')
- reflection_messages.reflection_message_id (when data_type='reflection')
```

---

## Indexing Strategy

### Encrypted Keys Table (Option A)
- **idx_encrypted_keys_reference**: Fast lookups by data_type + reference_id
- **idx_encrypted_keys_user**: Get all keys for a user
- **idx_encrypted_keys_data_user**: Fast lookup for specific user's key on specific data item

### Users Table
- **idx_users_encryption_salt**: Optional, for salt lookups (rarely needed)

---

## Security Considerations

### Data Storage
- ✅ All sensitive data encrypted before storage
- ✅ DEKs encrypted with user-specific KEKs
- ✅ IVs stored with ciphertext (required for decryption)
- ✅ No plaintext stored on server

### Access Control
- ✅ Each user has their own encrypted DEK
- ✅ Sharing = multiple encrypted_keys rows
- ✅ Revoking access = delete encrypted_keys row
- ✅ Server cannot decrypt without user password

### Backup & Recovery
- ⚠️ Backup includes encrypted data (safe)
- ⚠️ Password loss = data loss (no recovery)
- ⚠️ Consider key escrow for enterprise users

---

## Query Examples

### Insert Encrypted Deed Item (Option A)
```sql
BEGIN;

-- 1. Insert deed_item with encrypted name and description
INSERT INTO deed_items (deed_id, parent_deed_item_id, display_order, name, description)
VALUES (:deed_id, :parent_id, :order, :encrypted_name, :encrypted_description)
RETURNING deed_item_id;

-- 2. Insert encrypted key for owner (includes data IV)
INSERT INTO encrypted_keys (data_type, reference_id, user_id, encrypted_dek, iv, data_iv)
VALUES ('deed_item', :deed_item_id, :user_id, :encrypted_dek, :dek_iv, :data_iv);

COMMIT;
```

**Note:** 
- `name` and `description` contain encrypted ciphertext
- `data_iv` is the IV used to encrypt the data (stored in encrypted_keys for convenience)
- `iv` is the IV used to encrypt the DEK

### Fetch Encrypted Data for Decryption (Option A)
```sql
-- Fetch deed item with encrypted keys
SELECT 
    di.deed_item_id,
    di.name as encrypted_name,  -- Ciphertext stored here
    di.description as encrypted_description,  -- Ciphertext stored here
    ek.encrypted_dek,
    ek.iv as dek_iv,  -- IV for DEK encryption
    ek.data_iv,  -- IV for data encryption
    u.encryption_salt
FROM deed_items di
JOIN encrypted_keys ek ON ek.reference_id = di.deed_item_id 
    AND ek.data_type = 'deed_item'
JOIN users u ON u.user_id = ek.user_id
WHERE di.deed_item_id = :deed_item_id
  AND ek.user_id = :current_user_id;
```

### Share Data with Friend

**Important: Data is NOT double encrypted!**

The sharing flow works like this:

1. **Data is encrypted ONCE** with DEK → ciphertext (stored once in `encrypted_data`)
2. **DEK is encrypted MULTIPLE times** (once per user) → multiple rows in `encrypted_keys`

**Sharing Process:**
```
User A creates deed:
├─ Data encrypted with DEK → ciphertext (stored once)
└─ DEK encrypted with A's password → encrypted_DEK_A (stored in encrypted_keys)

User A shares with User B:
├─ User A's client: Decrypts encrypted_DEK_A → gets DEK
├─ User B's client: Encrypts SAME DEK with B's password → encrypted_DEK_B
└─ Server: Stores encrypted_DEK_B (new row in encrypted_keys)

Result:
├─ encrypted_data: ONE row (same ciphertext for everyone)
└─ encrypted_keys: TWO rows (one for A, one for B)
    - Both decrypt to the SAME DEK
    - Both use SAME DEK to decrypt SAME ciphertext
```

**Database Operation (Option A):**
```sql
-- When User A grants permission to User B:
-- 1. User A's client decrypts DEK (using A's password)
-- 2. User B's client encrypts same DEK with B's password
-- 3. Insert new encrypted_keys row (data in original table stays unchanged!)

INSERT INTO encrypted_keys (data_type, reference_id, user_id, encrypted_dek, iv, data_iv)
VALUES ('deed_item', :deed_item_id, :friend_user_id, :encrypted_dek_for_friend, :dek_iv, :data_iv);
-- Note: reference_id points to EXISTING deed_item_id
--       Encrypted data in deed_items.name/description stays the same
```

**Key Points:**
- ✅ Ciphertext stored ONCE (not re-encrypted)
- ✅ DEK encrypted separately for each user
- ✅ Same DEK decrypts same ciphertext
- ✅ No double encryption of data

---

## Implementation Checklist

### Database Changes
- [ ] Add `encryption_salt` column to `users` table
- [ ] Create `encrypted_keys` table (Option A structure)
- [ ] Create all required indexes
- [ ] **Option A chosen:** No changes to original tables (deed_items, entries, reflection_messages)
- [ ] Test foreign key constraints
- [ ] Test CASCADE deletes

### Migration (Option A)
- [ ] Generate encryption_salt for existing users
- [ ] Encrypt existing plaintext data in original columns (deed_items.name, deed_items.description, etc.)
- [ ] Create encrypted_keys rows for all existing encrypted data
- [ ] Store data IVs in encrypted_keys.data_iv for existing data
- [ ] Verify data integrity after migration
- [ ] Test decryption of migrated data

### Application Updates
- [ ] Update insert queries to encrypt before insert
- [ ] Update select queries to decrypt after fetch
- [ ] Handle encryption/decryption errors
- [ ] Update sharing logic to create encrypted_keys rows
- [ ] Update permission revocation to delete encrypted_keys rows

---

## Performance Considerations

### Query Performance
- JOINs between `encrypted_data` and `encrypted_keys` are indexed
- Consider caching decrypted data client-side (session only)
- Batch encryption/decryption operations when possible

### Storage Overhead
- Each encrypted data: ~16 bytes (data_id) + ciphertext + 12 bytes (IV)
- Each encrypted key: ~16 bytes (key_id) + encrypted_dek + 12 bytes (IV)
- Additional storage: ~40-60 bytes per encrypted field per user

### Index Maintenance
- Indexes on BYTEA columns are larger
- Monitor index bloat with VACUUM ANALYZE
- Consider partial indexes if filtering by data_type frequently

---

## Rollback Plan

If encryption needs to be rolled back:

1. **Stop encryption in application code**
2. **Decrypt all data** (requires user passwords)
3. **Update original columns** with decrypted plaintext (deed_items.name, deed_items.description, etc.)
4. **Drop encryption tables:**
   ```sql
   DROP TABLE encrypted_keys;
   ALTER TABLE users DROP COLUMN encryption_salt;
   ```

**Note:** Rollback requires all users to be logged in to decrypt their data. Consider this before implementing.

