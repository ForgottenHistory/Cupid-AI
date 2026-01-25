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
  const previousMessageCountRef = useRef(0);

  // Scroll to bottom when NEW messages are added (not when loading older messages or re-sorting)
  useEffect(() => {
    // Get the ID of the first message and current count
    const currentFirstMessageId = messages.length > 0 ? messages[0]?.id : null;
    const previousFirstMessageId = previousFirstMessageIdRef.current;
    const currentMessageCount = messages.length;
    const previousMessageCount = previousMessageCountRef.current;

    // Only auto-scroll if:
    // 1. First message ID hasn't changed (messages were appended, not prepended)
    // 2. And message count has increased (new messages added, not just re-sorted)
    // 3. Or this is the initial load (previousFirstMessageId is null)
    const shouldScroll =
      previousFirstMessageId === null ||
      (currentFirstMessageId === previousFirstMessageId && currentMessageCount > previousMessageCount);

/*     console.log('📜 Scroll check:', {
      shouldScroll,
      prevFirstId: previousFirstMessageId,
      currFirstId: currentFirstMessageId,
      prevCount: previousMessageCount,
      currCount: currentMessageCount,
      reason: previousFirstMessageId === null ? 'initial load' :
              currentFirstMessageId !== previousFirstMessageId ? 'first message changed (prepended)' :
              currentMessageCount > previousMessageCount ? 'new message added' :
              currentMessageCount < previousMessageCount ? 'messages deleted' :
              'no change or re-sort'
    }); */

    // Update the refs for next comparison
    previousFirstMessageIdRef.current = currentFirstMessageId;
    previousMessageCountRef.current = currentMessageCount;
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

  const isNearBottom = () => {
    // Check if user is near the bottom (within 100px)
    const element = messagesEndRef.current?.parentElement;
    if (!element) return true; // Default to true if we can't check

    const threshold = 100;
    const position = element.scrollTop + element.clientHeight;
    const bottom = element.scrollHeight;

    return bottom - position < threshold;
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
