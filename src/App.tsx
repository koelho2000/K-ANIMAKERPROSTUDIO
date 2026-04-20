import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Setup from "./components/Setup";
import Story from "./components/Story";
import Characters from "./components/Characters";
import Settings from "./components/Settings";
import Storyworld from "./components/Storyworld";
import Scenes from "./components/Scenes";
import Production from "./components/Production";
import IntroOutro from "./components/IntroOutro";
import Preview from "./components/Preview";
import Summary from "./components/Summary";
import Welcome from "./components/Welcome";
import MediaLibrary from "./components/MediaLibrary";
import Timelapse from "./components/Timelapse";
import Soundtrack from "./components/Soundtrack";
import EBook from "./components/EBook";
import MassProductionOverlay from "./components/MassProductionOverlay";
import IntelligentEditor from "./components/IntelligentEditor";
import { UpdateMovieOverlay } from "./components/UpdateMovieOverlay";
import { Project, CustomMedia } from "./types";
import { v4 as uuidv4 } from "uuid";

const initialProject: Project = {
  id: uuidv4(),
  title: "",
  idea: "",
  concept: "",
  filmType: "Animação 3D",
  filmStyle: "Fantasia",
  language: "Português (Portugal)",
  duration: "1 a 5 minutos",
  aspectRatio: "16:9",
  targetAudience: "Adultos",
  videoModel: "flow",
  sceneDetailLevel: "medium",
  takeDetailLevel: "medium",
  characterDetailLevel: "medium",
  settingDetailLevel: "medium",
  script: "",
  characters: [],
  settings: [],
  scenes: [],
};

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [navigationContext, setNavigationContext] = useState<{
    sceneId?: string;
    takeId?: string;
  } | null>(null);
  const [project, setProject] = useState<Project>(initialProject);
  const [lastSavedProject, setLastSavedProject] = useState<string>(JSON.stringify(initialProject));
  const [showMassProduction, setShowMassProduction] = useState(false);
  const [showIntelligentGenerator, setShowIntelligentGenerator] = useState(false);
  const [showUpdateMovie, setShowUpdateMovie] = useState(false);
  const [apiMode, setApiMode] = useState<'api' | 'free'>(() => {
    return (localStorage.getItem('API_MODE') as 'api' | 'free') || 'api';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Sync apiMode to localStorage
  useEffect(() => {
    localStorage.setItem('API_MODE', apiMode);
  }, [apiMode]);

  const hasUnsavedChanges = JSON.stringify(project) !== lastSavedProject;

  const onSave = (savedProject?: Project) => {
    setLastSavedProject(JSON.stringify(savedProject || project));
  };

  const onNewProject = () => {
    const freshProject = { ...initialProject, id: uuidv4() };
    setProject(freshProject);
    setLastSavedProject(JSON.stringify(freshProject));
    setCurrentStep(1);
  };

  const onStart = (loadedProject?: Project) => {
    if (loadedProject) {
      setProject(loadedProject);
      setLastSavedProject(JSON.stringify(loadedProject));
    } else {
      onNewProject();
    }
    setShowWelcome(false);
  };

  if (showWelcome) {
    return <Welcome onStart={onStart} />;
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50 font-sans overflow-hidden">
      <TopBar 
        currentStep={currentStep}
        setStep={setCurrentStep}
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setIsSidebarOpen}
        onNewProject={() => {
          if (hasUnsavedChanges) {
            if (window.confirm("Tens alterações não gravadas. Desejas mesmo criar um novo projeto?")) {
              onNewProject();
            }
          } else {
            onNewProject();
          }
        }}
        onLoad={(e) => {
           const input = document.getElementById('project-file-input') as HTMLInputElement;
           if (input) {
             input.files = e.target.files;
             input.dispatchEvent(new Event('change', { bubbles: true }));
             e.target.value = '';
           }
        }}
        onSaveClick={() => {
           const btn = document.getElementById('trigger-save-json');
           if (btn) btn.click();
        }}
        onOpenIntelligentGenerator={() => setShowIntelligentGenerator(true)}
        onOpenUpdateMovie={() => setShowUpdateMovie(true)}
        hasUnsavedChanges={hasUnsavedChanges}
      />
      <div className="flex flex-1 overflow-hidden relative">
        {isSidebarOpen && (
          <Sidebar
            currentStep={currentStep}
            setStep={setCurrentStep}
            project={project}
            setProject={setProject}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={onSave}
            onStartMassProduction={() => setShowMassProduction(true)}
            onNewProject={onNewProject}
            onOpenIntelligentGenerator={() => setShowIntelligentGenerator(true)}
            onOpenUpdateMovie={() => setShowUpdateMovie(true)}
            onGoHome={() => setShowWelcome(true)}
            apiMode={apiMode}
            setApiMode={setApiMode}
          />
        )}
        <main className="flex-1 overflow-y-auto">
          {currentStep === 1 && (
          <Setup 
            project={project} 
            setProject={setProject} 
            onStartMassProduction={() => setShowMassProduction(true)} 
            apiMode={apiMode}
          />
        )}
        {currentStep === 2 && (
          <Story project={project} setProject={setProject} />
        )}
        {currentStep === 3 && (
          <Characters project={project} setProject={setProject} />
        )}
        {currentStep === 4 && (
          <Settings project={project} setProject={setProject} />
        )}
        {currentStep === 5 && (
          <Scenes 
            project={project} 
            setProject={setProject} 
            navigationContext={navigationContext}
            setNavigationContext={setNavigationContext}
            setCurrentStep={setCurrentStep}
          />
        )}
        {currentStep === 14 && (
          <Storyworld project={project} setProject={setProject} />
        )}
        {currentStep === 6 && (
          <Production 
            project={project} 
            setProject={setProject} 
            navigationContext={navigationContext}
            setNavigationContext={setNavigationContext}
            setCurrentStep={setCurrentStep}
          />
        )}
        {currentStep === 7 && (
          <IntroOutro project={project} setProject={setProject} />
        )}
        {currentStep === 8 && (
          <Preview project={project} setProject={setProject} />
        )}
        {currentStep === 9 && (
          <Summary project={project} setProject={setProject} />
        )}
        {currentStep === 10 && (
          <MediaLibrary 
            project={project} 
            setProject={setProject} 
            navigationContext={navigationContext}
            setNavigationContext={setNavigationContext}
            setCurrentStep={setCurrentStep}
          />
        )}
        {currentStep === 11 && (
          <Timelapse 
            project={project} 
            setProject={setProject} 
            navigationContext={navigationContext}
            setNavigationContext={setNavigationContext}
            setCurrentStep={setCurrentStep}
          />
        )}
        {currentStep === 12 && (
          <EBook project={project} setProject={setProject} />
        )}
        {currentStep === 13 && (
          <Soundtrack project={project} setProject={setProject} />
        )}
        </main>
      </div>

      {showMassProduction && (
        <MassProductionOverlay 
          project={project} 
          setProject={setProject} 
          onClose={() => setShowMassProduction(false)} 
          setStep={setCurrentStep}
        />
      )}

      {showIntelligentGenerator && (
        <IntelligentEditor
          project={project}
          aspectRatio={project.aspectRatio}
          initialMode="create"
          onClose={() => setShowIntelligentGenerator(false)}
          onSave={(url, _, title) => {
            const newMedia: CustomMedia = {
              id: uuidv4(),
              url,
              type: 'image',
              title: title || 'Nova Imagem',
              source: 'Estúdio',
              createdAt: Date.now()
            };
            setProject(prev => ({
              ...prev,
              customMedia: [...(prev.customMedia || []), newMedia]
            }));
          }}
        />
      )}

      <UpdateMovieOverlay
        isOpen={showUpdateMovie}
        onClose={() => setShowUpdateMovie(false)}
        project={project}
        setProject={setProject}
      />
    </div>
  );
}
