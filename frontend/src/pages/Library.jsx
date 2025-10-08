import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UploadZone from '../components/UploadZone';
import CharacterGrid from '../components/CharacterGrid';
import CharacterProfile from '../components/CharacterProfile';
import characterService from '../services/characterService';

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'liked', 'unviewed'
  const [stats, setStats] = useState({ total: 0, liked: 0, remaining: 0 });
  const [uploadResults, setUploadResults] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  useEffect(() => {
    loadCharacters();
    loadStats();
  }, [user?.id]);

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

  const filteredCharacters = characters.filter((char) => {
    if (filter === 'liked') return char.isLiked;
    if (filter === 'unviewed') return !char.isLiked;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-3xl font-bold text-purple-600 mb-1">{stats.total}</div>
            <div className="text-gray-600">Total Characters</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-3xl font-bold text-green-600 mb-1">{stats.liked}</div>
            <div className="text-gray-600">Liked</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="text-3xl font-bold text-blue-600 mb-1">{stats.remaining}</div>
            <div className="text-gray-600">To Swipe</div>
          </div>
        </div>

        {/* Add Characters Section */}
        <div className="mb-8 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Add Characters</h2>

          {/* Create Character Button */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Create from Scratch</h3>
                <p className="text-pink-100">Use AI to generate a unique character with custom personality and appearance</p>
              </div>
              <button
                onClick={() => navigate('/wizard')}
                className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition font-semibold shadow-md"
              >
                Character Wizard
              </button>
            </div>
          </div>

          {/* Upload Zone */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Import Character Cards</h3>
            <UploadZone onUpload={handleUpload} />
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-purple-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilter('liked')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'liked'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Liked ({stats.liked})
          </button>
          <button
            onClick={() => setFilter('unviewed')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'unviewed'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            To Swipe ({stats.remaining})
          </button>
        </div>

        {/* Character Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading characters...</p>
          </div>
        ) : (
          <CharacterGrid
            characters={filteredCharacters}
            onDelete={handleDelete}
            onCharacterClick={handleCharacterClick}
            emptyMessage={
              filter === 'all'
                ? 'No characters uploaded yet. Upload some character cards to get started!'
                : filter === 'liked'
                ? 'No liked characters yet. Go swipe some!'
                : 'All characters have been swiped!'
            }
          />
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
