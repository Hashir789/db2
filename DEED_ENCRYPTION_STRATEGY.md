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

## Database Schema Changes

### 1. Add Encryption Fields to DEEDS Table

```sql
ALTER TABLE deeds ADD COLUMN is_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE deeds ADD COLUMN encryption_key_id VARCHAR(255); -- Reference to key derivation material
ALTER TABLE deeds ADD COLUMN encrypted_data JSONB; -- Encrypted deed metadata (if needed)
```

**Note**: The actual deed content (names, descriptions) will be encrypted in `deed_items` table, not in `deeds` table.

### 2. Add Encryption Fields to DEED_ITEMS Table

```sql
ALTER TABLE deed_items ADD COLUMN name_encrypted BYTEA; -- Encrypted name
ALTER TABLE deed_items ADD COLUMN description_encrypted BYTEA; -- Encrypted description
ALTER TABLE deed_items ADD COLUMN is_encrypted BOOLEAN DEFAULT FALSE;
```

### 3. Add Encryption Fields to ENTRIES Table

```sql
ALTER TABLE entries ADD COLUMN is_encrypted BOOLEAN DEFAULT FALSE;
-- Note: scale_value_id and count_value remain unencrypted for querying
-- Only entry metadata that reveals deed content needs encryption
```

### 4. Enhanced PERMISSIONS Table for Encryption

The existing `permissions` table already supports friend access. We'll use it with encryption awareness:

```sql
-- Permissions table already has:
-- relation_id (links to friend relationship)
-- deed_item_id (the encrypted deed item)
-- permission_type ('read' or 'write')
-- is_active (whether permission is active)

-- For encryption, we need to ensure:
-- 1. Only users with 'read' permission can decrypt
-- 2. Permission checks happen before decryption
```

---

## Encryption Architecture

### Key Derivation Strategy

#### User Master Key
Each user has a master key derived from their password:

```python
# Pseudocode for key derivation
def derive_user_master_key(user_id: int, password: str, salt: bytes) -> bytes:
    """
    Derive user's master encryption key from password.
    This key is NEVER stored in the database.
    """
    # Use PBKDF2 or Argon2 for key derivation
    key = pbkdf2_hmac(
        algorithm='sha256',
        password=password,
        salt=salt,  # User-specific salt stored in user_preferences
        iterations=100000  # High iteration count for security
    )
    return key
```

#### Deed Encryption Key
Each encrypted deed has a unique encryption key derived from the user's master key:

```python
def derive_deed_key(user_master_key: bytes, deed_id: int) -> bytes:
    """
    Derive a unique encryption key for a specific deed.
    Uses HKDF (HMAC-based Key Derivation Function) for key expansion.
    """
    info = f"deed_{deed_id}".encode('utf-8')
    deed_key = hkdf(
        master_key=user_master_key,
        info=info,
        length=32  # 256-bit key for AES-256
    )
    return deed_key
```

#### Friend Access Key Sharing
When a friend is granted permission, we need to share the encryption key securely:

```python
def share_deed_key_with_friend(
    owner_master_key: bytes,
    friend_master_key: bytes,
    deed_id: int,
    relation_id: int
) -> bytes:
    """
    Create a shared key that allows friend to decrypt the deed.
    Uses ECDH (Elliptic Curve Diffie-Hellman) for key exchange.
    """
    # Generate ephemeral key pair for this sharing
    owner_ephemeral_private = generate_ecdh_key()
    friend_ephemeral_public = get_friend_public_key(relation_id)
    
    # Derive shared secret
    shared_secret = ecdh_key_exchange(
        private_key=owner_ephemeral_private,
        public_key=friend_ephemeral_public
    )
    
    # Derive friend's access key
    friend_deed_key = hkdf(
        master_key=shared_secret,
        info=f"deed_{deed_id}_relation_{relation_id}".encode('utf-8'),
        length=32
    )
    
    return friend_deed_key
```

**Alternative Simpler Approach**: Store encrypted deed keys in a separate table, encrypted with each permitted user's master key.

---

## Database Schema for Key Management

### 5. DEED_ENCRYPTION_KEYS Table (New)

```sql
CREATE TABLE deed_encryption_keys (
    key_id BIGSERIAL PRIMARY KEY,
    deed_id BIGINT NOT NULL REFERENCES deeds(deed_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    relation_id BIGINT REFERENCES relations(relation_id) ON DELETE CASCADE,
    -- If relation_id IS NULL, this is the owner's key
    -- If relation_id IS NOT NULL, this is a friend's shared key
    encrypted_deed_key BYTEA NOT NULL, -- Deed key encrypted with user's master key
    key_derivation_salt BYTEA NOT NULL, -- Salt for key derivation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_deed_key UNIQUE (deed_id, user_id, relation_id)
);

-- Indexes
CREATE INDEX idx_deed_keys_deed ON deed_encryption_keys(deed_id);
CREATE INDEX idx_deed_keys_user ON deed_encryption_keys(user_id);
CREATE INDEX idx_deed_keys_relation ON deed_encryption_keys(relation_id) WHERE relation_id IS NOT NULL;
```

**Security Note**: The `encrypted_deed_key` is encrypted with the user's master key (derived from password). Without the user's password, even database admins cannot decrypt this.

---

## Encryption Implementation

### Encryption Algorithm
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV/Nonce**: 96 bits (12 bytes), randomly generated for each encryption
- **Authentication Tag**: 128 bits (16 bytes), included in encrypted data

### Encryption Process

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

def encrypt_deed_item_name(name: str, deed_key: bytes) -> bytes:
    """
    Encrypt a deed item name.
    Returns: IV (12 bytes) + encrypted_data + auth_tag (16 bytes)
    """
    aesgcm = AESGCM(deed_key)
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    
    # Encrypt and authenticate
    ciphertext = aesgcm.encrypt(nonce, name.encode('utf-8'), None)
    
    # Prepend nonce to ciphertext
    return nonce + ciphertext

def decrypt_deed_item_name(encrypted_data: bytes, deed_key: bytes) -> str:
    """
    Decrypt a deed item name.
    """
    # Extract nonce and ciphertext
    nonce = encrypted_data[:12]
    ciphertext = encrypted_data[12:]
    
    aesgcm = AESGCM(deed_key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    
    return plaintext.decode('utf-8')
```

---

## Access Control Flow

### 1. User Accessing Their Own Deed

```python
def get_user_deed_key(user_id: int, deed_id: int, password: str) -> bytes:
    """
    Retrieve and decrypt the deed key for the owner.
    """
    # 1. Derive user's master key from password
    user_salt = get_user_salt(user_id)  # Stored in user_preferences
    master_key = derive_user_master_key(user_id, password, user_salt)
    
    # 2. Get encrypted deed key from database
    encrypted_key_record = db.query(
        "SELECT encrypted_deed_key, key_derivation_salt FROM deed_encryption_keys "
        "WHERE deed_id = %s AND user_id = %s AND relation_id IS NULL",
        (deed_id, user_id)
    ).first()
    
    if not encrypted_key_record:
        raise PermissionError("Deed key not found")
    
    # 3. Decrypt the deed key using master key
    deed_key = decrypt_with_master_key(
        encrypted_key_record.encrypted_deed_key,
        master_key,
        encrypted_key_record.key_derivation_salt
    )
    
    return deed_key
```

### 2. Friend Accessing Permitted Deed

```python
def get_friend_deed_key(
    friend_user_id: int,
    deed_id: int,
    relation_id: int,
    friend_password: str
) -> bytes:
    """
    Retrieve and decrypt the deed key for a permitted friend.
    """
    # 1. Verify permission exists and is active
    permission = db.query(
        "SELECT * FROM permissions "
        "WHERE relation_id = %s AND deed_item_id IN "
        "(SELECT deed_item_id FROM deed_items WHERE deed_id = %s) "
        "AND permission_type = 'read' AND is_active = TRUE",
        (relation_id, deed_id)
    ).first()
    
    if not permission:
        raise PermissionError("No permission to access this deed")
    
    # 2. Derive friend's master key from password
    friend_salt = get_user_salt(friend_user_id)
    friend_master_key = derive_user_master_key(friend_user_id, friend_password, friend_salt)
    
    # 3. Get encrypted deed key shared with this friend
    encrypted_key_record = db.query(
        "SELECT encrypted_deed_key, key_derivation_salt FROM deed_encryption_keys "
        "WHERE deed_id = %s AND user_id = %s AND relation_id = %s",
        (deed_id, friend_user_id, relation_id)
    ).first()
    
    if not encrypted_key_record:
        raise PermissionError("Shared deed key not found")
    
    # 4. Decrypt the shared deed key
    deed_key = decrypt_with_master_key(
        encrypted_key_record.encrypted_deed_key,
        friend_master_key,
        encrypted_key_record.key_derivation_salt
    )
    
    return deed_key
```

### 3. Decrypting Deed Items

```python
def get_deed_items_decrypted(deed_id: int, user_id: int, password: str):
    """
    Retrieve and decrypt all items for a deed.
    Only works if user has permission.
    """
    # 1. Get deed key (handles both owner and friend cases)
    try:
        deed_key = get_user_deed_key(user_id, deed_id, password)
    except PermissionError:
        # Try as friend
        relation = get_relation_between_users(deed_owner_id, user_id)
        if not relation:
            raise PermissionError("No access to this deed")
        deed_key = get_friend_deed_key(user_id, deed_id, relation.relation_id, password)
    
    # 2. Query encrypted deed items
    encrypted_items = db.query(
        "SELECT deed_item_id, name_encrypted, description_encrypted, "
        "display_order, hide_type, created_at "
        "FROM deed_items WHERE deed_id = %s AND is_encrypted = TRUE",
        (deed_id,)
    ).all()
    
    # 3. Decrypt each item
    decrypted_items = []
    for item in encrypted_items:
        decrypted_items.append({
            'deed_item_id': item.deed_item_id,
            'name': decrypt_deed_item_name(item.name_encrypted, deed_key),
            'description': (
                decrypt_deed_item_description(item.description_encrypted, deed_key)
                if item.description_encrypted else None
            ),
            'display_order': item.display_order,
            'hide_type': item.hide_type,
            'created_at': item.created_at
        })
    
    return decrypted_items
```

---

## Permission Granting Flow

### Granting Friend Access to Encrypted Deed

```python
def grant_friend_access_to_encrypted_deed(
    owner_user_id: int,
    friend_user_id: int,
    deed_id: int,
    deed_item_ids: List[int],
    owner_password: str
):
    """
    Grant a friend permission to view an encrypted deed.
    Creates shared encryption keys.
    """
    # 1. Verify relation exists and is accepted
    relation = db.query(
        "SELECT relation_id FROM relations "
        "WHERE ((requester_id = %s AND requestee_id = %s) OR "
        "       (requester_id = %s AND requestee_id = %s)) "
        "AND status = 'accepted'",
        (owner_user_id, friend_user_id, friend_user_id, owner_user_id)
    ).first()
    
    if not relation:
        raise ValueError("No accepted relation between users")
    
    # 2. Get owner's master key
    owner_salt = get_user_salt(owner_user_id)
    owner_master_key = derive_user_master_key(owner_user_id, owner_password, owner_salt)
    
    # 3. Get the deed's encryption key (owner's version)
    owner_deed_key_record = db.query(
        "SELECT encrypted_deed_key FROM deed_encryption_keys "
        "WHERE deed_id = %s AND user_id = %s AND relation_id IS NULL",
        (deed_id, owner_user_id)
    ).first()
    
    # Decrypt to get the actual deed key
    actual_deed_key = decrypt_with_master_key(
        owner_deed_key_record.encrypted_deed_key,
        owner_master_key,
        owner_deed_key_record.key_derivation_salt
    )
    
    # 4. Get friend's master key (requires friend's password or use key exchange)
    # For simplicity, we'll encrypt the deed key with a shared secret
    # In production, use proper key exchange protocol
    
    # 5. Create permissions for each deed item
    for deed_item_id in deed_item_ids:
        db.execute(
            "INSERT INTO permissions (relation_id, deed_item_id, permission_type, is_active) "
            "VALUES (%s, %s, 'read', TRUE) "
            "ON CONFLICT (relation_id, deed_item_id, permission_type) "
            "DO UPDATE SET is_active = TRUE",
            (relation.relation_id, deed_item_id)
        )
    
    # 6. Store encrypted deed key for friend
    friend_salt = get_user_salt(friend_user_id)
    # In production, this would use proper key exchange
    # For now, we'll need friend's password or use a key exchange mechanism
    
    # Store the shared key (encrypted with friend's master key)
    shared_key_salt = os.urandom(32)
    encrypted_shared_key = encrypt_with_master_key(
        actual_deed_key,
        friend_master_key,  # Would need friend's password or use ECDH
        shared_key_salt
    )
    
    db.execute(
        "INSERT INTO deed_encryption_keys "
        "(deed_id, user_id, relation_id, encrypted_deed_key, key_derivation_salt) "
        "VALUES (%s, %s, %s, %s, %s) "
        "ON CONFLICT (deed_id, user_id, relation_id) "
        "DO UPDATE SET encrypted_deed_key = EXCLUDED.encrypted_deed_key",
        (deed_id, friend_user_id, relation.relation_id, encrypted_shared_key, shared_key_salt)
    )
```

---

## Security Considerations

### 1. Key Storage
- **Never store plaintext keys** in the database
- **Never store user passwords** (use password hashes)
- **Master keys are derived** from passwords, never stored
- **Deed keys are encrypted** with master keys before storage

### 2. Access Control Enforcement
- **Application-level checks**: Always verify permissions before decryption
- **Database-level constraints**: Use foreign keys and unique constraints
- **Audit logging**: Log all access attempts to encrypted deeds

### 3. Key Rotation
```python
def rotate_deed_encryption_key(deed_id: int, user_id: int, new_password: str):
    """
    Rotate encryption key for a deed (e.g., after password change).
    Requires re-encrypting all deed items and re-sharing with friends.
    """
    # 1. Get all encrypted deed items
    # 2. Decrypt with old key
    # 3. Generate new deed key
    # 4. Re-encrypt all items
    # 5. Update all shared keys for friends
    pass
```

### 4. Password Recovery
**Critical**: If a user loses their password, encrypted deeds **cannot be recovered**. This is by design for security.

Options:
- **Recovery key**: Allow users to generate and securely store a recovery key
- **Backup encryption**: Encrypt deed keys with a backup key (stored securely offline)

### 5. Database Administrator Access
- **DBA cannot decrypt**: Without user passwords, DBAs cannot derive master keys
- **Encrypted data is opaque**: Encrypted fields appear as random bytes
- **Metadata is visible**: Table structure, IDs, and non-encrypted fields are visible
- **Access logs**: All DBA queries should be logged for audit

---

## Implementation Checklist

### Phase 1: Schema Updates
- [ ] Add encryption fields to `deeds` table
- [ ] Add encryption fields to `deed_items` table
- [ ] Create `deed_encryption_keys` table
- [ ] Add indexes for performance
- [ ] Update `user_preferences` to store key derivation salt

### Phase 2: Core Encryption
- [ ] Implement key derivation functions
- [ ] Implement AES-256-GCM encryption/decryption
- [ ] Create encryption service layer
- [ ] Add unit tests for encryption functions

### Phase 3: Access Control
- [ ] Implement permission checking before decryption
- [ ] Create friend access key sharing mechanism
- [ ] Implement owner access flow
- [ ] Implement friend access flow

### Phase 4: API Integration
- [ ] Update deed creation API to support encryption
- [ ] Update deed retrieval API to decrypt on-the-fly
- [ ] Update permission granting API
- [ ] Add encryption status to API responses

### Phase 5: Security Hardening
- [ ] Implement key rotation mechanism
- [ ] Add audit logging for encrypted deed access
- [ ] Implement recovery key mechanism (optional)
- [ ] Security audit and penetration testing

---

## Example Usage

### Creating an Encrypted Deed

```python
# User creates a new encrypted deed
deed_id = create_deed(user_id=123, category_type='hasanaat', is_encrypted=True)

# Derive encryption key
user_password = get_user_password(user_id)  # From secure session
master_key = derive_user_master_key(user_id, user_password, user_salt)
deed_key = derive_deed_key(master_key, deed_id)

# Create encrypted deed items
deed_item_data = {
    'name': 'Private Prayer',
    'description': 'Personal prayer intentions',
    'is_encrypted': True
}

# Encrypt before storing
encrypted_name = encrypt_deed_item_name(deed_item_data['name'], deed_key)
encrypted_description = encrypt_deed_item_description(
    deed_item_data['description'], 
    deed_key
)

# Store encrypted data
create_deed_item(
    deed_id=deed_id,
    name_encrypted=encrypted_name,
    description_encrypted=encrypted_description,
    is_encrypted=True
)

# Store encrypted deed key
store_deed_encryption_key(deed_id, user_id, deed_key, master_key)
```

### Friend Accessing Encrypted Deed

```python
# Friend requests to view encrypted deed
friend_user_id = 456
deed_id = 789
friend_password = get_user_password(friend_user_id)

# Check permission
if has_permission(friend_user_id, deed_id, 'read'):
    # Get shared encryption key
    deed_key = get_friend_deed_key(friend_user_id, deed_id, relation_id, friend_password)
    
    # Decrypt and return
    decrypted_items = get_deed_items_decrypted(deed_id, friend_user_id, friend_password)
    return decrypted_items
else:
    raise PermissionError("No permission to view this deed")
```

---

## Performance Considerations

1. **Encryption Overhead**: AES-256-GCM is fast, but adds ~10-20ms per encryption/decryption
2. **Key Derivation**: PBKDF2 with 100k iterations takes ~200-500ms (acceptable for login)
3. **Caching**: Cache derived keys in memory (encrypted) during user session
4. **Indexing**: Cannot index encrypted fields - use separate metadata fields for queries
5. **Bulk Operations**: Batch encrypt/decrypt operations for better performance

---

## Compliance & Audit

### Audit Logging
All access to encrypted deeds should be logged:

```sql
CREATE TABLE encrypted_deed_access_log (
    log_id BIGSERIAL PRIMARY KEY,
    deed_id BIGINT NOT NULL REFERENCES deeds(deed_id),
    accessed_by_user_id BIGINT NOT NULL REFERENCES users(user_id),
    access_type VARCHAR(50) NOT NULL, -- 'owner_read', 'friend_read', 'friend_write'
    relation_id BIGINT REFERENCES relations(relation_id),
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_encrypted_access_deed ON encrypted_deed_access_log(deed_id, accessed_at DESC);
CREATE INDEX idx_encrypted_access_user ON encrypted_deed_access_log(accessed_by_user_id, accessed_at DESC);
```

---

## Conclusion

This encryption strategy ensures that:
1. ✅ Database administrators cannot view encrypted deed content
2. ✅ Only the deed owner and explicitly permitted friends can decrypt
3. ✅ Access control is enforced at both database and application levels
4. ✅ Keys are derived from user passwords, never stored in plaintext
5. ✅ All access is auditable for security compliance

The implementation requires careful attention to key management, access control, and security best practices. Regular security audits and penetration testing are recommended.

