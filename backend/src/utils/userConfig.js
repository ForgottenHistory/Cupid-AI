import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base paths
const CONFIG_DIR = path.join(__dirname, '../../config');
const USER_CONFIG_DIR = path.join(__dirname, '../../config/users');

// Default config file paths
const DEFAULT_CONFIGS = {
  prompts: path.join(CONFIG_DIR, 'prompts.json'),
  imageTagPrompts: path.join(CONFIG_DIR, 'imageTagPrompts.json'),
  tagLibrary: path.join(CONFIG_DIR, 'danbooru_tags.txt')
};

/**
 * Ensure the user config directory exists
 */
const ensureUserConfigDir = (userId) => {
  const userDir = path.join(USER_CONFIG_DIR, String(userId));
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
};

/**
 * Get the path to a user's config file
 * If user file doesn't exist, copy from default
 */
const getUserConfigPath = (userId, configType) => {
  const userDir = ensureUserConfigDir(userId);

  const filenames = {
    prompts: 'prompts.json',
    imageTagPrompts: 'imageTagPrompts.json',
    tagLibrary: 'danbooru_tags.txt'
  };

  const filename = filenames[configType];
  if (!filename) {
    throw new Error(`Unknown config type: ${configType}`);
  }

  const userConfigPath = path.join(userDir, filename);

  // If user config doesn't exist, copy from default
  if (!fs.existsSync(userConfigPath)) {
    const defaultPath = DEFAULT_CONFIGS[configType];
    if (fs.existsSync(defaultPath)) {
      fs.copyFileSync(defaultPath, userConfigPath);
      console.log(`📋 Copied default ${configType} config for user ${userId}`);
    }
  }

  return userConfigPath;
};

/**
 * Check if a user has custom config (vs using defaults)
 */
const hasUserConfig = (userId, configType) => {
  const userDir = path.join(USER_CONFIG_DIR, String(userId));
  const filenames = {
    prompts: 'prompts.json',
    imageTagPrompts: 'imageTagPrompts.json',
    tagLibrary: 'danbooru_tags.txt'
  };

  const userConfigPath = path.join(userDir, filenames[configType]);
  return fs.existsSync(userConfigPath);
};

export {
  getUserConfigPath,
  hasUserConfig,
  ensureUserConfigDir,
  DEFAULT_CONFIGS,
  CONFIG_DIR,
  USER_CONFIG_DIR
};
