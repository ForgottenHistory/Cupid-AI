import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for logging prompts and responses for debugging
 */
class PromptLogService {
  constructor() {
    this.promptsDir = path.join(__dirname, '../../logs/prompts');
    this.responsesDir = path.join(__dirname, '../../logs/responses');
  }

  /**
   * Ensure log directory exists
   */
  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Save prompt to log file for debugging (keep last 5)
   * Logs the ACTUAL messages array being sent to the API
   * Returns the log ID (timestamp) for matching response logs
   */
  savePromptLog(finalMessages, messageType, characterName, userName) {
    try {
      this.ensureDir(this.promptsDir);

      // Generate filename with timestamp
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `${messageType}-${timestamp}.txt`;
      const filepath = path.join(this.promptsDir, filename);

      // Build log content from finalMessages array
      const parts = [
        `PROMPT LOG`,
        `Type: ${messageType}`,
        `Timestamp: ${now.toISOString()}`,
        ''
      ];

      // Process each message in order
      finalMessages.forEach((msg, index) => {
        if (msg.role === 'system') {
          parts.push(`[SYSTEM MESSAGE ${index > 0 ? index : ''}]:`);
          parts.push(msg.content);
        } else if (msg.prefix) {
          // Log the actual priming content (e.g., "Nicole: ")
          parts.push('');
          parts.push(msg.content);
        } else {
          const name = msg.role === 'user' ? userName : characterName;
          parts.push(`${name}: ${msg.content}`);
        }
      });

      let logContent = parts.join('\n');

      // Clean up special markers - remove the [SYSTEM MESSAGE N]: label so they appear inline
      logContent = logContent.replace(/\[SYSTEM MESSAGE \d*\]:\n(\[TIME GAP:)/g, '\n$1');
      logContent = logContent.replace(/\[SYSTEM MESSAGE \d*\]:\n(\[.+ switched background to)/g, '\n$1');

      // Write to file
      fs.writeFileSync(filepath, logContent, 'utf8');

      // Keep only last 5 files per type
      this.cleanupOldLogs(this.promptsDir, messageType);

      console.log(`📝 Saved prompt log: ${filename}`);
      return timestamp; // Return timestamp for matching response log
    } catch (error) {
      console.error('Failed to save prompt log:', error.message);
      return null;
    }
  }

  /**
   * Save response to log file for debugging (keep last 5)
   * Uses matching timestamp from prompt log for easy correlation
   */
  saveResponseLog(processedContent, rawContent, messageType, logId, responseData) {
    try {
      if (!logId) {
        console.warn('⚠️  No log ID provided for response log, skipping');
        return;
      }

      this.ensureDir(this.responsesDir);

      // Use same timestamp as prompt for matching filenames
      const filename = `${messageType}-${logId}.txt`;
      const filepath = path.join(this.responsesDir, filename);

      // Build log content
      const parts = [
        `RESPONSE LOG`,
        `Type: ${messageType}`,
        `Timestamp: ${new Date().toISOString()}`,
        `Model: ${responseData.model}`,
        ``,
        `--- RAW CONTENT (from API) ---`,
        rawContent || '(empty)',
        ``,
        `--- PROCESSED CONTENT (after stripping) ---`,
        processedContent || '(empty)',
        ``,
        `--- USAGE ---`,
        JSON.stringify(responseData.usage, null, 2)
      ];

      const logContent = parts.join('\n');

      // Write to file
      fs.writeFileSync(filepath, logContent, 'utf8');

      // Keep only last 5 files per type
      this.cleanupOldLogs(this.responsesDir, messageType);

      console.log(`📝 Saved response log: ${filename}`);
    } catch (error) {
      console.error('Failed to save response log:', error.message);
    }
  }

  /**
   * Clean up old log files, keeping only the 5 newest per type
   */
  cleanupOldLogs(dir, messageType) {
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith(messageType.split('-')[0])) // Match by prefix
        .map(f => ({
          name: f,
          path: path.join(dir, f),
          mtime: fs.statSync(path.join(dir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Delete old files (keep only 5 newest per type)
      if (files.length > 5) {
        files.slice(5).forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`🗑️  Deleted old log: ${file.name}`);
        });
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error.message);
    }
  }
}

export default new PromptLogService();
