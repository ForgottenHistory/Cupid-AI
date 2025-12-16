import { useState, useEffect } from 'react';
import { defaultPromptState } from './promptFieldDefinitions';

const API_BASE = 'http://localhost:3000/api/prompts';

const getToken = () => localStorage.getItem('token');

const fetchWithAuth = async (url, options = {}) => {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
};

/**
 * Custom hook for managing prompts and presets
 */
export const usePrompts = (containerRef) => {
  const [prompts, setPrompts] = useState(defaultPromptState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Preset state
  const [presets, setPresets] = useState([]);
  const [loadingPresets, setLoadingPresets] = useState(false);

  useEffect(() => {
    loadPrompts();
    loadPresets();
  }, []);

  const showMessage = (type, text, duration = 3000) => {
    setMessage({ type, text });
    if (containerRef?.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (duration > 0) {
      setTimeout(() => setMessage({ type: '', text: '' }), duration);
    }
  };

  // ==================== PROMPT FUNCTIONS ====================

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(API_BASE);

      if (!response.ok) {
        throw new Error('Failed to load prompts');
      }

      const data = await response.json();
      setPrompts(data);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('Failed to load prompts:', error);
      showMessage('error', 'Failed to load prompts', 0);
    } finally {
      setLoading(false);
    }
  };

  const savePrompts = async () => {
    try {
      setSaving(true);
      const response = await fetchWithAuth(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts })
      });

      if (!response.ok) {
        throw new Error('Failed to save prompts');
      }

      showMessage('success', 'Prompts saved successfully!');
    } catch (error) {
      console.error('Failed to save prompts:', error);
      showMessage('error', 'Failed to save prompts');
    } finally {
      setSaving(false);
    }
  };

  const resetPrompts = async () => {
    if (!confirm('Reset all prompts to defaults? This cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetchWithAuth(`${API_BASE}/reset`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to reset prompts');
      }

      const data = await response.json();
      setPrompts(data.prompts);
      showMessage('success', 'Prompts reset to defaults!');
    } catch (error) {
      console.error('Failed to reset prompts:', error);
      showMessage('error', 'Failed to reset prompts');
    } finally {
      setSaving(false);
    }
  };

  const updatePrompt = (key, value) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
  };

  // ==================== PRESET FUNCTIONS ====================

  const loadPresets = async () => {
    try {
      setLoadingPresets(true);
      const response = await fetchWithAuth(`${API_BASE}/presets`);

      if (response.ok) {
        const data = await response.json();
        setPresets(data.presets || []);
      }
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setLoadingPresets(false);
    }
  };

  const savePreset = async (presetName) => {
    if (!presetName?.trim()) {
      showMessage('error', 'Please enter a preset name');
      return false;
    }

    try {
      setSaving(true);

      // First save current prompts
      await fetchWithAuth(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts })
      });

      // Then save as preset
      const response = await fetchWithAuth(`${API_BASE}/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to save preset');
      }

      showMessage('success', `Preset "${presetName}" saved!`);
      loadPresets();
      return true;
    } catch (error) {
      console.error('Failed to save preset:', error);
      showMessage('error', 'Failed to save preset');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const loadPreset = async (presetName) => {
    if (!confirm(`Load preset "${presetName}"? This will replace your current prompts.`)) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetchWithAuth(
        `${API_BASE}/presets/${encodeURIComponent(presetName)}/load`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to load preset');
      }

      const data = await response.json();
      setPrompts(data.prompts);
      showMessage('success', `Preset "${presetName}" loaded!`);
    } catch (error) {
      console.error('Failed to load preset:', error);
      showMessage('error', 'Failed to load preset');
    } finally {
      setSaving(false);
    }
  };

  const deletePreset = async (presetName) => {
    if (!confirm(`Delete preset "${presetName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetchWithAuth(
        `${API_BASE}/presets/${encodeURIComponent(presetName)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete preset');
      }

      showMessage('success', `Preset "${presetName}" deleted!`);
      loadPresets();
    } catch (error) {
      console.error('Failed to delete preset:', error);
      showMessage('error', 'Failed to delete preset');
    }
  };

  return {
    // Prompt state
    prompts,
    loading,
    saving,
    message,
    // Prompt actions
    loadPrompts,
    savePrompts,
    resetPrompts,
    updatePrompt,
    // Preset state
    presets,
    loadingPresets,
    // Preset actions
    savePreset,
    loadPreset,
    deletePreset
  };
};
