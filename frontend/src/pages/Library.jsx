import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UploadZone from '../components/UploadZone';
import CharacterGrid from '../components/CharacterGrid';
import CharacterProfile from '../components/CharacterProfile';
import characterService from '../services/characterService';
import api from '../services/api';

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'liked', 'unviewed'
  const [stats, setStats] = useState({ total: 0, liked: 0, remaining: 0 });
  const [uploadResults, setUploadResults] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [thumbnails, setThumbnails] = useState({});
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'compact'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'random'
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const ITEMS_PER_PAGE = viewMode === 'compact' ? 50 : 24;

  useEffect(() => {
    loadCharacters();
    loadStats();
    loadThumbnails();
  }, [user?.id]);

  const loadThumbnails = async () => {
    try {
      const response = await api.get('/sync/character-thumbnails');
      if (response.data.success) {
        setThumbnails(response.data.thumbnails);
      }
    } catch (error) {
      console.error('Failed to load thumbnails:', error);
    }
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCharacters = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const allChars = await characterService.getAllCharacters(user.id);
      setCharacters(allChars);
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user?.id) return;

    try {
      const newStats = await characterService.getStats(user.id);
      setStats(newStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleUpload = async (files) => {
    try {
      const results = await characterService.importMultipleCharacters(files, user.id);

      setUploadResults(results);

      // Reload characters
      await loadCharacters();
      await loadStats();

      // Show results
      if (results.success.length > 0) {
        const message = `Successfully imported ${results.success.length} character(s)`;
        if (results.failed.length > 0) {
          alert(
            `${message}\n\nFailed: ${results.failed.length}\n` +
              results.failed.map(f => `- ${f.filename}: ${f.error}`).join('\n')
          );
        } else {
          alert(message);
        }
      } else {
        alert(
          'Failed to import characters:\n' +
            results.failed.map(f => `- ${f.filename}: ${f.error}`).join('\n')
        );
      }
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    }
  };

  const handleDelete = async (characterId) => {
    try {
      await characterService.deleteCharacter(characterId);
      await loadCharacters();
      await loadStats();
      // Notify other components to refresh
      window.dispatchEvent(new Event('characterUpdated'));
    } catch (error) {
      throw error;
    }
  };

  const handleCharacterClick = (character) => {
    setSelectedCharacter(character);
  };

  const filteredCharacters = useMemo(() => {
    let result = characters.filter((char) => {
      // Apply filter
      if (filter === 'liked' && !char.isLiked) return false;
      if (filter === 'unviewed' && char.isLiked) return false;

      // Apply search (name and tags)
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase();
        const nameMatch = char.name?.toLowerCase().includes(query);
        const tags = char.cardData?.data?.tags || [];
        const tagMatch = tags.some(tag => tag.toLowerCase().includes(query));
        return nameMatch || tagMatch;
      }

      return true;
    });

    // Apply sorting
    if (sortOrder === 'newest') {
      result = [...result].sort((a, b) => {
        const timeA = Number(a.uploadedAt) || 0;
        const timeB = Number(b.uploadedAt) || 0;
        return timeB - timeA;
      });
    } else if (sortOrder === 'oldest') {
      result = [...result].sort((a, b) => {
        const timeA = Number(a.uploadedAt) || 0;
        const timeB = Number(b.uploadedAt) || 0;
        return timeA - timeB;
      });
    } else if (sortOrder === 'random') {
      result = [...result].sort(() => Math.random() - 0.5);
    }

    return result;
  }, [characters, filter, debouncedSearch, sortOrder]);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, debouncedSearch]);

  // Pagination
  const totalPages = Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE);
  const paginatedCharacters = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCharacters.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCharacters, currentPage]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">{stats.total}</div>
            <div className="text-gray-600 dark:text-gray-400">Total Characters</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{stats.liked}</div>
            <div className="text-gray-600 dark:text-gray-400">Liked</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{stats.remaining}</div>
            <div className="text-gray-600 dark:text-gray-400">To Swipe</div>
          </div>
        </div>

        {/* Add Characters Section */}
        <div className="mb-8 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Add Characters</h2>

          {/* Create Character Button */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 dark:from-pink-600 dark:to-purple-700 rounded-xl p-6 shadow-lg border border-pink-400/30 dark:border-purple-600/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Create from Scratch</h3>
                <p className="text-pink-100 dark:text-purple-100">Use AI to generate a unique character with custom personality and appearance</p>
              </div>
              <button
                onClick={() => navigate('/wizard')}
                className="px-6 py-3 bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition font-semibold shadow-md"
              >
                Character Wizard
              </button>
            </div>
          </div>

          {/* Upload Zone */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Import Character Cards</h3>
            <UploadZone onUpload={handleUpload} />
          </div>
        </div>

        {/* Filter, Search, and Pagination */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilter('liked')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'liked'
                  ? 'bg-green-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Liked ({stats.liked})
            </button>
            <button
              onClick={() => setFilter('unviewed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'unviewed'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              To Swipe ({stats.remaining})
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search characters..."
                className="w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              <span className="text-sm">
                {sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'Random'}
              </span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {sortDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSortDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={() => { setSortOrder('newest'); setSortDropdownOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
                      sortOrder === 'newest' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Newest
                  </button>
                  <button
                    onClick={() => { setSortOrder('oldest'); setSortDropdownOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
                      sortOrder === 'oldest' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Oldest
                  </button>
                  <button
                    onClick={() => { setSortOrder('random'); setSortDropdownOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
                      sortOrder === 'random' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Random
                  </button>
                </div>
              </>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition ${
                viewMode === 'grid'
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`p-2 rounded transition ${
                viewMode === 'compact'
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Compact view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-center">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Character Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading characters...</p>
          </div>
        ) : (
          <>
          <CharacterGrid
            characters={paginatedCharacters}
            onDelete={handleDelete}
            onCharacterClick={handleCharacterClick}
            thumbnails={viewMode === 'compact' ? thumbnails : {}}
            viewMode={viewMode}
            emptyMessage={
              searchQuery
                ? `No characters found for "${searchQuery}"`
                : filter === 'all'
                ? 'No characters uploaded yet. Upload some character cards to get started!'
                : filter === 'liked'
                ? 'No liked characters yet. Go swipe some!'
                : 'All characters have been swiped!'
            }
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  // Show first, last, current, and adjacent pages
                  const showPage = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                  const showEllipsis = page === 2 && currentPage > 3 || page === totalPages - 1 && currentPage < totalPages - 2;

                  if (showEllipsis && !showPage) {
                    return <span key={page} className="px-2 text-gray-400">...</span>;
                  }

                  if (!showPage) return null;

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg font-medium transition ${
                        currentPage === page
                          ? 'bg-purple-500 text-white'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <span className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                {filteredCharacters.length} characters
              </span>
            </div>
          )}
          </>
        )}
      </div>

      {/* Character Profile Modal */}
      {selectedCharacter && (
        <CharacterProfile
          character={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
          onLike={async () => {
            try {
              await characterService.likeCharacter(selectedCharacter.id);
              await loadCharacters();
              await loadStats();
              setSelectedCharacter(null);
              // Notify other components to refresh
              window.dispatchEvent(new Event('characterUpdated'));
            } catch (error) {
              console.error('Failed to like character:', error);
              // Show user-friendly error message
              alert(error.message || 'Failed to like character');
            }
          }}
          onUnlike={async () => {
            try {
              await characterService.unlikeCharacter(selectedCharacter.id);
              await loadCharacters();
              await loadStats();
              setSelectedCharacter(null);
              // Notify other components to refresh
              window.dispatchEvent(new Event('characterUpdated'));
            } catch (error) {
              console.error('Failed to unlike character:', error);
              // Show user-friendly error message
              alert(error.message || 'Failed to unmatch character');
            }
          }}
          onPass={() => {
            setSelectedCharacter(null);
          }}
          onUpdate={async () => {
            // Reload the updated character from storage
            const updatedChar = await characterService.getCharacter(selectedCharacter.id);
            setSelectedCharacter(updatedChar);
            // Also reload the full list to show updates in the grid
            await loadCharacters();
          }}
        />
      )}
    </div>
  );
};

export default Library;
