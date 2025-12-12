import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as aiGeneration from '../controllers/aiGenerationController.js';
import * as characterStatus from '../controllers/characterStatusController.js';
import * as characterInteraction from '../controllers/characterInteractionController.js';
import memoryService from '../services/memoryService.js';
import db from '../db/database.js';

const router = express.Router();

// ===== AI Generation Routes =====
router.post('/cleanup-description', authenticateToken, aiGeneration.cleanupDescription);
router.post('/generate-dating-profile', authenticateToken, aiGeneration.generateDatingProfile);
router.post('/generate-schedule', authenticateToken, aiGeneration.generateSchedule);
router.post('/generate-personality', authenticateToken, aiGeneration.generatePersonality);

// ===== Character CRUD Routes =====

// GET /api/characters - List all characters for user
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { filter = 'all', search } = req.query;

    let query = `
      SELECT id, name, card_data, image_url, thumbnail_url, is_liked, liked_at, created_at,
             schedule_data, personality_data, image_tags, contextual_tags,
             main_prompt_override, negative_prompt_override, voice_id,
             post_instructions, memory_data
      FROM characters WHERE user_id = ?
    `;
    const params = [userId];

    // Apply filter
    if (filter === 'liked') {
      query += ' AND is_liked = 1';
    } else if (filter === 'swipeable') {
      query += ' AND is_liked = 0';
    }

    // Apply search
    if (search) {
      query += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const characters = db.prepare(query).all(...params);

    // Format response
    const formatted = characters.map(char => ({
      id: char.id,
      name: char.name,
      cardData: JSON.parse(char.card_data || '{}'),
      imageUrl: char.image_url,
      thumbnailUrl: char.thumbnail_url,
      isLiked: !!char.is_liked,
      likedAt: char.liked_at,
      uploadedAt: char.created_at,
      scheduleData: char.schedule_data ? JSON.parse(char.schedule_data) : null,
      personalityData: char.personality_data ? JSON.parse(char.personality_data) : null,
      imageTags: char.image_tags,
      contextualTags: char.contextual_tags,
      mainPromptOverride: char.main_prompt_override,
      negativePromptOverride: char.negative_prompt_override,
      voiceId: char.voice_id,
      postInstructions: char.post_instructions,
      memoryData: char.memory_data ? JSON.parse(char.memory_data) : null,
      tags: JSON.parse(char.card_data || '{}').data?.tags || []
    }));

    res.json({
      characters: formatted,
      total: formatted.length
    });
  } catch (error) {
    console.error('Failed to get characters:', error);
    res.status(500).json({ error: 'Failed to get characters' });
  }
});

// GET /api/characters/stats - Get character counts
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const total = db.prepare('SELECT COUNT(*) as count FROM characters WHERE user_id = ?').get(userId).count;
    const liked = db.prepare('SELECT COUNT(*) as count FROM characters WHERE user_id = ? AND is_liked = 1').get(userId).count;

    res.json({
      total,
      liked,
      swipeable: total - liked
    });
  } catch (error) {
    console.error('Failed to get character stats:', error);
    res.status(500).json({ error: 'Failed to get character stats' });
  }
});

// POST /api/characters - Create a new character
router.post('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { id, cardData, imageUrl, isLiked = false, imageTags, contextualTags } = req.body;

    if (!id || !cardData) {
      return res.status(400).json({ error: 'id and cardData are required' });
    }

    const name = cardData.data?.name || cardData.name || 'Unknown';

    // Check if character already exists
    const existing = db.prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?').get(id, userId);
    if (existing) {
      return res.status(409).json({ error: 'Character already exists' });
    }

    // Insert character
    db.prepare(`
      INSERT INTO characters (id, user_id, name, card_data, image_url, is_liked, liked_at, created_at, image_tags, contextual_tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      name,
      JSON.stringify(cardData),
      imageUrl || null,
      isLiked ? 1 : 0,
      isLiked ? Date.now() : null,
      Date.now(),
      imageTags || null,
      contextualTags || null
    );

    console.log(`✅ Created character: ${name} (${id})`);

    // Return created character
    const character = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(id, userId);

    res.status(201).json({
      character: {
        id: character.id,
        name: character.name,
        cardData: JSON.parse(character.card_data || '{}'),
        imageUrl: character.image_url,
        isLiked: !!character.is_liked,
        likedAt: character.liked_at,
        uploadedAt: character.created_at
      }
    });
  } catch (error) {
    console.error('Failed to create character:', error);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

// PUT /api/characters/:characterId - Update character (general)
router.put('/:characterId', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Check character exists
    const existing = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Build update query dynamically
    const allowedFields = [
      'name', 'card_data', 'image_url', 'is_liked', 'liked_at',
      'schedule_data', 'personality_data', 'image_tags', 'contextual_tags',
      'main_prompt_override', 'negative_prompt_override', 'voice_id',
      'post_instructions', 'memory_data', 'thumbnail_url'
    ];

    const setClauses = [];
    const values = [];

    // Map frontend field names to database column names
    const fieldMapping = {
      cardData: 'card_data',
      imageUrl: 'image_url',
      isLiked: 'is_liked',
      likedAt: 'liked_at',
      scheduleData: 'schedule_data',
      personalityData: 'personality_data',
      imageTags: 'image_tags',
      contextualTags: 'contextual_tags',
      mainPromptOverride: 'main_prompt_override',
      negativePromptOverride: 'negative_prompt_override',
      voiceId: 'voice_id',
      postInstructions: 'post_instructions',
      memoryData: 'memory_data',
      thumbnailUrl: 'thumbnail_url'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key] || key;
      if (allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = ?`);

        // Handle JSON fields
        if (['card_data', 'schedule_data', 'personality_data', 'memory_data'].includes(dbField)) {
          values.push(typeof value === 'string' ? value : JSON.stringify(value));
        } else if (dbField === 'is_liked') {
          values.push(value ? 1 : 0);
          // Auto-set liked_at if liking
          if (value && !updates.likedAt) {
            setClauses.push('liked_at = ?');
            values.push(Date.now());
          }
        } else {
          values.push(value);
        }
      }
    }

    // Also update name if cardData changed
    if (updates.cardData && updates.cardData.data?.name) {
      setClauses.push('name = ?');
      values.push(updates.cardData.data.name);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(characterId, userId);

    db.prepare(`
      UPDATE characters SET ${setClauses.join(', ')}
      WHERE id = ? AND user_id = ?
    `).run(...values);

    // Return updated character
    const updated = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(characterId, userId);

    res.json({
      character: {
        id: updated.id,
        name: updated.name,
        cardData: JSON.parse(updated.card_data || '{}'),
        imageUrl: updated.image_url,
        thumbnailUrl: updated.thumbnail_url,
        isLiked: !!updated.is_liked,
        likedAt: updated.liked_at,
        uploadedAt: updated.created_at,
        imageTags: updated.image_tags,
        contextualTags: updated.contextual_tags
      }
    });
  } catch (error) {
    console.error('Failed to update character:', error);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

// ===== Status Routes =====
router.get('/:characterId/status', authenticateToken, characterStatus.getCharacterStatus);
router.post('/:characterId/status', authenticateToken, characterStatus.calculateStatus);
router.get('/:characterId/engagement', authenticateToken, characterStatus.getEngagement);

// ===== Swipe/Like Routes =====
router.get('/swipe-limit', authenticateToken, characterInteraction.getSwipeLimit);
router.post('/swipe', authenticateToken, characterInteraction.recordSwipe);
router.post('/:characterId/like', authenticateToken, characterInteraction.likeCharacter);

// ===== Daily Auto-Match Route =====
router.post('/daily-auto-match', authenticateToken, characterInteraction.performDailyAutoMatch);
router.post('/reset-daily-match', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    db.prepare('UPDATE users SET last_auto_match_date = NULL WHERE id = ?').run(userId);
    console.log(`🔄 Reset daily auto-match for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to reset daily match:', error);
    res.status(500).json({ error: 'Failed to reset daily match' });
  }
});

// ===== Voice Assignment Route =====
router.put('/:characterId/voice', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const { voice_id } = req.body;
    const userId = req.user.id;

    // Update character voice_id
    db.prepare(`
      UPDATE characters
      SET voice_id = ?
      WHERE id = ? AND user_id = ?
    `).run(voice_id, characterId, userId);

    res.json({ success: true, voice_id });
  } catch (error) {
    console.error('Failed to update character voice:', error);
    res.status(500).json({ error: 'Failed to update character voice' });
  }
});

// ===== Get Character Data Route =====
router.get('/:characterId', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    const character = db.prepare(`
      SELECT * FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json(character);
  } catch (error) {
    console.error('Failed to get character:', error);
    res.status(500).json({ error: 'Failed to get character' });
  }
});

// ===== Image Tags Assignment Route =====
router.put('/:characterId/image-tags', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const { image_tags, contextual_tags, main_prompt_override, negative_prompt_override } = req.body;
    const userId = req.user.id;

    console.log(`💾 Updating image tags for character ${characterId}:`, image_tags);
    console.log(`💾 Updating contextual tags for character ${characterId}:`, contextual_tags);
    console.log(`💾 Updating main prompt override for character ${characterId}:`, main_prompt_override);
    console.log(`💾 Updating negative prompt override for character ${characterId}:`, negative_prompt_override);

    // Update character image_tags, contextual_tags, and prompt overrides
    const result = db.prepare(`
      UPDATE characters
      SET image_tags = ?, contextual_tags = ?, main_prompt_override = ?, negative_prompt_override = ?
      WHERE id = ? AND user_id = ?
    `).run(image_tags, contextual_tags, main_prompt_override, negative_prompt_override, characterId, userId);

    console.log(`✅ Update result: ${result.changes} row(s) affected`);

    if (result.changes === 0) {
      console.error(`❌ Character ${characterId} not found in backend for user ${userId}`);
      return res.status(404).json({ error: 'Character not found. Please like/match with this character first to sync to backend.' });
    }

    // Verify the update by reading back
    const character = db.prepare('SELECT image_tags, contextual_tags, main_prompt_override, negative_prompt_override FROM characters WHERE id = ? AND user_id = ?').get(characterId, userId);
    console.log(`📝 Verified image_tags in DB:`, character?.image_tags);
    console.log(`📝 Verified contextual_tags in DB:`, character?.contextual_tags);
    console.log(`📝 Verified main_prompt_override in DB:`, character?.main_prompt_override);
    console.log(`📝 Verified negative_prompt_override in DB:`, character?.negative_prompt_override);

    res.json({
      success: true,
      image_tags: character?.image_tags,
      contextual_tags: character?.contextual_tags,
      main_prompt_override: character?.main_prompt_override,
      negative_prompt_override: character?.negative_prompt_override
    });
  } catch (error) {
    console.error('Failed to update character tags:', error);
    res.status(500).json({ error: 'Failed to update character tags' });
  }
});

// ===== Character Memories Routes =====

// GET memories
router.get('/:characterId/memories', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this character
    const character = db.prepare(`
      SELECT id FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get memories from memory service
    const memories = memoryService.getCharacterMemories(characterId);

    res.json({ memories });
  } catch (error) {
    console.error('Failed to get character memories:', error);
    res.status(500).json({ error: 'Failed to get character memories' });
  }
});

// POST - Add new memory
router.post('/:characterId/memories', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;
    const { text, importance } = req.body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Memory text is required' });
    }

    if (importance === undefined || typeof importance !== 'number' || importance < 0 || importance > 100) {
      return res.status(400).json({ error: 'Importance must be a number between 0 and 100' });
    }

    // Verify user has access to this character
    const character = db.prepare(`
      SELECT id FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get existing memories
    const memories = memoryService.getCharacterMemories(characterId);

    // Add new memory
    memories.push({ importance, text: text.trim() });

    // Save updated memories
    memoryService.saveCharacterMemories(characterId, memories, userId);

    res.json({ success: true, memories: memoryService.getCharacterMemories(characterId) });
  } catch (error) {
    console.error('Failed to add memory:', error);
    res.status(500).json({ error: 'Failed to add memory' });
  }
});

// PUT - Update existing memory
router.put('/:characterId/memories/:index', authenticateToken, (req, res) => {
  try {
    const { characterId, index } = req.params;
    const userId = req.user.id;
    const { text, importance } = req.body;
    const memoryIndex = parseInt(index, 10);

    // Validate input
    if (isNaN(memoryIndex) || memoryIndex < 0) {
      return res.status(400).json({ error: 'Invalid memory index' });
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Memory text is required' });
    }

    if (importance === undefined || typeof importance !== 'number' || importance < 0 || importance > 100) {
      return res.status(400).json({ error: 'Importance must be a number between 0 and 100' });
    }

    // Verify user has access to this character
    const character = db.prepare(`
      SELECT id FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get existing memories
    const memories = memoryService.getCharacterMemories(characterId);

    if (memoryIndex >= memories.length) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    // Update memory
    memories[memoryIndex] = { importance, text: text.trim() };

    // Save updated memories
    memoryService.saveCharacterMemories(characterId, memories, userId);

    res.json({ success: true, memories: memoryService.getCharacterMemories(characterId) });
  } catch (error) {
    console.error('Failed to update memory:', error);
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

// DELETE - Remove memory
router.delete('/:characterId/memories/:index', authenticateToken, (req, res) => {
  try {
    const { characterId, index } = req.params;
    const userId = req.user.id;
    const memoryIndex = parseInt(index, 10);

    // Validate input
    if (isNaN(memoryIndex) || memoryIndex < 0) {
      return res.status(400).json({ error: 'Invalid memory index' });
    }

    // Verify user has access to this character
    const character = db.prepare(`
      SELECT id FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get existing memories
    const memories = memoryService.getCharacterMemories(characterId);

    if (memoryIndex >= memories.length) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    // Remove memory
    memories.splice(memoryIndex, 1);

    // Save updated memories
    memoryService.saveCharacterMemories(characterId, memories, userId);

    res.json({ success: true, memories: memoryService.getCharacterMemories(characterId) });
  } catch (error) {
    console.error('Failed to delete memory:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// DELETE - Clear all memories
router.delete('/:characterId/memories', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this character
    const character = db.prepare(`
      SELECT id FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Clear all memories
    memoryService.saveCharacterMemories(characterId, [], userId);

    console.log(`🗑️  Cleared all memories for character ${characterId}`);
    res.json({ success: true, memories: [] });
  } catch (error) {
    console.error('Failed to clear memories:', error);
    res.status(500).json({ error: 'Failed to clear memories' });
  }
});

// ===== Post Instructions Routes =====

// GET post instructions
router.get('/:characterId/post-instructions', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Get character with post instructions
    const character = db.prepare(`
      SELECT post_instructions FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json({ postInstructions: character.post_instructions || '' });
  } catch (error) {
    console.error('Failed to get post instructions:', error);
    res.status(500).json({ error: 'Failed to get post instructions' });
  }
});

// PUT - Update post instructions
router.put('/:characterId/post-instructions', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;
    const { postInstructions } = req.body;

    // Validate input
    if (postInstructions !== null && postInstructions !== undefined && typeof postInstructions !== 'string') {
      return res.status(400).json({ error: 'Post instructions must be a string' });
    }

    // Verify user has access to this character
    const character = db.prepare(`
      SELECT id FROM characters WHERE id = ? AND user_id = ?
    `).get(characterId, userId);

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Update post instructions
    const trimmedInstructions = postInstructions ? postInstructions.trim() : null;
    db.prepare(`
      UPDATE characters SET post_instructions = ? WHERE id = ? AND user_id = ?
    `).run(trimmedInstructions, characterId, userId);

    console.log(`✅ Updated post instructions for character ${characterId}`);
    res.json({ success: true, postInstructions: trimmedInstructions || '' });
  } catch (error) {
    console.error('Failed to update post instructions:', error);
    res.status(500).json({ error: 'Failed to update post instructions' });
  }
});

// ===== Import Characters Route (from IndexedDB export) =====
router.post('/import', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { characters, skipExisting = true } = req.body;

    if (!Array.isArray(characters)) {
      return res.status(400).json({ error: 'characters must be an array' });
    }

    console.log(`📦 Importing ${characters.length} characters for user ${userId}`);

    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const char of characters) {
      try {
        // Check if character already exists
        const existing = db.prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?').get(char.id, userId);

        if (existing) {
          if (skipExisting) {
            results.skipped++;
            continue;
          }
          // Update existing character
          db.prepare(`
            UPDATE characters SET
              name = ?, card_data = ?, image_url = ?, is_liked = ?, liked_at = ?
            WHERE id = ? AND user_id = ?
          `).run(
            char.name,
            JSON.stringify(char.cardData),
            char.imageUrl,
            char.isLiked ? 1 : 0,
            char.likedAt,
            char.id,
            userId
          );
          results.imported++;
        } else {
          // Insert new character
          db.prepare(`
            INSERT INTO characters (id, user_id, name, card_data, image_url, is_liked, liked_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            char.id,
            userId,
            char.name,
            JSON.stringify(char.cardData),
            char.imageUrl,
            char.isLiked ? 1 : 0,
            char.likedAt,
            char.uploadedAt || Date.now()
          );
          results.imported++;
        }
      } catch (charError) {
        console.error(`Failed to import character ${char.name}:`, charError);
        results.errors.push({ name: char.name, error: charError.message });
      }
    }

    console.log(`✅ Import complete: ${results.imported} imported, ${results.skipped} skipped, ${results.errors.length} errors`);
    res.json(results);
  } catch (error) {
    console.error('Failed to import characters:', error);
    res.status(500).json({ error: 'Failed to import characters' });
  }
});

// ===== Export All Characters Route =====
router.get('/export', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const characters = db.prepare(`
      SELECT id, name, card_data, image_url, is_liked, liked_at, created_at,
             schedule_data, personality_data, image_tags, contextual_tags,
             main_prompt_override, negative_prompt_override, voice_id,
             post_instructions, memory_data, thumbnail_url
      FROM characters WHERE user_id = ?
    `).all(userId);

    // Format for export (parse card_data JSON)
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userId: userId,
      characterCount: characters.length,
      characters: characters.map(char => ({
        id: char.id,
        name: char.name,
        cardData: JSON.parse(char.card_data || '{}'),
        imageUrl: char.image_url,
        isLiked: !!char.is_liked,
        likedAt: char.liked_at,
        uploadedAt: char.created_at,
        scheduleData: char.schedule_data ? JSON.parse(char.schedule_data) : null,
        personalityData: char.personality_data ? JSON.parse(char.personality_data) : null,
        imageTags: char.image_tags,
        contextualTags: char.contextual_tags,
        mainPromptOverride: char.main_prompt_override,
        negativePromptOverride: char.negative_prompt_override,
        voiceId: char.voice_id,
        postInstructions: char.post_instructions,
        memoryData: char.memory_data ? JSON.parse(char.memory_data) : null,
        thumbnailUrl: char.thumbnail_url
      }))
    };

    console.log(`📦 Exported ${characters.length} characters for user ${userId}`);
    res.json(exportData);
  } catch (error) {
    console.error('Failed to export characters:', error);
    res.status(500).json({ error: 'Failed to export characters' });
  }
});

// ===== Delete Character Route =====
router.delete('/:characterId', authenticateToken, (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    // Delete character (CASCADE will handle related data like conversations, messages, posts)
    const result = db.prepare(`
      DELETE FROM characters WHERE id = ? AND user_id = ?
    `).run(characterId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }

    console.log(`🗑️  Deleted character ${characterId}`);
    res.json({ success: true, characterId });
  } catch (error) {
    console.error('Failed to delete character:', error);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

export default router;
