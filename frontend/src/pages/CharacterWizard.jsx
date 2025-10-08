import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WizardProgress from '../components/wizard/WizardProgress';
import IdentityStep from '../components/wizard/IdentityStep';
import DescriptionStep from '../components/wizard/DescriptionStep';
import ImageStep from '../components/wizard/ImageStep';
import OptionsStep from '../components/wizard/OptionsStep';
import characterService from '../services/characterService';
import api from '../services/api';

const CharacterWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [character, setCharacter] = useState({
    name: '',
    age: '',
    archetype: '',
    personalityTags: [],
    description: '',
    appearance: {
      hairColor: '',
      hairStyle: '',
      eyeColor: '',
      bodyType: '',
      style: ''
    },
    imageBase64: null,
    imageTags: '',
    autoGenerate: {
      datingProfile: false,
      schedule: false,
      personality: false
    }
  });

  const { user } = useAuth();
  const navigate = useNavigate();

  const updateCharacter = (field, value) => {
    setCharacter(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 0: // Identity step
        return (
          character.age &&
          character.archetype &&
          character.personalityTags.length >= 3
        );
      case 1: // Description step
        return (
          character.name && character.name.trim().length > 0 &&
          character.description && character.description.trim().length > 0
        );
      case 2: // Image step
        return character.imageBase64 !== null;
      case 3: // Options step (always can proceed, checkboxes are optional)
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceedToNextStep() && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(character.imageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const imageBlob = new Blob([byteArray], { type: 'image/png' });

      // Create Character v2 card JSON
      const cardData = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: character.name,
          description: character.description,
          tags: ['generated', 'wizard'],
          creator: 'Character Wizard',
          character_version: '1.0',
          imageTags: character.imageTags // Store image tags for later sync to backend
        }
      };

      // Create character directly (wizard-generated, no embedded data)
      const savedCharacter = await characterService.createCharacter({
        cardData,
        imageBlob,
        userId: user.id
      });

      console.log('Character saved:', savedCharacter);

      // Auto-generate additional features if selected
      const options = character.autoGenerate;
      const characterId = savedCharacter.id;

      if (options.datingProfile || options.schedule || options.personality) {
        console.log('Auto-generating additional features:', options);

        // Update cardData in IndexedDB with generated features
        const generatedData = {};

        if (options.datingProfile) {
          const profile = await characterService.generateDatingProfile(
            character.description,
            character.name
          );
          generatedData.datingProfile = profile;
        }

        if (options.schedule) {
          const schedule = await characterService.generateSchedule(
            character.description,
            character.name
          );
          generatedData.schedule = schedule;
        }

        if (options.personality) {
          const personality = await characterService.generatePersonality(
            character.description,
            character.name
          );
          generatedData.personalityTraits = personality;
        }

        // Update character with generated data
        await characterService.updateCharacterData(characterId, {
          cardData: {
            ...savedCharacter.cardData,
            data: {
              ...savedCharacter.cardData.data,
              ...generatedData
            }
          }
        });

        console.log('Auto-generation complete:', generatedData);
      }

      // Redirect to Library
      navigate('/library');
    } catch (error) {
      console.error('Failed to save character:', error);
      throw error;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <IdentityStep character={character} updateCharacter={updateCharacter} />;
      case 1:
        return <DescriptionStep character={character} updateCharacter={updateCharacter} />;
      case 2:
        return <ImageStep character={character} updateCharacter={updateCharacter} />;
      case 3:
        return <OptionsStep character={character} updateCharacter={updateCharacter} onSave={handleSave} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Character Wizard</h1>
          <p className="text-gray-600">Create a unique AI character from scratch</p>
        </div>

        {/* Progress Bar */}
        <WizardProgress currentStep={currentStep} />

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            Previous
          </button>

          {currentStep < 3 && (
            <button
              onClick={handleNext}
              disabled={!canProceedToNextStep()}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              Next
            </button>
          )}

          <button
            onClick={() => navigate('/library')}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterWizard;
