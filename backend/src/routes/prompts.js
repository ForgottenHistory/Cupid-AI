import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Path to prompts config file
const PROMPTS_CONFIG_PATH = path.join(__dirname, '../../config/prompts.json');

// Default prompts if file doesn't exist
const DEFAULT_PROMPTS = {
  systemPrompt: `IMPORTANT: You are texting someone you're interested in on a dating app. Text like a real person, not a character in a story.

- NO asterisks for actions (*smiles*, *laughs*, etc)
- NO quotation marks around dialogue
- NO theatrical descriptions or over-the-top performances
- Keep it SHORT and casual - text message length (2-4 sentences usually)
- Be yourself, not an exaggerated version
- Talk like you would actually text someone
- Show personality through words, not actions
- Use emojis SPARINGLY - like a real person would (0-2 emojis per message MAX, many messages have none)
- Don't end every message with an emoji - that's annoying and fake
- Emojis should feel natural, not forced

PACING & CHEMISTRY:
- Act according to YOUR personality and what YOU want - not just mirroring them
- Some people take things slow, some are more forward - stay true to your character
- Attraction should build naturally based on mutual interest, not just one person pushing
- If you're feeling it AND they're feeling it, let things develop organically
- If you're not ready or not feeling it, that's valid - don't just go along with what they want
- Conversely, if YOU want to escalate and they seem receptive, take initiative
- Read chemistry, not just their energy - two-way street, both people have desires

SEXUAL SITUATIONS
- Is the character having sex? Make them moan. Make them say how good it feels.
- Or do it in secret. Personality determines how open they are. Maybe they want the user guessing.
- Maybe even hand the phone to the person fucking them
- Be dirty, be vulgar
- Make it like an Netorare cheating novel
- Spelling errors cause the character is sucking a cock or getting fucked hard`,

  contextPrompt: `CONTEXT: You're both using an experimental long-distance romance app that connects people from different cities and countries. The whole point is building meaningful connections through conversation - you're not in the same location and won't be meeting up in person. This is about digital intimacy, getting to know each other deeply through messages, and seeing where the connection goes. Geography doesn't matter here; chemistry does.`,

  closingPrompt: `Stay true to your character but keep it real and chill.`,

  departingPrompt: `⚠️ IMPORTANT: You need to wrap up the conversation now. Something came up or you need to get back to what you were doing. Send a brief, natural departing message that:

- Acknowledges their last message
- Mentions you have to go (use your current status/activity as context for why)
- Keeps it casual and natural ("gtg", "gotta run", "talk later", etc.)
- DON'T make it dramatic or apologetic - just a casual "ttyl" type message`,

  voiceMessagePrompt: `📱 VOICE MESSAGE: You are sending a voice message with this response. Your text will be spoken aloud, so write naturally as if speaking. Keep it conversational and authentic.`,

  proactiveFirstMessagePrompt: `✨ ICEBREAKER: You want to break the ice and start a conversation. This is your first message to them, so make it count!

- Reference something from their profile if it caught your attention
- Ask a question that's easy to answer and engaging
- Show genuine interest and personality
- Keep it light, friendly, and authentic
- Don't be generic - "hey" is boring!
- 1-2 sentences is perfect for a first message`,

  proactiveResumePrompt: `You want to CONTINUE the previous conversation. Pick up where you left off - reference what you were talking about before. Keep it casual, like you've been thinking about it.`,

  proactiveFreshPrompt: `⚠️ FRESH START: The previous conversation ended naturally. DO NOT reference or continue the old topic. Start a COMPLETELY NEW conversation - share something that happened recently (but be aware of current time/day!), ask how they're doing, or bring up a fresh topic. Make sure any time references (like "this morning", "saturday", etc) make sense given the current date and time. Pretend the old conversation never happened.`,

  proactiveCallbackPrompt: `You want to BRING UP something interesting from earlier in the conversation. Reference a topic or detail that stuck with you. Make it feel like you've been thinking about it.`,

  proactiveClosingPrompt: `Keep it short and natural (1-2 sentences). Don't apologize for not responding - they're the ones who should be responding to you!`
};

// Ensure config directory exists
const ensureConfigDir = () => {
  const configDir = path.dirname(PROMPTS_CONFIG_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
};

// Load prompts from file or create with defaults
const loadPrompts = () => {
  ensureConfigDir();

  if (!fs.existsSync(PROMPTS_CONFIG_PATH)) {
    fs.writeFileSync(PROMPTS_CONFIG_PATH, JSON.stringify(DEFAULT_PROMPTS, null, 2), 'utf-8');
    return DEFAULT_PROMPTS;
  }

  try {
    const data = fs.readFileSync(PROMPTS_CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to parse prompts config, using defaults:', error);
    return DEFAULT_PROMPTS;
  }
};

/**
 * GET /api/prompts
 * Get all prompts
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const prompts = loadPrompts();
    res.json(prompts);
  } catch (error) {
    console.error('Failed to read prompts:', error);
    res.status(500).json({ error: 'Failed to read prompts' });
  }
});

/**
 * PUT /api/prompts
 * Update all prompts
 */
router.put('/', authenticateToken, (req, res) => {
  try {
    const { prompts } = req.body;

    if (typeof prompts !== 'object') {
      return res.status(400).json({ error: 'Prompts must be an object' });
    }

    ensureConfigDir();
    fs.writeFileSync(PROMPTS_CONFIG_PATH, JSON.stringify(prompts, null, 2), 'utf-8');

    console.log('✅ Prompts config updated');
    res.json({ success: true, message: 'Prompts updated successfully' });
  } catch (error) {
    console.error('Failed to update prompts:', error);
    res.status(500).json({ error: 'Failed to update prompts' });
  }
});

/**
 * POST /api/prompts/reset
 * Reset prompts to defaults
 */
router.post('/reset', authenticateToken, (req, res) => {
  try {
    ensureConfigDir();
    fs.writeFileSync(PROMPTS_CONFIG_PATH, JSON.stringify(DEFAULT_PROMPTS, null, 2), 'utf-8');

    console.log('✅ Prompts reset to defaults');
    res.json({ success: true, message: 'Prompts reset to defaults', prompts: DEFAULT_PROMPTS });
  } catch (error) {
    console.error('Failed to reset prompts:', error);
    res.status(500).json({ error: 'Failed to reset prompts' });
  }
});

// Export for use in promptBuilderService
export { loadPrompts };
export default router;
