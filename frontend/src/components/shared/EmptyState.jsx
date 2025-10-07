const EmptyState = ({ icon, title, description }) => {
  return (
    <div className="text-center py-8">
      {icon}
      <p className="text-gray-500 italic mb-3">{title}</p>
      {description && <p className="text-sm text-gray-400">{description}</p>}
    </div>
  );
};

export default EmptyState;
