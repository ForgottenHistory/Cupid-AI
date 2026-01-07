/**
 * Prompt field definitions for the Prompts page
 */

export const conversationPromptFields = [
  {
    key: 'systemPrompt',
    label: 'System Prompt',
    description: 'Main instructions for character behavior and messaging style',
    rows: 20
  },
  {
    key: 'contextPrompt',
    label: 'Context Prompt',
    description: 'Background context about the dating app',
    rows: 3
  },
  {
    key: 'closingPrompt',
    label: 'Closing Prompt',
    description: 'Final instructions at the end of the system prompt',
    rows: 2
  },
  {
    key: 'departingPrompt',
    label: 'Departing Prompt',
    description: 'Instructions when character needs to wrap up conversation',
    rows: 4
  },
  {
    key: 'voiceMessagePrompt',
    label: 'Voice Message Prompt',
    description: 'Instructions when sending a voice message',
    rows: 2
  },
  {
    key: 'proactiveFirstMessagePrompt',
    label: 'Proactive First Message (Icebreaker)',
    description: 'Instructions for first message after matching',
    rows: 5
  },
  {
    key: 'proactiveResumePrompt',
    label: 'Proactive Resume (unused)',
    description: 'Instructions to continue a previous conversation (currently unused)',
    rows: 2
  },
  {
    key: 'proactiveFreshPrompt',
    label: 'Proactive Fresh Start',
    description: 'Instructions to start a completely new conversation. Use {openerVariety} placeholder for random opener styles.',
    rows: 4
  },
  {
    key: 'proactiveCallbackPrompt',
    label: 'Proactive Callback (unused)',
    description: 'Instructions to reference an earlier topic (currently unused)',
    rows: 2
  },
  {
    key: 'proactiveClosingPrompt',
    label: 'Proactive Closing',
    description: 'Final instructions for proactive messages',
    rows: 2
  }
];

export const decisionEnginePromptFields = [
  {
    key: 'decisionPrompt',
    label: 'Main Decision Engine',
    description: 'AI prompt for analyzing conversations and deciding on reactions, unmatch, voice/image messages, moods, and thoughts. This is the core decision-making prompt.',
    rows: 40
  },
  {
    key: 'proactiveDecisionPrompt',
    label: 'Proactive Message Decision',
    description: 'AI prompt for deciding if character should send a proactive message after time gaps. Determines when characters reach out first.',
    rows: 20
  }
];

export const characterGenerationPromptFields = [
  {
    key: 'cleanupDescriptionPrompt',
    label: 'Cleanup Description',
    description: 'AI prompt for cleaning up imported character descriptions (remove formatting, placeholders, etc.)',
    rows: 8
  },
  {
    key: 'datingProfilePrompt',
    label: 'Dating Profile Generation',
    description: 'AI prompt for generating dating profiles from character descriptions. Use {characterName} and {description} as placeholders.',
    rows: 12
  },
  {
    key: 'schedulePrompt',
    label: 'Schedule Generation (Full Week)',
    description: 'AI prompt for generating weekly schedules. Use {characterName} and {description} as placeholders.',
    rows: 10
  },
  {
    key: 'scheduleDayPrompt',
    label: 'Schedule Generation (Single Day)',
    description: 'AI prompt for generating a single day schedule. Use {characterName}, {description}, and {day} as placeholders.',
    rows: 10
  },
  {
    key: 'personalityPrompt',
    label: 'Big Five Personality Generation',
    description: 'AI prompt for generating OCEAN personality traits. Use {characterName}, {description}, and {personality} as placeholders.',
    rows: 10
  },
  {
    key: 'memoryExtractionPrompt',
    label: 'Memory Extraction',
    description: 'AI prompt for extracting long-term memories from conversations. Use {characterName}, {conversationHistory}, {existingCount}, and {existingMemories} as placeholders.',
    rows: 30
  },
  {
    key: 'compactionPrompt',
    label: 'Conversation Compaction',
    description: 'AI prompt for summarizing old conversation blocks to save context window space. Use {characterName}, {userName}, and {conversationText} as placeholders.',
    rows: 12
  }
];

export const wizardPromptFields = [
  {
    key: 'wizardDescriptionPrompt',
    label: 'Character Description',
    description: 'AI prompt for generating character name and description. Use {age}, {archetype}, and {personalityTags} as placeholders.',
    rows: 12
  },
  {
    key: 'wizardAppearancePrompt',
    label: 'Character Appearance',
    description: 'AI prompt for generating character appearance suggestions. Use {age}, {archetype}, and {personalityTags} as placeholders.',
    rows: 10
  },
  {
    key: 'wizardImageTagsPrompt',
    label: 'Image Tags',
    description: 'AI prompt for generating Danbooru image tags for profile pictures. Use {baseAppearanceTags}, {age}, {archetype}, and {personalityTags} as placeholders.',
    rows: 12
  }
];

export const defaultPromptState = {
  systemPrompt: '',
  contextPrompt: '',
  closingPrompt: '',
  departingPrompt: '',
  voiceMessagePrompt: '',
  proactiveFirstMessagePrompt: '',
  proactiveResumePrompt: '',
  proactiveFreshPrompt: '',
  proactiveCallbackPrompt: '',
  proactiveClosingPrompt: '',
  cleanupDescriptionPrompt: '',
  datingProfilePrompt: '',
  schedulePrompt: '',
  scheduleDayPrompt: '',
  personalityPrompt: '',
  memoryExtractionPrompt: '',
  compactionPrompt: '',
  wizardDescriptionPrompt: '',
  wizardAppearancePrompt: '',
  wizardImageTagsPrompt: '',
  decisionPrompt: '',
  proactiveDecisionPrompt: ''
};

/**
 * Calculate approximate token count (1 token ≈ 4 characters)
 */
export const calculateTokens = (text) => {
  return Math.ceil((text?.length || 0) / 4);
};

/**
 * Calculate total tokens for a set of prompt fields
 */
export const calculateTotalTokens = (prompts, fields) => {
  const keys = fields.map(f => f.key);
  const totalChars = keys.reduce((sum, key) => sum + (prompts[key]?.length || 0), 0);
  return Math.ceil(totalChars / 4);
};
