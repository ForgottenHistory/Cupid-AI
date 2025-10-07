import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize SQLite database
const db = new Database(join(__dirname, '..', '..', 'database.db'), {
  verbose: console.log
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  try {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    db.exec(schema);
    console.log('✅ Database initialized successfully');

    // Run migrations
    runMigrations();
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Migrations for adding new columns to existing tables
function runMigrations() {
  try {
    // Migration: Add LLM settings columns to users table
    const userColumns = db.pragma('table_info(users)');
    const userColumnNames = userColumns.map(col => col.name);

    if (!userColumnNames.includes('llm_model')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN llm_model TEXT DEFAULT 'deepseek/deepseek-chat-v3';
        ALTER TABLE users ADD COLUMN llm_temperature REAL DEFAULT 0.8;
        ALTER TABLE users ADD COLUMN llm_max_tokens INTEGER DEFAULT 800;
        ALTER TABLE users ADD COLUMN llm_top_p REAL DEFAULT 1.0;
        ALTER TABLE users ADD COLUMN llm_frequency_penalty REAL DEFAULT 0.0;
        ALTER TABLE users ADD COLUMN llm_presence_penalty REAL DEFAULT 0.0;
      `);
      console.log('✅ LLM settings columns added to users table');
    }

    // Migration: Add unread_count column to conversations table
    const convColumns = db.pragma('table_info(conversations)');
    const convColumnNames = convColumns.map(col => col.name);

    if (!convColumnNames.includes('unread_count')) {
      db.exec(`ALTER TABLE conversations ADD COLUMN unread_count INTEGER DEFAULT 0;`);
      console.log('✅ unread_count column added to conversations table');
    }

    // Migration: Add context_window column to users table
    if (!userColumnNames.includes('llm_context_window')) {
      db.exec(`ALTER TABLE users ADD COLUMN llm_context_window INTEGER DEFAULT 4000;`);
      console.log('✅ llm_context_window column added to users table');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Run initialization
initializeDatabase();

export default db;
