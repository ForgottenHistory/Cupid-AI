const steps = [
  { id: 'identity', name: 'Character Identity' },
  { id: 'description', name: 'Generate Description' },
  { id: 'image', name: 'Generate Image' },
  { id: 'options', name: 'Options & Save' }
];

const WizardProgress = ({ currentStep }) => {
  return (
    <div className="mb-8">
      {/* Progress Steps */}
      <div className="flex justify-between items-center mb-4">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex flex-col items-center flex-1 ${
              index <= currentStep ? 'text-purple-500' : 'text-gray-400'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold mb-2 border-2 transition-colors ${
                index <= currentStep
                  ? 'bg-purple-500 border-purple-500 text-white'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}
            >
              {index + 1}
            </div>
            <span className="text-sm font-medium text-center">{step.name}</span>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};

export default WizardProgress;
