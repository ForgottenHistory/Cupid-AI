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

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.testCompact = testCompact;
  window.showBlockStructure = showBlockStructure;
  window.showConversationId = showConversationId;
}
