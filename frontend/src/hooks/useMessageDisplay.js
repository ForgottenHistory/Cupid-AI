import { useState, useEffect, useRef } from 'react';

/**
 * Hook for managing message display animations and scroll behavior
 * @param {Array} messages - Array of messages
 * @param {Object} messagesEndRef - Ref to scroll target
 * @param {boolean} showTypingIndicator - Whether typing indicator is shown
 * @returns {Object} Display state and utilities
 */
export const useMessageDisplay = (messages, messagesEndRef, showTypingIndicator) => {
  const [newMessageIds, setNewMessageIds] = useState(new Set());
  const [displayingMessages, setDisplayingMessages] = useState(false);
  const displayTimeoutsRef = useRef([]);
  const previousFirstMessageIdRef = useRef(null);

  // Scroll to bottom when NEW messages are added (not when loading older messages)
  useEffect(() => {
    // Get the ID of the first message
    const currentFirstMessageId = messages.length > 0 ? messages[0]?.id : null;
    const previousFirstMessageId = previousFirstMessageIdRef.current;

    // Only auto-scroll if:
    // 1. First message ID hasn't changed (messages were appended, not prepended)
    // 2. Or this is the initial load (previousFirstMessageId is null)
    if (previousFirstMessageId === null || currentFirstMessageId === previousFirstMessageId) {
      scrollToBottom();
    }

    // Update the ref for next comparison
    previousFirstMessageIdRef.current = currentFirstMessageId;
  }, [messages, showTypingIndicator]);

  // Remove message IDs from newMessageIds after animation completes
  useEffect(() => {
    if (newMessageIds.size > 0) {
      const timeout = setTimeout(() => {
        setNewMessageIds(new Set());
      }, 350); // Slightly longer than animation duration (300ms)

      return () => clearTimeout(timeout);
    }
  }, [messages]);

  // Cleanup display timeouts on unmount
  useEffect(() => {
    return () => {
      displayTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      displayTimeoutsRef.current = [];
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const markMessageAsNew = (messageId) => {
    setNewMessageIds(prev => new Set([...prev, messageId]));
  };

  const addDisplayTimeout = (timeout) => {
    displayTimeoutsRef.current.push(timeout);
  };

  const clearDisplayTimeouts = () => {
    displayTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    displayTimeoutsRef.current = [];
  };

  return {
    newMessageIds,
    displayingMessages,
    setDisplayingMessages,
    markMessageAsNew,
    addDisplayTimeout,
    clearDisplayTimeouts,
    scrollToBottom,
  };
};
