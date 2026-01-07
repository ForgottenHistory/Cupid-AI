import { useState, useEffect } from 'react';
import api from '../../services/api';

const AttributeSchemaEditor = () => {
  const [schema, setSchema] = useState({ attributes: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({ id: '', label: '', type: 'text' });

  // Load schema on mount
  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      setLoading(true);
      const response = await api.get('/characters/attributes-schema');
      setSchema(response.data);
    } catch (error) {
      console.error('Failed to load attribute schema:', error);
      setMessage({ type: 'error', text: 'Failed to load attribute schema' });
    } finally {
      setLoading(false);
    }
  };

  const saveSchema = async () => {
    try {
      setSaving(true);
      await api.put('/characters/attributes-schema', { attributes: schema.attributes });
      setMessage({ type: 'success', text: 'Attribute schema saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Failed to save attribute schema:', error);
      setMessage({ type: 'error', text: 'Failed to save attribute schema' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAttribute = () => {
    const newAttr = {
      id: `attr_${Date.now()}`,
      label: 'New Attribute',
      type: 'text'
    };
    setSchema(prev => ({
      ...prev,
      attributes: [...prev.attributes, newAttr]
    }));
    // Start editing the new attribute
    setEditingIndex(schema.attributes.length);
    setEditForm(newAttr);
  };

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setEditForm({ ...schema.attributes[index] });
  };

  const handleSaveEdit = () => {
    if (!editForm.id.trim() || !editForm.label.trim()) {
      setMessage({ type: 'error', text: 'ID and Label are required' });
      return;
    }

    // Check for duplicate IDs
    const isDuplicate = schema.attributes.some((attr, idx) =>
      idx !== editingIndex && attr.id === editForm.id.trim()
    );
    if (isDuplicate) {
      setMessage({ type: 'error', text: 'An attribute with this ID already exists' });
      return;
    }

    setSchema(prev => ({
      ...prev,
      attributes: prev.attributes.map((attr, idx) =>
        idx === editingIndex ? { ...editForm, id: editForm.id.trim(), label: editForm.label.trim() } : attr
      )
    }));
    setEditingIndex(null);
    setEditForm({ id: '', label: '', type: 'text' });
  };

  const handleCancelEdit = () => {
    // If this was a new attribute that wasn't saved, remove it
    if (schema.attributes[editingIndex]?.id.startsWith('attr_')) {
      const attr = schema.attributes[editingIndex];
      if (attr.label === 'New Attribute') {
        setSchema(prev => ({
          ...prev,
          attributes: prev.attributes.filter((_, idx) => idx !== editingIndex)
        }));
      }
    }
    setEditingIndex(null);
    setEditForm({ id: '', label: '', type: 'text' });
  };

  const handleDelete = (index) => {
    if (!confirm('Are you sure you want to delete this attribute?')) return;
    setSchema(prev => ({
      ...prev,
      attributes: prev.attributes.filter((_, idx) => idx !== index)
    }));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    setSchema(prev => {
      const newAttrs = [...prev.attributes];
      [newAttrs[index - 1], newAttrs[index]] = [newAttrs[index], newAttrs[index - 1]];
      return { ...prev, attributes: newAttrs };
    });
  };

  const handleMoveDown = (index) => {
    if (index === schema.attributes.length - 1) return;
    setSchema(prev => {
      const newAttrs = [...prev.attributes];
      [newAttrs[index], newAttrs[index + 1]] = [newAttrs[index + 1], newAttrs[index]];
      return { ...prev, attributes: newAttrs };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Character Attributes Schema</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Define what attributes AI generates for characters (body features, hobbies, relationships, etc.)
          </p>
        </div>
        <button
          onClick={saveSchema}
          disabled={saving}
          className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? 'Saving...' : 'Save Schema'}
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Attributes List */}
      <div className="space-y-2 mb-4">
        {schema.attributes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No attributes defined. Click "Add Attribute" to create one.
          </div>
        ) : (
          schema.attributes.map((attr, index) => (
            <div
              key={attr.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              {editingIndex === index ? (
                // Edit mode
                <div className="flex-1 flex items-center gap-3">
                  <input
                    type="text"
                    value={editForm.id}
                    onChange={(e) => setEditForm(prev => ({ ...prev, id: e.target.value.replace(/\s/g, '') }))}
                    placeholder="id (no spaces)"
                    className="w-32 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                  <input
                    type="text"
                    value={editForm.label}
                    onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Label"
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-24 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="list">List</option>
                  </select>
                  <button
                    onClick={handleSaveEdit}
                    className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                    title="Save"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    title="Cancel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                // View mode
                <>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === schema.attributes.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <code className="w-28 text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{attr.id}</code>
                  <span className="flex-1 font-medium text-gray-900 dark:text-white">{attr.label}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    attr.type === 'list'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}>
                    {attr.type}
                  </span>
                  <button
                    onClick={() => handleStartEdit(index)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Button */}
      <button
        onClick={handleAddAttribute}
        className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-purple-500 hover:text-purple-500 dark:hover:border-purple-400 dark:hover:text-purple-400 transition flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Attribute
      </button>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
        <strong>Type descriptions:</strong>
        <ul className="mt-1 list-disc list-inside">
          <li><strong>Text</strong> - Single value (e.g., Height: "5'6"", Eye Color: "Blue")</li>
          <li><strong>List</strong> - Multiple values (e.g., Hobbies: ["Reading", "Gaming", "Cooking"])</li>
        </ul>
      </div>
    </div>
  );
};

export default AttributeSchemaEditor;
