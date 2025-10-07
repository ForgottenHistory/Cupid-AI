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
  async getConversation(characterId) {
    const response = await api.get(`/chat/conversations/${characterId}`);
    return response.data;
  }

  /**
   * Send message and get AI response
   */
  async sendMessage(characterId, message, characterData) {
    const response = await api.post(`/chat/conversations/${characterId}/messages`, {
      message,
      characterData,
    });
    return response.data;
  }

  /**
   * Generate AI first message for new match
   */
  async generateFirstMessage(characterId, characterData) {
    const response = await api.post(`/chat/conversations/${characterId}/first-message`, {
      characterData,
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
}

export default new ChatService();
