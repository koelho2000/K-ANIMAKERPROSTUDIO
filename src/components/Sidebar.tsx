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
  Clock,
  Music,
  BookOpen,
  Sparkles,
  RefreshCw,
  Globe,
} from "lucide-react";
import { Project } from "../types";
import { AUTOMATION_PHASES } from "../constants";
import { useRef, useState, useEffect, Dispatch, SetStateAction, ChangeEvent } from "react";
import { ApiKeyModal } from "./ApiKeyModal";
import { UsageModal } from "./UsageModal";
import { ProjectProgressOverlay } from "./ProjectProgressOverlay";
import ClaudeExportModal from "./ClaudeExportModal";

interface SidebarProps {
  currentStep: number;
  setStep: (step: number) => void;
  project: Project;
  setProject: Dispatch<SetStateAction<Project>>;
  hasUnsavedChanges?: boolean;
  onSave?: (project?: Project) => void;
  onStartMassProduction?: () => void;
  onNewProject?: () => void;
  onOpenIntelligentGenerator?: () => void;
  onOpenUpdateMovie?: () => void;
  onGoHome?: () => void;
  apiMode: 'api' | 'free';
  setApiMode: (mode: 'api' | 'free') => void;
}

const steps = [
  { id: 1, name: "Configuração", icon: Settings },
  { id: 2, name: "História", icon: FileText },
  { id: 3, name: "Personagens", icon: Users },
  { id: 4, name: "Cenários", icon: ImageIcon },
  { id: 5, name: "Cenas e Takes", icon: Clapperboard },
  { id: 14, name: "Storyworld", icon: Globe },
  { id: 6, name: "Produção", icon: Film },
  { id: 7, name: "Intro & Créditos", icon: Zap },
  { id: 8, name: "Pré-visualização", icon: Play },
  { id: 9, name: "Quadro Resumo", icon: LayoutList },
  { id: 10, name: "Biblioteca de Media", icon: Library },
  { id: 11, name: "Timelapse", icon: Clock },
  { id: 13, name: "Soundtrack", icon: Music },
  { id: 12, name: "EBook", icon: BookOpen },
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
  onOpenIntelligentGenerator,
  onOpenUpdateMovie,
  onGoHome,
  apiMode,
  setApiMode,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [manualKey, setManualKey] = useState<string>(localStorage.getItem('GEMINI_API_KEY_MANUAL') || "");
  const [showAutoSettings, setShowAutoSettings] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [overlayType, setOverlayType] = useState<'save' | 'load'>('save');
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [overlayDescription, setOverlayDescription] = useState('');
  const [overlayTime, setOverlayTime] = useState<number | undefined>(undefined);
  const [overlaySteps, setOverlaySteps] = useState<{label: string, status: 'pending'|'current'|'completed'}[]>([]);
  const [overlaySummary, setOverlaySummary] = useState<{sizeBefore: number, sizeAfter: number, changes: string[]} | undefined>(undefined);
  const [showClaudeModal, setShowClaudeModal] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      const hasManual = !!localStorage.getItem('GEMINI_API_KEY_MANUAL');
      const hasEnv = !!process.env.GEMINI_API_KEY;
      
      if (hasManual) {
        setHasApiKey(true);
        return;
      }

      const aistudio = (window as any).aistudio || (window.parent as any).aistudio;
      if (aistudio?.hasSelectedApiKey) {
        const hasSelected = await aistudio.hasSelectedApiKey();
        setHasApiKey(hasSelected || hasEnv);
      } else {
        setHasApiKey(hasEnv);
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
    const aistudio = (window as any).aistudio || (window.parent as any).aistudio;
    if (aistudio?.openSelectKey) {
      await aistudio.openSelectKey();
      // Assume success and update state (as per guidelines)
      setHasApiKey(true);
      localStorage.removeItem('GEMINI_API_KEY_MANUAL');
      setManualKey("");
    } else {
      // If not in AI Studio environment, but we have an env key, just clear manual
      if (process.env.GEMINI_API_KEY) {
        localStorage.removeItem('GEMINI_API_KEY_MANUAL');
        setManualKey("");
        setHasApiKey(true);
      } else {
        alert("A Chave de Sistema funciona via backend (Variável de Ambiente GEMINI_API_KEY). Num servidor próprio, esta variável tem de ser injetada no código. Usa a opção Manual!");
      }
    }
  };

  const isConfigComplete = (project.title || "").trim() !== "" && 
                          (project.idea || "").trim() !== "" && 
                          (project.concept || "").trim() !== "";

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

  const handleSave = async () => {
    setOverlayType('save');
    setOverlayProgress(10);
    setOverlayDescription('A preparar dados do projeto');
    setOverlayTime(3);
    setOverlaySteps([]);
    setOverlaySummary(undefined);
    setIsOverlayOpen(true);

    await new Promise(r => setTimeout(r, 600));
    setOverlayProgress(40);
    setOverlayDescription('A processar imagens e ficheiros');
    setOverlayTime(2);

    await new Promise(r => setTimeout(r, 800));
    setOverlayProgress(70);
    setOverlayDescription('A gerar ficheiro de download');
    setOverlayTime(1);

    // Yield to event loop so UI updates before heavy stringify
    await new Promise(r => setTimeout(r, 100));

    const dataStr = JSON.stringify(project, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-PT').replace(/\//g, '-');
    const hourStr = now.getHours().toString().padStart(2, '0') + 'h';
    const safeTitle = (project.title || "projeto").trim().replace(/[^a-z0-9À-ÿ\s]/gi, '').replace(/\s+/g, '_');
    
    const exportFileDefaultName = `${safeTitle}_${dateStr}_${hourStr}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();

    setOverlayProgress(100);
    setOverlayDescription('Projeto gravado com sucesso!');
    setOverlayTime(0);

    if (onSave) onSave();

    await new Promise(r => setTimeout(r, 1000));
    setIsOverlayOpen(false);
  };

  const handleExportClaudeJSON = async () => {
    setOverlayType('save');
    setOverlayProgress(10);
    setOverlayDescription('A preparar exportação para Claude');
    setOverlayTime(2);
    setOverlaySteps([]);
    setOverlaySummary(undefined);
    setIsOverlayOpen(true);

    await new Promise(r => setTimeout(r, 500));

    const claudeData = {
      info: {
        title: project.title,
        idea: project.idea,
        concept: project.concept,
        filmType: project.filmType,
        filmStyle: project.filmStyle,
        language: project.language,
        duration: project.duration,
        aspectRatio: project.aspectRatio,
        targetAudience: project.targetAudience,
        director: project.director,
        author: project.author,
        company: project.company,
        producer: project.producer,
      },
      script: project.script,
      characters: project.characters.map(c => ({
        name: c.name,
        description: c.description,
        artisticStyle: c.artisticStyle,
        voice: c.voice,
        physical: c.physical,
      })),
      settings: project.settings.map(s => ({
        name: s.name,
        description: s.description,
        artisticStyle: s.artisticStyle,
      })),
      scenes: project.scenes.map(scene => ({
        title: scene.title,
        description: scene.description,
        takes: scene.takes.map(take => ({
          action: take.action,
          camera: take.camera,
          sound: take.sound,
          dialogue: take.dialogue,
          dialogueLines: take.dialogueLines,
          narration: take.narration,
          characterNames: take.characterIds?.map(id => project.characters.find(c => c.id === id)?.name).filter(Boolean),
          settingName: project.settings.find(s => s.id === take.settingId)?.name,
        }))
      })),
      storyworld: project.storyworld,
    };

    setOverlayProgress(70);
    setOverlayDescription('A gerar ficheiro JSON estruturado');
    setOverlayTime(1);

    await new Promise(r => setTimeout(r, 500));

    const dataStr = JSON.stringify(claudeData, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${project.title || "projeto"}-claude.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();

    setOverlayProgress(100);
    setOverlayDescription('Exportação concluída com sucesso!');
    setOverlayTime(0);

    await new Promise(r => setTimeout(r, 1000));
    setIsOverlayOpen(false);
  };

  const handleLoad = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOverlayType('load');
    setOverlayProgress(10);
    setOverlayDescription('A ler ficheiro do projeto');
    setOverlayTime(3);
    setOverlaySteps([]);
    setOverlaySummary(undefined);
    setIsOverlayOpen(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setOverlayProgress(40);
        setOverlayDescription('A analisar estrutura do projeto');
        setOverlayTime(2);
        
        await new Promise(r => setTimeout(r, 800));
        
        const json = JSON.parse(event.target?.result as string);
        
        setOverlayProgress(80);
        setOverlayDescription('A carregar recursos e imagens');
        setOverlayTime(1);
        
        await new Promise(r => setTimeout(r, 800));
        
        setProject(json);
        if (onSave) {
          // Update last saved state to match loaded project
          setTimeout(() => onSave(), 100);
        }
        
        setOverlayProgress(100);
        setOverlayDescription('Projeto carregado com sucesso!');
        setOverlayTime(0);
        
        await new Promise(r => setTimeout(r, 1000));
        setIsOverlayOpen(false);
        
      } catch (error) {
        console.error("Erro ao carregar projeto:", error);
        alert("Erro ao carregar o ficheiro JSON.");
        setIsOverlayOpen(false);
      }
    };
    reader.readAsText(file);
    
    // Reset file input so the same file can be loaded again
    e.target.value = '';
  };

  return (
    <>
      <div className="w-64 bg-zinc-900 text-zinc-300 flex flex-col h-full border-r border-zinc-800 relative z-50">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-indigo-500" />
          K-ANIMAKER PRO
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        <nav className="space-y-1">
          {[
            { id: 1, name: "Configuração", icon: Settings },
            { id: 2, name: "História", icon: FileText },
            { id: 3, name: "Personagens", icon: Users },
            { id: 4, name: "Cenários", icon: ImageIcon },
            { id: 5, name: "Cenas e Takes", icon: Clapperboard },
            { id: 14, name: "Storyworld", icon: Globe },
            { id: 6, name: "Produção", icon: Film },
            { id: 7, name: "Intro & Créditos", icon: Zap },
            { id: 8, name: "Pré-visualização", icon: Play },
            { id: 11, name: "Timelapse", icon: Clock },
            { id: 13, name: "Soundtrack", icon: Music },
          ].map((step) => {
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
                    : "hover:bg-zinc-800 hover:text-white text-zinc-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{step.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Hidden triggers for TopBar delegates */}
      <input
        type="file"
        id="project-file-input"
        ref={fileInputRef}
        onChange={handleLoad}
        accept=".json"
        className="hidden"
      />
      <button id="trigger-save-json" onClick={handleSave} className="hidden" />
      <button id="trigger-claude-json" onClick={() => setShowClaudeModal(true)} className="hidden" />

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

        {/* API Mode Slidebox & Tooltip */}
        <div className="mb-2 p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400">
              <span>Modo Operação</span>
              <button onClick={() => {
                const el = document.getElementById('api-mode-info-modal');
                if (el) el.classList.toggle('hidden');
              }} className="text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors">
                <Info className="w-3 h-3 cursor-pointer" />
              </button>
            </div>
            
            {/* Tooltip Content Modal */}
            <div id="api-mode-info-modal" className="hidden fixed inset-0 z-[999999] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={(e) => {
                e.currentTarget.parentElement?.classList.add('hidden');
              }}></div>
              <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl p-6 max-w-sm w-full relative z-10 transform scale-100 transition-all">
                <button
                  onClick={(e) => {
                    const el = document.getElementById('api-mode-info-modal');
                    if (el) el.classList.add('hidden');
                  }}
                  className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Info className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Configuração das IAs</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                    <p className="text-zinc-100 text-sm">
                      <span className="text-emerald-400 font-bold">Versão FREE:</span> Sem custos adicionais.
                    </p>
                    <ul className="text-xs text-zinc-400 space-y-1 ml-4 list-disc marker:text-emerald-500/50">
                      <li><strong className="text-zinc-300">Texto:</strong> Gemini 1.5 Flash</li>
                      <li><strong className="text-zinc-300">Imagem:</strong> Flux / Stable Diffusion</li>
                      <li><strong className="text-zinc-300">Vídeo:</strong> Veo 3 Lite (Otimizado)</li>
                    </ul>
                  </div>
                  <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2">
                    <p className="text-zinc-100 text-sm">
                      <span className="text-indigo-400 font-bold">Versão API:</span> Usa a sua Chave e Créditos.
                    </p>
                    <ul className="text-xs text-zinc-400 space-y-1 ml-4 list-disc marker:text-indigo-500/50">
                      <li><strong className="text-zinc-300">Texto:</strong> Gemini 1.5 Pro / Claude 3.5</li>
                      <li><strong className="text-zinc-300">Imagem:</strong> Imagen 3 / Midjourney</li>
                      <li><strong className="text-zinc-300">Vídeo:</strong> Veo 3.1 & Flow</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-700/50">
            <button
              onClick={() => setApiMode('free')}
              className={`flex-1 text-[9px] font-bold py-1.5 rounded-md transition-all z-10 ${
                apiMode === 'free' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              FREE
            </button>
            <button
              onClick={() => setApiMode('api')}
              className={`flex-1 text-[9px] font-bold py-1.5 rounded-md transition-all z-10 ${
                apiMode === 'api' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              API
            </button>
            
            {/* Sliding Background */}
            <div 
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md transition-transform duration-300 ease-in-out ${
                apiMode === 'api' 
                  ? 'translate-x-[calc(100%+4px)] bg-indigo-600' 
                  : 'translate-x-0 bg-emerald-600'
              }`}
            />
          </div>
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

      </div>

      <div className="p-3 space-y-1.5 border-t border-zinc-800 relative bg-zinc-900/50">
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
        V6.0.0 • Gemini & Veo
      </div>

      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onSave={handleSaveManualKey}
        currentKey={manualKey}
      />

      <ClaudeExportModal 
        isOpen={showClaudeModal}
        onClose={() => setShowClaudeModal(false)}
        onConfirmExport={handleExportClaudeJSON}
      />
    </div>

    <ProjectProgressOverlay
      isOpen={isOverlayOpen}
      type={overlayType}
      progress={overlayProgress}
      description={overlayDescription}
      timeRemaining={overlayTime}
      steps={overlaySteps}
      summary={overlaySummary}
      onClose={() => setIsOverlayOpen(false)}
    />
  </>
);
}
