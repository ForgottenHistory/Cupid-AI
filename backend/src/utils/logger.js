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

export default {
  logFile
};
