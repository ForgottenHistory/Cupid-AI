import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import userSettingsService from '../../services/userSettingsService.js';

const router = express.Router();

/**
 * Create GET and PUT handlers for an LLM type
 */
function createLLMSettingsRoutes(llmType, routePath) {
  // GET handler
  router.get(routePath, authenticateToken, (req, res) => {
    try {
      const settings = userSettingsService.getLLMSettings(req.user.id, llmType);

      if (!settings) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(settings);
    } catch (error) {
      console.error(`Get ${llmType} LLM settings error:`, error);
      res.status(500).json({ error: `Failed to get ${llmType} LLM settings` });
    }
  });

  // PUT handler
  router.put(routePath, authenticateToken, (req, res) => {
    try {
      const settings = req.body;
      const userId = req.user.id;

      // Validate
      const validation = userSettingsService.validateLLMSettings(settings, llmType);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Update
      const updated = userSettingsService.updateLLMSettings(userId, settings, llmType);

      if (!updated) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      res.json(updated);
    } catch (error) {
      console.error(`Update ${llmType} LLM settings error:`, error);
      res.status(500).json({ error: `Failed to update ${llmType} LLM settings` });
    }
  });
}

// Register all LLM settings routes
createLLMSettingsRoutes('content', '/llm-settings');
createLLMSettingsRoutes('decision', '/decision-llm-settings');
createLLMSettingsRoutes('imagetag', '/imagetag-llm-settings');
createLLMSettingsRoutes('metadata', '/metadata-llm-settings');

/**
 * GET /api/users/model-parameters/:modelId
 * Get supported parameters for an OpenRouter model
 */
router.get('/model-parameters/:modelId(*)', authenticateToken, async (req, res) => {
  try {
    const modelId = req.params.modelId;

    if (!modelId) {
      return res.status(400).json({ error: 'Model ID is required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    const response = await fetch(`https://openrouter.ai/api/v1/parameters/${modelId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.json({ supported_parameters: [] });
      }
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const data = await response.json();

    res.json({
      model: modelId,
      supported_parameters: data.data?.supported_parameters || []
    });
  } catch (error) {
    console.error('Get model parameters error:', error);
    res.status(500).json({ error: 'Failed to get model parameters' });
  }
});

export default router;
