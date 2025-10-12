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
 */
export function buildSchedulePrompt(description, name) {
  const prompts = loadPrompts();
  const characterName = name || 'this character';

  return prompts.schedulePrompt
    .replace(/{characterName}/g, characterName)
    .replace(/{description}/g, description);
}
