import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RandomChatSession from './RandomChatSession';
import BlindDateSession from './BlindDateSession';

// Activity modes
const MODE = {
  HUB: 'hub',
  RANDOM_CHAT: 'random',
  BLIND_DATE: 'blind',
};

const RandomChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(MODE.HUB);

  // Return to hub
  const handleBackToHub = () => {
    setMode(MODE.HUB);
  };

  // Render activity session based on mode
  if (mode === MODE.RANDOM_CHAT) {
    return <RandomChatSession user={user} onBack={handleBackToHub} />;
  }

  if (mode === MODE.BLIND_DATE) {
    return <BlindDateSession user={user} onBack={handleBackToHub} />;
  }

  // Render hub
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Activities
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Fun ways to meet new characters
            </p>
          </div>
          <button
            onClick={() => navigate('/settings/activities')}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Activities Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Activity Cards */}
      <div className="flex-1 px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {/* Random Chat Card */}
          <div
            onClick={() => setMode(MODE.RANDOM_CHAT)}
            className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer overflow-hidden border border-purple-100 dark:border-gray-700"
          >
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-purple-600"></div>

            <div className="p-6">
              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Random Chat
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Chat with a random online character for 10 minutes. At the end, both of you decide whether to match.
              </p>

              {/* Features */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded-full">
                  10 min timer
                </span>
                <span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 text-xs rounded-full">
                  Mutual matching
                </span>
              </div>
            </div>

            {/* Hover arrow */}
            <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>

          {/* Blind Date Card */}
          <div
            onClick={() => setMode(MODE.BLIND_DATE)}
            className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer overflow-hidden border border-purple-100 dark:border-gray-700"
          >
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500"></div>

            <div className="p-6">
              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-rose-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Blind Date
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Chat without seeing who you're talking to. Only their first initial is shown. Match to reveal their identity!
              </p>

              {/* Features */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs rounded-full">
                  Hidden identity
                </span>
                <span className="px-2 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-xs rounded-full">
                  Reveal on match
                </span>
              </div>
            </div>

            {/* Hover arrow */}
            <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>

          {/* Coming Soon Card */}
          <div className="relative bg-gray-100 dark:bg-gray-800/50 rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 opacity-60">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-400 to-gray-500"></div>

            <div className="p-6">
              <div className="w-16 h-16 bg-gray-300 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-gray-500 dark:text-gray-400 mb-2">
                More Coming Soon
              </h2>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                More activities are on the way!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RandomChat;
