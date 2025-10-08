import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db/database.js';

const router = express.Router();

/**
 * GET /api/feed
 * Get feed posts (chronological, with pagination)
 * Query params:
 *   - limit: number of posts to return (default: 20)
 *   - offset: pagination offset (default: 0)
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Get all posts, chronological order
    const posts = db.prepare(`
      SELECT
        p.*,
        c.card_data,
        c.image_url as character_image_url
      FROM posts p
      JOIN characters c ON p.character_id = c.id
      WHERE p.character_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    // Parse character data for each post
    const postsWithCharacterData = posts.map(post => {
      let characterData = {};
      try {
        characterData = JSON.parse(post.card_data);
      } catch (error) {
        console.error('Failed to parse character data:', error);
      }

      // Use character image_url from database (synced from IndexedDB)
      const characterAvatar = post.character_image_url || null;

      return {
        id: post.id,
        character_id: post.character_id,
        character_name: characterData.name || 'Unknown',
        character_avatar: characterAvatar,
        content: post.content,
        image_url: post.image_url,
        post_type: post.post_type,
        created_at: post.created_at
      };
    });

    // Check if there are more posts
    const hasMore = posts.length === limit;

    res.json({
      posts: postsWithCharacterData,
      hasMore: hasMore,
      nextOffset: offset + limit
    });
  } catch (error) {
    console.error('Failed to get feed:', error);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

export default router;
