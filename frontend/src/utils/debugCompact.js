import api from '../services/api';

/**
 * Get current conversation ID from the page's React state
 * The URL contains characterId (UUID), but we need the conversation.id (integer)
 */
function getCurrentConversationId() {
  // Access React state through the debug helper injected by Chat component
  if (window.__currentConversationId) {
    return window.__currentConversationId;
  }
  console.error('❌ Conversation ID not available. Make sure you are in a chat.');
  return null;
}

/**
 * Debug function to test conversation compacting without saving
 * Tests ALL compactable blocks until reaching protected blocks
 * Call from browser console: window.testCompact(options)
 *
 * @param {Object} options - Optional parameters
 * @param {string} options.conversationId - Conversation ID (auto-detects if not provided)
 * @param {number} options.minBlockSize - Minimum block size for compact (default: 15)
 * @param {number} options.keepUncompacted - Messages to keep uncompacted (default: 30)
 */
export async function testCompact(options = {}) {
  try {
    let conversationId = options.conversationId || options;

    // Handle old API where conversationId was passed directly as string
    if (typeof conversationId === 'string') {
      // Old API: testCompact(conversationId)
    } else {
      // New API: testCompact({ conversationId, minBlockSize, keepUncompacted })
      conversationId = options.conversationId;
    }

    if (!conversationId) {
      conversationId = getCurrentConversationId();
      if (!conversationId) {
        console.error('❌ Could not detect conversation ID from URL. Please provide it manually: testCompact({ conversationId: "your-id" })');
        return;
      }
      console.log(`🔍 Auto-detected conversation ID: ${conversationId}`);
    }

    console.log(`🧪 Testing compact for conversation ${conversationId}...`);

    // Build request body with optional test parameters
    const requestBody = {};
    if (options.minBlockSize !== undefined) requestBody.minBlockSize = options.minBlockSize;
    if (options.keepUncompacted !== undefined) requestBody.keepUncompacted = options.keepUncompacted;

    const response = await api.post(`/debug/test-compact/${conversationId}`, requestBody);

    if (!response.data.success) {
      console.warn('⚠️  No compactable blocks found');
      console.log('Reason:', response.data.reason);
      return;
    }

    const { summary, testParameters, blocks } = response.data;

    // Log everything in a nicely formatted way
    console.log('\n========================================');
    console.log('📊 COMPACTING TEST RESULTS (ALL BLOCKS)');
    console.log('========================================\n');

    console.log('📈 Summary:');
    console.log(`   - Total Blocks Processed: ${summary.totalBlocksProcessed}`);
    console.log(`   - Protected Blocks: ${summary.totalProtectedBlocks}`);
    console.log(`   - Deleted Blocks: ${summary.deletedBlocks}`);
    console.log(`   - Compacted Blocks: ${summary.compactedBlocks}`);
    console.log(`   - Overall Compression: ${summary.overallCompression.compressionRatio}`);
    console.log(`     (${summary.overallCompression.originalChars} → ${summary.overallCompression.summaryChars} chars)`);

    if (testParameters.minBlockSize !== 15 || testParameters.keepUncompacted !== 30) {
      console.log('\n🔧 Test Parameters:');
      console.log(`   - Min Block Size: ${testParameters.minBlockSize}`);
      console.log(`   - Keep Uncompacted: ${testParameters.keepUncompacted}`);
    }

    // Display each block
    blocks.forEach((block, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 BLOCK ${block.blockNumber}/${blocks.length}: ${block.blockInfo.action.toUpperCase()}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Messages: ${block.blockInfo.messageCount}`);
      console.log(`IDs: ${block.blockInfo.startMessageId} → ${block.blockInfo.endMessageId}`);
      console.log(`Note: ${block.blockInfo.note}`);

      if (block.blockInfo.action === 'compact') {
        console.log(`Compression: ${block.comparison.compressionRatio} (${block.comparison.originalLength} → ${block.comparison.summaryLength} chars)`);
      }

      console.log('\n📝 Raw Block:');
      console.log(block.rawBlock.substring(0, 500) + (block.rawBlock.length > 500 ? '...\n[truncated, see full output below]' : ''));

      if (block.blockInfo.action === 'compact') {
        console.log('\n✨ Generated Summary:');
        console.log(block.generatedSummary);
      } else {
        console.log('\n🗑️ Will be DELETED (no summary created)');
      }
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ TEST COMPLETE');
    console.log(`${'='.repeat(60)}\n`);

    console.log('💡 TIP: All compacted blocks should preserve:');
    console.log('   - Key facts and events');
    console.log('   - Emotional moments');
    console.log('   - Important decisions');
    console.log('   - Overall narrative flow\n');

    // Return the data for further inspection if needed
    return response.data;
  } catch (error) {
    console.error('❌ Test compact failed:', error);
    if (error.response?.data?.error) {
      console.error('   Error:', error.response.data.error);
    }
  }
}

/**
 * Debug function to show detailed block structure calculation
 * Call from browser console: window.showBlockStructure() or window.showBlockStructure(conversationId)
 *
 * @param {string} conversationId - Optional conversation ID (auto-detects from URL if not provided)
 */
export async function showBlockStructure(conversationId) {
  try {
    if (!conversationId) {
      conversationId = getCurrentConversationId();
      if (!conversationId) {
        console.error('❌ Could not detect conversation ID from URL. Please provide it manually: showBlockStructure("your-conversation-id")');
        return;
      }
      console.log(`🔍 Auto-detected conversation ID: ${conversationId}`);
    }

    console.log(`🔍 Analyzing block structure for conversation ${conversationId}...`);

    const response = await api.get(`/debug/block-structure/${conversationId}`);

    if (!response.data.success) {
      console.warn('⚠️  No messages found');
      if (response.data.debug) {
        console.log('\n🔍 DEBUG INFO:');
        console.log('   Conversation ID:', response.data.debug.conversationId);
        console.log('   Conversation exists:', response.data.debug.conversationExists);
        console.log('   Raw message count:', response.data.debug.rawMessageCount);
        console.log('   Sample conversations in DB:', response.data.debug.sampleConversations);
      }
      return;
    }

    const { summary, blocks, gaps } = response.data;

    console.log('\n========================================');
    console.log('📊 BLOCK STRUCTURE ANALYSIS');
    console.log('========================================\n');

    console.log('📈 Summary:');
    console.log(`   - Total Messages: ${summary.totalMessages}`);
    console.log(`   - Messages to First Gap: ${summary.messagesToFirstGap}`);
    console.log(`   - Time Gaps Detected: ${summary.timeGapsDetected}`);
    console.log(`   - Total Blocks: ${summary.totalBlocks}`);
    console.log(`   - Keep Uncompacted: ${summary.keepUncompacted} messages`);
    console.log(`   - Protected Messages: ${summary.protectedMessages}`);
    console.log(`   - Blocks to Keep: ${summary.blocksToKeep}`);
    console.log(`   - Compactable Blocks: ${summary.compactableBlocks}`);

    if (gaps.length > 0) {
      console.log('\n⏱️  Time Gaps:');
      gaps.forEach((gap, index) => {
        console.log(`   ${index + 1}. After message ${gap.afterMessageIndex}: ${gap.gapMinutes} minutes`);
        console.log(`      ${gap.prevTimestamp} → ${gap.currentTimestamp}`);
      });
    } else {
      console.log('\n⏱️  No time gaps detected (all messages < 30 minutes apart)');
    }

    console.log('\n📦 Blocks:');
    blocks.forEach((block, index) => {
      let status;
      let action = '';

      if (block.isProtected) {
        status = '🔒 PROTECTED';
      } else if (block.messageCount < 15) {
        status = '🗑️ DELETE';
        action = ' (will delete, no summary)';
      } else {
        status = '✅ COMPACT';
        action = ' (will create summary)';
      }

      console.log(`   Block ${index + 1}: ${block.messageCount} messages ${status}${action}`);
      console.log(`      Message IDs: ${block.startMessageId} → ${block.endMessageId}`);
      console.log(`      Indices: ${block.startIndex} → ${block.endIndex}${block.isMostRecent ? ' (most recent)' : ''}`);
    });

    console.log('\n========================================');
    if (summary.compactableBlocks === 0) {
      if (summary.totalBlocks === 1) {
        console.log('⚠️  ISSUE: Only 1 block found (no time gaps)');
        console.log('   This means all messages are < 30 minutes apart.');
      } else if (blocks.every(b => b.messageCount < 15)) {
        console.log('⚠️  ISSUE: All blocks are too small (< 15 messages)');
      } else {
        console.log('⚠️  ISSUE: All blocks are protected');
        console.log('   Try increasing keep_uncompacted_messages setting.');
      }
    }
    console.log('========================================\n');

    return response.data;
  } catch (error) {
    console.error('❌ Block structure analysis failed:', error);
    if (error.response?.data?.error) {
      console.error('   Error:', error.response.data.error);
    }
  }
}

/**
 * Show current conversation ID
 */
export function showConversationId() {
  const id = window.__currentConversationId;
  if (id) {
    console.log(`💬 Current conversation ID: ${id}`);
    return id;
  } else {
    console.error('❌ No conversation ID available. Make sure you are in a chat.');
    return null;
  }
}

/**
 * Debug function to test memory extraction without saving
 * Tests how the LLM would extract/consolidate memories from a conversation block
 * Call from browser console: window.testMemoryExtraction(options)
 *
 * @param {Object} options - Optional parameters
 * @param {string} options.conversationId - Conversation ID (auto-detects if not provided)
 * @param {number} options.blockIndex - Which block to test (default: 0 = oldest)
 * @param {number} options.keepUncompacted - Messages to keep uncompacted (default: 30)
 */
export async function testMemoryExtraction(options = {}) {
  try {
    let conversationId = options.conversationId || options;

    // Handle old API where conversationId was passed directly as string
    if (typeof conversationId === 'string') {
      // Old API: testMemoryExtraction(conversationId)
    } else {
      // New API: testMemoryExtraction({ conversationId, blockIndex })
      conversationId = options.conversationId;
    }

    if (!conversationId) {
      conversationId = getCurrentConversationId();
      if (!conversationId) {
        console.error('❌ Could not detect conversation ID from URL. Please provide it manually: testMemoryExtraction({ conversationId: "your-id" })');
        return;
      }
      console.log(`🔍 Auto-detected conversation ID: ${conversationId}`);
    }

    console.log(`🧠 Testing memory extraction for conversation ${conversationId}...`);

    // Build request body with optional test parameters
    const requestBody = {};
    if (options.blockIndex !== undefined) requestBody.blockIndex = options.blockIndex;
    if (options.keepUncompacted !== undefined) requestBody.keepUncompacted = options.keepUncompacted;

    const response = await api.post(`/debug/test-memory-extraction/${conversationId}`, requestBody);

    if (!response.data.success) {
      console.warn('⚠️  Could not test memory extraction');
      console.log('Reason:', response.data.message);
      if (response.data.debug) {
        console.log('\n🔍 DEBUG INFO:');
        console.log('   Total Messages:', response.data.debug.totalMessages);
        console.log('   Total Blocks:', response.data.debug.totalBlocks);
        console.log('   Blocks to Keep:', response.data.debug.blocksToKeep);
        console.log('   Existing Memories:', response.data.debug.existingMemories.length);
      }
      return;
    }

    const { characterName, blockInfo, existingMemories, extractedMemories, changes } = response.data;

    // Log everything in a nicely formatted way
    console.log('\n========================================');
    console.log('🧠 MEMORY EXTRACTION TEST RESULTS');
    console.log('========================================\n');

    console.log(`👤 Character: ${characterName}`);
    console.log(`📦 Testing Block ${blockInfo.blockIndex}: ${blockInfo.messageCount} messages`);
    console.log(`   Message IDs: ${blockInfo.startMessageId} → ${blockInfo.endMessageId}`);

    console.log('\n📊 Memory Summary:');
    console.log(`   - Existing Memories: ${existingMemories.count}/50`);
    console.log(`   - Extracted Memories: ${extractedMemories.count}/50`);
    console.log(`   - Added: ${changes.added} new memories`);
    console.log(`   - Removed: ${changes.removed} old memories`);
    console.log(`   - Unchanged: ${changes.unchanged} kept`);

    if (existingMemories.count > 0) {
      console.log('\n📝 EXISTING MEMORIES:');
      console.log('─'.repeat(60));
      existingMemories.memories.forEach((memory, index) => {
        console.log(`${index + 1}. ${memory}`);
      });
    } else {
      console.log('\n📝 EXISTING MEMORIES: None yet');
    }

    console.log('\n✨ EXTRACTED MEMORIES:');
    console.log('─'.repeat(60));
    extractedMemories.memories.forEach((memory, index) => {
      // Highlight new memories
      const isNew = changes.addedMemories.includes(memory);
      const prefix = isNew ? '🆕' : '  ';
      console.log(`${prefix} ${index + 1}. ${memory}`);
    });

    if (changes.added > 0) {
      console.log('\n🆕 NEW MEMORIES ADDED:');
      console.log('─'.repeat(60));
      changes.addedMemories.forEach((memory, index) => {
        console.log(`${index + 1}. ${memory}`);
      });
    }

    if (changes.removed > 0) {
      console.log('\n🗑️ MEMORIES REMOVED:');
      console.log('─'.repeat(60));
      changes.removedMemories.forEach((memory, index) => {
        console.log(`${index + 1}. ${memory}`);
      });
    }

    console.log('\n========================================');
    console.log('⚠️  NOTE: These memories were NOT saved!');
    console.log('This is a test run only.');
    console.log('========================================\n');

    console.log('💡 TIP: Memories should include:');
    console.log('   - Key facts about the user');
    console.log('   - Preferences and personality traits');
    console.log('   - Important life events');
    console.log('   - Relationship dynamics\n');

    // Return the data for further inspection if needed
    return response.data;
  } catch (error) {
    console.error('❌ Test memory extraction failed:', error);
    if (error.response?.data?.error) {
      console.error('   Error:', error.response.data.error);
    }
  }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.testCompact = testCompact;
  window.showBlockStructure = showBlockStructure;
  window.showConversationId = showConversationId;
  window.testMemoryExtraction = testMemoryExtraction;
}
