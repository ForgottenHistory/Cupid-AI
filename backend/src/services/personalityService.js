import { loadPrompts } from '../routes/prompts.js';

class PersonalityService {
  constructor() {
    // aiService will be lazy-loaded to avoid circular dependency
    this.aiService = null;
  }

  /**
   * Lazy-load aiService to avoid circular dependency
   */
  async getAIService() {
    if (!this.aiService) {
      const module = await import('./aiService.js');
      this.aiService = module.default;
    }
    return this.aiService;
  }

  /**
   * Generate Big Five personality traits for a character
   * Returns: { openness: 0-100, conscientiousness: 0-100, extraversion: 0-100, agreeableness: 0-100, neuroticism: 0-100 }
   */
  async generatePersonality(characterData) {
    try {
      const aiService = await this.getAIService();
      const prompts = loadPrompts();
      const characterName = characterData.name || 'Character';
      const description = characterData.description || 'N/A';
      const personalityText = characterData.personality || 'N/A';

      const prompt = prompts.personalityPrompt
        .replace(/{characterName}/g, characterName)
        .replace(/{description}/g, description)
        .replace(/{personality}/g, personalityText);

      const response = await aiService.createBasicCompletion(prompt, {
        model: 'deepseek/deepseek-chat-v3', // Use small model for this
        temperature: 0.7,
        max_tokens: 200,
        messageType: 'personality',
        characterName: characterName
      });

      const content = response.content.trim();

      // Parse response
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const personality = this.getDefaultPersonality();

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
      return this.getDefaultPersonality();
    }
  }

  /**
   * Get default personality values
   */
  getDefaultPersonality() {
    return {
      openness: 50,
      conscientiousness: 50,
      extraversion: 50,
      agreeableness: 50,
      neuroticism: 50
    };
  }
}

export default new PersonalityService();
