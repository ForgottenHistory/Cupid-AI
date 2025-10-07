import GenerateButton from '../shared/GenerateButton';
import EmptyState from '../shared/EmptyState';

const PersonalityTab = ({ data, loading, onGenerate }) => {
  const icon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const traits = [
    {
      name: 'Openness',
      value: data.personalityTraits?.openness,
      description: 'Curiosity, creativity, openness to new experiences',
      gradient: 'from-blue-400 to-blue-600'
    },
    {
      name: 'Conscientiousness',
      value: data.personalityTraits?.conscientiousness,
      description: 'Organization, dependability, discipline',
      gradient: 'from-green-400 to-green-600'
    },
    {
      name: 'Extraversion',
      value: data.personalityTraits?.extraversion,
      description: 'Sociability, assertiveness, energy around others',
      gradient: 'from-yellow-400 to-orange-500'
    },
    {
      name: 'Agreeableness',
      value: data.personalityTraits?.agreeableness,
      description: 'Compassion, cooperation, trust in others',
      gradient: 'from-pink-400 to-rose-500'
    },
    {
      name: 'Neuroticism',
      value: data.personalityTraits?.neuroticism,
      description: 'Emotional sensitivity vs. stability',
      gradient: 'from-purple-400 to-purple-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Big Five Personality Traits</h3>
        <GenerateButton
          onClick={onGenerate}
          loading={loading}
          disabled={!data.description}
          label="Generate Personality"
          icon={icon}
          gradient="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
        />
      </div>

      {data.personalityTraits ? (
        <div className="space-y-4">
          {traits.map((trait) => (
            <div key={trait.name}>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-800">{trait.name}</h4>
                <span className="text-sm font-medium text-gray-600">{trait.value}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`bg-gradient-to-r ${trait.gradient} h-3 rounded-full transition-all`}
                  style={{ width: `${trait.value}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{trait.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No personality traits yet. Generate them using the Big Five model!"
          description="The Big Five (OCEAN) model provides scientific personality assessment."
        />
      )}
    </div>
  );
};

export default PersonalityTab;
