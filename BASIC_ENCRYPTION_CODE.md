(async () => {
  /* ============================
     Helpers
  ============================ */
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const toArr = buf => Array.from(new Uint8Array(buf));
  const toBuf = arr => new Uint8Array(arr);

  /* ============================
     Password → Key
  ============================ */
  async function passwordToKey(password, salt) {
    const material = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /* ============================
     AES Encrypt / Decrypt
  ============================ */
  async function encryptAES(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    return { iv: toArr(iv), cipher: toArr(cipher) };
  }

  async function decryptAES(key, encrypted) {
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toBuf(encrypted.iv) },
      key,
      toBuf(encrypted.cipher)
    );
  }

  /* ============================
     KITAB FLOW
  ============================ */

  // Users
  const ownerPassword = "hashir-password";
  const friendPassword = "ali-password";

  // Private deed
  const deed = "Gave charity secretly";

  // 1️⃣ Generate random DEK
  const DEK = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2️⃣ Encrypt deed using DEK
  const encryptedDeed = await encryptAES(DEK, enc.encode(deed));

  // 3️⃣ Protect DEK for owner
  const ownerSalt = crypto.getRandomValues(new Uint8Array(16));
  const ownerKey = await passwordToKey(ownerPassword, ownerSalt);
  const rawDEK = await crypto.subtle.exportKey("raw", DEK);
  const encDEKOwner = await encryptAES(ownerKey, rawDEK);

  // 4️⃣ Protect DEK for friend
  const friendSalt = crypto.getRandomValues(new Uint8Array(16));
  const friendKey = await passwordToKey(friendPassword, friendSalt);
  const encDEKFriend = await encryptAES(friendKey, rawDEK);

  /* ============================
     OWNER DECRYPTS
  ============================ */
  const ownerDerivedKey = await passwordToKey(ownerPassword, ownerSalt);
  const ownerDEKRaw = await decryptAES(ownerDerivedKey, encDEKOwner);
  const ownerDEK = await crypto.subtle.importKey(
    "raw",
    ownerDEKRaw,
    "AES-GCM",
    false,
    ["decrypt"]
  );

  const ownerPlain = await decryptAES(ownerDEK, encryptedDeed);
  console.log("Owner reads:", dec.decode(ownerPlain));

  /* ============================
     FRIEND DECRYPTS
  ============================ */
  const friendDerivedKey = await passwordToKey(friendPassword, friendSalt);
  const friendDEKRaw = await decryptAES(friendDerivedKey, encDEKFriend);
  const friendDEK = await crypto.subtle.importKey(
    "raw",
    friendDEKRaw,
    "AES-GCM",
    false,
    ["decrypt"]
  );

  const friendPlain = await decryptAES(friendDEK, encryptedDeed);
  console.log("Friend reads:", dec.decode(friendPlain));

  /* ============================
     WHAT SERVER STORES
  ============================ */
  console.log("DB STORES:", {
    ciphertext: encryptedDeed,
    owner_key: encDEKOwner,
    friend_key: encDEKFriend,
  });
})();