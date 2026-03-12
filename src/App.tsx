import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Setup from "./components/Setup";
import Story from "./components/Story";
import Characters from "./components/Characters";
import Settings from "./components/Settings";
import Scenes from "./components/Scenes";
import Production from "./components/Production";
import IntroOutro from "./components/IntroOutro";
import Preview from "./components/Preview";
import Summary from "./components/Summary";
import Welcome from "./components/Welcome";
import MediaLibrary from "./components/MediaLibrary";
import MassProductionOverlay from "./components/MassProductionOverlay";
import { Project } from "./types";
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
  videoModel: "flow",
  sceneDetailLevel: "medium",
  takeDetailLevel: "medium",
  script: "",
  characters: [],
  settings: [],
  scenes: [],
};

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [project, setProject] = useState<Project>(initialProject);
  const [lastSavedProject, setLastSavedProject] = useState<string>(JSON.stringify(initialProject));
  const [showMassProduction, setShowMassProduction] = useState(false);

  const hasUnsavedChanges = JSON.stringify(project) !== lastSavedProject;

  const onSave = () => {
    setLastSavedProject(JSON.stringify(project));
  };

  const onNewProject = () => {
    const freshProject = { ...initialProject, id: uuidv4() };
    setProject(freshProject);
    setLastSavedProject(JSON.stringify(freshProject));
    setCurrentStep(1);
  };

  if (showWelcome) {
    return <Welcome onStart={() => setShowWelcome(false)} />;
  }

  return (
    <div className="flex h-screen bg-zinc-50 font-sans overflow-hidden">
      <Sidebar
        currentStep={currentStep}
        setStep={setCurrentStep}
        project={project}
        setProject={setProject}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={onSave}
        onStartMassProduction={() => setShowMassProduction(true)}
        onNewProject={onNewProject}
      />
      <main className="flex-1 overflow-y-auto">
        {currentStep === 1 && (
          <Setup 
            project={project} 
            setProject={setProject} 
            onStartMassProduction={() => setShowMassProduction(true)} 
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
          <Scenes project={project} setProject={setProject} />
        )}
        {currentStep === 6 && (
          <Production project={project} setProject={setProject} />
        )}
        {currentStep === 7 && (
          <IntroOutro project={project} setProject={setProject} />
        )}
        {currentStep === 8 && (
          <Preview project={project} setProject={setProject} />
        )}
        {currentStep === 9 && (
          <Summary project={project} />
        )}
        {currentStep === 10 && (
          <MediaLibrary project={project} setProject={setProject} />
        )}
      </main>

      {showMassProduction && (
        <MassProductionOverlay 
          project={project} 
          setProject={setProject} 
          onClose={() => setShowMassProduction(false)} 
          setStep={setCurrentStep}
        />
      )}
    </div>
  );
}
