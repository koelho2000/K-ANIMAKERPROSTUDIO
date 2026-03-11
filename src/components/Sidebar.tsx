import {
  FileText,
  Users,
  Image as ImageIcon,
  Clapperboard,
  Film,
  Play,
  Settings,
  Save,
  Upload,
  LayoutList,
  Coins,
  Info,
  Zap,
  Plus,
  Key,
  Library,
  ChevronDown,
  ChevronUp,
  Settings2,
} from "lucide-react";
import { Project } from "../types";
import { AUTOMATION_PHASES } from "../constants";
import { useRef, useState, useEffect, Dispatch, SetStateAction, ChangeEvent } from "react";
import { ApiKeyModal } from "./ApiKeyModal";
import { UsageModal } from "./UsageModal";

interface SidebarProps {
  currentStep: number;
  setStep: (step: number) => void;
  project: Project;
  setProject: Dispatch<SetStateAction<Project>>;
  hasUnsavedChanges?: boolean;
  onSave?: () => void;
  onStartMassProduction?: () => void;
  onNewProject?: () => void;
}

const steps = [
  { id: 1, name: "Configuração", icon: Settings },
  { id: 2, name: "História", icon: FileText },
  { id: 3, name: "Personagens", icon: Users },
  { id: 4, name: "Cenários", icon: ImageIcon },
  { id: 5, name: "Cenas e Takes", icon: Clapperboard },
  { id: 6, name: "Produção", icon: Film },
  { id: 7, name: "Intro & Créditos", icon: Zap },
  { id: 8, name: "Pré-visualização", icon: Play },
  { id: 9, name: "Quadro Resumo", icon: LayoutList },
  { id: 10, name: "Biblioteca de Media", icon: Library },
];

export default function Sidebar({
  currentStep,
  setStep,
  project,
  setProject,
  hasUnsavedChanges,
  onSave,
  onStartMassProduction,
  onNewProject,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [manualKey, setManualKey] = useState<string>(localStorage.getItem('GEMINI_API_KEY_MANUAL') || "");
  const [showAutoSettings, setShowAutoSettings] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      const hasManual = !!localStorage.getItem('GEMINI_API_KEY_MANUAL');
      if (hasManual) {
        setHasApiKey(true);
        return;
      }

      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
    // Check periodically or on focus
    window.addEventListener('focus', checkKey);
    return () => window.removeEventListener('focus', checkKey);
  }, []);

  const handleSaveManualKey = (key: string) => {
    localStorage.setItem('GEMINI_API_KEY_MANUAL', key);
    setManualKey(key);
    setHasApiKey(!!key);
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success and update state (as per guidelines)
      setHasApiKey(true);
    }
  };

  const isConfigComplete = project.title.trim() !== "" && 
                          project.idea.trim() !== "" && 
                          project.concept.trim() !== "";

  const isValidated = (project.validation?.title?.status === 'ok' || (project.validation?.title?.status === 'warning' && project.validation?.ignoreWarnings)) && 
                      (project.validation?.idea?.status === 'ok' || (project.validation?.idea?.status === 'warning' && project.validation?.ignoreWarnings)) && 
                      (project.validation?.concept?.status === 'ok' || (project.validation?.concept?.status === 'warning' && project.validation?.ignoreWarnings));

  const calculateUsage = () => {
    let textUnits = 0;
    let imagesCount = 0;
    let videosCount = 0;

    // Text units
    if (project.script) textUnits += 1;
    project.characters.forEach((c) => {
      if (c.description) textUnits += 1;
      if (c.imageUrl) imagesCount += 1;
      if (c.viewsImageUrl) imagesCount += 1;
    });
    project.settings.forEach((s) => {
      if (s.description) textUnits += 1;
      if (s.imageUrl) imagesCount += 1;
    });
    project.scenes.forEach((scene) => {
      if (scene.description) textUnits += 1;
      scene.takes.forEach((take) => {
        if (take.action) textUnits += 1;
        if (take.startFrameUrl) imagesCount += 1;
        if (take.endFrameUrl) imagesCount += 1;
        if (take.videoUrl) videosCount += 1;
      });
    });

    // Intro & Outro costs
    if (project.intro) {
      if (project.intro.prompt) textUnits += 1;
      if (project.intro.imageUrl) imagesCount += 1;
      if (project.intro.videoUrl) videosCount += 1;
    }
    if (project.outro) {
      if (project.outro.prompt) textUnits += 1;
      if (project.outro.imageUrl) imagesCount += 1;
      if (project.outro.videoUrl) videosCount += 1;
    }

    // Adjusted costs to reflect real Google Cloud / Gemini API pricing
    const textCost = textUnits * 0.05;
    const imageCost = imagesCount * 0.25;
    const videoCost = videosCount * 3.50;
    const totalCost = textCost + imageCost + videoCost;
    const totalCredits = Math.round(totalCost * 100);

    return {
      textUnits,
      imagesCount,
      videosCount,
      textCost,
      imageCost,
      videoCost,
      totalCost,
      totalCredits,
    };
  };

  const usage = calculateUsage();

  const togglePhase = (phaseId: number) => {
    setProject(prev => {
      const currentPhases = prev.automation?.enabledPhases || AUTOMATION_PHASES.map(p => p.id);
      let newPhases;
      if (currentPhases.includes(phaseId)) {
        newPhases = currentPhases.filter(id => id !== phaseId);
      } else {
        newPhases = [...currentPhases, phaseId].sort((a, b) => a - b);
      }
      return {
        ...prev,
        automation: {
          ...(prev.automation || {
            currentPhase: 1,
            status: 'idle',
            autoMode: false,
            progress: 0,
            logs: ["Pronto para iniciar a produção em massa."]
          }),
          enabledPhases: newPhases
        }
      };
    });
  };

  const toggleAllPhases = () => {
    setProject(prev => {
      const currentPhases = prev.automation?.enabledPhases || AUTOMATION_PHASES.map(p => p.id);
      const allPhases = AUTOMATION_PHASES.map(p => p.id);
      const newPhases = currentPhases.length === allPhases.length ? [] : allPhases;
      
      return {
        ...prev,
        automation: {
          ...(prev.automation || {
            currentPhase: 1,
            status: 'idle',
            autoMode: false,
            progress: 0,
            logs: ["Pronto para iniciar a produção em massa."]
          }),
          enabledPhases: newPhases
        }
      };
    });
  };

  const handleSave = () => {
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `${project.title || "projeto"}-animaker.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();

    if (onSave) onSave();
  };

  const handleLoad = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setProject(json);
        if (onSave) {
          // Update last saved state to match loaded project
          setTimeout(() => onSave(), 100);
        }
        alert("Projeto carregado com sucesso!");
      } catch (error) {
        console.error("Erro ao carregar projeto:", error);
        alert("Erro ao carregar o ficheiro JSON.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-64 bg-zinc-900 text-zinc-300 flex flex-col h-full border-r border-zinc-800">
      <div className="p-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-indigo-500" />
          K-ANIMAKER PRO
        </h1>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isDisabled = step.id !== 1 && step.id !== 10 && !isValidated;

          return (
            <button
              key={step.id}
              onClick={() => !isDisabled && setStep(step.id)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : isDisabled
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{step.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 space-y-1.5 border-t border-zinc-800 relative bg-zinc-900/50">
        {/* API Key Status & Selector */}
        <div className="mb-2 p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-400">
              <Key className={`w-3 h-3 ${hasApiKey ? "text-emerald-500" : "text-rose-500"}`} />
              <span>Chave API</span>
            </div>
            {!hasApiKey && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleOpenKeySelector}
              className={`text-center px-1 py-1.5 rounded-md text-[9px] font-bold transition-all ${
                hasApiKey && !manualKey
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20" 
                  : "bg-zinc-700/50 text-zinc-400 border border-zinc-600/50 hover:bg-zinc-700"
              }`}
              title="Selecionar chave do sistema"
            >
              Sistema
            </button>
            <button
              onClick={() => setShowKeyModal(true)}
              className={`text-center px-1 py-1.5 rounded-md text-[9px] font-bold transition-all ${
                manualKey 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20" 
                  : "bg-zinc-700/50 text-zinc-400 border border-zinc-600/50 hover:bg-zinc-700"
              }`}
              title={manualKey ? `Chave: ${manualKey.substring(0, 4)}...${manualKey.substring(manualKey.length - 4)}` : "Introduzir chave manualmente"}
            >
              {manualKey ? "Manual ✓" : "Manual"}
            </button>
          </div>
          {manualKey && (
            <div className="mt-1.5 px-2 py-1 bg-black/20 rounded border border-white/5 flex items-center justify-between">
              <span className="text-[8px] font-mono text-zinc-500">
                {manualKey.substring(0, 4)}••••{manualKey.substring(manualKey.length - 4)}
              </span>
              <button 
                onClick={() => setShowKeyModal(true)}
                className="text-[8px] text-indigo-400 hover:text-indigo-300"
              >
                Ver
              </button>
            </div>
          )}
        </div>

        {/* Usage Stats Display */}
        <div className="mb-2 p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-400">
              <Coins className="w-3 h-3 text-amber-500" />
              <span>Créditos / Custo</span>
            </div>
            <button 
              onClick={() => setShowUsageModal(true)}
              className="text-zinc-500 hover:text-white transition-colors flex items-center gap-1 text-[9px] font-bold uppercase"
            >
              <span>Detalhes</span>
              <Info className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-sm font-bold text-white leading-none">
              {usage.totalCredits} <span className="text-[9px] font-normal text-zinc-500 uppercase tracking-wider">Créditos</span>
            </div>
            <div className="text-[11px] font-medium text-emerald-500 leading-none">
              {usage.totalCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
            </div>
          </div>
        </div>

        <UsageModal 
          isOpen={showUsageModal}
          onClose={() => setShowUsageModal(false)}
          usage={usage}
        />

        <button
          onClick={handleSave}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-xs font-medium ${
            hasUnsavedChanges
              ? "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/30"
              : "hover:bg-zinc-800 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <Save className="w-4 h-4" />
            <span>Gravar Projeto</span>
          </div>
          {hasUnsavedChanges && (
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
          )}
        </button>
        <button
          onClick={() => {
            if (hasUnsavedChanges) {
              if (window.confirm("Tens alterações não gravadas. Desejas mesmo criar um novo projeto?")) {
                onNewProject?.();
              }
            } else {
              onNewProject?.();
            }
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors text-xs font-medium text-emerald-500"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Projeto</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors text-xs font-medium"
        >
          <Upload className="w-4 h-4" />
          Abrir Projeto
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleLoad}
          accept=".json"
          className="hidden"
        />

        {/* Mass Production Quick Access */}
        {isConfigComplete && onStartMassProduction && (
          <div className="space-y-1">
            <div className="flex flex-col bg-zinc-800/30 rounded-lg border border-zinc-700/30 overflow-hidden">
              <button
                onClick={() => setShowAutoSettings(!showAutoSettings)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800 transition-colors text-[10px] font-bold text-zinc-400 uppercase tracking-wider"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Opções de Automatização</span>
                </div>
                {showAutoSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              
              {showAutoSettings && (
                <div className="p-2 space-y-1 bg-black/20 border-t border-zinc-700/30 animate-in fade-in slide-in-from-top-1 duration-200">
                  <button
                    onClick={toggleAllPhases}
                    className="w-full text-left px-2 py-1 rounded hover:bg-zinc-700/50 text-[9px] font-bold text-indigo-400 mb-1"
                  >
                    {(project.automation?.enabledPhases || AUTOMATION_PHASES.map(p => p.id)).length === AUTOMATION_PHASES.length 
                      ? "Desativar Todas" 
                      : "Ativar Todas"}
                  </button>
                  {AUTOMATION_PHASES.map((phase) => {
                    const isEnabled = (project.automation?.enabledPhases || AUTOMATION_PHASES.map(p => p.id)).includes(phase.id);
                    return (
                      <button
                        key={phase.id}
                        onClick={() => togglePhase(phase.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[9px] transition-colors ${
                          isEnabled ? "text-zinc-200 bg-indigo-500/10" : "text-zinc-500 hover:bg-zinc-800"
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                          isEnabled ? "bg-indigo-500 border-indigo-500" : "border-zinc-600"
                        }`}>
                          {isEnabled && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span className="truncate">{phase.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => isValidated && onStartMassProduction()}
              disabled={!isValidated}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-xs font-bold ${
                project.automation?.status === "running"
                  ? "bg-indigo-600 text-white animate-pulse"
                  : !isValidated
                  ? "bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50"
                  : "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/30"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{project.automation?.status === "running" ? "Em Curso" : "Produção Massa"}</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-2 text-[10px] text-zinc-500 text-center">
        V2.0.0 • Gemini & Veo
      </div>

      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onSave={handleSaveManualKey}
        currentKey={manualKey}
      />
    </div>
  );
}
