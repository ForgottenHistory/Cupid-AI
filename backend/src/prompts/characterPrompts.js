/**
 * AI prompt templates for character generation
 * Uses configurable prompts from prompts.json
 */

import { loadPrompts } from '../routes/prompts.js';

/**
 * Build prompt for cleaning up character descriptions
 */
export function buildCleanupDescriptionPrompt(description, userId = null) {
  const prompts = loadPrompts(userId);
  return `${prompts.cleanupDescriptionPrompt}\n\n${description}`;
}

/**
 * Build prompt for generating dating profile
 */
export function buildDatingProfilePrompt(description, name, userId = null) {
  const prompts = loadPrompts(userId);
  const characterName = name || 'the character';

  return prompts.datingProfilePrompt
    .replace(/{characterName}/g, characterName)
    .replace(/{description}/g, description);
}

/**
 * Format attributes object into readable text for prompts
 * Only includes attributes that have non-empty values
 */
function formatAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object') {
    return '';
  }

  const lines = [];
  for (const [key, value] of Object.entries(attributes)) {
    // Skip null, undefined, empty strings, and empty arrays
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;

    // Format the key as a readable label (camelCase to Title Case)
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    // Format the value
    const formattedValue = Array.isArray(value) ? value.join(', ') : value;
    lines.push(`${label}: ${formattedValue}`);
  }

  if (lines.length === 0) {
    return '';
  }

  return '\nCharacter Attributes:\n' + lines.join('\n') + '\n';
}

/**
 * Build prompt for generating weekly schedule
 * @param {string} description - Character description
 * @param {string} name - Character name
 * @param {string} day - Optional specific day (MONDAY, TUESDAY, etc). If not provided, generates all 7 days.
 * @param {string} extraInstructions - Optional extra user instructions for customization
 * @param {number} userId - User ID for loading user-specific prompts
 * @param {object} attributes - Optional character attributes object
 */
export function buildSchedulePrompt(description, name, day = null, extraInstructions = null, userId = null, attributes = null) {
  const prompts = loadPrompts(userId);
  const characterName = name || 'this character';
  const attributesSection = formatAttributes(attributes);

  // Add extra instructions if provided
  const extraSection = extraInstructions && extraInstructions.trim()
    ? `\n\nEXTRA INSTRUCTIONS FROM USER:\n${extraInstructions.trim()}\n\nMake sure to follow these extra instructions while still adhering to all the formatting and content rules above.`
    : '';

  if (day) {
    // Generate single day
    return prompts.scheduleDayPrompt
      .replace(/{characterName}/g, characterName)
      .replace(/{description}/g, description)
      .replace(/{attributes}/g, attributesSection)
      .replace(/{day}/g, day) + extraSection;
  } else {
    // Generate all 7 days
    return prompts.schedulePrompt
      .replace(/{characterName}/g, characterName)
      .replace(/{description}/g, description)
      .replace(/{attributes}/g, attributesSection) + extraSection;
  }
}
