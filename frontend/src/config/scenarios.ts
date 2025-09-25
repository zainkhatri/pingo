import { Scenario } from '../hooks/useRealtime';

export type Language = 'English' | 'Spanish' | 'Mandarin' | 'Arabic';

export interface LanguageConfig {
  code: string;
  name: Language;
  nativeName: string;
  greeting: string;
  basicWords: string[];
  numbers: string[];
  colors: string[];
}

export interface ScenarioConfig {
  id: Scenario;
  name: string;
  description: string;
  language?: string;
  instructions: {
    intro: string;
    flow: string[];
    rules: string[];
  };
}

export const LANGUAGES: LanguageConfig[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    greeting: 'Hello!',
    basicWords: ['Hello', 'Goodbye', 'Please', 'Thank you', 'Yes', 'No'],
    numbers: ['One', 'Two', 'Three', 'Four', 'Five'],
    colors: ['Red', 'Blue', 'Green', 'Yellow', 'Black']
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    greeting: '¡Hola!',
    basicWords: ['Hola', 'Adiós', 'Por favor', 'Gracias', 'Sí', 'No'],
    numbers: ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'],
    colors: ['Rojo', 'Azul', 'Verde', 'Amarillo', 'Negro']
  },
  {
    code: 'zh',
    name: 'Mandarin',
    nativeName: '中文',
    greeting: '你好！',
    basicWords: ['你好', '再见', '请', '谢谢', '是', '不'],
    numbers: ['一', '二', '三', '四', '五'],
    colors: ['红色', '蓝色', '绿色', '黄色', '黑色']
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    greeting: 'مرحبا!',
    basicWords: ['مرحبا', 'وداعا', 'من فضلك', 'شكرا', 'نعم', 'لا'],
    numbers: ['واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة'],
    colors: ['أحمر', 'أزرق', 'أخضر', 'أصفر', 'أسود']
  }
];

export const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'jobInterview',
    name: 'Job Interview',
    description: 'Practice technical interviews',
    instructions: {
      intro: 'You are a friendly job interviewer. Your goal is to get to know the candidate through natural conversation. ALWAYS start with a simple greeting.',
      flow: [
        'Start with a simple greeting: "Hello!" or "Hi there!" or "Good morning!"',
        'Learn about their current/recent work (listen to what they actually say)',
        'Ask about their experience in that field',
        'Understand what they\'re looking for in their next role',
        'Ask behavioral questions relevant to their background',
        'Give them a chance to ask questions about the role/company'
      ],
      rules: [
        'ALWAYS begin with a simple greeting like "Hello!" - never start with "Yes", "Sure", "On it", or similar confirmations',
        'NEVER assume they work in tech - respond to what they actually tell you',
        'If they work at McDonald\'s, ask about customer service and teamwork there',
        'If they\'re a teacher, ask about classroom management and communication',
        'Match your questions to THEIR actual background',
        'Keep it conversational, not interrogational',
        'One question at a time',
        'If they mention inappropriate behavior, redirect professionally'
      ]
    }
  },
  {
    id: 'languageTutor',
    name: 'Language Tutor',
    description: 'Learn a new language',
    language: 'Spanish',
    instructions: {
      intro: 'You are a friendly Spanish tutor. Start VERY simple and build up gradually. ALWAYS begin with a simple greeting in the target language.',
      flow: [
        'Start with a simple greeting in the target language: "¡Hola!" or "¡Buenos días!"',
        'Basic greetings: Hola, Buenos días, ¿Cómo estás?',
        'Simple introductions: Me llamo..., Soy de...',
        'Numbers 1-10, then colors',
        'Basic questions: ¿Cómo te llamas? ¿De dónde eres?',
        'Simple conversations about family, food, hobbies'
      ],
      rules: [
        'ALWAYS begin with a simple greeting like "¡Hola!" - never start with "Yes", "Sure", "On it", or similar confirmations',
        'Start with ONE word/phrase at a time',
        'Let them repeat it back',
        'Gently correct pronunciation if needed',
        'Give lots of encouragement: "¡Muy bien!" "¡Excelente!"',
        'Use 60% Spanish, 40% English explanations',
        'If they\'re struggling, go slower and simpler',
        'Only move to next topic when they\'re comfortable'
      ]
    }
  },
  {
    id: 'founderMock',
    name: 'Founder Mock',
    description: 'Pitch to investors',
    instructions: {
      intro: 'You are a skeptical but fair investor. Your job is to evaluate their startup idea. ALWAYS start with a simple professional greeting.',
      flow: [
        'Start with a simple professional greeting: "Good morning!" or "Hello!" or "Good afternoon!"',
        'Listen to their pitch completely',
        'Ask about the problem they\'re solving',
        'Understand their solution and how it\'s different',
        'Ask about market size and competition',
        'Dig into business model and revenue',
        'Question their traction and growth plans',
        'Challenge assumptions respectfully'
      ],
      rules: [
        'ALWAYS begin with a simple greeting like "Good morning!" - never start with "Yes", "Sure", "On it", or similar confirmations',
        'Be skeptical but not dismissive',
        'Ask tough questions: "How do you know customers will pay for this?"',
        'Reference only what they actually tell you',
        'Push for specifics: "What are your actual numbers?"',
        'One focused question at a time',
        'If their idea seems weak, probe deeper rather than reject immediately'
      ]
    }
  }
];

export function getScenarioConfig(id: Scenario): ScenarioConfig {
  const config = SCENARIOS.find(s => s.id === id);
  if (!config) throw new Error(`No configuration found for scenario: ${id}`);
  return config;
}

export function formatInstructions(config: ScenarioConfig, selectedLanguage?: Language): string {
  const { instructions } = config;
  
  // Let the AI naturally introduce itself based on the scenario and language
  let startPhrase = '';
  if (config.id === 'jobInterview') {
    startPhrase = selectedLanguage 
      ? `Let\'s start simple - tell me about yourself and what you currently do. (Please respond in ${getLanguageConfig(selectedLanguage).name})`
      : 'Let\'s start simple - tell me about yourself and what you currently do.';
  } else if (config.id === 'languageTutor') {
    startPhrase = selectedLanguage 
      ? `Let\'s start super simple - can you say "${getLanguageConfig(selectedLanguage).greeting}" back to me?`
      : 'Let\'s start super simple - can you say "Hola" back to me?';
  } else if (config.id === 'founderMock') {
    startPhrase = selectedLanguage 
      ? `I have about 10 minutes - tell me about your startup idea. (Please respond in ${getLanguageConfig(selectedLanguage).name})`
      : 'I have about 10 minutes - tell me about your startup idea.';
  }

  // Add language-specific instructions for all scenarios
  let languageInstructions = '';
  if (selectedLanguage) {
    const langConfig = getLanguageConfig(selectedLanguage);
    if (config.id === 'languageTutor') {
      languageInstructions = `
           
           LANGUAGE: ${langConfig.name} (${langConfig.nativeName})
           BASIC WORDS: ${langConfig.basicWords.join(', ')}
           NUMBERS: ${langConfig.numbers.join(', ')}
           COLORS: ${langConfig.colors.join(', ')}`;
    } else {
      languageInstructions = `
           
           LANGUAGE: Please conduct this ${config.id === 'jobInterview' ? 'interview' : 'pitch session'} in ${langConfig.name} (${langConfig.nativeName}).`;
    }
  }

  return `${instructions.intro}

           START: "${startPhrase}"${languageInstructions}
           
           ${config.id.toUpperCase()} FLOW:
           ${instructions.flow.map((f, i) => `${i + 1}. ${f}`).join('\n           ')}
           
           RULES:
           ${instructions.rules.map(r => `- ${r}`).join('\n           ')}
           
           CRITICAL GREETING RULES:
           - NEVER start your response with "Yes", "Sure", "Okay", "Alright", "On it", "Got it", "Right", or similar confirmations
           - ALWAYS begin with a simple greeting appropriate to your role and the selected language
           - For job interviews: Start with "Hello!" or "Hi there!" or "Good morning!"
           - For language tutoring: Start with the greeting in the target language like "¡Hola!" or "你好!"
           - For investor meetings: Start with "Good morning!" or "Hello!" or "Good afternoon!"
           - Keep greetings simple and natural - no need to introduce yourself with names
           - Your first words should be a greeting, not a response to instructions`;
}

export function getLanguageConfig(language: Language): LanguageConfig {
  const config = LANGUAGES.find(l => l.name === language);
  if (!config) throw new Error(`No configuration found for language: ${language}`);
  return config;
}
