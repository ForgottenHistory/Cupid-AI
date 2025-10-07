import api from './api';

class AuthService {
  /**
   * Register a new user
   */
  async register({ username, email, password, displayName }) {
    const response = await api.post('/auth/register', {
      username,
      email,
      password,
      displayName,
    });

    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response.data;
  }

  /**
   * Login user
   */
  async login({ username, password }) {
    const response = await api.post('/auth/login', {
      username,
      password,
    });

    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response.data;
  }

  /**
   * Logout user
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Get current token
   */
  getToken() {
    return localStorage.getItem('token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Verify token with backend
   */
  async verifyToken() {
    try {
      const response = await api.post('/auth/verify');
      return response.data;
    } catch (error) {
      this.logout();
      return null;
    }
  }

  /**
   * Get user profile
   */
  async getProfile() {
    const response = await api.get('/users/profile');
    return response.data.user;
  }

  /**
   * Update user profile
   */
  async updateProfile({ displayName, bio }) {
    const response = await api.put('/users/profile', {
      displayName,
      bio,
    });

    // Update localStorage
    localStorage.setItem('user', JSON.stringify(response.data.user));

    return response.data.user;
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await api.post('/users/profile/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  /**
   * Remove profile image
   */
  async removeProfileImage() {
    const response = await api.delete('/users/profile/image');
    return response.data;
  }
}

export default new AuthService();
