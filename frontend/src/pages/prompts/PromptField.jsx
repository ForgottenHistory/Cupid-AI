import { calculateTokens } from './promptFieldDefinitions';

/**
 * Individual prompt textarea field component
 */
const PromptField = ({ field, value, onChange, showTokens = false }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <label className="block mb-2">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {field.label}
          </span>
          {showTokens && (
            <span className="text-sm text-blue-600 dark:text-blue-400 font-mono">
              ~{calculateTokens(value).toLocaleString()} tokens
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {field.description}
        </p>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        rows={field.rows}
        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-y font-mono text-sm"
        placeholder={`Enter ${field.label.toLowerCase()}...`}
      />
    </div>
  );
};

export default PromptField;
