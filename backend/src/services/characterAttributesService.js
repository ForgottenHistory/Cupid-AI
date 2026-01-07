import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CharacterAttributesService {
  constructor() {
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
   * Load attribute schema from config file
   * Checks user-specific config first, falls back to default
   */
  loadAttributeSchema(userId = null) {
    try {
      // Try user-specific config first
      if (userId) {
        const userConfigPath = path.join(__dirname, '../../config/users', String(userId), 'characterAttributes.json');
        if (fs.existsSync(userConfigPath)) {
          const content = fs.readFileSync(userConfigPath, 'utf-8');
          return JSON.parse(content);
        }
      }

      // Fall back to default config
      const defaultConfigPath = path.join(__dirname, '../../config/characterAttributes.json');
      if (fs.existsSync(defaultConfigPath)) {
        const content = fs.readFileSync(defaultConfigPath, 'utf-8');
        return JSON.parse(content);
      }

      // Return empty schema if no config found
      return { attributes: [] };
    } catch (error) {
      console.error('Error loading attribute schema:', error);
      return { attributes: [] };
    }
  }

  /**
   * Save attribute schema for a user
   */
  saveAttributeSchema(userId, schema) {
    try {
      const userDir = path.join(__dirname, '../../config/users', String(userId));
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      const configPath = path.join(userDir, 'characterAttributes.json');
      fs.writeFileSync(configPath, JSON.stringify(schema, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving attribute schema:', error);
      return false;
    }
  }

  /**
   * Generate attributes for a character using AI
   */
  async generateAttributes(characterData, userId = null) {
    try {
      const aiService = await this.getAIService();
      const schema = this.loadAttributeSchema(userId);

      if (!schema.attributes || schema.attributes.length === 0) {
        console.log('No attributes configured');
        return {};
      }

      const characterName = characterData.name || 'Character';
      const description = characterData.description || '';
      const personality = characterData.personality || '';

      // Build the prompt with attribute list
      const attributeList = schema.attributes.map(attr => {
        if (attr.type === 'list') {
          return `${attr.label}: [comma-separated list]`;
        }
        return `${attr.label}: [value]`;
      }).join('\n');

      const prompt = `Based on this character, fill in their attributes. If something isn't mentioned, make a reasonable guess that fits the character.

Character: ${characterName}
Description: ${description}
${personality ? `Personality: ${personality}` : ''}

Fill in ONLY these attributes, one per line, in this exact format:
${attributeList}

Output ONLY the attribute lines, nothing else. For list attributes, separate items with commas.`;

      const response = await aiService.createBasicCompletion(prompt, {
        temperature: 0.7,
        max_tokens: 500,
        messageType: 'attributes',
        characterName: characterName,
        userId: userId,
        llmType: 'metadata'
      });

      const content = response.content.trim();
      return this.parseAttributeResponse(content, schema);
    } catch (error) {
      console.error('Attribute generation error:', error.message);
      return {};
    }
  }

  /**
   * Parse AI response into attribute object
   */
  parseAttributeResponse(content, schema) {
    const attributes = {};
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const attr of schema.attributes) {
      // Find line that starts with this attribute's label
      const line = lines.find(l => l.toLowerCase().startsWith(attr.label.toLowerCase() + ':'));

      if (line) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const value = line.substring(colonIndex + 1).trim();

          if (attr.type === 'list') {
            // Parse comma-separated list
            attributes[attr.id] = value
              .split(',')
              .map(item => item.trim())
              .filter(item => item.length > 0 && item.toLowerCase() !== 'none' && item.toLowerCase() !== 'n/a');
          } else {
            // Single value
            attributes[attr.id] = value || '';
          }
        }
      } else {
        // Set default empty value
        attributes[attr.id] = attr.type === 'list' ? [] : '';
      }
    }

    console.log('✅ Character attributes generated:', attributes);
    return attributes;
  }
}

export default new CharacterAttributesService();
