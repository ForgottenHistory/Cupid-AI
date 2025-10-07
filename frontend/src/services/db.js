import { openDB } from 'idb';

const DB_NAME = 'ai-dater-db';
const DB_VERSION = 1;

// Object store names
export const STORES = {
  CHARACTERS: 'characters',
};

/**
 * Initialize IndexedDB database
 */
export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Create characters store if it doesn't exist
      if (!db.objectStoreNames.contains(STORES.CHARACTERS)) {
        const characterStore = db.createObjectStore(STORES.CHARACTERS, {
          keyPath: 'id',
        });

        // Create indexes for efficient querying
        characterStore.createIndex('userId', 'userId', { unique: false });
        characterStore.createIndex('isLiked', 'isLiked', { unique: false });
        characterStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        characterStore.createIndex('name', 'name', { unique: false });

        console.log('✅ IndexedDB: Characters store created');
      }
    },
  });
}

/**
 * Get database instance
 */
export async function getDB() {
  return initDB();
}
