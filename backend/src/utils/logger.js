import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = path.join(__dirname, '..', '..', 'logs');
const logFile = path.join(logDir, 'server.log');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Override console.log, console.error, etc. to also write to file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function formatLogMessage(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  return `[${timestamp}] [${level}] ${message}\n`;
}

function writeToFile(level, ...args) {
  const logMessage = formatLogMessage(level, ...args);
  fs.appendFileSync(logFile, logMessage, 'utf8');
}

console.log = function(...args) {
  originalConsoleLog(...args);
  writeToFile('INFO', ...args);
};

console.error = function(...args) {
  originalConsoleError(...args);
  writeToFile('ERROR', ...args);
};

console.warn = function(...args) {
  originalConsoleWarn(...args);
  writeToFile('WARN', ...args);
};

// Clear log on startup
if (fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '');
}

console.log('📝 File logging enabled:', logFile);

/**
 * Clean log entries older than 10 minutes
 */
function cleanOldLogs() {
  try {
    if (!fs.existsSync(logFile)) {
      return;
    }

    const content = fs.readFileSync(logFile, 'utf8');
    if (!content) {
      return;
    }

    const lines = content.split('\n');
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // Filter lines to keep only those from last 10 minutes
    const recentLines = lines.filter(line => {
      if (!line.trim()) {
        return false; // Remove empty lines
      }

      // Extract timestamp from format: [2025-10-12T13:46:14.630Z]
      const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
      if (!timestampMatch) {
        return false; // Skip malformed lines
      }

      const lineDate = new Date(timestampMatch[1]);
      return lineDate >= tenMinutesAgo;
    });

    // Write back only recent logs
    fs.writeFileSync(logFile, recentLines.join('\n') + (recentLines.length > 0 ? '\n' : ''), 'utf8');
  } catch (error) {
    originalConsoleError('❌ Failed to clean old logs:', error);
  }
}

// Clean old logs every minute
setInterval(cleanOldLogs, 60 * 1000);

export default {
  logFile
};
