const CardCounter = ({ remaining, total, swipesUsed, swipeLimit }) => {
  if (total === 0 || remaining === 0) return null;

  const isUnlimited = swipeLimit === 0;

  return (
    <div className="text-center mb-6">
      <div className="text-sm text-gray-500 font-medium">
        {remaining} / {total} remaining
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {isUnlimited ? (
          <span>{swipesUsed} swipes today (unlimited)</span>
        ) : (
          <span>{swipesUsed} / {swipeLimit} swipes today</span>
        )}
      </div>
    </div>
  );
};

export default CardCounter;
