const CardCounter = ({ remaining, total }) => {
  if (total === 0 || remaining === 0) return null;

  return (
    <div className="text-center mb-6">
      <div className="text-sm text-gray-500 font-medium">
        {remaining} / {total} remaining
      </div>
    </div>
  );
};

export default CardCounter;
