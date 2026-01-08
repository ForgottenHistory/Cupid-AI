import { useState, useEffect } from 'react';
import GenerateButton from '../shared/GenerateButton';
import EmptyState from '../shared/EmptyState';
import api from '../../services/api';

const AttributesTab = ({ data, loading, onGenerate, onRevert, onUpdateAttributes }) => {
  const [schema, setSchema] = useState({ attributes: [] });
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Load attribute schema on mount
  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    try {
      const response = await api.get('/characters/attributes-schema');
      setSchema(response.data);
    } catch (error) {
      console.error('Failed to load attribute schema:', error);
    }
  };

  const icon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const handleRevert = () => {
    if (confirm('Are you sure you want to revert to the previous attributes?')) {
      onRevert();
    }
  };

  const handleGenerate = async () => {
    // Reload schema before generating to pick up any config changes
    await loadSchema();
    onGenerate();
  };

  const handleStartEdit = (attrId, currentValue) => {
    setEditingId(attrId);
    // For lists, convert array to comma-separated string
    if (Array.isArray(currentValue)) {
      setEditValue(currentValue.join(', '));
    } else {
      setEditValue(currentValue || '');
    }
  };

  const handleSaveEdit = (attrId, attrType) => {
    if (!data.attributesData) return;

    let newValue;
    if (attrType === 'list') {
      // Parse comma-separated list
      newValue = editValue
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    } else {
      newValue = editValue.trim();
    }

    const updatedAttributes = {
      ...data.attributesData,
      [attrId]: newValue
    };

    onUpdateAttributes(updatedAttributes);
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e, attrId, attrType) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(attrId, attrType);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const renderAttributeValue = (attr) => {
    const value = data.attributesData?.[attr.id];

    if (editingId === attr.id) {
      return (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, attr.id, attr.type)}
            className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder={attr.type === 'list' ? 'Item 1, Item 2, Item 3' : 'Enter value...'}
            autoFocus
          />
          <button
            onClick={() => handleSaveEdit(attr.id, attr.type)}
            className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
            title="Save"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={handleCancelEdit}
            className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            title="Cancel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      );
    }

    if (attr.type === 'list') {
      const items = Array.isArray(value) ? value : [];
      return (
        <div
          className="flex flex-wrap gap-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded p-1 -m-1 transition-colors"
          onClick={() => handleStartEdit(attr.id, value)}
          title="Click to edit"
        >
          {items.length > 0 ? (
            items.map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-full"
              >
                {item}
              </span>
            ))
          ) : (
            <span className="text-gray-400 dark:text-gray-500 text-sm italic">Not set</span>
          )}
        </div>
      );
    }

    return (
      <span
        className="text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
        onClick={() => handleStartEdit(attr.id, value)}
        title="Click to edit"
      >
        {value || <span className="text-gray-400 dark:text-gray-500 italic">Not set</span>}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Character Attributes</h3>
        <div className="flex gap-2">
          {data.previousAttributesData && data.attributesData && (
            <button
              onClick={handleRevert}
              disabled={loading}
              className="px-3 py-1 text-sm bg-orange-500 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Revert
            </button>
          )}
          <GenerateButton
            onClick={handleGenerate}
            loading={loading}
            disabled={!data.description}
            label="Generate Attributes"
            icon={icon}
            gradient="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
          />
        </div>
      </div>

      {data.attributesData && Object.keys(data.attributesData).length > 0 ? (
        <div className="space-y-3">
          {schema.attributes.map((attr) => (
            <div
              key={attr.id}
              className="flex items-start gap-4 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <span className="w-28 flex-shrink-0 font-medium text-gray-600 dark:text-gray-400 text-sm pt-1">
                {attr.label}
              </span>
              <div className="flex-1">
                {renderAttributeValue(attr)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          title="No attributes yet"
          description="Generate character attributes like physical features, hobbies, and relationships."
        />
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        Click any value to edit it manually. For lists, separate items with commas.
      </p>
    </div>
  );
};

export default AttributesTab;
