import axios from 'axios';
import db from '../db/database.js';
import { encode } from 'gpt-tokenizer';

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.defaultModel = 'deepseek/deepseek-chat-v3'; // Free tier model

    if (!this.apiKey) {
      console.warn('⚠️  OPENROUTER_API_KEY not found in environment variables');
    }
  }

  /**
   * Get user's LLM settings from database
   */
  getUserSettings(userId) {
    if (!userId) {
      return {
        model: this.defaultModel,
        temperature: 0.8,
        max_tokens: 800,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        context_window: 4000
      };
    }

    try {
      const settings = db.prepare(`
        SELECT llm_model, llm_temperature, llm_max_tokens, llm_top_p,
               llm_frequency_penalty, llm_presence_penalty, llm_context_window
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return {
          model: this.defaultModel,
          temperature: 0.8,
          max_tokens: 800,
          top_p: 1.0,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
          context_window: 4000
        };
      }

      return {
        model: settings.llm_model || this.defaultModel,
        temperature: settings.llm_temperature ?? 0.8,
        max_tokens: settings.llm_max_tokens ?? 800,
        top_p: settings.llm_top_p ?? 1.0,
        frequency_penalty: settings.llm_frequency_penalty ?? 0.0,
        presence_penalty: settings.llm_presence_penalty ?? 0.0,
        context_window: settings.llm_context_window ?? 4000
      };
    } catch (error) {
      console.error('Error fetching user LLM settings:', error);
      return {
        model: this.defaultModel,
        temperature: 0.8,
        max_tokens: 800,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        context_window: 4000
      };
    }
  }

  /**
   * Get user's Decision LLM settings from database
   */
  getDecisionLLMSettings(userId) {
    if (!userId) {
      return {
        model: this.defaultModel,
        temperature: 0.7,
        max_tokens: 500,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        context_window: 2000
      };
    }

    try {
      const settings = db.prepare(`
        SELECT decision_llm_model, decision_llm_temperature, decision_llm_max_tokens, decision_llm_top_p,
               decision_llm_frequency_penalty, decision_llm_presence_penalty, decision_llm_context_window
        FROM users WHERE id = ?
      `).get(userId);

      if (!settings) {
        return {
          model: this.defaultModel,
          temperature: 0.7,
          max_tokens: 500,
          top_p: 1.0,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
          context_window: 2000
        };
      }

      return {
        model: settings.decision_llm_model || this.defaultModel,
        temperature: settings.decision_llm_temperature ?? 0.7,
        max_tokens: settings.decision_llm_max_tokens ?? 500,
        top_p: settings.decision_llm_top_p ?? 1.0,
        frequency_penalty: settings.decision_llm_frequency_penalty ?? 0.0,
        presence_penalty: settings.decision_llm_presence_penalty ?? 0.0,
        context_window: settings.decision_llm_context_window ?? 2000
      };
    } catch (error) {
      console.error('Error fetching user Decision LLM settings:', error);
      return {
        model: this.defaultModel,
        temperature: 0.7,
        max_tokens: 500,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        context_window: 2000
      };
    }
  }

  /**
   * Count tokens in text
   */
  countTokens(text) {
    try {
      return encode(text).length;
    } catch (error) {
      // Fallback: rough estimate (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Trim messages to fit within context window
   * Keeps system prompt + most recent messages that fit
   */
  trimMessagesToContextWindow(messages, systemPrompt, contextWindow, maxTokens) {
    // Reserve tokens for system prompt and response
    const systemTokens = this.countTokens(systemPrompt);
    const availableTokens = contextWindow - systemTokens - maxTokens - 100; // 100 token buffer

    if (availableTokens <= 0) {
      console.warn('⚠️  Context window too small for system prompt and response');
      return []; // Return empty if not enough space
    }

    // Count tokens from newest to oldest, keep messages that fit
    let totalTokens = 0;
    const trimmedMessages = [];

    // Go through messages in reverse (newest first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageText = `${message.role}: ${message.content}`;
      const messageTokens = this.countTokens(messageText);

      if (totalTokens + messageTokens <= availableTokens) {
        trimmedMessages.unshift(message); // Add to beginning to maintain order
        totalTokens += messageTokens;
      } else {
        // No more room, stop
        break;
      }
    }

    console.log(`📊 Context trimming: ${messages.length} messages → ${trimmedMessages.length} messages (${totalTokens}/${availableTokens} tokens)`);

    return trimmedMessages;
  }

  /**
   * Get surrounding activities from schedule (3 before, 3 after current)
   */
  getSurroundingActivities(schedule) {
    if (!schedule?.schedule) return null;

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Build a flat list of all blocks across the week with day labels
    const allBlocks = [];
    for (let i = 0; i < 7; i++) {
      const dayIndex = (now.getDay() + i) % 7;
      const day = dayNames[dayIndex];
      const dayBlocks = schedule.schedule[day] || [];

      dayBlocks.forEach(block => {
        allBlocks.push({
          day: day.charAt(0).toUpperCase() + day.slice(1),
          ...block
        });
      });
    }

    // Find current block index
    let currentBlockIndex = -1;
    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];
      if (block.day.toLowerCase() === currentDay &&
          currentTime >= block.start &&
          currentTime < block.end) {
        currentBlockIndex = i;
        break;
      }
    }

    if (currentBlockIndex === -1) return null;

    // Get 3 blocks before and 3 blocks after
    const recentActivities = [];
    const upcomingActivities = [];

    for (let i = Math.max(0, currentBlockIndex - 3); i < currentBlockIndex; i++) {
      recentActivities.push(allBlocks[i]);
    }

    for (let i = currentBlockIndex + 1; i <= Math.min(allBlocks.length - 1, currentBlockIndex + 3); i++) {
      upcomingActivities.push(allBlocks[i]);
    }

    return { recentActivities, upcomingActivities };
  }

  /**
   * Build system prompt from character data
   */
  buildSystemPrompt(characterData, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null) {
    const parts = [];

    if (characterData.name) {
      parts.push(`You are ${characterData.name}.`);
    }

    if (characterData.description) {
      parts.push(`\nDescription: ${characterData.description}`);
    }

    if (characterData.datingProfile) {
      parts.push(`\nDating Profile: ${characterData.datingProfile}`);
    }

    if (currentStatus) {
      const statusText = currentStatus.activity
        ? `${currentStatus.status} (${currentStatus.activity})`
        : currentStatus.status;
      parts.push(`\nCurrent Status: ${statusText}`);

      // Add context about what the status means
      if (currentStatus.status === 'busy' && currentStatus.activity) {
        parts.push(` - You're currently busy with this, so your texts might be brief or distracted.`);
      } else if (currentStatus.status === 'away' && currentStatus.activity) {
        parts.push(` - You're doing this right now, but can still text casually.`);
      } else if (currentStatus.status === 'online') {
        parts.push(` - You're free and available to chat.`);
      }
    }

    // Add departing context
    if (isDeparting) {
      parts.push(`\n\n⚠️ IMPORTANT: You need to wrap up the conversation now. Something came up or you need to get back to what you were doing. Send a brief, natural departing message that:`);
      parts.push(`\n- Acknowledges their last message`);
      parts.push(`\n- Mentions you have to go (use your current status/activity as context for why)`);
      parts.push(`\n- Keeps it casual and natural ("gtg", "gotta run", "talk later", etc.)`);
      parts.push(`\n- DON'T make it dramatic or apologetic - just a casual "ttyl" type message`);
    }

    // Add proactive messaging context
    if (isProactive && proactiveType) {
      parts.push(`\n\n💬 PROACTIVE MESSAGE CONTEXT: You are reaching out to them first after some time has passed.`);

      if (proactiveType === 'resume') {
        parts.push(`\n- Type: RESUME - Continue the previous conversation/topic naturally`);
        parts.push(`\n- Reference what you were talking about before`);
        parts.push(`\n- Keep it casual, like you've been thinking about it`);
      } else if (proactiveType === 'fresh') {
        parts.push(`\n- Type: FRESH START - Begin a new conversation`);
        parts.push(`\n- Don't reference the previous topic (it ended naturally)`);
        parts.push(`\n- Share something new, ask how they're doing, or bring up something you're doing`);
      } else if (proactiveType === 'callback') {
        parts.push(`\n- Type: CALLBACK - Reference something interesting from earlier`);
        parts.push(`\n- Bring up a topic or detail from the previous conversation`);
        parts.push(`\n- Make it feel like you've been thinking about it`);
      }

      parts.push(`\n- Keep it short and natural (1-2 sentences)`);
      parts.push(`\n- Don't apologize for not responding (they're the ones who should be responding to you!)`);
    }

    // Add recent and upcoming activities
    if (schedule) {
      const activities = this.getSurroundingActivities(schedule);
      if (activities) {
        const { recentActivities, upcomingActivities } = activities;

        if (recentActivities.length > 0) {
          parts.push(`\n\nRecent activities:`);
          recentActivities.forEach(block => {
            const activity = block.activity ? ` - ${block.activity}` : '';
            parts.push(`\n- ${block.start}-${block.end}: ${block.status}${activity}`);
          });
        }

        if (upcomingActivities.length > 0) {
          parts.push(`\n\nUpcoming activities:`);
          upcomingActivities.forEach(block => {
            const activity = block.activity ? ` - ${block.activity}` : '';
            parts.push(`\n- ${block.start}-${block.end}: ${block.status}${activity}`);
          });
        }
      }
    }

    if (userBio) {
      parts.push(`\n\nPerson you're talking to: ${userBio}`);
    }

    if (characterData.system_prompt) {
      parts.push(`\n\n${characterData.system_prompt}`);
    }

    parts.push(`\n\nIMPORTANT: You are texting someone you're interested in on a dating app. Text like a real person, not a character in a story.

- NO asterisks for actions (*smiles*, *laughs*, etc)
- NO quotation marks around dialogue
- NO theatrical descriptions or over-the-top performances
- Keep it SHORT and casual - text message length (1-3 sentences usually)
- Be yourself, not an exaggerated version
- Talk like you would actually text someone
- Show personality through words, not actions

Stay true to your character but keep it real and chill.`);

    return parts.join('');
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  async createChatCompletion({ messages, characterData, model = null, userId = null, maxTokens = null, currentStatus = null, userBio = null, schedule = null, isDeparting = false, isProactive = false, proactiveType = null }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const systemPrompt = this.buildSystemPrompt(characterData, currentStatus, userBio, schedule, isDeparting, isProactive, proactiveType);
      const userSettings = this.getUserSettings(userId);
      const selectedModel = model || userSettings.model;
      const effectiveMaxTokens = maxTokens || userSettings.max_tokens;

      // Trim messages to fit within context window
      const trimmedMessages = this.trimMessagesToContextWindow(
        messages,
        systemPrompt,
        userSettings.context_window,
        effectiveMaxTokens
      );

      console.log('🤖 OpenRouter Request:', {
        model: selectedModel,
        temperature: userSettings.temperature,
        max_tokens: effectiveMaxTokens,
        context_window: userSettings.context_window,
        messageCount: trimmedMessages.length + 1, // +1 for system prompt
        originalMessageCount: messages.length
      });

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...trimmedMessages
          ],
          temperature: userSettings.temperature,
          max_tokens: effectiveMaxTokens,
          top_p: userSettings.top_p,
          frequency_penalty: userSettings.frequency_penalty,
          presence_penalty: userSettings.presence_penalty,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'AI-Dater',
          }
        }
      );

      const content = response.data.choices[0].message.content;

      console.log('✅ OpenRouter Response:', {
        model: response.data.model,
        contentLength: content?.length || 0,
        usage: response.data.usage
      });

      return {
        content: content,
        model: response.data.model,
        usage: response.data.usage,
      };
    } catch (error) {
      console.error('❌ OpenRouter API error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        model: model || this.defaultModel
      });
      throw new Error(error.response?.data?.error?.message || error.message || 'AI service error');
    }
  }

  /**
   * Decision Engine: Analyze conversation and decide on actions
   * Returns: { reaction: string|null, shouldRespond: boolean, shouldUnmatch: boolean }
   */
  async makeDecision({ messages, characterData, userMessage, userId, isEngaged = false }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const decisionSettings = this.getDecisionLLMSettings(userId);

      // Build decision prompt (plaintext output)
      const decisionPrompt = `You are a decision-making AI that analyzes dating app conversations and decides how the character should respond.

Character: ${characterData.name}
Description: ${characterData.description || 'N/A'}
${isEngaged ? '\nCurrent state: Character is actively engaged in conversation (responding quickly)' : '\nCurrent state: Character is disengaged (slower responses based on availability)'}

Recent conversation context:
${messages.slice(-3).map(m => `${m.role === 'user' ? 'User' : characterData.name}: ${m.content}`).join('\n')}

User just sent: "${userMessage}"

Decide on the character's behavioral response. Output your decision in this EXACT plaintext format:

Reaction: [emoji or "none"]
Should Respond: [yes/no]
Should Unmatch: [yes/no]

Guidelines:
- "Reaction": IMPORTANT - Reactions should be RARE (only 1 in 5 messages or less). Only react to messages that are genuinely funny, sweet, exciting, or emotionally significant. Most messages should get "none". Don't react to every message!
- If you do react, choose ONE emoji that represents a strong emotional reaction (❤️, 😂, 🔥, 😍, 😭, etc.)
- "Should Respond": Always "yes" for now (we will expand this later)
- "Should Unmatch": EXTREMELY RARE - Only "yes" if the user is being:
  * Extremely annoying
  * Persistently ignoring boundaries after warnings
  * Not fulfilling character's needs in any way
  This should almost NEVER be "yes" - reserve it for serious violations only. Normal awkwardness, bad jokes, or being boring should NOT trigger unmatch.

Output ONLY the three lines in the exact format shown above, nothing else.`;

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
      try {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const decision = {
          reaction: null,
          shouldRespond: true,
          shouldUnmatch: false
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
          }
        }

        return decision;
      } catch (parseError) {
        console.error('Failed to parse decision response:', parseError, 'Content:', content);
        // Fallback: no reaction, but respond, don't unmatch
        return {
          reaction: null,
          shouldRespond: true,
          shouldUnmatch: false
        };
      }
    } catch (error) {
      console.error('❌ Decision Engine error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // On error, fail gracefully: no reaction, but respond, don't unmatch
      return {
        reaction: null,
        shouldRespond: true,
        shouldUnmatch: false
      };
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
      const decisionSettings = this.getDecisionLLMSettings(userId);

      // Build context
      const lastMessages = messages.slice(-5);
      const conversationEnded = lastMessages.length > 0 ?
        (lastMessages[lastMessages.length - 1].content.length < 20 ||
         lastMessages[lastMessages.length - 1].content.match(/ok|yeah|lol|haha|😂|👍/i)) : false;

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
    } catch (error) {
      console.error('❌ Proactive Decision Engine error:', error.message);
      // On error, don't send
      return {
        shouldSend: false,
        messageType: 'fresh'
      };
    }
  }

  /**
   * Stream chat completion (for future implementation)
   */
  async createChatCompletionStream({ messages, characterData, model = null, currentStatus = null, userBio = null, schedule = null }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(characterData, currentStatus, userBio, schedule);

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: model || this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 800,
        stream: true,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://localhost:3000',
          'X-Title': 'AI-Dater',
        },
        responseType: 'stream',
      }
    );

    return response.data;
  }

  /**
   * Generate Big Five personality traits for a character
   * Returns: { openness: 0-100, conscientiousness: 0-100, extraversion: 0-100, agreeableness: 0-100, neuroticism: 0-100 }
   */
  async generatePersonality(characterData) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const prompt = `Analyze this character using the Big Five (OCEAN) personality model. Rate each trait on a 0-100 scale.

Character: ${characterData.name}
Description: ${characterData.description || 'N/A'}
Personality: ${characterData.personality || 'N/A'}

Rate these Big Five traits (0-100):
- Openness: Curiosity, creativity, open to new experiences (0 = conventional/cautious, 100 = inventive/curious)
- Conscientiousness: Organization, dependability, discipline (0 = spontaneous/careless, 100 = efficient/organized)
- Extraversion: Sociability, assertiveness, energy around others (0 = reserved/introverted, 100 = outgoing/energetic)
- Agreeableness: Compassion, cooperation, trust in others (0 = competitive/detached, 100 = friendly/compassionate)
- Neuroticism: Emotional stability vs. tendency toward anxiety (0 = calm/stable, 100 = anxious/sensitive)

Output ONLY in this exact format:
Openness: [0-100]
Conscientiousness: [0-100]
Extraversion: [0-100]
Agreeableness: [0-100]
Neuroticism: [0-100]`;

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'deepseek/deepseek-chat-v3', // Use small model for this
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 200,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'AI-Dater Personality Generator',
          }
        }
      );

      const content = response.data.choices[0].message.content.trim();

      // Parse response
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const personality = {
        openness: 50,
        conscientiousness: 50,
        extraversion: 50,
        agreeableness: 50,
        neuroticism: 50
      };

      for (const line of lines) {
        if (line.startsWith('Openness:')) {
          const value = parseInt(line.substring('Openness:'.length).trim());
          if (!isNaN(value) && value >= 0 && value <= 100) {
            personality.openness = value;
          }
        } else if (line.startsWith('Conscientiousness:')) {
          const value = parseInt(line.substring('Conscientiousness:'.length).trim());
          if (!isNaN(value) && value >= 0 && value <= 100) {
            personality.conscientiousness = value;
          }
        } else if (line.startsWith('Extraversion:')) {
          const value = parseInt(line.substring('Extraversion:'.length).trim());
          if (!isNaN(value) && value >= 0 && value <= 100) {
            personality.extraversion = value;
          }
        } else if (line.startsWith('Agreeableness:')) {
          const value = parseInt(line.substring('Agreeableness:'.length).trim());
          if (!isNaN(value) && value >= 0 && value <= 100) {
            personality.agreeableness = value;
          }
        } else if (line.startsWith('Neuroticism:')) {
          const value = parseInt(line.substring('Neuroticism:'.length).trim());
          if (!isNaN(value) && value >= 0 && value <= 100) {
            personality.neuroticism = value;
          }
        }
      }

      console.log('✅ Big Five personality generated:', personality);
      return personality;
    } catch (error) {
      console.error('❌ Personality generation error:', error.message);
      // Return defaults on error
      return {
        openness: 50,
        conscientiousness: 50,
        extraversion: 50,
        agreeableness: 50,
        neuroticism: 50
      };
    }
  }
}

export default new AIService();
