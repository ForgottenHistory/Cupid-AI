import PromptField from './PromptField';
import { calculateTotalTokens } from './promptFieldDefinitions';

/**
 * Section container for a group of prompt fields
 */
const PromptSection = ({
  title,
  description,
  fields,
  prompts,
  updatePrompt,
  showTokens = false,
  showTotalTokens = false
}) => {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h2>
        {description && (
          <p className="text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
        {showTotalTokens && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-semibold text-blue-800 dark:text-blue-300">
                {title} Tokens:
              </span>
              <span className="text-blue-700 dark:text-blue-400 font-mono">
                ~{calculateTotalTokens(prompts, fields).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
      {fields.map(field => (
        <PromptField
          key={field.key}
          field={field}
          value={prompts[field.key]}
          onChange={updatePrompt}
          showTokens={showTokens}
        />
      ))}
    </div>
  );
};

export default PromptSection;
