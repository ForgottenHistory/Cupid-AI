import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import characterService from '../services/characterService';

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState(null); // 'left' or 'right'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();

  // Load posts
  const loadPosts = async () => {
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.get('/feed', {
        params: {
          limit: 50,
          offset: 0
        }
      });

      const newPosts = response.data.posts || [];
      setPosts(newPosts);
    } catch (err) {
      console.error('Failed to load feed:', err);
      setError('Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadPosts();
  }, []);

  // Navigation handlers with animation
  const handleNext = () => {
    if (currentIndex < posts.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setDirection('left'); // Slide out to left
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setDirection('right'); // Slide in from right
        setTimeout(() => {
          setIsTransitioning(false);
          setDirection(null);
        }, 50);
      }, 300);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setDirection('right'); // Slide out to right
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1);
        setDirection('left'); // Slide in from left
        setTimeout(() => {
          setIsTransitioning(false);
          setDirection(null);
        }, 50);
      }, 300);
    }
  };

  // Handle character click - navigate to chat
  const handleCharacterClick = async (characterId) => {
    navigate(`/chat/${characterId}`);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, posts.length]);

  const currentPost = posts[currentIndex];

  return (
    <div className="h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md shadow-sm border-b border-purple-100/50 dark:border-purple-500/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Feed
          </h1>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {posts.length > 0 && `${currentIndex + 1} / ${posts.length}`}
          </div>
        </div>
      </div>

      {/* Single Post View */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 dark:border-purple-400"></div>
          </div>
        ) : !currentPost ? (
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">No posts yet</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm">Characters will start posting soon!</p>
          </div>
        ) : (
          <>
            {/* Main Post Container */}
            <div className="max-w-5xl w-full h-full flex items-center">
              <div
                className={`bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-3xl shadow-xl border border-purple-100/50 dark:border-gray-700/50 overflow-hidden w-full h-full max-h-[600px] flex transition-all duration-300 ease-out ${
                  direction === 'left' ? '-translate-x-full opacity-0' :
                  direction === 'right' ? 'translate-x-full opacity-0' :
                  'translate-x-0 opacity-100'
                }`}
              >
                {/* Left: Large Avatar */}
                <div
                  className="relative flex-shrink-0 w-80 cursor-pointer group"
                  onClick={() => handleCharacterClick(currentPost.character_id)}
                >
                  {currentPost.character_avatar ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-purple-500 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                      <img
                        src={currentPost.character_avatar}
                        alt={currentPost.character_name}
                        className="w-full h-full object-cover"
                        style={{
                          imageRendering: 'auto',
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden'
                        }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-6xl">
                      {currentPost.character_name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>

                {/* Right: Content */}
                <div className="flex-1 p-8 flex flex-col overflow-y-auto">
                  {/* Header */}
                  <div className="mb-6">
                    <h2
                      className="text-2xl font-bold text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer mb-1"
                      onClick={() => handleCharacterClick(currentPost.character_id)}
                    >
                      {currentPost.character_name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {new Date(currentPost.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Post Content */}
                  <div className="flex-1 mb-6">
                    <p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                      {currentPost.content}
                    </p>
                  </div>

                  {/* Image if present */}
                  {currentPost.image_url && (
                    <div className="rounded-xl overflow-hidden border border-purple-100/50 dark:border-gray-700/50">
                      <img
                        src={currentPost.image_url}
                        alt="Post"
                        className="w-full h-auto object-cover max-h-80"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Arrows */}
            {currentIndex > 0 && (
              <button
                onClick={handlePrevious}
                className="absolute left-8 top-1/2 transform -translate-y-1/2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 border border-purple-100 dark:border-gray-700 text-purple-600 dark:text-purple-400 rounded-full p-4 shadow-lg transition-all hover:scale-110"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {currentIndex < posts.length - 1 && (
              <button
                onClick={handleNext}
                className="absolute right-8 top-1/2 transform -translate-y-1/2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 border border-purple-100 dark:border-gray-700 text-purple-600 dark:text-purple-400 rounded-full p-4 shadow-lg transition-all hover:scale-110"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Feed;
