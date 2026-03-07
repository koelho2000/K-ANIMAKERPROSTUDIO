declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export type AutomationPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type AutomationStatus = 'idle' | 'running' | 'paused' | 'waiting_validation' | 'completed';

export interface AutomationState {
  currentPhase: AutomationPhase;
  status: AutomationStatus;
  autoMode: boolean;
  progress: number;
  logs: string[];
  totalCost?: number;
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
  intro?: {
    type: string;
    prompt: string;
    imageUrl?: string;
    videoUrl?: string;
    videoOperationId?: string;
  };
  outro?: {
    type: string;
    prompt: string;
    imageUrl?: string;
    videoUrl?: string;
    videoOperationId?: string;
    company?: string;
    director?: string;
    producer?: string;
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
  viewsImageUrl?: string;
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
  duration?: number; // duration in seconds
  analysis?: {
    status: 'ok' | 'warning' | 'error';
    feedback: string;
    suggestions: string[];
  };
}
