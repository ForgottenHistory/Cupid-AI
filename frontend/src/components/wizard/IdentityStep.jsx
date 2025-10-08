import { useState, useEffect } from 'react';
import archetypesData from '../../data/archetypes.txt?raw';
import personalityTraitsData from '../../data/personalityTraits.txt?raw';

const IdentityStep = ({ character, updateCharacter }) => {
  const [archetypes, setArchetypes] = useState([]);
  const [traits, setTraits] = useState([]);

  useEffect(() => {
    // Parse archetypes from text file
    const archetypeList = archetypesData
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    setArchetypes(archetypeList);

    // Parse personality traits from text file
    const traitList = personalityTraitsData
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    setTraits(traitList);
  }, []);

  const toggleTrait = (trait) => {
    const current = character.personalityTags || [];
    if (current.includes(trait)) {
      updateCharacter('personalityTags', current.filter(t => t !== trait));
    } else if (current.length < 5) {
      updateCharacter('personalityTags', [...current, trait]);
    }
  };

  const randomize = () => {
    // Weighted age selection (50% 18-25, 30% 26-35, 15% 36-45, 5% 46+)
    const ageWeights = [
      ...Array(50).fill('18-25'),
      ...Array(30).fill('26-35'),
      ...Array(15).fill('36-45'),
      ...Array(5).fill('46+')
    ];
    const randomAge = ageWeights[Math.floor(Math.random() * ageWeights.length)];
    const randomArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    // Select 3-5 random traits
    const numTraits = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
    const shuffled = [...traits].sort(() => 0.5 - Math.random());
    const randomTraits = shuffled.slice(0, numTraits);

    updateCharacter('age', randomAge);
    updateCharacter('archetype', randomArchetype);
    updateCharacter('personalityTags', randomTraits);
  };

  const selectedTraits = character.personalityTags || [];

  return (
    <div className="space-y-6">
      {/* Randomize Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={randomize}
          className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition font-medium"
        >
          Randomize
        </button>
      </div>

      {/* Age */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Age Range *
        </label>
        <select
          value={character.age || ''}
          onChange={(e) => updateCharacter('age', e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
        >
          <option value="">Select age range</option>
          <option value="18-25">18-25</option>
          <option value="26-35">26-35</option>
          <option value="36-45">36-45</option>
          <option value="46+">46+</option>
        </select>
      </div>

      {/* Archetype */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Archetype * <span className="text-gray-500 text-xs font-normal">(What are they like?)</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {archetypes.map((archetype) => (
            <button
              key={archetype}
              type="button"
              onClick={() => updateCharacter('archetype', archetype)}
              className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                character.archetype === archetype
                  ? 'bg-purple-500 border-purple-500 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-purple-400'
              }`}
            >
              {archetype}
            </button>
          ))}
        </div>
      </div>

      {/* Personality Tags */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Personality Traits * <span className="text-gray-500 text-xs font-normal">(Select 3-5)</span>
        </label>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {traits.map((trait) => {
            const isSelected = selectedTraits.includes(trait);
            const canSelect = selectedTraits.length < 5;
            return (
              <button
                key={trait}
                type="button"
                onClick={() => toggleTrait(trait)}
                disabled={!isSelected && !canSelect}
                className={`px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
                  isSelected
                    ? 'bg-pink-500 border-pink-500 text-white'
                    : canSelect
                    ? 'bg-white border-gray-300 text-gray-700 hover:border-pink-400'
                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {trait}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Selected: {selectedTraits.length}/5
        </p>
      </div>
    </div>
  );
};

export default IdentityStep;
