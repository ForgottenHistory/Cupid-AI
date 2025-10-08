import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import characterWizardService from '../services/characterWizardService.js';

const router = express.Router();

/**
 * POST /api/wizard/generate-description
 * Generate character name and description using LLM
 */
router.post('/generate-description', authenticateToken, async (req, res) => {
  try {
    const { age, archetype, personalityTags } = req.body;
    const userId = req.user.id;

    // Validation
    if (!age || !archetype || !personalityTags || !Array.isArray(personalityTags)) {
      return res.status(400).json({
        error: 'Missing required fields: age, archetype, personalityTags (array)'
      });
    }

    if (personalityTags.length < 3) {
      return res.status(400).json({
        error: 'At least 3 personality traits are required'
      });
    }

    const result = await characterWizardService.generateDescription({
      age,
      archetype,
      personalityTags,
      userId
    });

    res.json(result); // Returns { name, description }
  } catch (error) {
    console.error('Error generating character:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate character'
    });
  }
});

/**
 * POST /api/wizard/generate-appearance
 * Generate appearance suggestions using LLM
 */
router.post('/generate-appearance', authenticateToken, async (req, res) => {
  try {
    const { age, archetype, personalityTags } = req.body;
    const userId = req.user.id;

    // Validation
    if (!age || !archetype || !personalityTags || !Array.isArray(personalityTags)) {
      return res.status(400).json({
        error: 'Missing required fields: age, archetype, personalityTags (array)'
      });
    }

    const appearance = await characterWizardService.generateAppearance({
      age,
      archetype,
      personalityTags,
      userId
    });

    res.json({ appearance });
  } catch (error) {
    console.error('Error generating appearance:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate appearance'
    });
  }
});

/**
 * POST /api/wizard/generate-image
 * Generate character image using Stable Diffusion with LLM-enhanced tags
 */
router.post('/generate-image', authenticateToken, async (req, res) => {
  try {
    const { appearance, age, archetype, personalityTags } = req.body;
    const userId = req.user.id;

    // Validation
    if (!appearance || typeof appearance !== 'object') {
      return res.status(400).json({
        error: 'Missing required field: appearance (object)'
      });
    }

    if (!age || !archetype || !personalityTags || !Array.isArray(personalityTags)) {
      return res.status(400).json({
        error: 'Missing required fields: age, archetype, personalityTags (array)'
      });
    }

    const result = await characterWizardService.generateImage({
      appearance,
      age,
      archetype,
      personalityTags,
      userId
    });

    // Convert image buffer to base64 for JSON response
    const imageBase64 = result.imageBuffer.toString('base64');

    res.json({
      imageBase64,
      imageTags: result.imageTags
    });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate character image'
    });
  }
});

export default router;
