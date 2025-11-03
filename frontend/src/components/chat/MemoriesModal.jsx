import { createPortal } from 'react-dom';
import { useState } from 'react';

/**
 * Modal component to display and manage character memories
 */
const MemoriesModal = ({ isOpen, onClose, characterId, characterName, memories, loading, onAdd, onEdit, onDelete, onClearAll }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newMemory, setNewMemory] = useState({ text: '', importance: 50 });
  const [editMemory, setEditMemory] = useState({ text: '', importance: 50 });

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (!newMemory.text.trim()) return;

    const success = await onAdd(newMemory.text.trim(), newMemory.importance);
    if (success) {
      setNewMemory({ text: '', importance: 50 });
      setIsAdding(false);
    }
  };

  const handleEdit = async (index) => {
    if (!editMemory.text.trim()) return;

    const success = await onEdit(index, editMemory.text.trim(), editMemory.importance);
    if (success) {
      setEditingIndex(null);
      setEditMemory({ text: '', importance: 50 });
    }
  };

  const handleDelete = async (index) => {
    if (confirm('Are you sure you want to delete this memory?')) {
      await onDelete(index);
    }
  };

  const handleClearAll = async () => {
    if (confirm(`Are you sure you want to delete ALL ${memories.length} memories? This cannot be undone.`)) {
      const success = await onClearAll();
      if (success) {
        setIsAdding(false);
        setEditingIndex(null);
      }
    }
  };

  const startEditing = (index, memory) => {
    setEditingIndex(index);
    setEditMemory({
      text: memory.text || memory,
      importance: memory.importance || 50
    });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditMemory({ text: '', importance: 50 });
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewMemory({ text: '', importance: 50 });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-purple-200/50 dark:border-purple-800/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {characterName}'s Memories
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                What they remember about you
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdding(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all text-sm font-medium flex items-center gap-1"
              title="Add memory"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)] custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Add Memory Form */}
              {isAdding && (
                <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border-2 border-purple-300 dark:border-purple-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Add New Memory</h3>
                  <textarea
                    value={newMemory.text}
                    onChange={(e) => setNewMemory({ ...newMemory, text: e.target.value })}
                    placeholder="What does the character remember about you?"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Importance: {newMemory.importance}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={newMemory.importance}
                      onChange={(e) => setNewMemory({ ...newMemory, importance: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleAdd}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelAdd}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Memories List */}
              {memories.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No memories yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    Memories are extracted from your conversations over time, or add them manually
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {memories.map((memory, index) => {
                    // Handle both old format (string) and new format (object)
                    const memoryText = typeof memory === 'string' ? memory : memory.text;
                    const importance = typeof memory === 'object' && memory.importance !== undefined ? memory.importance : null;

                    const isEditing = editingIndex === index;

                    return (
                      <div
                        key={index}
                        className="flex gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-100 dark:border-purple-800/50 hover:shadow-md transition-shadow"
                      >
                        <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                          {index + 1}
                        </div>

                        {isEditing ? (
                          <div className="flex-1">
                            <textarea
                              value={editMemory.text}
                              onChange={(e) => setEditMemory({ ...editMemory, text: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              rows={2}
                            />
                            <div className="mt-2 flex items-center gap-3">
                              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                Importance: {editMemory.importance}
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={editMemory.importance}
                                onChange={(e) => setEditMemory({ ...editMemory, importance: parseInt(e.target.value) })}
                                className="flex-1"
                              />
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => handleEdit(index)}
                                className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all text-xs font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-xs font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                {memoryText}
                              </p>
                              {importance !== null && (
                                <div className="mt-1 flex items-center gap-1">
                                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                                    Importance: {importance}
                                  </span>
                                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[100px]">
                                    <div
                                      className={`h-full rounded-full ${
                                        importance >= 90 ? 'bg-red-500' :
                                        importance >= 70 ? 'bg-orange-500' :
                                        importance >= 50 ? 'bg-yellow-500' :
                                        importance >= 30 ? 'bg-blue-500' :
                                        'bg-gray-400'
                                      }`}
                                      style={{ width: `${importance}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 flex gap-1">
                              <button
                                onClick={() => startEditing(index, memory)}
                                className="p-1.5 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded transition-colors"
                                title="Edit memory"
                              >
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(index)}
                                className="p-1.5 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded transition-colors"
                                title="Delete memory"
                              >
                                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {memories.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {memories.length} of 50 memory slots used • Updated as conversations are compacted
                </span>
              </div>
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                title="Remove all memories"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default MemoriesModal;
