declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export type TransitionType = 'cut' | 'fade' | 'fade-black' | 'fade-white' | 'wipe-left' | 'wipe-right' | 'zoom-in' | 'zoom-out';
export type VideoModel = 'veo-3.1' | 'veo-fast' | 'flow';

export type AutomationPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type AutomationStatus = 'idle' | 'running' | 'paused' | 'waiting_validation' | 'completed';

export interface AutomationState {
  currentPhase: AutomationPhase;
  status: AutomationStatus;
  autoMode: boolean;
  progress: number;
  currentTask?: string;
  logs: string[];
  totalCost?: number;
  enabledPhases?: number[];
}

export interface Project {
  id: string;
  title: string;
  idea: string;
  concept: string;
  filmType: string;
  filmStyle: string;
  language: string;
  duration: string;
  aspectRatio: '9:16' | '16:9' | '4:3' | '1:1';
  sceneDetailLevel: 'low' | 'medium' | 'high';
  takeDetailLevel: 'low' | 'medium' | 'high';
  script: string;
  characters: Character[];
  settings: Setting[];
  scenes: Scene[];
  automation?: AutomationState;
  validation?: {
    title?: { status: 'ok' | 'warning' | 'error'; message: string };
    idea?: { status: 'ok' | 'warning' | 'error'; message: string };
    concept?: { status: 'ok' | 'warning' | 'error'; message: string };
    ignoreWarnings?: boolean;
  };
  subtitleSettings?: {
    enabled: boolean;
    language: string;
    translatedLanguage?: string;
    translations?: Record<string, string>; // takeId -> translatedText
  };
  globalTransition?: TransitionType;
  videoModel?: VideoModel;
  intro?: {
    type: string;
    prompt: string;
    imageUrl?: string;
    videoUrl?: string;
    videoOperationId?: string;
    videoObject?: any;
    videoModel?: VideoModel;
    lastVideoPrompt?: string;
  };
  outro?: {
    type: string;
    prompt: string;
    imageUrl?: string;
    videoUrl?: string;
    videoOperationId?: string;
    videoObject?: any;
    videoModel?: VideoModel;
    lastVideoPrompt?: string;
    company?: string;
    director?: string;
    producer?: string;
    thankYouMessage?: string;
  };
}

export interface Character {
  id: string;
  name: string;
  description: string;
  voice?: {
    language: string;
    country: string;
    age: number | string;
    personality: string;
  };
  imageUrl?: string;
  lastImagePrompt?: string;
  viewsImageUrl?: string;
  lastViewsPrompt?: string;
  updatedAt?: number;
  analysis?: {
    status: 'ok' | 'warning' | 'error';
    feedback: string;
    suggestions: string[];
  };
}

export interface Setting {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  lastImagePrompt?: string;
  updatedAt?: number;
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  takes: Take[];
}

export interface DialogueLine {
  characterId: string;
  text: string;
}

export interface Take {
  id: string;
  action: string;
  camera: string;
  sound: string;
  music: string;
  dialogue: string;
  dialogueLines?: DialogueLine[];
  characterIds?: string[];
  settingId?: string;
  updatedAt?: number;
  startFrameUrl?: string;
  endFrameUrl?: string;
  videoUrl?: string;
  videoOperationId?: string;
  videoObject?: any;
  videoModel?: VideoModel;
  lastStartFramePrompt?: string;
  lastEndFramePrompt?: string;
  lastVideoPrompt?: string;
  duration?: number; // duration in seconds
  transition?: TransitionType;
  analysis?: {
    status: 'ok' | 'warning' | 'error';
    feedback: string;
    suggestions: string[];
  };
}
