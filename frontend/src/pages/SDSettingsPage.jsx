import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const SDSettingsPage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  // Local display setting (stored in localStorage, not backend)
  const [horizontalAsBackground, setHorizontalAsBackground] = useState(() => {
    const saved = localStorage.getItem('chatHorizontalAsBackground');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Persist horizontal background setting
  const handleHorizontalBackgroundChange = (enabled) => {
    setHorizontalAsBackground(enabled);
    localStorage.setItem('chatHorizontalAsBackground', JSON.stringify(enabled));
  };

  const [settings, setSettings] = useState({
    mainPrompt: '',
    negativePrompt: '',
    model: '',
    sd_steps: 30,
    sd_cfg_scale: 7.0,
    sd_sampler: 'DPM++ 2M',
    sd_scheduler: 'Karras',
    sd_enable_hr: true,
    sd_hr_scale: 1.5,
    sd_hr_upscaler: 'remacri_original',
    sd_hr_steps: 15,
    sd_hr_cfg: 5.0,
    sd_denoising_strength: 0.7,
    sd_enable_adetailer: true,
    sd_adetailer_model: 'face_yolov8n.pt',
    sd_width: 896,
    sd_height: 1152,
    sd_randomize_orientation: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/sd-settings');
      setSettings({
        mainPrompt: response.data.sd_main_prompt,
        negativePrompt: response.data.sd_negative_prompt,
        model: response.data.sd_model,
        sd_steps: response.data.sd_steps,
        sd_cfg_scale: response.data.sd_cfg_scale,
        sd_sampler: response.data.sd_sampler,
        sd_scheduler: response.data.sd_scheduler,
        sd_enable_hr: response.data.sd_enable_hr,
        sd_hr_scale: response.data.sd_hr_scale,
        sd_hr_upscaler: response.data.sd_hr_upscaler,
        sd_hr_steps: response.data.sd_hr_steps,
        sd_hr_cfg: response.data.sd_hr_cfg,
        sd_denoising_strength: response.data.sd_denoising_strength,
        sd_enable_adetailer: response.data.sd_enable_adetailer,
        sd_adetailer_model: response.data.sd_adetailer_model,
        sd_width: response.data.sd_width,
        sd_height: response.data.sd_height,
        sd_randomize_orientation: response.data.sd_randomize_orientation
      });
    } catch (err) {
      console.error('Failed to load SD settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await api.put('/users/sd-settings', {
        sd_main_prompt: settings.mainPrompt,
        sd_negative_prompt: settings.negativePrompt,
        sd_model: settings.model,
        sd_steps: settings.sd_steps,
        sd_cfg_scale: settings.sd_cfg_scale,
        sd_sampler: settings.sd_sampler,
        sd_scheduler: settings.sd_scheduler,
        sd_enable_hr: settings.sd_enable_hr,
        sd_hr_scale: settings.sd_hr_scale,
        sd_hr_upscaler: settings.sd_hr_upscaler,
        sd_hr_steps: settings.sd_hr_steps,
        sd_hr_cfg: settings.sd_hr_cfg,
        sd_denoising_strength: settings.sd_denoising_strength,
        sd_enable_adetailer: settings.sd_enable_adetailer,
        sd_adetailer_model: settings.sd_adetailer_model,
        sd_width: settings.sd_width,
        sd_height: settings.sd_height,
        sd_randomize_orientation: settings.sd_randomize_orientation
      });

      setSuccess('Settings saved successfully!');
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save SD settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({
      mainPrompt: 'masterpiece, best quality, amazing quality',
      negativePrompt: 'nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
      model: '',
      sd_steps: 30,
      sd_cfg_scale: 7.0,
      sd_sampler: 'DPM++ 2M',
      sd_scheduler: 'Karras',
      sd_enable_hr: true,
      sd_hr_scale: 1.5,
      sd_hr_upscaler: 'remacri_original',
      sd_hr_steps: 15,
      sd_hr_cfg: 5.0,
      sd_denoising_strength: 0.7,
      sd_enable_adetailer: true,
      sd_adetailer_model: 'face_yolov8n.pt',
      sd_width: 896,
      sd_height: 1152,
      sd_randomize_orientation: false
    });
    setError('');
    setSuccess('');
  };

  return (
    <div ref={containerRef} className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-2 mb-4 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Image Generation Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Configure Stable Diffusion parameters</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Main Prompt
                </label>
                <textarea
                  value={settings.mainPrompt}
                  onChange={(e) => setSettings({ ...settings, mainPrompt: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                  rows="3"
                  placeholder="Tags added to the beginning of every image generation"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  These tags are added to the start of every image prompt. Example: "masterpiece, best quality, amazing quality"
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Negative Prompt
                </label>
                <textarea
                  value={settings.negativePrompt}
                  onChange={(e) => setSettings({ ...settings, negativePrompt: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                  rows="4"
                  placeholder="Tags to avoid in image generation"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  These tags tell Stable Diffusion what to avoid. Example: "lowres, bad anatomy, bad hands, text, error"
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Stable Diffusion Model
                </label>
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                  placeholder="Leave empty to use default model"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The checkpoint/model name to use in Stable Diffusion WebUI. Leave empty to use the currently loaded model.
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Base Generation</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Sampling Steps
                    </label>
                    <input
                      type="number"
                      value={settings.sd_steps}
                      onChange={(e) => setSettings({ ...settings, sd_steps: parseInt(e.target.value) })}
                      min="1"
                      max="150"
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      CFG Scale
                    </label>
                    <input
                      type="number"
                      value={settings.sd_cfg_scale}
                      onChange={(e) => setSettings({ ...settings, sd_cfg_scale: parseFloat(e.target.value) })}
                      min="1"
                      max="30"
                      step="0.5"
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Sampler
                    </label>
                    <input
                      type="text"
                      value={settings.sd_sampler}
                      onChange={(e) => setSettings({ ...settings, sd_sampler: e.target.value })}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., DPM++ 2M, Euler a"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Scheduler
                    </label>
                    <input
                      type="text"
                      value={settings.sd_scheduler}
                      onChange={(e) => setSettings({ ...settings, sd_scheduler: e.target.value })}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., Karras, Exponential"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Width
                    </label>
                    <input
                      type="number"
                      value={settings.sd_width}
                      onChange={(e) => setSettings({ ...settings, sd_width: parseInt(e.target.value) })}
                      min="256"
                      max="2048"
                      step="64"
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Height
                    </label>
                    <input
                      type="number"
                      value={settings.sd_height}
                      onChange={(e) => setSettings({ ...settings, sd_height: parseInt(e.target.value) })}
                      min="256"
                      max="2048"
                      step="64"
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Randomize Orientation
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Randomly swap width/height for each image (50% vertical, 50% horizontal)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sd_randomize_orientation}
                      onChange={(e) => setSettings({ ...settings, sd_randomize_orientation: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Horizontal Images as Background
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Display horizontal images as chat background instead of in the side panel</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={horizontalAsBackground}
                      onChange={(e) => handleHorizontalBackgroundChange(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Highres Fix</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sd_enable_hr}
                      onChange={(e) => setSettings({ ...settings, sd_enable_hr: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {settings.sd_enable_hr && (
                  <div className="space-y-4 pl-4 border-l-2 border-purple-300 dark:border-purple-600">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Upscale Factor
                        </label>
                        <input
                          type="number"
                          value={settings.sd_hr_scale}
                          onChange={(e) => setSettings({ ...settings, sd_hr_scale: parseFloat(e.target.value) })}
                          min="1.0"
                          max="2.0"
                          step="0.1"
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Upscaler
                        </label>
                        <input
                          type="text"
                          value={settings.sd_hr_upscaler}
                          onChange={(e) => setSettings({ ...settings, sd_hr_upscaler: e.target.value })}
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                          placeholder="e.g., 4x-UltraSharp, Latent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Highres Steps
                        </label>
                        <input
                          type="number"
                          value={settings.sd_hr_steps}
                          onChange={(e) => setSettings({ ...settings, sd_hr_steps: parseInt(e.target.value) })}
                          min="0"
                          max="150"
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Highres CFG
                        </label>
                        <input
                          type="number"
                          value={settings.sd_hr_cfg}
                          onChange={(e) => setSettings({ ...settings, sd_hr_cfg: parseFloat(e.target.value) })}
                          min="1"
                          max="30"
                          step="0.5"
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Denoising Strength
                        </label>
                        <input
                          type="number"
                          value={settings.sd_denoising_strength}
                          onChange={(e) => setSettings({ ...settings, sd_denoising_strength: parseFloat(e.target.value) })}
                          min="0"
                          max="1"
                          step="0.05"
                          className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ADetailer</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sd_enable_adetailer}
                      onChange={(e) => setSettings({ ...settings, sd_enable_adetailer: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {settings.sd_enable_adetailer && (
                  <div className="pl-4 border-l-2 border-purple-300 dark:border-purple-600">
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Detection Model
                    </label>
                    <input
                      type="text"
                      value={settings.sd_adetailer_model}
                      onChange={(e) => setSettings({ ...settings, sd_adetailer_model: e.target.value })}
                      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., face_yolov8n.pt, hand_yolov8n.pt"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 dark:from-pink-600 dark:to-purple-700 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 dark:hover:from-pink-700 dark:hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold shadow-md hover:shadow-lg"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </span>
                  ) : (
                    'Save Settings'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                >
                  Reset to Defaults
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  disabled={saving}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SDSettingsPage;
