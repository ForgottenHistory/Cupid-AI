import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize SQLite database
const db = new Database(join(__dirname, '..', '..', 'database.db'));

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

    // Migration: Add Decision LLM settings columns to users table
    if (!userColumnNames.includes('decision_llm_model')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN decision_llm_model TEXT DEFAULT 'deepseek/deepseek-chat-v3';
        ALTER TABLE users ADD COLUMN decision_llm_temperature REAL DEFAULT 0.7;
        ALTER TABLE users ADD COLUMN decision_llm_max_tokens INTEGER DEFAULT 500;
        ALTER TABLE users ADD COLUMN decision_llm_top_p REAL DEFAULT 1.0;
        ALTER TABLE users ADD COLUMN decision_llm_frequency_penalty REAL DEFAULT 0.0;
        ALTER TABLE users ADD COLUMN decision_llm_presence_penalty REAL DEFAULT 0.0;
        ALTER TABLE users ADD COLUMN decision_llm_context_window INTEGER DEFAULT 2000;
      `);
      console.log('✅ Decision LLM settings columns added to users table');
    }

    // Migration: Add reaction column to messages table
    const messagesColumns = db.pragma('table_info(messages)');
    const messagesColumnNames = messagesColumns.map(col => col.name);

    if (!messagesColumnNames.includes('reaction')) {
      db.exec(`ALTER TABLE messages ADD COLUMN reaction TEXT;`);
      console.log('✅ reaction column added to messages table');
    }

    // Migration: Add schedule columns to characters table
    const charactersColumns = db.pragma('table_info(characters)');
    const charactersColumnNames = charactersColumns.map(col => col.name);

    if (!charactersColumnNames.includes('schedule_data')) {
      db.exec(`
        ALTER TABLE characters ADD COLUMN schedule_data TEXT;
        ALTER TABLE characters ADD COLUMN schedule_generated_at TIMESTAMP;
      `);
      console.log('✅ schedule_data and schedule_generated_at columns added to characters table');
    }

    // Migration: Create character_states table
    db.exec(`
      CREATE TABLE IF NOT EXISTS character_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        character_id TEXT NOT NULL,
        current_status TEXT DEFAULT 'online',
        engagement_state TEXT DEFAULT 'disengaged',
        engagement_messages_remaining INTEGER DEFAULT 0,
        last_check_time TIMESTAMP,
        message_queue TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        UNIQUE(user_id, character_id)
      );
    `);
    console.log('✅ character_states table created');

    // Create index for character_states
    db.exec(`CREATE INDEX IF NOT EXISTS idx_character_states_lookup ON character_states(user_id, character_id);`);

    // Migration: Add engagement tracking columns to character_states table
    const characterStatesColumns = db.pragma('table_info(character_states)');
    const characterStatesColumnNames = characterStatesColumns.map(col => col.name);

    if (!characterStatesColumnNames.includes('engagement_started_at')) {
      db.exec(`
        ALTER TABLE character_states ADD COLUMN engagement_started_at TIMESTAMP;
        ALTER TABLE character_states ADD COLUMN departed_status TEXT;
      `);
      console.log('✅ engagement_started_at and departed_status columns added to character_states table');
    }

    // Migration: Add personality_data column to characters table
    if (!charactersColumnNames.includes('personality_data')) {
      db.exec(`ALTER TABLE characters ADD COLUMN personality_data TEXT;`);
      console.log('✅ personality_data column added to characters table');
    }

    // Migration: Add proactive message tracking to users table
    if (!userColumnNames.includes('proactive_messages_today')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN proactive_messages_today INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN last_proactive_date TEXT;
      `);
      console.log('✅ proactive_messages_today and last_proactive_date columns added to users table');
    }

    // Migration: Add super like tracking to users table
    if (!userColumnNames.includes('super_likes_today')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN super_likes_today INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN last_super_like_date TEXT;
      `);
      console.log('✅ super_likes_today and last_super_like_date columns added to users table');
    }

    // Migration: Add is_super_like column to characters table
    if (!charactersColumnNames.includes('is_super_like')) {
      db.exec(`ALTER TABLE characters ADD COLUMN is_super_like BOOLEAN DEFAULT 0;`);
      console.log('✅ is_super_like column added to characters table');
    }

    // Migration: Add proactive message rate limiting columns
    if (!userColumnNames.includes('last_global_proactive_at')) {
      db.exec(`ALTER TABLE users ADD COLUMN last_global_proactive_at TIMESTAMP;`);
      console.log('✅ last_global_proactive_at column added to users table');
    }

    if (!charactersColumnNames.includes('last_proactive_at')) {
      db.exec(`ALTER TABLE characters ADD COLUMN last_proactive_at TIMESTAMP;`);
      console.log('✅ last_proactive_at column added to characters table');
    }

    // Migration: Add swipe limit tracking to users table
    if (!userColumnNames.includes('swipes_today')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN swipes_today INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN last_swipe_date TEXT;
      `);
      console.log('✅ swipes_today and last_swipe_date columns added to users table');
    }

    // Migration: Add voice_id column to characters table
    if (!charactersColumnNames.includes('voice_id')) {
      db.exec(`ALTER TABLE characters ADD COLUMN voice_id TEXT;`);
      console.log('✅ voice_id column added to characters table');
    }

    // Migration: Add message_type and audio_url columns to messages table
    if (!messagesColumnNames.includes('message_type')) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text';
        ALTER TABLE messages ADD COLUMN audio_url TEXT;
      `);
      console.log('✅ message_type and audio_url columns added to messages table');
    }

    // Migration: Add image_tags column to characters table
    if (!charactersColumnNames.includes('image_tags')) {
      db.exec(`ALTER TABLE characters ADD COLUMN image_tags TEXT;`);
      console.log('✅ image_tags column added to characters table');
    }

    // Migration: Add image_url column to messages table
    if (!messagesColumnNames.includes('image_url')) {
      db.exec(`ALTER TABLE messages ADD COLUMN image_url TEXT;`);
      console.log('✅ image_url column added to messages table');
    }

    // Migration: Add image_tags column to messages table
    if (!messagesColumnNames.includes('image_tags')) {
      db.exec(`ALTER TABLE messages ADD COLUMN image_tags TEXT;`);
      console.log('✅ image_tags column added to messages table');
    }

    // Migration: Add is_proactive column to messages table
    if (!messagesColumnNames.includes('is_proactive')) {
      db.exec(`ALTER TABLE messages ADD COLUMN is_proactive INTEGER DEFAULT 0;`);
      console.log('✅ is_proactive column added to messages table');
    }

    // Migration: Add image_prompt column to messages table
    if (!messagesColumnNames.includes('image_prompt')) {
      db.exec(`ALTER TABLE messages ADD COLUMN image_prompt TEXT;`);
      console.log('✅ image_prompt column added to messages table');
    }

    // Migration: Add Stable Diffusion settings columns to users table
    if (!userColumnNames.includes('sd_steps')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN sd_steps INTEGER DEFAULT 30;
        ALTER TABLE users ADD COLUMN sd_cfg_scale REAL DEFAULT 7.0;
        ALTER TABLE users ADD COLUMN sd_sampler TEXT DEFAULT 'DPM++ 2M';
        ALTER TABLE users ADD COLUMN sd_scheduler TEXT DEFAULT 'Karras';
        ALTER TABLE users ADD COLUMN sd_enable_hr INTEGER DEFAULT 1;
        ALTER TABLE users ADD COLUMN sd_hr_scale REAL DEFAULT 1.5;
        ALTER TABLE users ADD COLUMN sd_hr_upscaler TEXT DEFAULT 'remacri_original';
        ALTER TABLE users ADD COLUMN sd_hr_steps INTEGER DEFAULT 15;
        ALTER TABLE users ADD COLUMN sd_hr_cfg REAL DEFAULT 5.0;
        ALTER TABLE users ADD COLUMN sd_denoising_strength REAL DEFAULT 0.7;
        ALTER TABLE users ADD COLUMN sd_enable_adetailer INTEGER DEFAULT 1;
        ALTER TABLE users ADD COLUMN sd_adetailer_model TEXT DEFAULT 'face_yolov8n.pt';
      `);
      console.log('✅ Stable Diffusion settings columns added to users table');
    }

    // Migration: Add SD main prompt, negative prompt, and model columns
    if (!userColumnNames.includes('sd_main_prompt')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN sd_main_prompt TEXT DEFAULT 'masterpiece, best quality, amazing quality';
        ALTER TABLE users ADD COLUMN sd_negative_prompt TEXT DEFAULT 'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';
        ALTER TABLE users ADD COLUMN sd_model TEXT DEFAULT '';
      `);
      console.log('✅ SD main prompt, negative prompt, and model columns added to users table');
    }

    // Migration: Populate image_url from card_data for existing characters
    const existingCharacters = db.prepare('SELECT id, card_data FROM characters WHERE image_url IS NULL').all();
    let migratedCount = 0;
    for (const char of existingCharacters) {
      try {
        const cardData = JSON.parse(char.card_data);
        if (cardData.image) {
          db.prepare('UPDATE characters SET image_url = ? WHERE id = ?').run(cardData.image, char.id);
          migratedCount++;
        }
      } catch (error) {
        console.error(`Failed to migrate image for character ${char.id}:`, error.message);
      }
    }
    if (migratedCount > 0) {
      console.log(`✅ Migrated ${migratedCount} character images from card_data`);
    }

    // Migration: Create posts table for social media feed
    db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id TEXT,
        user_id INTEGER,
        content TEXT NOT NULL,
        image_url TEXT,
        post_type TEXT DEFAULT 'text',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ posts table created');

    // Create index for posts
    db.exec(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_posts_character ON posts(character_id);`);
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Run initialization
initializeDatabase();

export default db;

