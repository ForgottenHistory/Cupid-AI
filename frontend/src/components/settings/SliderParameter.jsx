/**
 * Reusable slider parameter component for LLM settings
 */
const SliderParameter = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  description,
  labels
}) => {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {label}: {value}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      {labels && labels.length > 0 && (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          {labels.map((labelText, index) => (
            <span key={index}>{labelText}</span>
          ))}
        </div>
      )}
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {description}
        </p>
      )}
    </div>
  );
};

export default SliderParameter;
