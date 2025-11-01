const HeroImage = () => {
  return (
    <div className="w-[1280px] h-[640px] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center overflow-hidden">
      <div className="text-center px-16 max-w-full">
        {/* Main Title */}
        <h1 className="text-8xl font-bold mb-4 flex items-center justify-center gap-6">
          <span className="text-pink-500">Cupid</span>
          <span className="text-white">AI</span>
        </h1>

        {/* Tagline */}
        <p className="text-2xl text-gray-300 mb-12">
          AI-Powered Dating Simulation with Realistic Character Interactions
        </p>

        {/* Features */}
        <div className="flex items-center justify-center gap-6 text-lg font-semibold text-gray-300 flex-wrap">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>Dating Simulation</span>
          </div>
          <span className="text-gray-600">•</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span>Proactive Messaging</span>
          </div>
          <span className="text-gray-600">•</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>Memory System</span>
          </div>
          <span className="text-gray-600">•</span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Image Generation</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroImage;
