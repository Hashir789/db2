# Deed Encryption Strategy - Secure Private Deeds

## Overview
This document outlines the encryption strategy for special/private deeds in Kitaab, ensuring that only the deed owner and explicitly permitted friends can view the deed content. Even database administrators with full database access cannot decrypt and view these deeds without proper authorization.

## Security Requirements

### Core Principles
1. **Zero-Knowledge Architecture**: Database administrators cannot decrypt private deeds
2. **User-Controlled Access**: Only the deed owner and explicitly permitted friends can decrypt
3. **End-to-End Encryption**: Data is encrypted before storage and decrypted only at the application layer
4. **Key Derivation**: Encryption keys are derived from user credentials, not stored in the database
5. **Permission-Based Decryption**: Friend permissions control who can decrypt which deeds

---

## What Gets Encrypted and What Doesn't

### Data That WILL Be Encrypted

#### 1. Deed Item Names (`deed_items.name`)
- **Why**: The name reveals what the deed item is about (e.g., "Private Prayer", "Personal Charity")
- **Storage**: Stored in `name_encrypted` field as binary encrypted data
- **Visibility**: Only visible to owner and permitted friends after decryption

#### 2. Deed Item Descriptions (`deed_items.description`)
- **Why**: Descriptions contain detailed information about the deed item
- **Storage**: Stored in `description_encrypted` field as binary encrypted data
- **Visibility**: Only visible to owner and permitted friends after decryption

### Data That Will NOT Be Encrypted

#### 1. Deed Metadata (`deeds` table)
- **What**: `deed_id`, `user_id`, `category_type`, `created_at`, `updated_at`, `is_encrypted` flag
- **Why**: These are structural identifiers needed for database operations, queries, and relationships
- **Visibility**: Visible to database administrators but don't reveal deed content

#### 2. Deed Item Structural Data (`deed_items` table)
- **What**: `deed_item_id`, `deed_id`, `display_order`, `hide_type`, `created_at`, `is_encrypted` flag
- **Why**: These are needed for ordering, display logic, and database relationships
- **Visibility**: Visible to database administrators but don't reveal actual content

#### 3. Entry Data (`entries` table)
- **What**: `entry_id`, `deed_item_id`, `scale_value_id`, `count_value`, `entry_date`, `is_encrypted` flag
- **Why**: 
  - `scale_value_id` and `count_value` are numeric references needed for calculations and queries
  - These values don't reveal what the deed item is about (the name/description do)
  - Encrypting these would break querying and aggregation capabilities
- **Visibility**: Visible to database administrators but meaningless without the encrypted names/descriptions

#### 4. Permission Data (`permissions` table)
- **What**: All permission records (relation_id, deed_item_id, permission_type, is_active)
- **Why**: Needed to enforce access control and determine who can decrypt
- **Visibility**: Visible to database administrators but don't reveal deed content

#### 5. User and Relationship Data
- **What**: User IDs, usernames, relation IDs, friend relationships
- **Why**: Needed for authentication, authorization, and system functionality
- **Visibility**: Standard user data, not related to deed content

### Summary Table

| Data Field | Encrypted? | Reason |
|------------|-----------|--------|
| `deed_items.name` | ✅ YES | Reveals what the deed item is about |
| `deed_items.description` | ✅ YES | Contains detailed deed information |
| `deed_items.deed_item_id` | ❌ NO | Structural identifier needed for queries |
| `deed_items.display_order` | ❌ NO | Needed for UI ordering |
| `entries.scale_value_id` | ❌ NO | Numeric reference needed for calculations |
| `entries.count_value` | ❌ NO | Numeric value needed for aggregations |
| `deeds.deed_id` | ❌ NO | Primary key needed for relationships |
| `deeds.category_type` | ❌ NO | Category classification (not sensitive) |
| All IDs and timestamps | ❌ NO | Structural data needed for operations |

---

## Encryption Architecture Logic

### Key Hierarchy

The encryption system uses a three-level key hierarchy:

#### Level 1: User Master Key
- **Source**: Derived from the user's password
- **When Created**: Every time the user logs in (never stored)
- **Purpose**: The root key that unlocks all user's encrypted data
- **Storage**: NEVER stored in database - only exists in memory during active session
- **Derivation Method**: Uses password-based key derivation (PBKDF2 or Argon2) with high iteration count
- **Security**: Without the user's password, this key cannot be recreated

#### Level 2: Deed Encryption Key
- **Source**: Derived from the user's master key + deed ID
- **When Created**: When a new encrypted deed is created
- **Purpose**: Unique key for encrypting/decrypting a specific deed's items
- **Storage**: Stored in `deed_encryption_keys` table, but encrypted with the user's master key
- **Uniqueness**: Each deed has its own unique encryption key
- **Security**: Even if one deed key is compromised, other deeds remain secure

#### Level 3: Encrypted Data
- **Source**: Deed item names and descriptions encrypted with the deed encryption key
- **Storage**: Stored as binary data in `name_encrypted` and `description_encrypted` fields
- **Algorithm**: AES-256-GCM (provides both encryption and authentication)

### Key Derivation Flow

**For Deed Owner:**
1. User enters password → System derives master key (using salt from user_preferences)
2. Master key + deed_id → System derives deed encryption key
3. Deed encryption key → Encrypts/decrypts deed item names and descriptions

**For Permitted Friend:**
1. Friend enters their own password → System derives friend's master key
2. Friend's master key → Decrypts shared deed key (stored in deed_encryption_keys table)
3. Shared deed key → Decrypts deed item names and descriptions

---

## Key Management Logic

### Storing Deed Keys

When a user creates an encrypted deed:
1. System generates a unique deed encryption key
2. System encrypts this deed key using the user's master key (derived from password)
3. Encrypted deed key is stored in `deed_encryption_keys` table with:
   - `deed_id`: Which deed this key belongs to
   - `user_id`: The owner's user ID
   - `relation_id`: NULL (because this is the owner's key, not a friend's)
   - `encrypted_deed_key`: The deed key encrypted with owner's master key
   - `key_derivation_salt`: Salt used for additional security

**Critical Point**: The stored `encrypted_deed_key` is useless without the user's password to derive the master key. Database administrators cannot decrypt it.

### Sharing Keys with Friends

When owner grants a friend permission to view an encrypted deed:
1. System verifies that a friend relationship exists and is accepted
2. System retrieves the owner's deed encryption key (decrypted using owner's password)
3. System creates a copy of the deed key, encrypted with the friend's master key
4. System stores this shared key in `deed_encryption_keys` table with:
   - `deed_id`: Same deed ID
   - `user_id`: Friend's user ID
   - `relation_id`: The relation ID between owner and friend
   - `encrypted_deed_key`: The same deed key, but encrypted with friend's master key
   - `key_derivation_salt`: Salt for friend's encryption

**Important**: The actual deed encryption key is the same for both owner and friend, but each has their own encrypted copy that can only be decrypted with their own password.

---

## Access Control Logic

### Owner Accessing Their Own Deed

**Step-by-Step Process:**
1. User requests to view their encrypted deed
2. System checks: Is this user the owner? (Compare `deed.user_id` with current user)
3. System derives user's master key from their password (using stored salt)
4. System retrieves encrypted deed key from `deed_encryption_keys` where `relation_id IS NULL`
5. System decrypts the deed key using the master key
6. System retrieves encrypted deed items (`name_encrypted`, `description_encrypted`)
7. System decrypts each item using the deed key
8. System returns decrypted data to the user

**Security Check**: If user is not the owner, deny access immediately.

### Friend Accessing Permitted Deed

**Step-by-Step Process:**
1. Friend requests to view an encrypted deed
2. System checks: Does a friend relationship exist? (Query `relations` table)
3. System checks: Does friend have 'read' permission? (Query `permissions` table for this deed's items)
4. If permission exists and is active:
   - System derives friend's master key from friend's password
   - System retrieves shared encrypted deed key from `deed_encryption_keys` where `relation_id` matches
   - System decrypts the shared deed key using friend's master key
   - System retrieves encrypted deed items
   - System decrypts each item using the deed key
   - System returns decrypted data to the friend
5. If no permission: Deny access

**Security Check**: Permission must be verified BEFORE attempting decryption. No permission = no decryption attempt.

### Database Administrator Access

**What DBAs Can See:**
- All table structures and schemas
- All IDs (user_id, deed_id, deed_item_id, etc.)
- All timestamps and metadata
- All encrypted data (but as meaningless binary blobs)
- All permission records
- All relationship data

**What DBAs Cannot Do:**
- Cannot decrypt encrypted deed keys (requires user passwords)
- Cannot decrypt deed item names/descriptions (requires deed keys)
- Cannot view actual deed content without a user's password

**Security Guarantee**: Even with full database access, DBAs see encrypted data as random bytes with no way to decrypt without user credentials.

---

## Permission Granting Logic

### Granting Friend Access

When an owner wants to share an encrypted deed with a friend:

**Prerequisites:**
1. Friend relationship must exist and be in 'accepted' status
2. Owner must be authenticated (has their password available)
3. Deed must be marked as encrypted (`is_encrypted = TRUE`)

**Process:**
1. System verifies friend relationship exists and is accepted
2. System derives owner's master key from owner's password
3. System retrieves and decrypts owner's deed encryption key
4. System creates permission records in `permissions` table for each deed item:
   - Links `relation_id` to `deed_item_id`
   - Sets `permission_type = 'read'`
   - Sets `is_active = TRUE`
5. System creates a shared key entry in `deed_encryption_keys`:
   - Encrypts the deed key with friend's master key (requires friend's password or key exchange)
   - Stores encrypted key with friend's `user_id` and the `relation_id`

**Key Sharing Challenge**: To encrypt the deed key with friend's master key, we need friend's password. Options:
- **Option A**: Friend must be logged in when permission is granted (system has friend's password in session)
- **Option B**: Use cryptographic key exchange (ECDH) to share keys without passwords
- **Option C**: Store permission request, encrypt key when friend next logs in

### Revoking Friend Access

When owner revokes friend's permission:
1. System sets `is_active = FALSE` in `permissions` table
2. System may optionally delete the shared key from `deed_encryption_keys` (or keep for audit)
3. Friend can no longer decrypt the deed (permission check fails before decryption)

---

## Encryption Process Logic

### Creating an Encrypted Deed

**When User Creates Encrypted Deed:**
1. User creates new deed and marks it as encrypted
2. System generates unique deed encryption key
3. User creates deed items with names and descriptions
4. **Before storing in database:**
   - System encrypts each name using deed encryption key → stores in `name_encrypted`
   - System encrypts each description using deed encryption key → stores in `description_encrypted`
   - System sets `is_encrypted = TRUE` flag
5. System encrypts deed key with user's master key → stores in `deed_encryption_keys`
6. Original plaintext names/descriptions are discarded (never stored)

**Result**: Database contains only encrypted binary data. Plaintext never touches the database.

### Reading an Encrypted Deed

**When User Views Encrypted Deed:**
1. System retrieves encrypted data from database (`name_encrypted`, `description_encrypted`)
2. System derives user's master key from password
3. System retrieves and decrypts deed encryption key
4. System decrypts each encrypted field using deed key
5. System returns plaintext to user
6. Plaintext exists only in application memory, never in database

**Result**: Decryption happens on-the-fly. Database always contains encrypted data.

---

## Security Considerations

### What Happens If User Forgets Password?

**Critical Limitation**: If a user loses their password, encrypted deeds **cannot be recovered**. This is by design for security.

**Why**: 
- Master key is derived from password
- Without password, master key cannot be recreated
- Without master key, encrypted deed keys cannot be decrypted
- Without deed keys, encrypted data cannot be decrypted

**Mitigation Options**:
1. **Recovery Key**: Users can generate a recovery key during account setup, stored securely offline
2. **Backup Encryption**: Encrypt deed keys with a backup key (requires secure offline storage)
3. **Warning to Users**: Clear communication that password loss = permanent data loss for encrypted deeds

### Key Rotation

If a user changes their password:
1. Old master key (from old password) can no longer decrypt stored deed keys
2. System must:
   - Decrypt all deed keys using old master key (before password change)
   - Re-encrypt all deed keys using new master key (after password change)
   - Re-encrypt all shared keys for friends (using their master keys)
3. This is a resource-intensive operation but necessary for security

**Alternative**: Keep old master key encrypted with new password, but this reduces security.

### Database Administrator Limitations

**What DBAs Can Do:**
- View all table structures
- See all encrypted data (as binary)
- Query relationships and permissions
- See metadata and timestamps

**What DBAs Cannot Do:**
- Decrypt any encrypted data without user passwords
- View actual deed content
- Access user master keys (never stored)
- Bypass permission checks (enforced at application level)

**Audit Requirement**: All DBA queries should be logged to detect unauthorized access attempts.

---

## Database Schema Changes

### New Fields Required

#### `deeds` Table
- `is_encrypted BOOLEAN`: Flag indicating if deed is encrypted
- **Note**: Deed metadata (IDs, category, timestamps) remain unencrypted

#### `deed_items` Table
- `name_encrypted BYTEA`: Encrypted name (replaces or supplements `name` field)
- `description_encrypted BYTEA`: Encrypted description (replaces or supplements `description` field)
- `is_encrypted BOOLEAN`: Flag indicating if item is encrypted
- **Note**: Structural fields (IDs, display_order, hide_type) remain unencrypted

#### `entries` Table
- `is_encrypted BOOLEAN`: Flag indicating if entry belongs to encrypted deed
- **Note**: `scale_value_id` and `count_value` remain unencrypted (needed for queries)

#### `deed_encryption_keys` Table (New)
- `key_id`: Primary key
- `deed_id`: Which deed this key belongs to
- `user_id`: Which user can use this key
- `relation_id`: NULL for owner, relation ID for friend
- `encrypted_deed_key`: The deed key encrypted with user's master key
- `key_derivation_salt`: Salt for additional security
- `created_at`: Timestamp

**Purpose**: Stores encrypted copies of deed keys, one per user who has access (owner + each permitted friend).

#### `user_preferences` Table
- `key_derivation_salt BYTEA`: Unique salt for each user's master key derivation
- **Purpose**: Ensures each user's master key is unique even with same password

---

## Access Flow Summary

### Owner Viewing Their Deed
```
User Login → Derive Master Key (from password)
    ↓
Retrieve Encrypted Deed Key (from deed_encryption_keys)
    ↓
Decrypt Deed Key (using master key)
    ↓
Retrieve Encrypted Deed Items (name_encrypted, description_encrypted)
    ↓
Decrypt Each Item (using deed key)
    ↓
Return Plaintext to User
```

### Friend Viewing Permitted Deed
```
Friend Login → Derive Friend's Master Key (from friend's password)
    ↓
Check Permission (in permissions table)
    ↓
If Permission Exists:
    ↓
Retrieve Shared Encrypted Deed Key (from deed_encryption_keys with relation_id)
    ↓
Decrypt Shared Deed Key (using friend's master key)
    ↓
Retrieve Encrypted Deed Items
    ↓
Decrypt Each Item (using deed key)
    ↓
Return Plaintext to Friend
```

### Database Administrator Viewing Database
```
DBA Connects to Database
    ↓
Can See: All table structures, IDs, timestamps, encrypted binary data
    ↓
Cannot Decrypt: No access to user passwords → No master keys → No deed keys → No plaintext
    ↓
Result: Sees encrypted data as meaningless binary blobs
```

---

## Performance Considerations

### Encryption Overhead
- **Encryption/Decryption**: Each operation adds ~10-20ms per field
- **Impact**: Minimal for individual deed items, noticeable for bulk operations
- **Mitigation**: Batch operations where possible, cache decrypted data in session

### Key Derivation Overhead
- **Master Key Derivation**: Takes ~200-500ms (acceptable for login, done once per session)
- **Deed Key Derivation**: Fast (HKDF is efficient)
- **Mitigation**: Derive master key once per login, cache in secure session storage

### Query Limitations
- **Cannot Index Encrypted Fields**: Encrypted names/descriptions cannot be searched or indexed
- **Impact**: Full-text search on encrypted deeds is not possible
- **Workaround**: If search is needed, maintain separate unencrypted metadata fields (defeats purpose) or implement application-level search after decryption

### Bulk Operations
- **Re-encryption**: Changing password requires re-encrypting all deed keys (time-consuming)
- **Key Rotation**: Rotating keys requires decrypting and re-encrypting all deed items
- **Mitigation**: Perform in background jobs, show progress to user

---

## Audit and Compliance

### What to Log

All access to encrypted deeds should be logged:
- **Who**: Which user accessed the deed
- **What**: Which deed was accessed
- **When**: Timestamp of access
- **How**: Owner access or friend access (with relation_id)
- **Where**: IP address and user agent (for security monitoring)

### Audit Table Structure

Create `encrypted_deed_access_log` table to track:
- `deed_id`: Which deed was accessed
- `accessed_by_user_id`: Who accessed it
- `access_type`: 'owner_read', 'friend_read', etc.
- `relation_id`: If friend access, which relation
- `ip_address`: Source IP
- `user_agent`: Browser/client info
- `accessed_at`: Timestamp

**Purpose**: Security compliance, detecting unauthorized access attempts, audit trails.

---

## Implementation Phases

### Phase 1: Schema Updates
- Add encryption flags to existing tables
- Create `deed_encryption_keys` table
- Add key derivation salt to `user_preferences`
- Create indexes for performance

### Phase 2: Core Encryption Logic
- Implement key derivation functions (master key, deed key)
- Implement encryption/decryption functions (AES-256-GCM)
- Create encryption service layer
- Add unit tests

### Phase 3: Access Control
- Implement permission checking before decryption
- Create friend key sharing mechanism
- Implement owner access flow
- Implement friend access flow

### Phase 4: API Integration
- Update deed creation to support encryption option
- Update deed retrieval to decrypt on-the-fly
- Update permission granting API
- Add encryption status indicators

### Phase 5: Security Hardening
- Implement key rotation for password changes
- Add audit logging for all encrypted deed access
- Implement recovery key mechanism (optional)
- Security audit and penetration testing

---

## Conclusion

This encryption strategy ensures:

1. ✅ **Zero-Knowledge**: Database administrators cannot view encrypted deed content
2. ✅ **User Control**: Only deed owner and explicitly permitted friends can decrypt
3. ✅ **Selective Encryption**: Only sensitive content (names, descriptions) is encrypted; structural data remains unencrypted for functionality
4. ✅ **Key Security**: Keys derived from passwords, never stored in plaintext
5. ✅ **Permission Enforcement**: Access control verified before any decryption attempt
6. ✅ **Auditability**: All access logged for security compliance

**Key Takeaway**: The system encrypts only the content that reveals what deeds are about (names and descriptions), while keeping structural data (IDs, values, timestamps) unencrypted to maintain database functionality and query capabilities.
