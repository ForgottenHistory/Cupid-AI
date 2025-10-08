const PostCard = ({ post, onCharacterClick }) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className="group bg-white/60 backdrop-blur-sm rounded-2xl shadow-sm border border-purple-100/50 hover:border-purple-300/50 hover:shadow-lg hover:shadow-purple-100/50 transition-all duration-300 cursor-pointer overflow-hidden h-full"
      onClick={() => onCharacterClick?.(post.character_id)}
    >
      <div className="flex gap-4 p-4">
        {/* Left: Avatar - full height */}
        <div className="relative flex-shrink-0 self-stretch">
          {post.character_avatar ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-purple-500 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
              <div className="relative h-full p-0.5 bg-gradient-to-br from-pink-400 to-purple-500 rounded-xl">
                <img
                  src={post.character_avatar}
                  alt={post.character_name}
                  className="w-24 h-full rounded-lg object-cover border-2 border-white"
                  style={{
                    imageRendering: 'auto',
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden'
                  }}
                />
              </div>
            </>
          ) : (
            <div className="w-24 h-full rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
              {post.character_name?.charAt(0) || '?'}
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-2">
            <p className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
              {post.character_name}
            </p>
            <p className="text-sm text-gray-500 font-medium">
              {formatTime(post.created_at)}
            </p>
          </div>

          {/* Post text */}
          <div className="mb-3">
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
              {post.content}
            </p>
          </div>

          {/* Image if present */}
          {post.image_url && (
            <div className="mt-3">
              <div className="rounded-xl overflow-hidden border border-purple-100/50">
                <img
                  src={post.image_url}
                  alt="Post"
                  className="w-full h-auto object-cover max-h-96"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostCard;
