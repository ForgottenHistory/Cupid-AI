import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import sdService from '../services/sdService.js';
import messageService from '../services/messageService.js';
import compactService from '../services/compactService.js';
import db from '../db/database.js';

const router = express.Router();

/**
 * Debug endpoint to clear all posts
 */
router.delete('/clear-posts', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Delete all posts for this user's characters
    const result = db.prepare(`
      DELETE FROM posts
      WHERE character_id IN (
        SELECT id FROM characters WHERE user_id = ?
      )
    `).run(userId);

    console.log(`🗑️  Debug: Cleared ${result.changes} posts`);

    res.json({
      success: true,
      deleted: result.changes
    });
  } catch (error) {
    console.error('Debug clear posts error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Debug endpoint to trigger proactive message for a character
 */
router.post('/trigger-proactive/:characterId', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const userId = req.user.id;

    console.log(`🐛 Debug: Triggering proactive message for character ${characterId}`);

    // Get proactive message service
    const proactiveMessageService = (await import('../services/proactiveMessageService.js')).default;

    // Get IO instance from app
    const io = req.app.get('io');

    // Trigger proactive check for this specific character
    await proactiveMessageService.checkAndSend(io, characterId);

    res.json({
      success: true,
      message: 'Proactive message check triggered'
    });
  } catch (error) {
    console.error('Debug trigger proactive error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Debug endpoint to generate an image for a character
 * Supports both matched characters (from backend) and unmatched characters (from IndexedDB via request body)
 */
router.post('/generate-image/:characterId', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    const { contextTags, imageTags: providedImageTags, additionalPrompt } = req.body;
    const userId = req.user.id;

    console.log(`🐛 Debug: Generating image for character ${characterId}`);
    if (additionalPrompt) {
      console.log(`🎨 Additional prompt: ${additionalPrompt}`);
    }

    let imageTags = providedImageTags; // Use provided tags from request body (for unmatched characters)

    // If no tags provided, try to get from backend (for matched characters)
    if (!imageTags) {
      const character = db.prepare(`
        SELECT * FROM characters WHERE id = ? AND user_id = ?
      `).get(characterId, userId);

      if (character) {
        imageTags = character.image_tags;
        console.log(`🎨 Using image tags from backend`);
      }
    } else {
      console.log(`🎨 Using image tags from request body (unmatched character)`);
    }

    if (!imageTags) {
      return res.status(400).json({ error: 'No image tags available. Please configure image tags first.' });
    }

    console.log(`🎨 Character tags: ${imageTags}`);
    console.log(`🎨 Context tags: ${contextTags || 'none'}`);

    // Fetch user's SD settings
    const userSettings = db.prepare(`
      SELECT sd_steps, sd_cfg_scale, sd_sampler, sd_scheduler,
             sd_enable_hr, sd_hr_scale, sd_hr_upscaler, sd_hr_steps,
             sd_hr_cfg, sd_denoising_strength, sd_enable_adetailer, sd_adetailer_model,
             sd_main_prompt, sd_negative_prompt, sd_model
      FROM users WHERE id = ?
    `).get(userId);

    // Generate image
    const imageResult = await sdService.generateImage({
      characterTags: imageTags,
      contextTags: contextTags || '',
      additionalPrompt: additionalPrompt || '',
      userSettings: userSettings
    });

    if (!imageResult.success) {
      return res.status(500).json({ error: imageResult.error });
    }

    // Return base64 image
    const base64Image = imageResult.imageBuffer.toString('base64');
    res.json({
      success: true,
      image: `data:image/png;base64,${base64Image}`,
      prompt: imageResult.prompt,
      negativePrompt: imageResult.negativePrompt
    });
  } catch (error) {
    console.error('Debug image generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/debug/test-compact/:conversationId
 * Test conversation compacting WITHOUT actually saving
 * Returns raw block and generated summary for comparison
 */
router.post('/test-compact/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Optional test parameters from request body
    const { minBlockSize, keepUncompacted: customKeepUncompacted } = req.body;

    console.log(`🧪 [DEBUG] Testing compact for conversation ${conversationId}`);

    // Get user's compacting settings
    const userSettings = db.prepare(`
      SELECT keep_uncompacted_messages
      FROM users WHERE id = ?
    `).get(userId);

    const keepUncompacted = customKeepUncompacted || userSettings?.keep_uncompacted_messages || 30;
    const minBlockSizeToUse = minBlockSize !== undefined ? minBlockSize : 15;

    if (minBlockSize !== undefined || customKeepUncompacted !== undefined) {
      console.log(`🔧 [DEBUG] Using custom test parameters: minBlockSize=${minBlockSizeToUse}, keepUncompacted=${keepUncompacted}`);
    }

    // Get all messages to show block structure
    const allMessages = db.prepare(`
      SELECT id, role, content, message_type, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);

    console.log(`📊 [DEBUG] Total messages in conversation: ${allMessages.length}`);

    // Show block structure
    let currentBlock = [];
    let blocks = [];

    for (let i = 0; i < allMessages.length; i++) {
      const msg = allMessages[i];
      if (msg.message_type === 'summary' || msg.content?.startsWith('[TIME GAP:')) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.length);
          console.log(`   Block ${blocks.length}: ${currentBlock.length} messages`);
          currentBlock = [];
        }
        console.log(`   ${msg.message_type === 'summary' ? '[SUMMARY]' : '[TIME GAP]'}`);
      } else {
        currentBlock.push(msg);
      }
    }
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.length);
      console.log(`   Block ${blocks.length}: ${currentBlock.length} messages (recent/protected)`);
    }

    // Get character and user names (needed for summaries)
    const conversation = db.prepare('SELECT user_id, character_id FROM conversations WHERE id = ?').get(conversationId);
    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(conversation.user_id);
    const character = db.prepare('SELECT card_data FROM characters WHERE id = ? AND user_id = ?').get(conversation.character_id, conversation.user_id);

    const userName = user?.display_name || 'User';
    let characterName = 'Character';

    if (character) {
      try {
        const cardData = JSON.parse(character.card_data);
        characterName = cardData.data?.name || cardData.name || 'Character';
      } catch (e) {}
    }

    // Process ALL compactable blocks until we reach protected ones
    const processedBlocks = [];
    let totalOriginalChars = 0;
    let totalSummaryChars = 0;

    console.log(`🔄 [DEBUG] Processing all compactable blocks...`);

    // Manually calculate compactable blocks
    const SESSION_GAP_THRESHOLD = 30 * 60 * 1000;
    const messagesNonSystem = db.prepare(`
      SELECT id, role, content, message_type, created_at
      FROM messages
      WHERE conversation_id = ? AND role != 'system'
      ORDER BY created_at ASC
    `).all(conversationId);

    // Build blocks array
    const allBlocks = [];
    let blockBuffer = [];

    for (let i = 0; i < messagesNonSystem.length; i++) {
      const msg = messagesNonSystem[i];

      if (i > 0 && blockBuffer.length > 0) {
        const prevMsg = messagesNonSystem[i - 1];
        const prevTime = new Date(prevMsg.created_at).getTime();
        const currentTime = new Date(msg.created_at).getTime();
        const gapMs = currentTime - prevTime;

        if (gapMs >= SESSION_GAP_THRESHOLD) {
          allBlocks.push([...blockBuffer]);
          blockBuffer = [];
        }
      }

      blockBuffer.push(msg);
    }

    if (blockBuffer.length > 0) {
      allBlocks.push(blockBuffer);
    }

    // Calculate protected blocks
    const protectedMessages = Math.min(keepUncompacted, messagesNonSystem.length);
    let messagesFromEnd = 0;
    let blocksToKeep = 0;

    for (let i = allBlocks.length - 1; i >= 0; i--) {
      messagesFromEnd += allBlocks[i].length;
      blocksToKeep++;
      if (messagesFromEnd >= protectedMessages) break;
    }

    const compactableBlocks = allBlocks.slice(0, allBlocks.length - blocksToKeep);

    if (compactableBlocks.length === 0) {
      console.log(`⚠️  [DEBUG] No processable blocks found`);
      return res.json({
        success: false,
        message: 'No processable blocks found',
        reason: 'Not enough messages to process',
        debug: {
          totalMessages: allMessages.length,
          blockSizes: blocks,
          testParameters: {
            minBlockSize: minBlockSizeToUse,
            keepUncompacted: keepUncompacted
          }
        }
      });
    }

    // Process each compactable block
    for (let i = 0; i < compactableBlocks.length; i++) {
      const blockMsgs = compactableBlocks[i];
      const action = blockMsgs.length >= minBlockSizeToUse ? 'compact' : 'delete';

      console.log(`🔍 [DEBUG] Block ${i + 1}/${compactableBlocks.length}: ${blockMsgs.length} messages - action: ${action.toUpperCase()}`);

      // Format raw block
      const rawBlock = blockMsgs.map(msg => {
        const name = msg.role === 'user' ? userName : characterName;
        return `${name}: ${msg.content}`;
      }).join('\n');

      totalOriginalChars += rawBlock.length;

      let processedBlock;

      if (action === 'delete') {
        processedBlock = {
          blockNumber: i + 1,
          blockInfo: {
            messageCount: blockMsgs.length,
            startMessageId: blockMsgs[0].id,
            endMessageId: blockMsgs[blockMsgs.length - 1].id,
            action: 'delete',
            note: `Will be DELETED (< ${minBlockSizeToUse} messages)`
          },
          rawBlock: rawBlock,
          generatedSummary: null,
          comparison: {
            originalLength: rawBlock.length,
            summaryLength: 0,
            compressionRatio: '0%'
          }
        };
      } else {
        // Generate summary
        console.log(`🤖 [DEBUG] Generating summary for block ${i + 1}...`);
        const summary = await compactService.generateSummary(blockMsgs, characterName, userName, userId);
        totalSummaryChars += summary.length;

        processedBlock = {
          blockNumber: i + 1,
          blockInfo: {
            messageCount: blockMsgs.length,
            startMessageId: blockMsgs[0].id,
            endMessageId: blockMsgs[blockMsgs.length - 1].id,
            action: 'compact',
            note: `Will be COMPACTED (>= ${minBlockSizeToUse} messages)`
          },
          rawBlock: rawBlock,
          generatedSummary: summary,
          comparison: {
            originalLength: rawBlock.length,
            summaryLength: summary.length,
            compressionRatio: `${((summary.length / rawBlock.length) * 100).toFixed(1)}%`
          }
        };

        console.log(`✅ [DEBUG] Summary generated: ${summary.substring(0, 80)}...`);
      }

      processedBlocks.push(processedBlock);
    }

    const result = {
      success: true,
      summary: {
        totalBlocksProcessed: processedBlocks.length,
        totalProtectedBlocks: blocksToKeep,
        deletedBlocks: processedBlocks.filter(b => b.blockInfo.action === 'delete').length,
        compactedBlocks: processedBlocks.filter(b => b.blockInfo.action === 'compact').length,
        overallCompression: {
          originalChars: totalOriginalChars,
          summaryChars: totalSummaryChars,
          compressionRatio: totalOriginalChars > 0 ? `${((totalSummaryChars / totalOriginalChars) * 100).toFixed(1)}%` : 'N/A'
        }
      },
      testParameters: {
        minBlockSize: minBlockSizeToUse,
        keepUncompacted: keepUncompacted
      },
      blocks: processedBlocks
    };

    console.log(`✅ [DEBUG] Processed ${processedBlocks.length} blocks - overall compression: ${result.summary.overallCompression.compressionRatio}`);

    res.json(result);
  } catch (error) {
    console.error('❌ [DEBUG] Test compact error:', error);
    res.status(500).json({ error: error.message || 'Failed to test compact' });
  }
});

/**
 * GET /api/debug/block-structure/:conversationId
 * Show detailed block structure calculation for debugging
 */
router.get('/block-structure/:conversationId', authenticateToken, (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log(`🔍 [DEBUG] Analyzing block structure for conversation ${conversationId}`);
    console.log(`🔍 [DEBUG] User ID: ${userId}`);
    console.log(`🔍 [DEBUG] Conversation ID type: ${typeof conversationId}`);

    // Check if conversation exists
    const conversation = db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `).get(conversationId);

    console.log(`🔍 [DEBUG] Conversation exists:`, conversation ? 'YES' : 'NO');
    if (conversation) {
      console.log(`🔍 [DEBUG] Conversation user_id: ${conversation.user_id}`);
    }

    // Get ALL messages first (no filters)
    const allMessagesRaw = db.prepare(`
      SELECT id, role, content, message_type, created_at, conversation_id
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);

    console.log(`📊 [DEBUG] Total messages (raw, no filter): ${allMessagesRaw.length}`);

    // Get messages excluding system
    const messages = db.prepare(`
      SELECT id, role, content, message_type, created_at
      FROM messages
      WHERE conversation_id = ? AND role != 'system'
      ORDER BY created_at ASC
    `).all(conversationId);

    console.log(`📊 [DEBUG] Total messages (excluding system): ${messages.length}`);

    if (messages.length === 0) {
      // Show first few messages from database to help debug
      const sampleMessages = db.prepare(`
        SELECT conversation_id, COUNT(*) as count FROM messages GROUP BY conversation_id LIMIT 10
      `).all();

      console.log(`🔍 [DEBUG] Sample conversation IDs in database:`, sampleMessages);

      return res.json({
        success: false,
        message: 'No messages found in conversation',
        debug: {
          conversationId: conversationId,
          conversationExists: !!conversation,
          rawMessageCount: allMessagesRaw.length,
          sampleConversations: sampleMessages
        }
      });
    }

    const SESSION_GAP_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds
    const blocks = [];
    let currentBlock = [];
    let gaps = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Check if there's a time gap from previous message
      if (i > 0 && currentBlock.length > 0) {
        const prevMsg = messages[i - 1];
        const prevTime = new Date(prevMsg.created_at).getTime();
        const currentTime = new Date(msg.created_at).getTime();
        const gapMs = currentTime - prevTime;
        const gapMinutes = (gapMs / (1000 * 60)).toFixed(1);

        // If gap is significant (30+ minutes), record it and start a new block
        if (gapMs >= SESSION_GAP_THRESHOLD) {
          console.log(`   ⏱️  TIME GAP detected: ${gapMinutes} minutes (between message ${i-1} and ${i})`);

          gaps.push({
            afterMessageIndex: i - 1,
            gapMinutes: parseFloat(gapMinutes),
            blockEndedWith: currentBlock.length,
            prevTimestamp: prevMsg.created_at,
            currentTimestamp: msg.created_at
          });

          blocks.push({
            messageCount: currentBlock.length,
            startMessageId: currentBlock[0].id,
            endMessageId: currentBlock[currentBlock.length - 1].id,
            startIndex: i - currentBlock.length,
            endIndex: i - 1
          });

          currentBlock = [];
        }
      }

      currentBlock.push(msg);
    }

    // Add final block if any
    if (currentBlock.length > 0) {
      blocks.push({
        messageCount: currentBlock.length,
        startMessageId: currentBlock[0].id,
        endMessageId: currentBlock[currentBlock.length - 1].id,
        startIndex: messages.length - currentBlock.length,
        endIndex: messages.length - 1,
        isMostRecent: true
      });
    }

    console.log(`📦 [DEBUG] Found ${blocks.length} blocks, ${gaps.length} time gaps`);

    // Calculate which blocks would be protected
    const keepUncompacted = 30;
    const protectedMessages = Math.min(keepUncompacted, messages.length);

    let messagesFromEnd = 0;
    let blocksToKeep = 0;

    for (let i = blocks.length - 1; i >= 0; i--) {
      messagesFromEnd += blocks[i].messageCount;
      blocksToKeep++;

      if (messagesFromEnd >= protectedMessages) {
        break;
      }
    }

    const compactableBlockCount = blocks.length - blocksToKeep;

    const result = {
      success: true,
      summary: {
        totalMessages: messages.length,
        totalBlocks: blocks.length,
        timeGapsDetected: gaps.length,
        messagesToFirstGap: gaps.length > 0 ? gaps[0].afterMessageIndex + 1 : messages.length,
        keepUncompacted: keepUncompacted,
        protectedMessages: protectedMessages,
        blocksToKeep: blocksToKeep,
        compactableBlocks: compactableBlockCount
      },
      blocks: blocks.map((block, index) => ({
        ...block,
        isProtected: index >= (blocks.length - blocksToKeep),
        isCompactable: index < compactableBlockCount && block.messageCount >= 15
      })),
      gaps: gaps
    };

    console.log(`✅ [DEBUG] Block structure analysis complete`);
    console.log(`   - Messages to first gap: ${result.summary.messagesToFirstGap}`);
    console.log(`   - Total blocks: ${result.summary.totalBlocks}`);
    console.log(`   - Compactable blocks: ${result.summary.compactableBlocks}`);

    res.json(result);
  } catch (error) {
    console.error('❌ [DEBUG] Block structure analysis error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze block structure' });
  }
});

export default router;
