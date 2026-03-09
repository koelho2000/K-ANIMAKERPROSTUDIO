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
} from "lucide-react";
import { Project } from "../types";
import { useRef, useState, useEffect, Dispatch, SetStateAction, ChangeEvent } from "react";
import { ApiKeyModal } from "./ApiKeyModal";

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
  const [showUsagePopup, setShowUsagePopup] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [manualKey, setManualKey] = useState<string>(localStorage.getItem('GEMINI_API_KEY_MANUAL') || "");

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

    const textCost = textUnits * 0.01;
    const imageCost = imagesCount * 0.05;
    const videoCost = videosCount * 0.25;
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
              onClick={() => setShowUsagePopup(!showUsagePopup)}
              className="text-zinc-500 hover:text-white transition-colors"
            >
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

        {/* Usage Breakdown Popup */}
        {showUsagePopup && (
          <div className="absolute bottom-full left-4 right-4 mb-2 p-4 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Divisão de Custos</h3>
              <button onClick={() => setShowUsagePopup(false)} className="text-zinc-500 hover:text-white">×</button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Conteúdo Texto ({usage.textUnits})</span>
                <span className="text-white font-medium">{usage.textCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Imagens Geradas ({usage.imagesCount})</span>
                <span className="text-white font-medium">{usage.imageCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Vídeos Renderizados ({usage.videosCount})</span>
                <span className="text-white font-medium">{usage.videoCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
              </div>
              <div className="pt-2 border-t border-zinc-700 flex justify-between text-sm font-bold">
                <span className="text-white">Total Estimado</span>
                <span className="text-emerald-500">{usage.totalCost.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-zinc-500 italic">
              * Valores baseados em estimativas de consumo de API.
            </div>
          </div>
        )}

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
        )}
      </div>

      <div className="p-2 text-[10px] text-zinc-500 text-center">
        v2.5.0 • Gemini & Veo
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
