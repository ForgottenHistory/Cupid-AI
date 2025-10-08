// Import logger FIRST to override console methods
import './utils/logger.js';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import chatRoutes from './routes/chat.js';
import charactersRoutes from './routes/characters.js';
import ttsRoutes from './routes/tts.js';
import debugRoutes from './routes/debug.js';
import wizardRoutes from './routes/wizard.js';

// Import services
import proactiveMessageService from './services/proactiveMessageService.js';

// Import database to initialize it
import './db/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Make io available to routes
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join room for user-specific events
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`👤 User ${userId} joined socket room`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/characters', charactersRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/wizard', wizardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║                                        ║
║   🚀 AI-Dater Backend Server          ║
║   🔌 WebSocket Support Enabled        ║
║                                        ║
║   📡 Server: http://localhost:${PORT}    ║
║   🏥 Health: http://localhost:${PORT}/api/health
║                                        ║
╚════════════════════════════════════════╝
  `);

  // Start proactive message checker (runs every 5 minutes)
  console.log('📬 Proactive message service started (checks every 5 minutes)');
  setInterval(() => {
    proactiveMessageService.checkAndSend(io).catch(error => {
      console.error('Proactive message service error:', error);
    });
  }, 5 * 60 * 1000); // 5 minutes
});

export default app;
export { io };
 
