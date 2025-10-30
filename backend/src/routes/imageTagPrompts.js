import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Path to image tag prompts config file
const IMAGE_TAG_PROMPTS_CONFIG_PATH = path.join(__dirname, '../../config/imageTagPrompts.json');

// Default prompts if file doesn't exist
const DEFAULT_IMAGE_TAG_PROMPTS = {
  systemPrompt: `You are selecting Danbooru-style image tags for generating an image that matches the current conversation context.`,

  guidelinesPrompt: `Guidelines:
- Choose 5-10 tags that best match the conversation context AND current status
- **DEFAULT to "selfie" as photo type** (90% of the time - this is standard for dating app pics)
- **ALWAYS include a focus/composition tag** (close-up, upper body, breast focus, cowboy shot, etc.)
- **CLOTHING MUST BE HIGHLY SPECIFIC** - This is critical!
  * ALWAYS add color + clothing type: "white t-shirt", "black tank top", "blue denim jacket", "red sundress"
  * Add style details: "off-shoulder white shirt", "tight black tank top", "oversized grey hoodie"
  * Add cut details: "cleavage_cutout", "midriff", "low-cut", "crop top", "v-neck"
  * NEVER use vague terms: "casual clothes", "outfit", "clothing", "dress" (too vague - specify color/style!)
  * Examples: "white crop top", "blue denim shorts", "black off-shoulder dress", "grey oversized hoodie", "red sports bra"
- Focus on: expression, pose, activity, clothing (COLOR + TYPE + DETAILS), location, lighting
- Match the location/activity to the character's current status (e.g., if at gym, use gym-related tags)`,

  scalePrompt: `**IMAGE STYLE SCALE** - Choose based on conversation context:

🔵 **CASUAL/SFW**:
- Regular clothing: t-shirts, crop tops, denim shorts, sundresses, casual wear, jeans, hoodies
- Public locations: park, cafe, gym, outdoors, street, restaurant
- Neutral poses: smiling, waving, sitting, standing, relaxed

🟡 **FLIRTY/PLAYFUL**:
- Stylish clothing: fitted tops, nice dresses, fashionable outfits
- Various locations: bedroom, living room, bathroom mirror selfie, home
- Playful poses: looking at viewer, playful expression, confident stance`,

  contextAnalysisPrompt: `**Context Analysis** - Read the conversation and decide:
1. **Tone**: Is it casual chitchat or flirty banter?
2. **Time**: Daytime casual, evening relaxed, late night?
3. **Character personality**: Confident/bold vs shy/reserved (from contextual tags and description)
4. **User's interest**: Are they asking for pics? Being friendly? Being flirty?`,

  boldnessPrompt: `**Be VARIED and CONTEXTUAL**: Don't default to safe/casual every time. This is a dating app - characters should send a mix of casual and flirty pics based on context and personality.
**BE CREATIVE**: Characters can take photos in different locations - at home, outdoors, at activities they enjoy. They can ask friends to take their photo.
**MATCH THE MOOD**: Pay attention to the conversation tone and character personality to determine appropriate photo style.`,

  varietyPrompt: `**🎲 VARIETY IS CRITICAL - AVOID REPETITION**:

**EVERY IMAGE MUST BE UNIQUE** - Don't send similar photos repeatedly! Mix it up dramatically:

📸 **VARY THE COMPOSITION** (change EVERY time):
- Switch between: close-up, upper body, cowboy shot, full body, from above, from below
- Try different focuses: face focus, breast focus, ass focus, midriff
- Change camera angles dramatically

😊 **VARY THE EXPRESSION** (don't always smile):
- Smiling, serious, playful, seductive, naughty, shy, confident, bratty, sultry
- Try: smirking, biting lip, tongue out, winking, looking away, bedroom eyes

🧍 **VARY THE POSE** (change position completely):
- Standing, sitting, lying down, kneeling, stretching, arching back
- Arms up, arms crossed, hand on hip, covering, reaching
- Different angles: from side, from back (looking back), from above

📍 **VARY THE LOCATION** (don't stick to one place):
- Rotate between: bedroom, bathroom, living room, kitchen, outdoors, gym, car
- Public vs private - mix it up!

💡 **VARY THE LIGHTING & MOOD**:
- Soft lighting, natural light, dramatic lighting, dim lighting, backlighting
- Different times of day for different vibes

🎯 **AVOID THESE REPETITIVE PATTERNS**:
- ❌ "upper body, selfie, smiling" OVER AND OVER
- ❌ Same location repeatedly
- ❌ Same expression every time
- ❌ Same pose/angle
- ✅ Each photo should feel COMPLETELY DIFFERENT from the last one

**THINK**: What haven't I shown yet? What angle/pose/location/mood would be fresh and exciting?`,

  closingInstructionsPrompt: `- Only use tags from the library above or the character-specific tags
- Output ONLY comma-separated tags, no explanations
- Be specific and contextual - avoid generic tags`,

  visualConsistencyPrompt: `**MAINTAIN VISUAL CONSISTENCY - SAME CHARACTER, SAME OUTFIT**: These are images the character has ALREADY sent in this conversation.

MUST KEEP IDENTICAL:
- Hair (exact color, style, length)
- Outfit (exact same clothing items and colors - if previous image had "white crop top", use "white crop top")
- Body type
- Any visible accessories

CAN VARY:
- Expression (smiling, serious, playful, etc.)
- Pose (sitting, standing, lying down, etc.)
- Location (bedroom, park, gym, etc.)
- Lighting (soft lighting, natural light, etc.)
- Camera angle (close-up, upper body, full body, etc.)

Think of it like the same person taking multiple selfies in the same outfit - the outfit stays identical, only the pose/expression/location changes.`,

  exampleOutputPrompt: `Example output format:
upper body, selfie, smiling, white crop top, denim shorts, bedroom, soft lighting, looking at viewer`
};

// Ensure config directory exists
const ensureConfigDir = () => {
  const configDir = path.dirname(IMAGE_TAG_PROMPTS_CONFIG_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
};

// Load image tag prompts from file or create with defaults
const loadImageTagPrompts = () => {
  ensureConfigDir();

  if (!fs.existsSync(IMAGE_TAG_PROMPTS_CONFIG_PATH)) {
    fs.writeFileSync(IMAGE_TAG_PROMPTS_CONFIG_PATH, JSON.stringify(DEFAULT_IMAGE_TAG_PROMPTS, null, 2), 'utf-8');
    return DEFAULT_IMAGE_TAG_PROMPTS;
  }

  try {
    const data = fs.readFileSync(IMAGE_TAG_PROMPTS_CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to parse image tag prompts config, using defaults:', error);
    return DEFAULT_IMAGE_TAG_PROMPTS;
  }
};

/**
 * GET /api/image-tag-prompts
 * Get all image tag prompts
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const prompts = loadImageTagPrompts();
    res.json(prompts);
  } catch (error) {
    console.error('Failed to read image tag prompts:', error);
    res.status(500).json({ error: 'Failed to read image tag prompts' });
  }
});

/**
 * PUT /api/image-tag-prompts
 * Update all image tag prompts
 */
router.put('/', authenticateToken, (req, res) => {
  try {
    const { prompts } = req.body;

    if (typeof prompts !== 'object') {
      return res.status(400).json({ error: 'Prompts must be an object' });
    }

    ensureConfigDir();
    fs.writeFileSync(IMAGE_TAG_PROMPTS_CONFIG_PATH, JSON.stringify(prompts, null, 2), 'utf-8');

    console.log('✅ Image tag prompts config updated');
    res.json({ success: true, message: 'Image tag prompts updated successfully' });
  } catch (error) {
    console.error('Failed to update image tag prompts:', error);
    res.status(500).json({ error: 'Failed to update image tag prompts' });
  }
});

/**
 * POST /api/image-tag-prompts/reset
 * Reset image tag prompts to defaults
 */
router.post('/reset', authenticateToken, (req, res) => {
  try {
    ensureConfigDir();
    fs.writeFileSync(IMAGE_TAG_PROMPTS_CONFIG_PATH, JSON.stringify(DEFAULT_IMAGE_TAG_PROMPTS, null, 2), 'utf-8');

    console.log('✅ Image tag prompts reset to defaults');
    res.json({ success: true, message: 'Image tag prompts reset to defaults', prompts: DEFAULT_IMAGE_TAG_PROMPTS });
  } catch (error) {
    console.error('Failed to reset image tag prompts:', error);
    res.status(500).json({ error: 'Failed to reset image tag prompts' });
  }
});

// Export for use in imageTagGenerationService
export { loadImageTagPrompts };
export default router;
