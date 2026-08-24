// lib/db.ts
// IndexedDB holds the two things that need structured-clone storage:
// captured image blobs, and the non-extractable device signing keypair
// (our stand-in for a TEE-resident attestation key).

const DB_NAME = "ciphera";
const DB_VERSION = 1;
const IMAGES_STORE = "images";
const KEYS_STORE = "device_keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const store = db.createObjectStore(IMAGES_STORE, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
      }
      if (!db.objectStoreNames.contains(KEYS_STORE)) {
        db.createObjectStore(KEYS_STORE, { keyPath: "userId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putImage(record: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGES_STORE, "readwrite");
    tx.objectStore(IMAGES_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImagesForUser(userId: string): Promise<any[]> {
  // Filtering in JS instead of querying the "userId" index deliberately --
  // an IndexedDB index only gets created in onupgradeneeded, which only
  // runs when the DB version increases. If this browser's "ciphera" DB was
  // first created before that index existed and DB_VERSION never bumped,
  // the index silently wouldn't exist and this query would fail. Filtering
  // over getAll() can't have that failure mode.
  const all = await getAllImages();
  return all.filter((img) => img.userId === userId);
}

export async function getAllImages(): Promise<any[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGES_STORE, "readonly");
    const req = tx.objectStore(IMAGES_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getImage(id: string): Promise<any | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGES_STORE, "readonly");
    const req = tx.objectStore(IMAGES_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGES_STORE, "readwrite");
    tx.objectStore(IMAGES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putDeviceKeyPair(
  userId: string,
  keyPair: CryptoKeyPair
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEYS_STORE, "readwrite");
    tx.objectStore(KEYS_STORE).put({ userId, keyPair });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDeviceKeyPair(
  userId: string
): Promise<CryptoKeyPair | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEYS_STORE, "readonly");
    const req = tx.objectStore(KEYS_STORE).get(userId);
    req.onsuccess = () => resolve(req.result?.keyPair);
    req.onerror = () => reject(req.error);
  });
}
