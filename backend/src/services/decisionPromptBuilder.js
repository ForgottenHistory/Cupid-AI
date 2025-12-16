import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load character states from user config file
 * @param {number} userId - User ID
 * @returns {Array} Array of { id, name, description }
 */
export function loadCharacterStates(userId) {
  try {
    // Try user-specific config first
    let statesPath = path.join(__dirname, '../../config/users', String(userId), 'characterStates.txt');
    if (!fs.existsSync(statesPath)) {
      // Fall back to default config
      statesPath = path.join(__dirname, '../../config/characterStates.txt');
    }

    if (!fs.existsSync(statesPath)) {
      return [];
    }

    const content = fs.readFileSync(statesPath, 'utf-8');
    const states = [];

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split('|').map(p => p.trim());
      if (parts.length >= 3) {
        states.push({
          id: parts[0],
          name: parts[1],
          description: parts[2]
        });
      }
    }

    return states;
  } catch (error) {
    console.error('Error loading character states:', error);
    return [];
  }
}

/**
 * Build the decision prompt template with all conditional replacements
 */
export function buildDecisionPromptTemplate(prompts, options) {
  const {
    hasVoice,
    hasImage,
    shouldGenerateThought,
    shouldGenerateCharacterMood,
    shouldGenerateCharacterState,
    canChangeMood,
    userId
  } = options;

  let template = prompts.decisionPrompt;

  // Replace conditional sections with markers for removal
  template = template.replace('{hasVoice}', hasVoice ? '' : '##REMOVE_VOICE##');
  template = template.replace('{hasImage}', hasImage ? '' : '##REMOVE_IMAGE##');
  template = template.replace('{shouldGenerateThought}', shouldGenerateThought ? '' : '##REMOVE_THOUGHT##');
  template = template.replace('{shouldGenerateCharacterMood}', shouldGenerateCharacterMood ? '' : '##REMOVE_CHARACTER_MOOD##');
  template = template.replace('{shouldGenerateCharacterState}', shouldGenerateCharacterState ? '' : '##REMOVE_CHARACTER_STATE##');

  // Handle guideline sections
  template = replaceGuidelineSection(template, 'voiceGuidelines', hasVoice);
  template = replaceGuidelineSection(template, 'imageGuidelines', hasImage);
  template = replaceGuidelineSection(template, 'thoughtGuidelines', shouldGenerateThought);
  template = replaceGuidelineSection(template, 'characterMoodGuidelines', shouldGenerateCharacterMood);
  template = replaceGuidelineSection(template, 'characterStateGuidelines', shouldGenerateCharacterState);

  // Mood cooldown message
  const moodCooldownMsg = canChangeMood
    ? ''
    : 'MOOD COOLDOWN ACTIVE - You MUST set this to "none". The mood was recently changed and cannot be changed again yet. ';
  template = template.replace('{moodCooldownMessage}', moodCooldownMsg);

  if (!canChangeMood) {
    template = replaceGuidelineSection(template, 'moodGuidelines', false);
  } else {
    template = template.replace('{moodGuidelines}', '\n');
  }

  // Handle available states
  if (shouldGenerateCharacterState) {
    const characterStates = loadCharacterStates(userId);
    const statesFormatted = characterStates.map(s => `    - "${s.id}" = ${s.name}: ${s.description}`).join('\n');
    template = template.replace('{availableStates}', statesFormatted || '    (no states configured)');
  } else {
    template = template.replace('{availableStates}', '');
  }

  // Remove all marker lines
  template = template.replace(/##REMOVE_VOICE##[^\n]*\n?/g, '');
  template = template.replace(/##REMOVE_IMAGE##[^\n]*\n?/g, '');
  template = template.replace(/##REMOVE_THOUGHT##[^\n]*\n?/g, '');
  template = template.replace(/##REMOVE_CHARACTER_MOOD##[^\n]*\n?/g, '');
  template = template.replace(/##REMOVE_CHARACTER_STATE##[^\n]*\n?/g, '');

  return template;
}

/**
 * Helper to replace or remove guideline sections
 */
function replaceGuidelineSection(template, placeholder, shouldInclude) {
  const regex = new RegExp(`\\{${placeholder}\\}[^\\{]*`, 'g');
  if (!shouldInclude) {
    return template.replace(regex, '');
  }
  return template.replace(`{${placeholder}}`, '\n');
}

/**
 * Build character context string
 */
export function buildCharacterContext(characterData) {
  const characterName = characterData.data?.name || characterData.name || 'Character';
  const characterDescription = characterData.data?.description || characterData.description || '';

  return {
    characterName,
    characterContext: `You are analyzing a conversation as ${characterName}.
Character: ${characterName}
${characterDescription ? `Description: ${characterDescription}` : ''}`
  };
}

/**
 * Build personality context string
 */
export function buildPersonalityContext(characterData) {
  if (!characterData.personality_data) {
    return '';
  }

  try {
    const personality = JSON.parse(characterData.personality_data);
    return `\nPersonality Traits:
- Extraversion: ${personality.extraversion}/100 (${personality.extraversion > 60 ? 'outgoing, expressive' : 'reserved, thoughtful'})
- Openness: ${personality.openness}/100 (${personality.openness > 60 ? 'experimental, creative' : 'traditional, practical'})`;
  } catch (e) {
    return '';
  }
}

/**
 * Build status context string (placed at bottom for recency bias)
 */
export function buildStatusContext(currentStatus, characterName, currentCharacterState = null, currentCharacterMood = null) {
  const parts = [];

  if (currentStatus) {
    parts.push(`⚠️ CURRENT STATUS: ${currentStatus.status.toUpperCase()}${currentStatus.activity ? ` - "${currentStatus.activity}"` : ''}`);
    parts.push(`This is what ${characterName} is doing RIGHT NOW.`);
  }

  if (currentCharacterState) {
    parts.push(`⚠️ CURRENT CHARACTER STATE: "${currentCharacterState}" - Only change if the situation has CHANGED. Keep the same state if still applicable.`);
  }

  if (currentCharacterMood) {
    parts.push(`⚠️ CURRENT CHARACTER MOOD: "${currentCharacterMood}" - Only change if the emotional tone has significantly shifted.`);
  }

  if (parts.length === 0) {
    return '';
  }

  return '\n' + parts.join('\n');
}

/**
 * Format conversation history for decision prompt
 */
export function formatConversationHistory(messages, characterName) {
  return messages.map(m => {
    if (m.role === 'system') {
      return m.content; // TIME GAP markers, summaries, etc.
    }
    return `${m.role === 'user' ? 'User' : characterName}: ${m.content}`;
  }).join('\n');
}

/**
 * Assemble the full decision prompt
 */
export function assembleDecisionPrompt(options) {
  const {
    characterContext,
    personalityContext,
    isEngaged,
    hasVoice,
    hasImage,
    conversationHistory,
    userMessage,
    postInstructionsSection,
    statusContext,
    decisionPromptTemplate
  } = options;

  return `${characterContext}
${personalityContext}
${isEngaged ? '\nEngagement: Actively engaged in conversation' : '\nEngagement: Disengaged (slower responses)'}
${hasVoice ? '\nVoice: Available' : ''}
${hasImage ? '\nImage generation: Available' : ''}

Conversation history:
${conversationHistory}

User just sent: "${userMessage}"
${postInstructionsSection}
${statusContext}

${decisionPromptTemplate}`;
}
