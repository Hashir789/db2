const crypto = require('crypto');

// -----------------------------
// Dummy data
// -----------------------------
const privateDeed = "My secret good deed entry";
const userId = "user123";
const friendId = "friend456";

// -----------------------------
// Key derivation, encryption, decryption
// -----------------------------
function deriveKey(password, salt = null) {
    if (!salt) salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    return { key, salt };
}

function encrypt(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { encryptedData: encrypted, iv, tag };
}

function decrypt(encryptedObj, key) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, encryptedObj.iv);
    decipher.setAuthTag(encryptedObj.tag);
    const decrypted = Buffer.concat([decipher.update(encryptedObj.encryptedData), decipher.final()]);
    return decrypted.toString('utf8');
}

// -----------------------------
// Simulated DB
// -----------------------------
const db = { deeds: [] };

// =============================
// Step-by-step lifecycle
// =============================

// -------- Cycle 1: User logs in, encrypts, shares --------
console.log("\n=== Step 1: User logs in and encrypts deed ===");
const userPassword = "userPassword123!";
console.log("User password:", userPassword);

const { key: userKey, salt } = deriveKey(userPassword);
console.log("Derived symmetric key (user key):", userKey.toString('hex'));
console.log("Salt:", salt.toString('hex'));

console.log("\nEncrypting deed...");
const encryptedDeed = encrypt(privateDeed, userKey);
console.log("Encrypted data:", encryptedDeed.encryptedData.toString('hex'));
console.log("IV:", encryptedDeed.iv.toString('hex'));
console.log("Auth Tag:", encryptedDeed.tag.toString('hex'));

// Store deed in DB
const deedRecord = {
    deed_id: "deed001",
    owner_id: userId,
    encrypted_data: encryptedDeed.encryptedData.toString('hex'),
    iv: encryptedDeed.iv.toString('hex'),
    auth_tag: encryptedDeed.tag.toString('hex'),
    salt: salt.toString('hex'),
    shared_with: [
        {
            friend_id: friendId,
            // Instead of sharing password, share the symmetric key directly (dummy)
            shared_key: userKey.toString('hex')
        }
    ]
};
db.deeds.push(deedRecord);

console.log("\nDB state after user encryption and sharing:");
console.log(JSON.stringify(db, null, 2));

console.log("\nUser logs out.\n");

// -------- Cycle 2: Friend logs in and decrypts --------
console.log("=== Step 2: Friend logs in and decrypts deed ===");
const friendPassword = "friendPassword456!";
console.log("Friend password:", friendPassword);

// Friend retrieves shared key from DB
const sharedKeyHex = db.deeds[0].shared_with[0].shared_key;
const sharedKey = Buffer.from(sharedKeyHex, 'hex');
console.log("Friend retrieved shared key from DB:", sharedKey.toString('hex'));

// Friend decrypts deed
const friendDecrypted = decrypt({
    encryptedData: Buffer.from(db.deeds[0].encrypted_data, 'hex'),
    iv: Buffer.from(db.deeds[0].iv, 'hex'),
    tag: Buffer.from(db.deeds[0].auth_tag, 'hex')
}, sharedKey);

console.log("Friend sees deed:", friendDecrypted);

console.log("\nFriend logs out.\n");

// -------- Cycle 3: User logs in again and decrypts --------
console.log("=== Step 3: User logs in again and decrypts deed ===");
const { key: userKeyAgain } = deriveKey(userPassword, Buffer.from(db.deeds[0].salt, 'hex'));
console.log("User derived key again:", userKeyAgain.toString('hex'));

// User decrypts
const userDecrypted = decrypt({
    encryptedData: Buffer.from(db.deeds[0].encrypted_data, 'hex'),
    iv: Buffer.from(db.deeds[0].iv, 'hex'),
    tag: Buffer.from(db.deeds[0].auth_tag, 'hex')
}, userKeyAgain);

console.log("User sees deed:", userDecrypted);

console.log("\nFinal DB state (what's stored):");
console.log(JSON.stringify(db, null, 2));
