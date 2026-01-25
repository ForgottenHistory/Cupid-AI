import api from './api';

class ChatService {
  /**
   * Get all conversations
   */
  async getConversations() {
    const response = await api.get('/chat/conversations');
    return response.data.conversations;
  }

  /**
   * Get or create conversation with character
   */
  async getConversation(characterId, limit = 200, offset = 0) {
    const response = await api.get(`/chat/conversations/${characterId}`, {
      params: { limit, offset }
    });
    return response.data;
  }

  /**
   * Get conversation by ID (for activity sessions that already have a conversation)
   */
  async getConversationById(conversationId, limit = 200, offset = 0) {
    const response = await api.get(`/chat/conversations/by-id/${conversationId}`, {
      params: { limit, offset }
    });
    return response.data;
  }

  /**
   * Send message and get AI response
   */
  async sendMessage(characterId, message, characterData, imageUrl = null, imageDescription = null) {
    const response = await api.post(`/chat/conversations/${characterId}/messages`, {
      message,
      characterData,
      imageUrl,
      imageDescription,
    });
    return response.data;
  }

  /**
   * Generate AI first message for new match or activity session
   * @param {string} characterId - Character ID
   * @param {Object} characterData - Character card data
   * @param {Object} options - Optional parameters
   * @param {number} options.conversationId - Existing conversation ID (for activities)
   * @param {string} options.activityMode - Activity mode ('random' or 'blind')
   * @param {boolean} options.isSuperLike - Whether this is a super like
   */
  async generateFirstMessage(characterId, characterData, options = {}) {
    const response = await api.post(`/chat/conversations/${characterId}/first-message`, {
      characterData,
      conversationId: options.conversationId,
      activityMode: options.activityMode,
      isSuperLike: options.isSuperLike,
    });
    return response.data;
  }

  /**
   * Mark conversation messages as read
   */
  async markAsRead(characterId) {
    const response = await api.post(`/chat/conversations/${characterId}/mark-read`);
    return response.data;
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId) {
    const response = await api.delete(`/chat/conversations/${conversationId}`);
    return response.data;
  }

  /**
   * Edit a message
   */
  async editMessage(messageId, content) {
    const response = await api.put(`/chat/messages/${messageId}`, {
      content,
    });
    return response.data;
  }

  /**
   * Delete message and all messages after it
   */
  async deleteMessagesFrom(messageId) {
    const response = await api.delete(`/chat/messages/${messageId}/delete-from`);
    return response.data;
  }

  /**
   * Regenerate AI response for current conversation state
   */
  async regenerateResponse(characterId, characterData) {
    const response = await api.post(`/chat/conversations/${characterId}/regenerate`, {
      characterData,
    });
    return response.data;
  }

  /**
   * Get character status from schedule
   */
  async getCharacterStatus(characterId) {
    const response = await api.get(`/characters/${characterId}/status`);
    return response.data;
  }

  /**
   * Generate suggested reply for user
   */
  async suggestReply(characterId, style, characterData) {
    const response = await api.post(`/chat/conversations/${characterId}/suggest-reply`, {
      style,
      characterData,
    });
    return response.data;
  }

  /**
   * Navigate to a different swipe variant of a message
   */
  async swipeMessage(messageId, swipeIndex) {
    const response = await api.post(`/chat/messages/${messageId}/swipe`, {
      swipeIndex,
    });
    return response.data;
  }

  /**
   * Regenerate a message (creates a new swipe variant)
   */
  async regenerateMessage(messageId, characterData) {
    const response = await api.post(`/chat/messages/${messageId}/regenerate`, {
      characterData,
    });
    return response.data;
  }

  /**
   * Get swipe info for a message
   */
  async getSwipeInfo(messageId) {
    const response = await api.get(`/chat/messages/${messageId}/swipes`);
    return response.data;
  }

  /**
   * Export conversation as JSON file
   */
  async exportConversation(conversationId) {
    const response = await api.get(`/chat/conversations/${conversationId}/export`);

    // Create and download the file
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${response.data.conversation?.characterName || 'export'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return response.data;
  }

  /**
   * Check if there's a pending AI response for a character
   */
  async checkPending(characterId) {
    const response = await api.get(`/chat/conversations/${characterId}/pending`);
    return response.data;
  }
}

export default new ChatService();
