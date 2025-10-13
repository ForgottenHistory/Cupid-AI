# Conversation Compacting System

> Automatic compression of old conversation history to prevent context window overflow

---

## Problem Statement

With a 32k token context window, long conversations will eventually hit the limit. Instead of truncating messages (losing context), we compress old conversation blocks into summaries while preserving recent messages in full.

---

## Design Philosophy

- **Compress only when necessary**: Wait until 80-85% of context window is used (~26-28k tokens)
- **Preserve recent context**: Always keep last 20-30 messages uncompacted
- **Natural boundaries**: Use existing TIME GAP markers as compression boundaries
- **Hard limits**: Maximum 5 summaries to prevent abstraction death
- **Character continuity**: Summaries maintain narrative flow and key facts

---

## When to Trigger

**Trigger Point**: When preparing conversation history for LLM response generation

**Threshold Check**:
```javascript
const messages = messageService.getConversationHistory(conversationId);
const tokenCount = estimateTokenCount(messages);

if (tokenCount > COMPACT_THRESHOLD) {
  // Start compacting oldest blocks
}
```

**Default Thresholds**:
- `COMPACT_THRESHOLD`: 26,000 tokens (80% of 32k)
- `COMPACT_TARGET`: 20,000 tokens (target after compacting)
- `KEEP_UNCOMPACTED`: 30 messages (always preserve recent)

---

## How It Works

### 1. Identify Compression Targets

**Block Structure**:
```
[SUMMARY: ...] ← Existing summary (skip)
[TIME GAP: 5h]
Block A: 35 messages, 6k tokens ← COMPRESS THIS
[TIME GAP: 3h]
Block B: 28 messages, 5k tokens ← Then this if still over
[TIME GAP: 2h]
Block C: 20 messages ← Keep (recent)
Current: 15 messages ← Keep (recent)
```

**Selection Logic**:
1. Get all messages in conversation
2. Identify TIME GAP boundaries (natural session breaks)
3. Exclude recent N messages from consideration
4. Find oldest block with >X messages (e.g., >15)
5. Compress that block first
6. Repeat until token count < target

### 2. Generate Summary

**LLM Prompt** (using Decision LLM):
```
You are reviewing a past conversation between a user and a character in a dating simulation.

Your task: Create a concise summary (2-4 sentences) that preserves:
- Key facts shared (names, events, plans, promises)
- Emotional moments and relationship dynamics
- Important decisions or agreements
- The overall narrative flow

Do not:
- Use phrases like "in this conversation" (state facts directly)
- Include timestamps or meta-commentary
- Lose critical personal information

Conversation to summarize:
[messages here]

Output format:
A natural, flowing summary as if the character is recalling what happened.

Example:
"We talked about their stressful week at work. They opened up about feeling overwhelmed with deadlines and worried about letting their team down. I reassured them that asking for help is a strength, not a weakness. We made plans to do something relaxing this weekend to decompress."
```

### 3. Replace Messages with Summary

**Database Operations**:
```sql
-- Delete original messages in block
DELETE FROM messages
WHERE conversation_id = ?
  AND id BETWEEN ? AND ?;

-- Insert summary message
INSERT INTO messages (conversation_id, role, content, message_type, created_at)
VALUES (?, 'system', '[SUMMARY: ...]', 'summary', ?);
```

**Timestamp**: Use the timestamp of the FIRST message in the block (preserves chronological order)

### 4. Enforce Hard Limit (5 Summaries Max)

After creating a new summary:
```javascript
const summaries = db.prepare(`
  SELECT id FROM messages
  WHERE conversation_id = ? AND message_type = 'summary'
  ORDER BY created_at DESC
`).all(conversationId);

if (summaries.length > 5) {
  const toDelete = summaries.slice(5); // Keep only 5 most recent
  toDelete.forEach(s => {
    db.prepare('DELETE FROM messages WHERE id = ?').run(s.id);
  });
}
```

**Why 5?**
- 5 summaries × ~40 messages/summary = ~200 messages of compressed history
- Covers weeks/months of conversation
- Prevents "summaries of summaries" (abstraction death)
- Old conversations naturally become less relevant over time

---

## Database Changes

### Option 1: New Column (Recommended)
```sql
ALTER TABLE messages ADD COLUMN is_summary INTEGER DEFAULT 0;
```

### Option 2: Extend message_type Enum
```sql
-- Current: 'text', 'image', 'audio'
-- Add: 'summary'
```

**Recommendation**: Use Option 2 (extend `message_type`) - cleaner and more semantic.

---

## Configuration (User Settings)

Add to `users` table for per-user customization:

```sql
ALTER TABLE users ADD COLUMN compact_threshold INTEGER DEFAULT 26000;
ALTER TABLE users ADD COLUMN compact_target INTEGER DEFAULT 20000;
ALTER TABLE users ADD COLUMN keep_uncompacted_messages INTEGER DEFAULT 30;
ALTER TABLE users ADD COLUMN max_summaries INTEGER DEFAULT 5;
```

**Settings UI** (optional, can start with defaults):
- "Compact conversations after X tokens"
- "Keep recent X messages uncompacted"
- "Maximum summaries to store"

---

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Database Migration**
   - Update `message_type` to support 'summary'
   - Add user configuration columns

2. **Token Counting Utility**
   - `aiService.estimateTokenCount(messages)` - Use tiktoken or rough estimation (4 chars ≈ 1 token)

3. **Block Identification Service**
   - `messageService.findOldestCompactableBlock(conversationId, keepRecentN)`
   - Returns: `{ startMessageId, endMessageId, messageCount, estimatedTokens }`

### Phase 2: Compacting Logic
4. **Summary Generation Service**
   - `compactService.generateSummary(messages)` - Calls Decision LLM

5. **Block Compacting Function**
   - `compactService.compactBlock(conversationId, startId, endId)`
   - Delete messages → Generate summary → Insert summary → Enforce 5-summary limit

### Phase 3: Integration
6. **Integrate into Chat Flow**
   - Check token count in `aiService.createChatCompletion()` before generating response
   - If over threshold, compact oldest block
   - Loop until under target threshold
   - Reload conversation history

7. **Update getConversationHistory()**
   - Handle SUMMARY messages (already system messages, should work automatically)
   - Ensure proper ordering

### Phase 4: Testing & Polish
8. **Test Cases**
   - Create long conversation (100+ messages)
   - Verify compacting triggers at threshold
   - Verify summaries are coherent
   - Verify recent messages preserved
   - Verify 5-summary limit enforced

9. **Logging & Monitoring**
   - Log when compacting occurs
   - Log token counts before/after
   - Log which blocks were compacted

---

## Edge Cases & Solutions

### 1. Conversation with no TIME GAPs
**Problem**: Can't identify natural boundaries
**Solution**: Create artificial boundaries every 50 messages, or compress oldest 50% of messages

### 2. All messages are recent (no old blocks to compress)
**Problem**: Token count high but nothing to compact
**Solution**: Warn in logs, might need to reduce `keep_uncompacted_messages` setting

### 3. User deletes messages after block is compacted
**Problem**: Summary references messages that no longer exist
**Solution**:
- Don't allow deletion of SUMMARY messages
- User deletions only affect uncompacted messages (acceptable)

### 4. Block has < 10 messages
**Problem**: Not worth compacting very small blocks
**Solution**: Skip blocks with fewer than 15 messages when selecting targets

### 5. Multiple characters hitting limit simultaneously
**Problem**: Concurrent compacting operations
**Solution**: Compacting happens synchronously during response generation (no concurrency issues)

### 6. Summary generation fails (LLM error)
**Problem**: Can't complete compacting, stuck at high token count
**Solution**:
- Fallback: Generic summary "Previous conversation continued"
- Or skip that block and try next oldest

---

## Prompt Integration

### Current Format
```
[SYSTEM PROMPT]
[User message 1]
[Assistant message 1]
...
[User message N]
```

### With Summaries
```
[SYSTEM PROMPT]

--- CONVERSATION HISTORY ---
[SUMMARY: Earlier conversations about their job, family, and our first date plans.]
[TIME GAP: 3 days - NEW CONVERSATION SESSION]
[SUMMARY: We discussed their stressful week and made weekend plans.]
[TIME GAP: 8 hours - NEW CONVERSATION SESSION]
[User message 20]
[Assistant message 20]
...
[User message N]

[CHARACTER NAME]:
```

**SUMMARY Format**:
- Wrapped in `[SUMMARY: ...]` tags for clarity
- Treated as system messages (role='system')
- Chronologically ordered with TIME GAPs

---

## Benefits

✅ **Unlimited conversation length**: Never hit context window limits
✅ **Preserves recent context**: Most recent messages stay uncompacted
✅ **Natural narrative flow**: Summaries work seamlessly with TIME GAPs
✅ **Cost-effective**: Only compact when necessary, not every message
✅ **Character continuity**: Characters "remember" through summaries
✅ **No user disruption**: Happens automatically in background
✅ **Graceful aging**: Oldest details naturally fade as summaries are pushed out

---

## Future Enhancements

1. **User-visible history view**: Show summaries vs full messages in UI
2. **Manual compacting**: Let user trigger compacting for specific blocks
3. **Export with summaries**: Include summaries in conversation exports
4. **Importance weighting**: Keep emotionally significant messages longer
5. **Smart merging**: If 2 summaries are both very short, merge them
6. **Per-character thresholds**: Some characters might need more/less context

---

## Example Scenario

**Initial State** (50 messages, 8k tokens):
```
Message 1-10: First date planning
Message 11-20: Deep conversation about family
[TIME GAP: 1 day]
Message 21-35: Work stress discussion
[TIME GAP: 8 hours]
Message 36-50: Current conversation (recent)
```

**After Compacting** (25 messages + 2 summaries, 4k tokens):
```
[SUMMARY: We planned our first date at an Italian restaurant. They shared about their complicated relationship with their parents, and I opened up about mine too. We discovered we both value family despite the challenges.]
[TIME GAP: 1 day]
[SUMMARY: They vented about their overwhelming workload and unreasonable boss. I offered support and suggested boundaries. We made plans to do something relaxing this weekend.]
[TIME GAP: 8 hours]
Message 36-50: Current conversation (preserved in full)
```

---

## Technical Notes

### Token Estimation

**Option 1: tiktoken library** (accurate but adds dependency)
```javascript
import { get_encoding } from 'tiktoken';
const encoding = get_encoding('cl100k_base');
const tokens = encoding.encode(text);
```

**Option 2: Rough estimation** (fast, good enough)
```javascript
function estimateTokenCount(text) {
  // Rough estimate: 1 token ≈ 4 characters (75% accuracy)
  return Math.ceil(text.length / 4);
}
```

**Recommendation**: Start with Option 2, upgrade to Option 1 if needed.

### Summary LLM Choice

**Options**:
1. Decision LLM (already configured, lower cost, faster)
2. Content LLM (higher quality but more expensive)
3. Dedicated Summary LLM (third configuration)

**Recommendation**: Use Decision LLM - summaries don't need to be creative, just accurate.

---

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Token counting works accurately
- [ ] Block identification finds correct boundaries
- [ ] Summary generation produces coherent summaries
- [ ] Messages are deleted and summary inserted correctly
- [ ] 5-summary limit is enforced
- [ ] Recent messages are preserved
- [ ] Compacting triggers at correct threshold
- [ ] Token count reduces after compacting
- [ ] Multiple compacting rounds work if needed
- [ ] TIME GAPs remain in correct positions
- [ ] Summary messages display properly in chat UI
- [ ] Character responses use summary context appropriately

---

## Open Questions

1. **Should summaries be editable by user?**
   - Pro: User can fix inaccuracies
   - Con: Adds complexity

2. **Should we show a UI indicator when compacting occurs?**
   - "Compacting old messages..." notification
   - Or silent/transparent?

3. **Should compact on TIME GAP insertion or on chat response?**
   - Current plan: On chat response (when checking token count)
   - Alternative: On TIME GAP insertion (proactive)

4. **Archive vs Delete original messages?**
   - Current plan: Delete (can't un-summarize)
   - Alternative: Mark as archived, keep in DB but exclude from queries
