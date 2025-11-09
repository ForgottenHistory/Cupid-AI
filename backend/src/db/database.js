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

    // Migration: Add last_opened_at column to conversations table
    if (!convColumnNames.includes('last_opened_at')) {
      db.exec(`ALTER TABLE conversations ADD COLUMN last_opened_at TIMESTAMP;`);
      console.log('✅ last_opened_at column added to conversations table');
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

    // Migration: Add last_mood_change column to character_states table
    if (!characterStatesColumnNames.includes('last_mood_change')) {
      db.exec(`ALTER TABLE character_states ADD COLUMN last_mood_change TIMESTAMP;`);
      console.log('✅ last_mood_change column added to character_states table');
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

    // Migration: Add left-on-read rate limiting columns (separate from normal proactive)
    if (!userColumnNames.includes('left_on_read_messages_today')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN left_on_read_messages_today INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN last_left_on_read_date TEXT;
        ALTER TABLE users ADD COLUMN daily_left_on_read_limit INTEGER DEFAULT 10;
      `);
      console.log('✅ Left-on-read rate limiting columns added to users table');
    }

    if (!charactersColumnNames.includes('last_left_on_read_at')) {
      db.exec(`ALTER TABLE characters ADD COLUMN last_left_on_read_at TIMESTAMP;`);
      console.log('✅ last_left_on_read_at column added to characters table');
    }

    // Migration: Add left-on-read behavior config columns to users table
    if (!userColumnNames.includes('left_on_read_trigger_min')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN left_on_read_trigger_min INTEGER DEFAULT 5;
        ALTER TABLE users ADD COLUMN left_on_read_trigger_max INTEGER DEFAULT 15;
        ALTER TABLE users ADD COLUMN left_on_read_character_cooldown INTEGER DEFAULT 120;
      `);
      console.log('✅ Left-on-read behavior config columns added to users table');
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

    // Migration: Add contextual_tags column to characters table
    if (!charactersColumnNames.includes('contextual_tags')) {
      db.exec(`ALTER TABLE characters ADD COLUMN contextual_tags TEXT;`);
      console.log('✅ contextual_tags column added to characters table');
    }

    // Migration: Add prompt override columns to characters table
    if (!charactersColumnNames.includes('main_prompt_override')) {
      db.exec(`ALTER TABLE characters ADD COLUMN main_prompt_override TEXT;`);
      console.log('✅ main_prompt_override column added to characters table');
    }

    if (!charactersColumnNames.includes('negative_prompt_override')) {
      db.exec(`ALTER TABLE characters ADD COLUMN negative_prompt_override TEXT;`);
      console.log('✅ negative_prompt_override column added to characters table');
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

    // Migration: Add reasoning column to messages table (for reasoning models)
    if (!messagesColumnNames.includes('reasoning')) {
      db.exec(`ALTER TABLE messages ADD COLUMN reasoning TEXT;`);
      console.log('✅ reasoning column added to messages table');
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

    // Migration: Add auto-match tracking to users table
    if (!userColumnNames.includes('last_auto_match_date')) {
      db.exec(`ALTER TABLE users ADD COLUMN last_auto_match_date TEXT;`);
      console.log('✅ last_auto_match_date column added to users table');
    }

    // Migration: Add behavior settings columns to users table
    if (!userColumnNames.includes('max_emojis_per_message')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN max_emojis_per_message INTEGER DEFAULT 2;
        ALTER TABLE users ADD COLUMN proactive_message_hours INTEGER DEFAULT 4;
        ALTER TABLE users ADD COLUMN daily_proactive_limit INTEGER DEFAULT 5;
        ALTER TABLE users ADD COLUMN pacing_style TEXT DEFAULT 'balanced';
      `);
      console.log('✅ Behavior settings columns added to users table');
    }

    // Migration: Add proactive message away/busy chance columns to users table
    if (!userColumnNames.includes('proactive_away_chance')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN proactive_away_chance INTEGER DEFAULT 50;
        ALTER TABLE users ADD COLUMN proactive_busy_chance INTEGER DEFAULT 10;
      `);
      console.log('✅ Proactive away/busy chance columns added to users table');
    }

    // Migration: Add proactive check interval columns to users table
    if (!userColumnNames.includes('proactive_check_interval')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN proactive_check_interval INTEGER DEFAULT 5;
        ALTER TABLE users ADD COLUMN last_proactive_check_at TIMESTAMP;
      `);
      console.log('✅ Proactive check interval columns added to users table');
    }

    // Migration: Add AI provider columns to users table
    if (!userColumnNames.includes('llm_provider')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN llm_provider TEXT DEFAULT 'openrouter';
        ALTER TABLE users ADD COLUMN decision_llm_provider TEXT DEFAULT 'openrouter';
      `);
      console.log('✅ llm_provider and decision_llm_provider columns added to users table');
    }

    // Migration: Add Image Tag LLM settings columns to users table
    if (!userColumnNames.includes('imagetag_llm_model')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN imagetag_llm_provider TEXT DEFAULT 'openrouter';
        ALTER TABLE users ADD COLUMN imagetag_llm_model TEXT DEFAULT 'x-ai/grok-4-fast';
        ALTER TABLE users ADD COLUMN imagetag_llm_temperature REAL DEFAULT 0.7;
        ALTER TABLE users ADD COLUMN imagetag_llm_max_tokens INTEGER DEFAULT 4000;
        ALTER TABLE users ADD COLUMN imagetag_llm_top_p REAL DEFAULT 1.0;
        ALTER TABLE users ADD COLUMN imagetag_llm_frequency_penalty REAL DEFAULT 0.0;
        ALTER TABLE users ADD COLUMN imagetag_llm_presence_penalty REAL DEFAULT 0.0;
      `);
      console.log('✅ Image Tag LLM settings columns added to users table');
    }

    // Migration: Add consecutive proactive tracking columns to characters table
    // Refresh charactersColumnNames before checking
    const charactersColumnsRefresh = db.pragma('table_info(characters)');
    const charactersColumnNamesRefresh = charactersColumnsRefresh.map(col => col.name);

    if (!charactersColumnNamesRefresh.includes('consecutive_proactive_count')) {
      db.exec(`
        ALTER TABLE characters ADD COLUMN consecutive_proactive_count INTEGER DEFAULT 0;
        ALTER TABLE characters ADD COLUMN current_proactive_cooldown INTEGER DEFAULT 60;
      `);
      console.log('✅ consecutive_proactive_count and current_proactive_cooldown columns added to characters table');
    }

    // Migration: Add max consecutive proactive limit to users table
    // Refresh userColumnNames before checking
    const userColumnsRefresh = db.pragma('table_info(users)');
    const userColumnNamesRefresh = userColumnsRefresh.map(col => col.name);

    if (!userColumnNamesRefresh.includes('max_consecutive_proactive')) {
      db.exec(`ALTER TABLE users ADD COLUMN max_consecutive_proactive INTEGER DEFAULT 4;`);
      console.log('✅ max_consecutive_proactive column added to users table');
    }

    if (!userColumnNamesRefresh.includes('proactive_cooldown_multiplier')) {
      db.exec(`ALTER TABLE users ADD COLUMN proactive_cooldown_multiplier REAL DEFAULT 2.0;`);
      console.log('✅ proactive_cooldown_multiplier column added to users table');
    }

    if (!userColumnNamesRefresh.includes('daily_swipe_limit')) {
      db.exec(`ALTER TABLE users ADD COLUMN daily_swipe_limit INTEGER DEFAULT 5;`);
      console.log('✅ daily_swipe_limit column added to users table');
    }

    if (!userColumnNamesRefresh.includes('daily_auto_match_enabled')) {
      db.exec(`ALTER TABLE users ADD COLUMN daily_auto_match_enabled INTEGER DEFAULT 1;`);
      console.log('✅ daily_auto_match_enabled column added to users table');
    }

    if (!userColumnNamesRefresh.includes('compaction_enabled')) {
      db.exec(`ALTER TABLE users ADD COLUMN compaction_enabled INTEGER DEFAULT 1;`);
      console.log('✅ compaction_enabled column added to users table');
    }

    if (!userColumnNamesRefresh.includes('max_memories')) {
      db.exec(`ALTER TABLE users ADD COLUMN max_memories INTEGER DEFAULT 50;`);
      console.log('✅ max_memories column added to users table');
    }

    if (!userColumnNamesRefresh.includes('thought_frequency')) {
      db.exec(`ALTER TABLE users ADD COLUMN thought_frequency INTEGER DEFAULT 10;`);
      console.log('✅ thought_frequency column added to users table');
    }

    if (!userColumnNamesRefresh.includes('max_matches')) {
      db.exec(`ALTER TABLE users ADD COLUMN max_matches INTEGER DEFAULT 0;`);
      console.log('✅ max_matches column added to users table');
    }

    if (!userColumnNamesRefresh.includes('memory_degradation_points')) {
      db.exec(`ALTER TABLE users ADD COLUMN memory_degradation_points INTEGER DEFAULT 0;`);
      console.log('✅ memory_degradation_points column added to users table');
    }

    if (!userColumnNamesRefresh.includes('auto_unmatch_after_proactive')) {
      db.exec(`ALTER TABLE users ADD COLUMN auto_unmatch_after_proactive INTEGER DEFAULT 1;`);
      console.log('✅ auto_unmatch_after_proactive column added to users table');
    }

    // Migration: Update messages table to allow 'system' role
    // Check if the constraint needs updating
    const messagesSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
    if (messagesSchema && messagesSchema.sql.includes("CHECK(role IN ('user', 'assistant'))")) {
      console.log('🔄 Updating messages table to allow system role...');

      // SQLite doesn't support ALTER TABLE for CHECK constraints, so we need to recreate the table
      db.exec(`
        PRAGMA foreign_keys=OFF;

        BEGIN TRANSACTION;

        -- Create new table with updated constraint
        CREATE TABLE messages_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reaction TEXT,
          message_type TEXT DEFAULT 'text',
          audio_url TEXT,
          image_url TEXT,
          image_tags TEXT,
          is_proactive INTEGER DEFAULT 0,
          image_prompt TEXT,
          reasoning TEXT,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        -- Copy data from old table
        INSERT INTO messages_new SELECT * FROM messages;

        -- Drop old table
        DROP TABLE messages;

        -- Rename new table
        ALTER TABLE messages_new RENAME TO messages;

        -- Recreate index
        CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

        COMMIT;

        PRAGMA foreign_keys=ON;
      `);

      console.log('✅ messages table updated to allow system role');
    }

    // Migration: Add conversation compacting settings to users table
    if (!userColumnNamesRefresh.includes('compact_threshold')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN compact_threshold INTEGER DEFAULT 26000;
        ALTER TABLE users ADD COLUMN compact_target INTEGER DEFAULT 20000;
        ALTER TABLE users ADD COLUMN keep_uncompacted_messages INTEGER DEFAULT 30;
        ALTER TABLE users ADD COLUMN max_summaries INTEGER DEFAULT 5;
      `);
      console.log('✅ Conversation compacting settings columns added to users table');
    }

    // Migration: Convert compact threshold/target to percentages
    if (!userColumnNamesRefresh.includes('compact_threshold_percent')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN compact_threshold_percent INTEGER DEFAULT 90;
        ALTER TABLE users ADD COLUMN compact_target_percent INTEGER DEFAULT 70;
      `);
      console.log('✅ Converted compact settings to percentages');
    }

    // Migration: Add auto-unmatch inactive conversations setting
    if (!userColumnNamesRefresh.includes('auto_unmatch_inactive_days')) {
      db.exec(`ALTER TABLE users ADD COLUMN auto_unmatch_inactive_days INTEGER DEFAULT 0;`);
      console.log('✅ auto_unmatch_inactive_days column added to users table');
    }

    // Migration: Add gap_duration_hours column to messages table and migrate TIME GAP markers
    // Refresh messagesColumnNames before checking
    const messagesColumnsRefresh = db.pragma('table_info(messages)');
    const messagesColumnNamesRefresh = messagesColumnsRefresh.map(col => col.name);

    if (!messagesColumnNamesRefresh.includes('gap_duration_hours')) {
      db.exec(`ALTER TABLE messages ADD COLUMN gap_duration_hours REAL;`);
      console.log('✅ gap_duration_hours column added to messages table');

      // Migrate existing TIME GAP markers from content-based to type-based
      // Find all messages with content starting with '[TIME GAP:'
      const timeGapMessages = db.prepare(`
        SELECT id, content FROM messages
        WHERE content LIKE '[TIME GAP:%'
      `).all();

      let migratedTimeGaps = 0;
      for (const msg of timeGapMessages) {
        try {
          // Extract gap hours from content: "[TIME GAP: 5.2 hours - NEW CONVERSATION SESSION]"
          const match = msg.content.match(/\[TIME GAP:\s*([0-9.]+)\s*hours/);
          if (match) {
            const gapHours = parseFloat(match[1]);
            db.prepare(`
              UPDATE messages
              SET message_type = 'time_gap',
                  gap_duration_hours = ?
              WHERE id = ?
            `).run(gapHours, msg.id);
            migratedTimeGaps++;
          }
        } catch (error) {
          console.error(`Failed to migrate TIME GAP message ${msg.id}:`, error.message);
        }
      }

      if (migratedTimeGaps > 0) {
        console.log(`✅ Migrated ${migratedTimeGaps} TIME GAP markers to type-based system`);
      }

      // Also migrate existing summary messages to use message_type
      const summaryMessages = db.prepare(`
        SELECT id FROM messages
        WHERE content LIKE '[SUMMARY:%'
        AND message_type != 'summary'
      `).all();

      if (summaryMessages.length > 0) {
        db.exec(`
          UPDATE messages
          SET message_type = 'summary'
          WHERE content LIKE '[SUMMARY:%'
          AND message_type != 'summary'
        `);
        console.log(`✅ Migrated ${summaryMessages.length} SUMMARY markers to type-based system`);
      }
    }

    // Migration: Add advanced LLM parameters (top_k, repetition_penalty, min_p) for all three LLM types
    // Refresh userColumnNames before checking
    const userColumnsRefreshAdvanced = db.pragma('table_info(users)');
    const userColumnNamesRefreshAdvanced = userColumnsRefreshAdvanced.map(col => col.name);

    if (!userColumnNamesRefreshAdvanced.includes('llm_top_k')) {
      db.exec(`
        ALTER TABLE users ADD COLUMN llm_top_k INTEGER DEFAULT -1;
        ALTER TABLE users ADD COLUMN llm_repetition_penalty REAL DEFAULT 1.0;
        ALTER TABLE users ADD COLUMN llm_min_p REAL DEFAULT 0.0;
        ALTER TABLE users ADD COLUMN decision_llm_top_k INTEGER DEFAULT -1;
        ALTER TABLE users ADD COLUMN decision_llm_repetition_penalty REAL DEFAULT 1.0;
        ALTER TABLE users ADD COLUMN decision_llm_min_p REAL DEFAULT 0.0;
        ALTER TABLE users ADD COLUMN imagetag_llm_top_k INTEGER DEFAULT -1;
        ALTER TABLE users ADD COLUMN imagetag_llm_repetition_penalty REAL DEFAULT 1.0;
        ALTER TABLE users ADD COLUMN imagetag_llm_min_p REAL DEFAULT 0.0;
      `);
      console.log('✅ Advanced LLM parameters (top_k, repetition_penalty, min_p) added for all LLM types');
    }

    // Migration: Add memory_data column to characters table for long-term memory
    // Refresh charactersColumnNames before checking
    const charactersColumnsRefreshMemory = db.pragma('table_info(characters)');
    const charactersColumnNamesRefreshMemory = charactersColumnsRefreshMemory.map(col => col.name);

    if (!charactersColumnNamesRefreshMemory.includes('memory_data')) {
      db.exec(`ALTER TABLE characters ADD COLUMN memory_data TEXT;`);
      console.log('✅ memory_data column added to characters table for long-term memory');
    }

    // Migration: Add post_instructions column to characters table
    if (!charactersColumnNamesRefreshMemory.includes('post_instructions')) {
      db.exec(`ALTER TABLE characters ADD COLUMN post_instructions TEXT;`);
      console.log('✅ post_instructions column added to characters table');
    }

    // Migration: Make email column optional (nullable)
    // SQLite doesn't support ALTER COLUMN, so we recreate the table if email is NOT NULL
    const usersSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (usersSchema && usersSchema.sql.includes('email TEXT UNIQUE NOT NULL')) {
      console.log('🔄 Making email column optional in users table...');

      // Get all existing columns from users table
      const usersColumnsForEmail = db.pragma('table_info(users)');

      db.exec(`
        PRAGMA foreign_keys=OFF;

        BEGIN TRANSACTION;

        -- Create new table with email as optional
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          bio TEXT,
          profile_image TEXT,
          llm_model TEXT DEFAULT 'deepseek/deepseek-chat-v3',
          llm_temperature REAL DEFAULT 0.8,
          llm_max_tokens INTEGER DEFAULT 800,
          llm_top_p REAL DEFAULT 1.0,
          llm_frequency_penalty REAL DEFAULT 0.0,
          llm_presence_penalty REAL DEFAULT 0.0,
          llm_context_window INTEGER DEFAULT 4000,
          llm_provider TEXT DEFAULT 'openrouter',
          llm_top_k INTEGER DEFAULT -1,
          llm_repetition_penalty REAL DEFAULT 1.0,
          llm_min_p REAL DEFAULT 0.0,
          decision_llm_model TEXT DEFAULT 'deepseek/deepseek-chat-v3',
          decision_llm_temperature REAL DEFAULT 0.7,
          decision_llm_max_tokens INTEGER DEFAULT 500,
          decision_llm_top_p REAL DEFAULT 1.0,
          decision_llm_frequency_penalty REAL DEFAULT 0.0,
          decision_llm_presence_penalty REAL DEFAULT 0.0,
          decision_llm_context_window INTEGER DEFAULT 2000,
          decision_llm_provider TEXT DEFAULT 'openrouter',
          decision_llm_top_k INTEGER DEFAULT -1,
          decision_llm_repetition_penalty REAL DEFAULT 1.0,
          decision_llm_min_p REAL DEFAULT 0.0,
          imagetag_llm_provider TEXT DEFAULT 'openrouter',
          imagetag_llm_model TEXT DEFAULT 'x-ai/grok-4-fast',
          imagetag_llm_temperature REAL DEFAULT 0.7,
          imagetag_llm_max_tokens INTEGER DEFAULT 4000,
          imagetag_llm_top_p REAL DEFAULT 1.0,
          imagetag_llm_frequency_penalty REAL DEFAULT 0.0,
          imagetag_llm_presence_penalty REAL DEFAULT 0.0,
          imagetag_llm_top_k INTEGER DEFAULT -1,
          imagetag_llm_repetition_penalty REAL DEFAULT 1.0,
          imagetag_llm_min_p REAL DEFAULT 0.0,
          proactive_messages_today INTEGER DEFAULT 0,
          last_proactive_date TEXT,
          super_likes_today INTEGER DEFAULT 0,
          last_super_like_date TEXT,
          last_global_proactive_at TIMESTAMP,
          left_on_read_messages_today INTEGER DEFAULT 0,
          last_left_on_read_date TEXT,
          daily_left_on_read_limit INTEGER DEFAULT 10,
          left_on_read_trigger_min INTEGER DEFAULT 5,
          left_on_read_trigger_max INTEGER DEFAULT 15,
          left_on_read_character_cooldown INTEGER DEFAULT 120,
          swipes_today INTEGER DEFAULT 0,
          last_swipe_date TEXT,
          sd_steps INTEGER DEFAULT 30,
          sd_cfg_scale REAL DEFAULT 7.0,
          sd_sampler TEXT DEFAULT 'DPM++ 2M',
          sd_scheduler TEXT DEFAULT 'Karras',
          sd_enable_hr INTEGER DEFAULT 1,
          sd_hr_scale REAL DEFAULT 1.5,
          sd_hr_upscaler TEXT DEFAULT 'remacri_original',
          sd_hr_steps INTEGER DEFAULT 15,
          sd_hr_cfg REAL DEFAULT 5.0,
          sd_denoising_strength REAL DEFAULT 0.7,
          sd_enable_adetailer INTEGER DEFAULT 1,
          sd_adetailer_model TEXT DEFAULT 'face_yolov8n.pt',
          sd_main_prompt TEXT DEFAULT 'masterpiece, best quality, amazing quality',
          sd_negative_prompt TEXT DEFAULT 'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
          sd_model TEXT DEFAULT '',
          posts_today INTEGER DEFAULT 0,
          last_post_date TEXT,
          last_auto_match_date TEXT,
          max_emojis_per_message INTEGER DEFAULT 2,
          proactive_message_hours INTEGER DEFAULT 4,
          daily_proactive_limit INTEGER DEFAULT 5,
          pacing_style TEXT DEFAULT 'balanced',
          proactive_away_chance INTEGER DEFAULT 50,
          proactive_busy_chance INTEGER DEFAULT 10,
          proactive_check_interval INTEGER DEFAULT 5,
          last_proactive_check_at TIMESTAMP,
          max_consecutive_proactive INTEGER DEFAULT 4,
          proactive_cooldown_multiplier REAL DEFAULT 2.0,
          compact_threshold INTEGER DEFAULT 26000,
          compact_target INTEGER DEFAULT 20000,
          keep_uncompacted_messages INTEGER DEFAULT 30,
          max_summaries INTEGER DEFAULT 5,
          compact_threshold_percent INTEGER DEFAULT 90,
          compact_target_percent INTEGER DEFAULT 70,
          auto_unmatch_inactive_days INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Copy data from old table (set email to NULL for users without email)
        INSERT INTO users_new SELECT * FROM users;

        -- Drop old table
        DROP TABLE users;

        -- Rename new table
        ALTER TABLE users_new RENAME TO users;

        COMMIT;

        PRAGMA foreign_keys=ON;
      `);

      console.log('✅ Email column is now optional in users table');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Run initialization
initializeDatabase();

export default db;

