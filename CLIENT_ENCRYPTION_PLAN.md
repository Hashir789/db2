# Kitaab Client-Side Encryption Plan

## Overview
All sensitive user data is encrypted on the client before sending to the server. The server never sees plaintext data or user passwords.

## Encryption Strategy

### Key Architecture
- **DEK (Data Encryption Key)**: Random AES-256-GCM key per deed/item
- **KEK (Key Encryption Key)**: Derived from user password via PBKDF2
- **Pattern**: Encrypt data with DEK, encrypt DEK with KEK per user

## What Gets Encrypted

### Encrypted Fields
- `deed_items.name` - Deed item names
- `deed_items.description` - Descriptions
- `entries.notes` - Entry notes (if added)
- `reflection_messages.message` - Daily reflections
- `deed_items.hide_type` - Privacy settings (if sensitive)

### Unencrypted Fields (Metadata)
- `user_id`, `deed_id`, `entry_id` - IDs for relationships
- `entry_date`, `created_at` - Timestamps for queries
- `count_value`, `scale_value_id` - Numeric values (non-sensitive)
- `category_type` - Hasanaat/Saiyyiaat (non-sensitive)

## Encryption Flow

### 1. User Registration/Login
```
User enters password → Client derives KEK via PBKDF2
- Salt: Random 16 bytes (stored server-side per user)
- Iterations: 100,000
- Hash: SHA-256
- Key length: 256 bits
```

### 2. Creating Encrypted Data
```
1. Generate random DEK (AES-256-GCM)
2. Encrypt data with DEK → ciphertext
3. Encrypt DEK with user's KEK → encrypted_DEK
4. Send to server: { ciphertext, encrypted_DEK, iv, salt }
```

### 3. Sharing with Friends (Permission-Based)
```
When User A grants permission to User B:
1. User A's client decrypts DEK using A's password
2. User B's client encrypts same DEK using B's password
3. Server stores: { ciphertext, encrypted_DEK_owner, encrypted_DEK_friend }
```

## Server Storage Schema

### Encrypted Data Table
```sql
CREATE TABLE encrypted_data (
    data_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    data_type VARCHAR(50) NOT NULL, -- 'deed_item', 'entry', 'reflection'
    reference_id BIGINT NOT NULL, -- Links to deed_item_id, entry_id, etc.
    ciphertext BYTEA NOT NULL,
    iv BYTEA NOT NULL, -- 12 bytes for AES-GCM
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE encrypted_keys (
    key_id BIGSERIAL PRIMARY KEY,
    data_id BIGINT NOT NULL REFERENCES encrypted_data(data_id),
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    encrypted_dek BYTEA NOT NULL, -- DEK encrypted with user's KEK
    salt BYTEA NOT NULL, -- PBKDF2 salt (16 bytes)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_id, user_id)
);
```

## Client Implementation

### Encryption Functions
```javascript
// Password → Key (PBKDF2)
async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt data with DEK
async function encryptData(dek, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, dek, enc.encode(plaintext)
  );
  return { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) };
}

// Encrypt DEK with user's password
async function encryptDEK(password, salt, dek) {
  const kek = await deriveKey(password, salt);
  const rawDEK = await crypto.subtle.exportKey("raw", dek);
  return encryptData(kek, rawDEK);
}
```

### Usage Example
```javascript
// Encrypt deed item name
const plaintext = "Prayed Fajr on time";
const dek = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
);

const encrypted = await encryptData(dek, plaintext);
const userSalt = crypto.getRandomValues(new Uint8Array(16));
const encryptedDEK = await encryptDEK(userPassword, userSalt, dek);

// Send to server
await api.createDeedItem({
  deed_id: 123,
  encrypted_data: {
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv
  },
  encrypted_key: {
    encrypted_dek: encryptedDEK.ciphertext,
    iv: encryptedDEK.iv,
    salt: Array.from(userSalt)
  }
});
```

## Decryption Flow

### User Reads Own Data
```
1. Client requests encrypted_data + encrypted_keys for user
2. Derive KEK from password + salt
3. Decrypt DEK using KEK
4. Decrypt data using DEK
5. Display plaintext to user
```

### Friend Reads Shared Data
```
1. Friend's client requests encrypted_data + their encrypted_keys
2. Derive friend's KEK from friend's password + salt
3. Decrypt DEK using friend's KEK
4. Decrypt data using DEK
5. Display plaintext to friend
```

## Security Considerations

### Client-Side
- ✅ Passwords never sent to server (only used for key derivation)
- ✅ Plaintext never leaves client
- ✅ Each user has unique salt (prevents rainbow table attacks)
- ✅ High PBKDF2 iterations (100k) slow brute force
- ✅ AES-256-GCM provides authenticated encryption

### Server-Side
- ✅ Server cannot decrypt data (no access to passwords)
- ✅ Encrypted keys stored separately from encrypted data
- ✅ Multiple encrypted keys per data (owner + friends)
- ✅ IV stored with ciphertext (required for decryption)

### Key Management
- ⚠️ Password loss = data loss (no recovery mechanism)
- ⚠️ Consider optional key escrow for recovery
- ⚠️ Password changes require re-encrypting all DEKs

## Implementation Checklist

- [ ] Add encryption functions to client
- [ ] Create encrypted_data and encrypted_keys tables
- [ ] Encrypt deed_items.name and description on create/update
- [ ] Encrypt reflection_messages.message
- [ ] Encrypt entries.notes (if added)
- [ ] Implement DEK sharing for permissions
- [ ] Add decryption on data fetch
- [ ] Handle password change flow (re-encrypt all DEKs)
- [ ] Add error handling for decryption failures
- [ ] Test with multiple users and permissions

## Performance Notes

- Encryption/decryption happens client-side (no server load)
- PBKDF2 is CPU-intensive (consider Web Workers for UI responsiveness)
- DEK sharing requires client-to-client key exchange (or server as intermediary)
- Batch operations: Encrypt once, share DEK with multiple users

