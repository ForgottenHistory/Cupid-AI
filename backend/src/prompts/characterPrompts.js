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
 * Build prompt for generating weekly schedule
 * @param {string} description - Character description
 * @param {string} name - Character name
 * @param {string} day - Optional specific day (MONDAY, TUESDAY, etc). If not provided, generates all 7 days.
 * @param {string} extraInstructions - Optional extra user instructions for customization
 * @param {number} userId - User ID for loading user-specific prompts
 */
export function buildSchedulePrompt(description, name, day = null, extraInstructions = null, userId = null) {
  const prompts = loadPrompts(userId);
  const characterName = name || 'this character';

  // Add extra instructions if provided
  const extraSection = extraInstructions && extraInstructions.trim()
    ? `\n\nEXTRA INSTRUCTIONS FROM USER:\n${extraInstructions.trim()}\n\nMake sure to follow these extra instructions while still adhering to all the formatting and content rules above.`
    : '';

  if (day) {
    // Generate single day
    return prompts.scheduleDayPrompt
      .replace(/{characterName}/g, characterName)
      .replace(/{description}/g, description)
      .replace(/{day}/g, day) + extraSection;
  } else {
    // Generate all 7 days
    return prompts.schedulePrompt
      .replace(/{characterName}/g, characterName)
      .replace(/{description}/g, description) + extraSection;
  }
}
