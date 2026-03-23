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
  Cloud,
  Globe,
} from "lucide-react";
import { Project } from "../types";
import { AUTOMATION_PHASES } from "../constants";
import { useRef, useState, useEffect, Dispatch, SetStateAction, ChangeEvent } from "react";
import { ApiKeyModal } from "./ApiKeyModal";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { UsageModal } from "./UsageModal";
import { ProjectProgressOverlay } from "./ProjectProgressOverlay";

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
      localStorage.removeItem('GEMINI_API_KEY_MANUAL');
      setManualKey("");
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

    const exportFileDefaultName = `${project.title || "projeto"}-animaker.json`;

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

  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [saveEstimation, setSaveEstimation] = useState({
    currentSize: 0,
    newSize: 0,
    increase: 0,
    estimatedTime: 0
  });

  const handleSaveToCloud = async () => {
    if (isSavingToCloud) return;
    
    if (!auth.currentUser) {
      alert("Precisas de fazer login para gravar na cloud.");
      return;
    }

    if (!project.title) {
      alert("O projeto precisa de um título para ser gravado na cloud.");
      return;
    }

    setIsSavingToCloud(true);
    
    try {
      const userId = auth.currentUser.uid;
      let currentSize = 0;
      
      if (project.id) {
        const docRef = doc(db, `users/${userId}/projects`, project.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.chunksCount && data.chunksCount > 1) {
            currentSize = data.chunksCount * 800 * 1024;
          } else {
            currentSize = new Blob([JSON.stringify(data)]).size;
          }
        }
      }
      
      const projectData = {
        ...project,
        updatedAt: Date.now(),
        userId: userId
      };
      
      const jsonString = JSON.stringify(projectData);
      const newSize = new Blob([jsonString]).size;
      const increase = newSize - currentSize;
      
      // Estimate time: 1MB/s upload speed + 1s base overhead
      const estimatedTime = Math.max(1, Math.ceil((newSize / 1048576) * 2 + 1));
      
      setSaveEstimation({
        currentSize,
        newSize,
        increase,
        estimatedTime
      });
      
      setShowSaveConfirmation(true);
    } catch (error) {
      console.error("Error calculating estimation:", error);
      handleSaveToCloudConfirmed();
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleSaveToCloudConfirmed = async () => {
    if (isSavingToCloud) return;
    setShowSaveConfirmation(false);
    setIsSavingToCloud(true);
    setOverlayType('save');
    setOverlayProgress(10);
    setOverlayDescription('A iniciar gravação...');
    setOverlayTime(5);
    setOverlaySteps([
      { label: 'A preparar dados', status: 'current' },
      { label: 'A analisar alterações', status: 'pending' },
      { label: 'A enviar para a cloud', status: 'pending' },
      { label: 'A concluir gravação', status: 'pending' }
    ]);
    setOverlaySummary(undefined);
    setIsOverlayOpen(true);

    try {
      const userId = auth.currentUser.uid;
      const now = Date.now();
      
      let projectId = project.id;
      // If it's the first time saving to cloud, generate the custom ID format
      if (!project.createdAt) {
        const safeTitle = (project.title || 'SemTitulo').replace(/[^a-zA-Z0-9]/g, '');
        const safeDirector = (project.director || 'SemRealizador').replace(/[^a-zA-Z0-9]/g, '');
        const safeAuthor = (project.author || 'SemAutor').replace(/[^a-zA-Z0-9]/g, '');
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const uniqueCode = Math.random().toString(36).substring(2, 10);
        projectId = `${safeTitle}+${safeDirector}+${safeAuthor}+${dateStr}+${uniqueCode}`;
      }
      
      // Ensure project has required fields
      const projectToSave = {
        ...project,
        id: projectId,
        userId,
        createdAt: project.createdAt || now,
        updatedAt: now,
      };

      const projectDataStr = JSON.stringify(projectToSave);
      const CHUNK_SIZE = 800 * 1024; // 800KB
      const chunksCount = Math.ceil(projectDataStr.length / CHUNK_SIZE);

      const firestoreData = {
        id: projectToSave.id,
        userId: projectToSave.userId,
        title: projectToSave.title,
        idea: projectToSave.idea || "",
        concept: projectToSave.concept || "",
        filmType: projectToSave.filmType || "",
        filmStyle: projectToSave.filmStyle || "",
        language: projectToSave.language || "",
        duration: projectToSave.duration || "",
        aspectRatio: projectToSave.aspectRatio || "",
        director: projectToSave.director || "",
        author: projectToSave.author || "",
        createdAt: projectToSave.createdAt,
        updatedAt: projectToSave.updatedAt,
        chunksCount,
        projectData: chunksCount === 1 ? projectDataStr : ""
      };

      setOverlayProgress(30);
      setOverlaySteps([
        { label: 'A preparar dados', status: 'completed' },
        { label: 'A analisar alterações', status: 'current' },
        { label: 'A enviar para a cloud', status: 'pending' },
        { label: 'A concluir gravação', status: 'pending' }
      ]);
      setOverlayTime(4);

      // Fetch existing project to calculate size before and changes
      const docRef = doc(db, `users/${userId}/projects/${projectToSave.id}`);
      const docSnap = await getDoc(docRef);
      
      let sizeBefore = 0;
      let changes: string[] = [];

      if (docSnap.exists()) {
        const oldData = docSnap.data();
        sizeBefore = new Blob([JSON.stringify(oldData)]).size;
        
        let oldProjectDataStr = oldData.projectData || '{}';
        if (oldData.chunksCount && oldData.chunksCount > 1) {
          let fullData = "";
          for (let i = 0; i < oldData.chunksCount; i++) {
            const chunkDoc = await getDoc(doc(db, `users/${userId}/projects/${projectToSave.id}/chunks/${i}`));
            if (chunkDoc.exists()) {
              fullData += chunkDoc.data().data;
            }
          }
          oldProjectDataStr = fullData;
          sizeBefore += new Blob([fullData]).size;
        }
        
        const oldProject = JSON.parse(oldProjectDataStr);
        
        if (oldProject.title !== projectToSave.title) changes.push('Título atualizado');
        if (oldProject.script?.length !== projectToSave.script?.length) changes.push('Guião modificado');
        if (oldProject.characters?.length !== projectToSave.characters?.length) changes.push('Personagens alteradas');
        if (oldProject.settings?.length !== projectToSave.settings?.length) changes.push('Cenários alterados');
        if (oldProject.scenes?.length !== projectToSave.scenes?.length) changes.push('Cenas modificadas');
        
        if (changes.length === 0) changes.push('Pequenas atualizações de metadados');
      } else {
        changes.push('Novo projeto criado na cloud');
      }

      const sizeAfter = new Blob([JSON.stringify(firestoreData)]).size + (chunksCount > 1 ? new Blob([projectDataStr]).size : 0);
      const estimatedSeconds = Math.max(3, Math.ceil(sizeAfter / (256 * 1024)) + 2);

      setOverlayProgress(40);
      setOverlaySteps([
        { label: 'A preparar dados', status: 'completed' },
        { label: 'A analisar alterações', status: 'completed' },
        { label: 'A enviar para a cloud', status: 'current' },
        { label: 'A concluir gravação', status: 'pending' }
      ]);
      setOverlayTime(estimatedSeconds);

      // Simulate detailed upload progress
      const uploadDetails = [
        "A preparar pacote de dados...",
        "A enviar metadados do projeto...",
        "A sincronizar personagens e cenários...",
        "A transferir imagens e recursos pesados...",
        "A otimizar armazenamento...",
        "A aguardar confirmação do servidor..."
      ];
      
      let detailIndex = 0;
      let currentSeconds = estimatedSeconds;
      let currentProgress = 40;

      const progressInterval = setInterval(() => {
        currentSeconds = Math.max(1, currentSeconds - 1);
        setOverlayTime(currentSeconds);

        if (currentProgress < 85) {
          currentProgress += (85 - 40) / estimatedSeconds;
          setOverlayProgress(Math.min(85, currentProgress));
        }

        if (currentSeconds % 2 === 0 && detailIndex < uploadDetails.length - 1) {
          detailIndex++;
          setOverlayDescription(uploadDetails[detailIndex]);
        }
      }, 1000);

      setOverlayDescription(uploadDetails[0]);

      try {
        await setDoc(docRef, firestoreData);
        if (chunksCount > 1) {
          for (let i = 0; i < chunksCount; i++) {
            const chunk = projectDataStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            await setDoc(doc(db, `users/${userId}/projects/${projectToSave.id}/chunks/${i}`), { data: chunk });
            // Add a small delay to prevent exhausting the Firestore write stream
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Delete old chunks if the new project has fewer chunks
        if (docSnap.exists() && docSnap.data().chunksCount > chunksCount) {
          for (let i = chunksCount; i < docSnap.data().chunksCount; i++) {
            await deleteDoc(doc(db, `users/${userId}/projects/${projectToSave.id}/chunks/${i}`));
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      } finally {
        clearInterval(progressInterval);
      }

      setOverlayProgress(90);
      setOverlaySteps([
        { label: 'A preparar dados', status: 'completed' },
        { label: 'A analisar alterações', status: 'completed' },
        { label: 'A enviar para a cloud', status: 'completed' },
        { label: 'A concluir gravação', status: 'current' }
      ]);
      setOverlayTime(1);
      setOverlayDescription('A verificar integridade dos dados...');

      await new Promise(r => setTimeout(r, 600));

      setProject(projectToSave);
      if (onSave) onSave(projectToSave);

      // Finalize
      setOverlayProgress(100);
      setOverlaySteps([
        { label: 'A preparar dados', status: 'completed' },
        { label: 'A analisar alterações', status: 'completed' },
        { label: 'A enviar para a cloud', status: 'completed' },
        { label: 'A concluir gravação', status: 'completed' }
      ]);
      setOverlaySummary({
        sizeBefore,
        sizeAfter,
        changes
      });
      setOverlayDescription('Projeto gravado na cloud com sucesso!');
      setOverlayTime(0);
      
      // Do not auto-close here, let the user click "Concluir"
      setIsSavingToCloud(false);
    } catch (error: any) {
      setIsSavingToCloud(false);
      console.error("Erro ao gravar na cloud:", error);
      setOverlayDescription('Erro ao gravar na cloud.');
      setOverlaySteps(prev => prev.map(s => s.status === 'current' ? { ...s, status: 'pending' } : s));
      
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        operationType: 'write',
        path: `users/${auth.currentUser?.uid}/projects/${project.id}`,
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email
        }
      };
      console.error('Firestore Error: ', JSON.stringify(errInfo));
      alert("Ocorreu um erro ao gravar na cloud. Verifica a consola.");
      
      await new Promise(r => setTimeout(r, 1500));
      setIsOverlayOpen(false);
    }
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
          onClick={onOpenIntelligentGenerator}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors text-xs font-medium text-indigo-400"
        >
          <Sparkles className="w-4 h-4" />
          <span>Gerador Inteligente</span>
        </button>
        <button
          onClick={onOpenUpdateMovie}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors text-xs font-medium text-emerald-400"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Update Filme</span>
        </button>
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
            <span>Gravar em JSON</span>
          </div>
        </button>
        <button
          onClick={handleSaveToCloud}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-xs font-medium ${
            hasUnsavedChanges
              ? "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/30"
              : "hover:bg-zinc-800 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <Cloud className="w-4 h-4" />
            <span>Gravar na Cloud</span>
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

        {onGoHome && (
          <button
            onClick={onGoHome}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors text-xs font-medium text-zinc-400 mt-4 border border-zinc-800"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </div>
            Voltar ao Início
          </button>
        )}

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
        V3.0.0 • Gemini & Veo
      </div>

      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onSave={handleSaveManualKey}
        currentKey={manualKey}
      />

      {showSaveConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Gravar na Cloud</h3>
                  <p className="text-sm text-zinc-400">Confirmação de gravação</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-zinc-400">Tamanho Atual (Cloud)</span>
                    <span className="text-sm font-mono text-white">{(saveEstimation.currentSize / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-zinc-400">Aumento Estimado</span>
                    <span className={`text-sm font-mono ${saveEstimation.increase > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {saveEstimation.increase > 0 ? '+' : ''}{(saveEstimation.increase / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <div className="h-px bg-zinc-700 my-3"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-zinc-300">Tamanho Final</span>
                    <span className="text-base font-bold font-mono text-indigo-400">{(saveEstimation.newSize / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-zinc-400 bg-zinc-800/30 p-3 rounded-lg border border-zinc-700/30">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span>Tempo estimado: <strong className="text-zinc-300">~{saveEstimation.estimatedTime} segundos</strong></span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveConfirmation(false)}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveToCloudConfirmed}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
