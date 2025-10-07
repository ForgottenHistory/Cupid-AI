import { useState, useEffect } from 'react';
import api from '../../services/api';

const ImageGenSettings = () => {
  const [settings, setSettings] = useState({
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
    sd_adetailer_model: 'face_yolov8n.pt'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/sd-settings');
      setSettings(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load SD settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.put('/users/sd-settings', settings);
      alert('Image generation settings saved!');
    } catch (err) {
      console.error('Failed to save SD settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all image generation settings to defaults?')) return;

    const defaults = {
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
      sd_adetailer_model: 'face_yolov8n.pt'
    };

    setSettings(defaults);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 dark:text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Base Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Base Generation</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sampling Steps
            </label>
            <input
              type="number"
              value={settings.sd_steps}
              onChange={(e) => setSettings({ ...settings, sd_steps: parseInt(e.target.value) })}
              min="1"
              max="150"
              className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              CFG Scale
            </label>
            <input
              type="number"
              value={settings.sd_cfg_scale}
              onChange={(e) => setSettings({ ...settings, sd_cfg_scale: parseFloat(e.target.value) })}
              min="1"
              max="30"
              step="0.5"
              className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sampler
            </label>
            <select
              value={settings.sd_sampler}
              onChange={(e) => setSettings({ ...settings, sd_sampler: e.target.value })}
              className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
            >
              <option>DPM++ 2M</option>
              <option>DPM++ SDE</option>
              <option>Euler a</option>
              <option>Euler</option>
              <option>DDIM</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Scheduler
            </label>
            <select
              value={settings.sd_scheduler}
              onChange={(e) => setSettings({ ...settings, sd_scheduler: e.target.value })}
              className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
            >
              <option>Karras</option>
              <option>Exponential</option>
              <option>Normal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Highres Fix */}
      <div className="space-y-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Highres Fix</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sd_enable_hr}
              onChange={(e) => setSettings({ ...settings, sd_enable_hr: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {settings.sd_enable_hr && (
          <div className="space-y-4 pl-4 border-l-2 border-purple-300/50 dark:border-purple-700/50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upscale Factor
                </label>
                <input
                  type="number"
                  value={settings.sd_hr_scale}
                  onChange={(e) => setSettings({ ...settings, sd_hr_scale: parseFloat(e.target.value) })}
                  min="1.0"
                  max="2.0"
                  step="0.1"
                  className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upscaler
                </label>
                <select
                  value={settings.sd_hr_upscaler}
                  onChange={(e) => setSettings({ ...settings, sd_hr_upscaler: e.target.value })}
                  className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                >
                  <option>remacri_original</option>
                  <option>4x-UltraSharp</option>
                  <option>Latent</option>
                  <option>Latent (bicubic)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Highres Steps
                </label>
                <input
                  type="number"
                  value={settings.sd_hr_steps}
                  onChange={(e) => setSettings({ ...settings, sd_hr_steps: parseInt(e.target.value) })}
                  min="0"
                  max="150"
                  className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Highres CFG
                </label>
                <input
                  type="number"
                  value={settings.sd_hr_cfg}
                  onChange={(e) => setSettings({ ...settings, sd_hr_cfg: parseFloat(e.target.value) })}
                  min="1"
                  max="30"
                  step="0.5"
                  className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Denoising Strength
                </label>
                <input
                  type="number"
                  value={settings.sd_denoising_strength}
                  onChange={(e) => setSettings({ ...settings, sd_denoising_strength: parseFloat(e.target.value) })}
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADetailer */}
      <div className="space-y-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ADetailer</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sd_enable_adetailer}
              onChange={(e) => setSettings({ ...settings, sd_enable_adetailer: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {settings.sd_enable_adetailer && (
          <div className="pl-4 border-l-2 border-purple-300/50 dark:border-purple-700/50">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Detection Model
            </label>
            <select
              value={settings.sd_adetailer_model}
              onChange={(e) => setSettings({ ...settings, sd_adetailer_model: e.target.value })}
              className="w-full px-4 py-2 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 text-gray-900 dark:text-gray-100"
            >
              <option>face_yolov8n.pt</option>
              <option>face_yolov8s.pt</option>
              <option>Eyes.pt</option>
              <option>mediapipe_face_full</option>
              <option>hand_yolov8n.pt</option>
            </select>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        <button
          onClick={handleReset}
          disabled={saving}
          className="px-6 py-3 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold hover:bg-white/80 dark:hover:bg-gray-700/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Info */}
      <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
        <p>💡 <strong>Tips:</strong></p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Highres fix generates higher quality images (832x1216 → 1248x1824)</li>
          <li>ADetailer improves face/hand details automatically</li>
          <li>Higher steps = better quality but slower generation</li>
          <li>CFG scale controls prompt adherence (7-9 recommended)</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageGenSettings;
