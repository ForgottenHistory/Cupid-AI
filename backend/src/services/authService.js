import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/database.js';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d';

class AuthService {
  /**
   * Register a new user
   */
  async register({ username, email, password, displayName }) {
    try {
      // Validate input
      if (!username || !email || !password) {
        throw new Error('Username, email, and password are required');
      }

      // Check if user already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
        .get(username, email);

      if (existingUser) {
        throw new Error('Username or email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Insert user
      const result = db.prepare(`
        INSERT INTO users (username, email, password_hash, display_name)
        VALUES (?, ?, ?, ?)
      `).run(username, email, passwordHash, displayName || username);

      const userId = result.lastInsertRowid;

      // Get created user
      const user = db.prepare('SELECT id, username, email, display_name, bio, profile_image, created_at FROM users WHERE id = ?')
        .get(userId);

      // Generate JWT token
      const token = this.generateToken(user);

      return {
        user,
        token
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user
   */
  async login({ username, password }) {
    try {
      // Validate input
      if (!username || !password) {
        throw new Error('Username and password are required');
      }

      // Get user by username or email
      const user = db.prepare(`
        SELECT * FROM users WHERE username = ? OR email = ?
      `).get(username, username);

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Remove password hash from response
      const { password_hash, ...userWithoutPassword } = user;

      // Generate JWT token
      const token = this.generateToken(userWithoutPassword);

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  getUserById(userId) {
    const user = db.prepare(`
      SELECT id, username, email, display_name, bio, profile_image, created_at
      FROM users WHERE id = ?
    `).get(userId);

    return user;
  }
}

export default new AuthService();
