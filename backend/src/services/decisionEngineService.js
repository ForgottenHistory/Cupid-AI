import axios from 'axios';
import llmSettingsService from './llmSettingsService.js';

class DecisionEngineService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  }

  /**
   * Decision Engine: Analyze conversation and decide on actions
   * Returns: { reaction: string|null, shouldRespond: boolean, shouldUnmatch: boolean, shouldSendVoice: boolean, shouldSendImage: boolean, imageContext: string|null }
   */
  async makeDecision({ messages, characterData, userMessage, userId, isEngaged = false, hasVoice = false, hasImage = false }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const decisionSettings = llmSettingsService.getDecisionSettings(userId);

      // Get personality data if available
      let personalityContext = '';
      if (characterData.personality_data) {
        try {
          const personality = JSON.parse(characterData.personality_data);
          personalityContext = `\nPersonality Traits:
- Extraversion: ${personality.extraversion}/100 (${personality.extraversion > 60 ? 'outgoing, expressive' : 'reserved, thoughtful'})
- Openness: ${personality.openness}/100 (${personality.openness > 60 ? 'experimental, creative' : 'traditional, practical'})`;
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Build decision prompt (plaintext output)
      const decisionPrompt = `You are a decision-making AI that analyzes dating app conversations and decides how the character should respond.

Character: ${characterData.name}
Description: ${characterData.description || 'N/A'}${personalityContext}
${isEngaged ? '\nCurrent state: Character is actively engaged in conversation (responding quickly)' : '\nCurrent state: Character is disengaged (slower responses based on availability)'}
${hasVoice ? '\nVoice available: This character has a voice sample and can send voice messages' : '\nVoice available: No (text only)'}
${hasImage ? '\nImage generation: This character has image tags configured and can send generated images' : '\nImage generation: No'}

Recent conversation context:
${messages.slice(-3).map(m => `${m.role === 'user' ? 'User' : characterData.name}: ${m.content}`).join('\n')}

User just sent: "${userMessage}"

Decide on the character's behavioral response. Output your decision in this EXACT plaintext format:

Reaction: [emoji or "none"]
Should Respond: [yes/no]
Should Unmatch: [yes/no]
${hasVoice ? 'Send Voice: [yes/no]' : ''}${hasImage ? `
Send Image: [yes/no]
Image Context: [danbooru tags or "none"]` : ''}

Guidelines:
- "Reaction": IMPORTANT - Reactions should be RARE (only 1 in 5 messages or less). Only react to messages that are genuinely funny, sweet, exciting, or emotionally significant. Most messages should get "none". Don't react to every message!
- If you do react, choose ONE emoji that represents a strong emotional reaction (❤️, 😂, 🔥, 😍, 😭, etc.)
- "Should Respond": Always "yes" for now (we will expand this later)
- "Should Unmatch": EXTREMELY RARE - Only "yes" if the user is being:
  * Extremely annoying
  * Persistently ignoring boundaries after warnings
  * Not fulfilling character's needs in any way
  This should almost NEVER be "yes" - reserve it for serious violations only. Normal awkwardness, bad jokes, or being boring should NOT trigger unmatch.${hasVoice ? `
- "Send Voice": Should be OCCASIONAL, not every message. Consider:
  * Personality: High extraversion/openness = more likely to use voice
  * Context: Emotional moments, excitement, longer responses = more voice
  * Variety: Don't overuse voice - text is default, voice is special
  * Quick replies: Usually text
  * Deep/heartfelt messages: More likely voice` : ''}${hasImage ? `
- "Send Image": Consider context carefully. Send image when:
  * User directly asks for a photo/pic/selfie → Usually YES
  * Character wants to show what they're doing/wearing → YES if relevant
  * Flirty moment where visual would enhance chemistry → Consider YES
  * Sharing a moment (food, location, outfit, activity) → Consider YES
  * Random messages with no visual context → NO
  * Early conversation before rapport built → Usually NO
  * Personality: High openness/extraversion = more likely to send spontaneous pics
  Images should feel natural to the conversation flow, not forced or random.
- "Image Context": If Send Image is "yes", provide Danbooru-style tags describing the situation/pose/expression/clothing/location. IMPORTANT: Default to "selfie" unless context clearly suggests a different perspective (e.g., user asking "what are you doing" = selfie with activity, flirty moment = selfie, showing outfit = selfie). Examples: "selfie, smiling, waving, casual clothes" or "selfie, bedroom, lying down, phone in hand, soft lighting" or "selfie, biting lip, winking, teasing". If "no", write "none".` : ''}

Output ONLY the ${hasVoice && hasImage ? 'six' : hasVoice || hasImage ? 'five' : 'three'} lines in the exact format shown above, nothing else.`;

      console.log('🎯 Decision Engine Request:', {
        model: decisionSettings.model,
        temperature: decisionSettings.temperature,
        max_tokens: decisionSettings.max_tokens
      });

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: decisionSettings.model,
          messages: [
            { role: 'user', content: decisionPrompt }
          ],
          temperature: decisionSettings.temperature,
          max_tokens: decisionSettings.max_tokens,
          top_p: decisionSettings.top_p,
          frequency_penalty: decisionSettings.frequency_penalty,
          presence_penalty: decisionSettings.presence_penalty,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'AI-Dater Decision Engine',
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();

      console.log('✅ Decision Engine Response:', {
        model: response.data.model,
        usage: response.data.usage
      });

      // Parse plaintext response
      return this.parseDecisionResponse(content);
    } catch (error) {
      console.error('❌ Decision Engine error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // On error, fail gracefully: no reaction, but respond, don't unmatch
      return this.getDefaultDecision();
    }
  }

  /**
   * Proactive Decision Engine: Decide if character should send proactive message
   * Returns: { shouldSend: boolean, messageType: "resume"|"fresh"|"callback" }
   */
  async makeProactiveDecision({ messages, characterData, gapHours, userId }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const decisionSettings = llmSettingsService.getDecisionSettings(userId);

      // Build context
      const lastMessages = messages.slice(-5);

      const decisionPrompt = `You are deciding if this character should proactively send a message on a dating app.

Character: ${characterData.name}
Description: ${characterData.description || 'N/A'}

Time since last message: ${gapHours.toFixed(1)} hours

Recent conversation:
${lastMessages.map(m => `${m.role === 'user' ? 'User' : characterData.name}: ${m.content}`).join('\n')}

Analyze:
1. Did the conversation naturally end or trail off?
2. Is there an open question or unresolved topic?
3. Would it feel natural for the character to reach out now?
4. Consider time of day and how long it's been

Output your decision in this EXACT format:

Should Send: [yes/no]
Message Type: [resume/fresh/callback]

Guidelines:
- "Should Send": yes if character would naturally reach out, no if conversation ended cleanly
- "Message Type":
  * "resume" - Continue the previous topic (if conversation was mid-flow)
  * "fresh" - Start a new conversation (if enough time has passed or topic ended)
  * "callback" - Reference something from earlier (if there was an interesting point to revisit)

Output ONLY the two lines in the exact format shown above, nothing else.`;

      console.log('🎯 Proactive Decision Engine Request:', {
        model: decisionSettings.model,
        gapHours: gapHours.toFixed(1)
      });

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: decisionSettings.model,
          messages: [
            { role: 'user', content: decisionPrompt }
          ],
          temperature: decisionSettings.temperature,
          max_tokens: decisionSettings.max_tokens,
          top_p: decisionSettings.top_p,
          frequency_penalty: decisionSettings.frequency_penalty,
          presence_penalty: decisionSettings.presence_penalty,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'AI-Dater Proactive Decision Engine',
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();

      // Parse response
      return this.parseProactiveDecisionResponse(content);
    } catch (error) {
      console.error('❌ Proactive Decision Engine error:', error.message);
      // On error, don't send
      return this.getDefaultProactiveDecision();
    }
  }

  /**
   * Parse decision response
   */
  parseDecisionResponse(content) {
    try {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const decision = {
        reaction: null,
        shouldRespond: true,
        shouldUnmatch: false,
        shouldSendVoice: false,
        shouldSendImage: false,
        imageContext: null
      };

      for (const line of lines) {
        if (line.startsWith('Reaction:')) {
          const value = line.substring('Reaction:'.length).trim();
          // If it's "none" or empty, keep null. Otherwise use the emoji
          if (value && value.toLowerCase() !== 'none') {
            decision.reaction = value;
          }
        } else if (line.startsWith('Should Respond:')) {
          const value = line.substring('Should Respond:'.length).trim().toLowerCase();
          decision.shouldRespond = value === 'yes';
        } else if (line.startsWith('Should Unmatch:')) {
          const value = line.substring('Should Unmatch:'.length).trim().toLowerCase();
          decision.shouldUnmatch = value === 'yes';
        } else if (line.startsWith('Send Voice:')) {
          const value = line.substring('Send Voice:'.length).trim().toLowerCase();
          decision.shouldSendVoice = value === 'yes';
        } else if (line.startsWith('Send Image:')) {
          const value = line.substring('Send Image:'.length).trim().toLowerCase();
          decision.shouldSendImage = value === 'yes';
        } else if (line.startsWith('Image Context:')) {
          const value = line.substring('Image Context:'.length).trim();
          if (value && value.toLowerCase() !== 'none') {
            decision.imageContext = value;
          }
        }
      }

      return decision;
    } catch (parseError) {
      console.error('Failed to parse decision response:', parseError, 'Content:', content);
      return this.getDefaultDecision();
    }
  }

  /**
   * Parse proactive decision response
   */
  parseProactiveDecisionResponse(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const decision = {
      shouldSend: false,
      messageType: 'fresh'
    };

    for (const line of lines) {
      if (line.startsWith('Should Send:')) {
        const value = line.substring('Should Send:'.length).trim().toLowerCase();
        decision.shouldSend = value === 'yes';
      } else if (line.startsWith('Message Type:')) {
        const value = line.substring('Message Type:'.length).trim().toLowerCase();
        if (['resume', 'fresh', 'callback'].includes(value)) {
          decision.messageType = value;
        }
      }
    }

    return decision;
  }

  /**
   * Get default decision (fallback)
   */
  getDefaultDecision() {
    return {
      reaction: null,
      shouldRespond: true,
      shouldUnmatch: false,
      shouldSendVoice: false,
      shouldSendImage: false,
      imageContext: null
    };
  }

  /**
   * Get default proactive decision (fallback)
   */
  getDefaultProactiveDecision() {
    return {
      shouldSend: false,
      messageType: 'fresh'
    };
  }
}

export default new DecisionEngineService();
