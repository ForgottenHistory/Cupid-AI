/**
 * AI prompt templates for character generation
 * Uses configurable prompts from prompts.json
 */

import { loadPrompts } from '../routes/prompts.js';

/**
 * Build prompt for cleaning up character descriptions
 */
export function buildCleanupDescriptionPrompt(description) {
  const prompts = loadPrompts();
  return `${prompts.cleanupDescriptionPrompt}\n\n${description}`;
}

/**
 * Build prompt for generating dating profile
 */
export function buildDatingProfilePrompt(description, name) {
  const prompts = loadPrompts();
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
 */
export function buildSchedulePrompt(description, name, day = null) {
  const prompts = loadPrompts();
  const characterName = name || 'this character';

  if (day) {
    // Generate single day
    return prompts.scheduleDayPrompt
      .replace(/{characterName}/g, characterName)
      .replace(/{description}/g, description)
      .replace(/{day}/g, day);
  } else {
    // Generate all 7 days
    return prompts.schedulePrompt
      .replace(/{characterName}/g, characterName)
      .replace(/{description}/g, description);
  }
}
