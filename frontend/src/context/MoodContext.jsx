import { createContext, useContext, useState, useCallback, useRef } from 'react';

const MoodContext = createContext();

export const MoodProvider = ({ children }) => {
  // Store mood state per character: { [characterId]: { effect, visible, characterName, showModal } }
  const [characterMoods, setCharacterMoods] = useState({});
  const fadeTimeoutsRef = useRef({});
  const autoClearTimeoutsRef = useRef({}); // Store auto-clear timeouts per character

  const setMoodEffect = useCallback((characterId, effect, characterName = '', autoClearMs = null, showModal = true) => {
    console.log('🎨 setMoodEffect called:', characterId, effect, characterName, 'autoClear:', autoClearMs, 'showModal:', showModal);

    // Clear any pending fade timeout for this character
    if (fadeTimeoutsRef.current[characterId]) {
      console.log('⏳ Clearing existing fade timeout for', characterId);
      clearTimeout(fadeTimeoutsRef.current[characterId]);
      delete fadeTimeoutsRef.current[characterId];
    }

    // Clear any existing auto-clear timeout for this character
    if (autoClearTimeoutsRef.current[characterId]) {
      console.log('⏰ Clearing existing auto-clear timeout for', characterId);
      clearTimeout(autoClearTimeoutsRef.current[characterId]);
      delete autoClearTimeoutsRef.current[characterId];
    }

    if (effect === 'none') {
      // Fade out
      console.log('❌ Setting effect to none - fading out');
      setCharacterMoods(prev => ({
        ...prev,
        [characterId]: {
          ...prev[characterId],
          visible: false,
          showModal: false,
        }
      }));

      fadeTimeoutsRef.current[characterId] = setTimeout(() => {
        setCharacterMoods(prev => ({
          ...prev,
          [characterId]: {
            effect: 'none',
            visible: false,
            showModal: false,
            characterName: ''
          }
        }));
        delete fadeTimeoutsRef.current[characterId];
      }, 1000);
    } else {
      // Reset and fade in
      console.log('✨ Setting effect:', effect, '- fading in');
      setCharacterMoods(prev => ({
        ...prev,
        [characterId]: {
          effect,
          visible: false,
          showModal: showModal, // Use parameter instead of always true
          characterName
        }
      }));

      // Fade in after brief delay
      fadeTimeoutsRef.current[characterId] = setTimeout(() => {
        console.log('👁️ Making background visible for', characterId);
        setCharacterMoods(prev => ({
          ...prev,
          [characterId]: {
            ...prev[characterId],
            visible: true
          }
        }));
        delete fadeTimeoutsRef.current[characterId];
      }, 100);

      // Set auto-clear timeout if specified
      if (autoClearMs) {
        console.log(`⏰ Setting auto-clear timeout for ${characterId} in ${autoClearMs}ms`);
        autoClearTimeoutsRef.current[characterId] = setTimeout(() => {
          console.log(`⏰ Auto-clearing effect for ${characterId}`);
          // Call clearMoodEffect internally
          setCharacterMoods(prev => ({
            ...prev,
            [characterId]: {
              ...prev[characterId],
              visible: false,
              showModal: false,
            }
          }));

          fadeTimeoutsRef.current[characterId] = setTimeout(() => {
            setCharacterMoods(prev => ({
              ...prev,
              [characterId]: {
                effect: 'none',
                visible: false,
                showModal: false,
                characterName: ''
              }
            }));
            delete fadeTimeoutsRef.current[characterId];
          }, 1000);

          delete autoClearTimeoutsRef.current[characterId];
        }, autoClearMs);
      }
    }
  }, []);

  const clearMoodEffect = useCallback((characterId, instant = false) => {
    console.log('🧹 clearMoodEffect called for', characterId, instant ? '(instant)' : '(fade)');

    // Clear any pending fade timeout
    if (fadeTimeoutsRef.current[characterId]) {
      clearTimeout(fadeTimeoutsRef.current[characterId]);
      delete fadeTimeoutsRef.current[characterId];
    }

    // Clear any pending auto-clear timeout
    if (autoClearTimeoutsRef.current[characterId]) {
      console.log('⏰ Clearing auto-clear timeout for', characterId);
      clearTimeout(autoClearTimeoutsRef.current[characterId]);
      delete autoClearTimeoutsRef.current[characterId];
    }

    if (instant) {
      // Instant clear - no fade animation
      // Use functional update to avoid unnecessary re-renders
      setCharacterMoods(prev => {
        const currentMood = prev[characterId];
        // Skip if already cleared (avoid unnecessary flash)
        if (!currentMood || currentMood.effect === 'none') {
          console.log('⏭️ Mood already cleared, skipping');
          return prev;
        }

        return {
          ...prev,
          [characterId]: {
            effect: 'none',
            visible: false,
            showModal: false,
            characterName: ''
          }
        };
      });
    } else {
      // Fade out animation
      setCharacterMoods(prev => ({
        ...prev,
        [characterId]: {
          ...prev[characterId],
          visible: false,
          showModal: false,
        }
      }));

      fadeTimeoutsRef.current[characterId] = setTimeout(() => {
        setCharacterMoods(prev => ({
          ...prev,
          [characterId]: {
            effect: 'none',
            visible: false,
            showModal: false,
            characterName: ''
          }
        }));
        delete fadeTimeoutsRef.current[characterId];
      }, 1000);
    }
  }, []);

  const closeMoodModal = useCallback((characterId) => {
    console.log('👋 Closing mood modal for', characterId, '(effect persists)');
    setCharacterMoods(prev => ({
      ...prev,
      [characterId]: {
        ...prev[characterId],
        showModal: false
      }
    }));
  }, []);

  const getMoodForCharacter = useCallback((characterId) => {
    return characterMoods[characterId] || {
      effect: 'none',
      visible: false,
      showModal: false,
      characterName: ''
    };
  }, [characterMoods]);

  return (
    <MoodContext.Provider
      value={{
        setMoodEffect,
        clearMoodEffect,
        closeMoodModal,
        getMoodForCharacter,
      }}
    >
      {children}
    </MoodContext.Provider>
  );
};

export const useMood = () => {
  const context = useContext(MoodContext);
  if (!context) {
    throw new Error('useMood must be used within a MoodProvider');
  }
  return context;
};
