import React, { useState, useEffect } from "react";
import { Project, AutomationPhase, AutomationStatus } from "../types";
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Circle, 
  Loader2, 
  FastForward,
  AlertCircle,
  X,
  Settings as SettingsIcon,
  Film,
  Image as ImageIcon,
  FileText,
  Clapperboard,
  Video,
  Zap
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { 
  generateImage, 
  generateVideo, 
  pollVideoOperation,
  getGenAI
} from "../services/geminiService";

interface MassProductionOverlayProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  onClose: () => void;
  setStep: (step: number) => void;
}

const PHASES = [
  { id: 1, name: "Guião, Personagens e Cenários (Texto)", icon: FileText },
  { id: 2, name: "Personagens e Cenários (Imagens)", icon: ImageIcon },
  { id: 3, name: "Cenas e Takes (Texto)", icon: Clapperboard },
  { id: 4, name: "Takes (Imagens)", icon: ImageIcon },
  { id: 5, name: "Takes (Vídeos)", icon: Video },
  { id: 6, name: "Intro e Créditos (Vídeos)", icon: Zap },
  { id: 7, name: "Montagem Final do Filme", icon: Film },
];

const COST_TEXT = 0.01;
const COST_IMAGE = 0.05;
const COST_VIDEO = 0.50;

export default function MassProductionOverlay({ project, setProject, onClose, setStep }: MassProductionOverlayProps) {
  const automation = project.automation || {
    currentPhase: 1,
    status: "idle",
    autoMode: false,
    progress: 0,
    logs: ["Pronto para iniciar a produção em massa."],
    totalCost: project.automation?.totalCost || 0
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const updateAutomation = (updates: Partial<typeof automation>) => {
    setProject((prev) => ({
      ...prev,
      automation: prev.automation 
        ? { ...prev.automation, ...updates } 
        : { ...automation, ...updates }
    }));
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setProject((prev) => {
      const currentAutomation = prev.automation || automation;
      return {
        ...prev,
        automation: {
          ...currentAutomation,
          logs: [`[${timestamp}] ${message}`, ...currentAutomation.logs].slice(0, 50)
        }
      };
    });
  };

  const addCost = (amount: number) => {
    setProject((prev) => {
      const currentAutomation = prev.automation || automation;
      return {
        ...prev,
        automation: {
          ...currentAutomation,
          totalCost: (currentAutomation.totalCost || 0) + amount
        }
      };
    });
  };

  const startAutomation = (autoMode: boolean) => {
    updateAutomation({ status: "running", autoMode });
    addLog(`Iniciando Fase ${automation.currentPhase} em modo ${autoMode ? "Automático" : "Manual"}.`);
  };

  const pauseAutomation = () => {
    updateAutomation({ status: "paused" });
    addLog("Produção pausada pelo utilizador.");
  };

  const resumeAutomation = () => {
    updateAutomation({ status: "running" });
    addLog("Retomando produção...");
  };

  const validatePhase = () => {
    if (automation.currentPhase < 7) {
      const nextPhase = (automation.currentPhase + 1) as AutomationPhase;
      updateAutomation({ 
        currentPhase: nextPhase, 
        status: automation.autoMode ? "running" : "idle",
        progress: 0
      });
      addLog(`Fase ${automation.currentPhase} validada. Seguindo para Fase ${nextPhase}.`);
    } else {
      updateAutomation({ status: "completed", progress: 100 });
      addLog("Produção em massa concluída com sucesso!");
    }
  };

  const runPhaseLogic = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const ai = getGenAI();
      
      if (automation.currentPhase === 1) {
        addLog("Gerando Guião, Personagens e Cenários...");
        updateAutomation({ progress: 10 });
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Cria um guião de curta metragem, 3 personagens principais, 2 cenários e prompts para Intro e Créditos Finais para um filme com o título "${project.title}", ideia "${project.idea}" e conceito "${project.concept}". Estilo: ${project.filmStyle}. Tipo: ${project.filmType}. 
          Para cada personagem, define também as características da sua voz para dobragem (língua/país, idade aproximada e personalidade vocal).
          Responde em JSON com campos: script, characters (array de {name, description, voice: {language, country, age, personality}}), settings (array de {name, description}), introPrompt (string), outroPrompt (string).`,
          config: { responseMimeType: "application/json" }
        });
        addCost(COST_TEXT);

        const data = JSON.parse(response.text || "{}");
        
        setProject((prev) => ({
          ...prev,
          script: data.script || prev.script,
          intro: { ...prev.intro, type: "cinematic", prompt: data.introPrompt || "" },
          outro: { ...prev.outro, type: "scrolling", prompt: data.outroPrompt || "" },
          characters: (data.characters || []).map((c: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            name: c.name,
            description: c.description,
            voice: c.voice
          })),
          settings: (data.settings || []).map((s: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            name: s.name,
            description: s.description
          })),
          automation: {
            ...prev.automation!,
            progress: 100,
            status: prev.automation!.autoMode ? "running" : "waiting_validation"
          }
        }));
        
        addLog("Fase 1 concluída: Texto gerado.");
        if (automation.autoMode) validatePhase();
      } 
      else if (automation.currentPhase === 2) {
        addLog("Gerando imagens para Personagens e Cenários...");
        
        const totalItems = project.characters.length + project.settings.length;
        if (totalItems === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Nenhum personagem ou cenário para gerar imagens.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;

        // Generate Character Images
        for (const char of project.characters) {
          if (!char.imageUrl) {
            addLog(`Gerando imagem para personagem: ${char.name}...`);
            const prompt = `Personagem de animação: ${char.name}. Descrição: ${char.description}. Estilo: ${project.filmStyle}. Tipo: ${project.filmType}.`;
            const imageUrl = await generateImage(prompt, "1:1");
            addCost(COST_IMAGE);
            
            setProject(prev => ({
              ...prev,
              characters: prev.characters.map(c => c.id === char.id ? { ...c, imageUrl, updatedAt: Date.now() } : c)
            }));
          }
          completed++;
          updateAutomation({ progress: Math.round((completed / totalItems) * 100) });
        }

        // Generate Setting Images
        for (const setting of project.settings) {
          if (!setting.imageUrl) {
            addLog(`Gerando imagem para cenário: ${setting.name}...`);
            const prompt = `Concept art environment design for an animated film. 
              Location Name: ${setting.name}. 
              Description: ${setting.description}. 
              Estilo: ${project.filmStyle}. 
              Tipo: ${project.filmType}.
              CRITICAL: NO CHARACTERS, NO PEOPLE, NO ANIMALS. Just the empty environment/location.`;
            const imageUrl = await generateImage(prompt, "16:9");
            addCost(COST_IMAGE);
            
            setProject(prev => ({
              ...prev,
              settings: prev.settings.map(s => s.id === setting.id ? { ...s, imageUrl, updatedAt: Date.now() } : s)
            }));
          }
          completed++;
          updateAutomation({ progress: Math.round((completed / totalItems) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 2 concluída: Todas as imagens base geradas.");
        
        // Generate Intro/Outro Images if prompts exist
        if (project.intro?.prompt && !project.intro.imageUrl) {
          addLog("Gerando imagem para Intro...");
          const introUrl = await generateImage(project.intro.prompt, "16:9");
          addCost(COST_IMAGE);
          setProject(prev => ({ ...prev, intro: { ...prev.intro!, imageUrl: introUrl } }));
        }
        if (project.outro?.prompt && !project.outro.imageUrl) {
          addLog("Gerando imagem para Créditos...");
          const outroUrl = await generateImage(project.outro.prompt, "16:9");
          addCost(COST_IMAGE);
          setProject(prev => ({ ...prev, outro: { ...prev.outro!, imageUrl: outroUrl } }));
        }

        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 3) {
        addLog("Gerando Cenas e Takes para todo o filme...");
        updateAutomation({ progress: 10 });

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Com base no guião: "${project.script}", cria uma lista de cenas e takes detalhados. Responde em JSON com um array "scenes" onde cada cena tem "title", "description" e um array "takes" com "action", "camera", "sound", "music", "dialogue".`,
          config: { responseMimeType: "application/json" }
        });
        addCost(COST_TEXT);

        const data = JSON.parse(response.text || "{}");
        
        setProject((prev) => ({
          ...prev,
          scenes: (data.scenes || []).map((scene: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            title: scene.title,
            description: scene.description,
            takes: (scene.takes || []).map((take: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              action: take.action,
              camera: take.camera,
              sound: take.sound,
              music: take.music,
              dialogue: take.dialogue
            }))
          })),
          automation: {
            ...prev.automation!,
            progress: 100,
            status: prev.automation!.autoMode ? "running" : "waiting_validation"
          }
        }));

        addLog("Fase 3 concluída: Cenas e Takes gerados.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 4) {
        addLog("Gerando frames (inicial e final) para todos os Takes...");
        
        const allTakes: { sceneId: string, takeId: string, action: string, camera: string, charIds?: string[], settingId?: string }[] = [];
        project.scenes.forEach(scene => {
          scene.takes.forEach(take => {
            allTakes.push({ 
              sceneId: scene.id, 
              takeId: take.id, 
              action: take.action, 
              camera: take.camera,
              charIds: take.characterIds,
              settingId: take.settingId
            });
          });
        });

        if (allTakes.length === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Nenhum take encontrado para gerar frames.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;
        for (const tInfo of allTakes) {
          addLog(`Processando frames para Take ${completed + 1}/${allTakes.length}...`);
          
          const scene = project.scenes.find(s => s.id === tInfo.sceneId);
          const take = scene?.takes.find(t => t.id === tInfo.takeId);
          
          if (take) {
            const takeCharacters = project.characters.filter(c => tInfo.charIds?.includes(c.id));
            const takeSetting = project.settings.find(s => s.id === tInfo.settingId);
            
            const referenceImages: string[] = [];
            if (takeSetting?.imageUrl) referenceImages.push(takeSetting.imageUrl);
            takeCharacters.forEach(c => { if (c.imageUrl) referenceImages.push(c.imageUrl); });

            const promptBase = `Animação ${project.filmType}, Estilo ${project.filmStyle}. Cena: ${scene?.title}. Ação: ${take.action}. Câmara: ${take.camera}.`;

            if (!take.startFrameUrl) {
              const startFrameUrl = await generateImage(`${promptBase} Frame Inicial.`, "16:9", referenceImages);
              addCost(COST_IMAGE);
              setProject(prev => ({
                ...prev,
                scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
                  ...s,
                  takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, startFrameUrl, updatedAt: Date.now() } : t)
                } : s)
              }));
            }

            if (!take.endFrameUrl) {
              const endFrameUrl = await generateImage(`${promptBase} Frame Final.`, "16:9", referenceImages);
              addCost(COST_IMAGE);
              setProject(prev => ({
                ...prev,
                scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
                  ...s,
                  takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, endFrameUrl, updatedAt: Date.now() } : t)
                } : s)
              }));
            }
          }

          completed++;
          updateAutomation({ progress: Math.round((completed / allTakes.length) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 4 concluída: Todos os frames gerados.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 5) {
        addLog("Renderizando vídeos para todos os Takes...");
        
        const allTakes: { sceneId: string, takeId: string, action: string, camera: string, start: string, end: string }[] = [];
        project.scenes.forEach(scene => {
          scene.takes.forEach(take => {
            if (take.startFrameUrl && take.endFrameUrl && !take.videoUrl) {
              allTakes.push({ 
                sceneId: scene.id, 
                takeId: take.id, 
                action: take.action, 
                camera: take.camera,
                start: take.startFrameUrl,
                end: take.endFrameUrl
              });
            }
          });
        });

        if (allTakes.length === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Nenhum take com frames prontos para vídeo.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;
        
        // Check if API key is selected before starting video phase (system or manual)
        const hasManualKey = !!localStorage.getItem('GEMINI_API_KEY_MANUAL');
        const hasSystemKey = await (window as any).aistudio?.hasSelectedApiKey?.();
        
        if (!hasManualKey && !hasSystemKey) {
          if ((window as any).aistudio?.openSelectKey) {
            addLog("Aguardando configuração de Chave API para vídeos...");
            await (window as any).aistudio.openSelectKey();
          } else {
            addLog("ERRO: Chave API não configurada.");
            alert("Por favor, configura a tua Chave API Gemini primeiro (Sistema ou Manual no Menu Lateral).");
            updateAutomation({ status: "idle" });
            return;
          }
        }

        for (const tInfo of allTakes) {
          addLog(`Renderizando vídeo para Take ${completed + 1}/${allTakes.length}...`);
          
          const prompt = `Animação ${project.filmType}, Estilo ${project.filmStyle}. Ação: ${tInfo.action}. Câmara: ${tInfo.camera}.`;
          const operation = await generateVideo(prompt, tInfo.start, tInfo.end);
          addCost(COST_VIDEO);
          
          // Update operation ID
          setProject(prev => ({
            ...prev,
            scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
              ...s,
              takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, videoOperationId: operation.name } : t)
            } : s)
          }));

          // Poll for result
          const videoUrl = await pollVideoOperation(operation.name);
          
          // Update final video URL
          setProject(prev => ({
            ...prev,
            scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
              ...s,
              takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, videoUrl, videoOperationId: undefined } : t)
            } : s)
          }));

          completed++;
          updateAutomation({ progress: Math.round((completed / allTakes.length) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 5 concluída: Todos os vídeos dos takes renderizados.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 6) {
        addLog("Iniciando Fase 6: Renderização de Intro e Créditos...");
        updateAutomation({ progress: 10 });

        // Generate Intro Video if image exists
        if (project.intro?.imageUrl && !project.intro.videoUrl) {
          addLog("Renderizando vídeo para Intro...");
          const op = await generateVideo(project.intro.prompt, project.intro.imageUrl);
          addCost(COST_VIDEO);
          const vUrl = await pollVideoOperation(op.name);
          setProject(prev => ({ ...prev, intro: { ...prev.intro!, videoUrl: vUrl } }));
        }
        updateAutomation({ progress: 50 });

        // Generate Outro Video if image exists
        if (project.outro?.imageUrl && !project.outro.videoUrl) {
          addLog("Renderizando vídeo para Créditos...");
          const op = await generateVideo(project.outro.prompt, project.outro.imageUrl);
          addCost(COST_VIDEO);
          const vUrl = await pollVideoOperation(op.name);
          setProject(prev => ({ ...prev, outro: { ...prev.outro!, videoUrl: vUrl } }));
        }
        
        updateAutomation({ progress: 100 });
        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 6 concluída: Intro e Créditos renderizados.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 7) {
        addLog("Iniciando Montagem Final do Filme...");
        updateAutomation({ progress: 50 });
        
        // Simulate assembly
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        updateAutomation({ progress: 100, status: "completed" });
        addLog("Fase 7 concluída: Filme montado e pronto para visualização!");
        
        // Auto-navigate to Preview step if in auto mode
        if (automation.autoMode) {
          setStep(8);
        }
      }
    } catch (error) {
      addLog(`Erro na Fase ${automation.currentPhase}: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      updateAutomation({ status: "paused" });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (automation.status === "running" && !isProcessing) {
      runPhaseLogic();
    }
  }, [automation.status, automation.currentPhase]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-bottom border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <SettingsIcon className="w-6 h-6 text-white animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Realização Filme em Massa</h2>
              <p className="text-xs text-zinc-400">Automatização inteligente de produção cinematográfica</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar Phases */}
          <div className="w-72 border-right border-zinc-800 p-4 space-y-2 bg-zinc-900/30">
            {PHASES.map((phase) => {
              const Icon = phase.icon;
              const isActive = automation.currentPhase === phase.id;
              const isCompleted = automation.currentPhase > phase.id || automation.status === "completed";
              
              return (
                <div 
                  key={phase.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isActive ? "bg-indigo-600/10 border border-indigo-500/50 text-white" : 
                    isCompleted ? "text-emerald-500" : "text-zinc-500"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive ? "bg-indigo-600 text-white" : 
                    isCompleted ? "bg-emerald-500/20 text-emerald-500" : "bg-zinc-800 text-zinc-600"
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold leading-tight">{phase.name}</p>
                    {isActive && (
                      <span className="text-[10px] uppercase tracking-wider font-medium opacity-70">
                        {automation.status === "running" ? "Em curso..." : 
                         automation.status === "paused" ? "Pausado" : 
                         automation.status === "waiting_validation" ? "Validar" : "Pendente"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
            {/* Status Card */}
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">
                  Fase {automation.currentPhase}: {PHASES[automation.currentPhase - 1].name}
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Custo Estimado</span>
                    <span className="text-emerald-400 font-mono font-bold text-lg">
                      ${(automation.totalCost || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {automation.status === "running" && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      automation.status === "running" ? "bg-indigo-500/20 text-indigo-400" :
                      automation.status === "paused" ? "bg-amber-500/20 text-amber-400" :
                      automation.status === "waiting_validation" ? "bg-emerald-500/20 text-emerald-400" :
                      automation.status === "completed" ? "bg-emerald-500 text-white" : "bg-zinc-700 text-zinc-400"
                    }`}>
                      {automation.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-400">Progresso da Fase</span>
                  <span className="text-white">{automation.progress}%</span>
                </div>
                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-700">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                    style={{ width: `${automation.progress}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="mt-8 flex flex-wrap gap-4">
                {automation.status === "idle" && (
                  <>
                    <button 
                      onClick={() => startAutomation(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
                    >
                      <FastForward className="w-5 h-5" />
                      Modo 100% Automático
                    </button>
                    <button 
                      onClick={() => startAutomation(false)}
                      className="flex-1 flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white px-6 py-3 rounded-xl font-bold transition-all"
                    >
                      <Play className="w-5 h-5" />
                      Modo com Validação
                    </button>
                  </>
                )}

                {automation.status === "running" && (
                  <button 
                    onClick={pauseAutomation}
                    className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
                  >
                    <Pause className="w-5 h-5" />
                    Pausar Produção
                  </button>
                )}

                {automation.status === "paused" && (
                  <button 
                    onClick={resumeAutomation}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
                  >
                    <Play className="w-5 h-5" />
                    Continuar Produção
                  </button>
                )}

                {automation.status === "waiting_validation" && (
                  <button 
                    onClick={validatePhase}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Validar e Seguir para Fase {automation.currentPhase + 1}
                  </button>
                )}

                {automation.status === "completed" && (
                  <button 
                    onClick={() => {
                      setStep(8);
                      onClose();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Concluir e Ver Filme
                  </button>
                )}
              </div>
            </div>

            {/* Logs */}
            <div className="flex-1 flex flex-col bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-2 border-bottom border-zinc-800 bg-zinc-900 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Consola de Produção</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500/50" />
                  <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                </div>
              </div>
              <div className="flex-1 p-4 font-mono text-xs space-y-1 overflow-y-auto">
                {automation.logs.map((log, i) => (
                  <div key={i} className={i === 0 ? "text-indigo-400" : "text-zinc-500"}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-zinc-950 border-top border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Pode fechar esta janela a qualquer momento para verificar os menus. O progresso será mantido.
            </span>
          </div>
          <span className="font-mono">K-ANIMAKER PRO v2.5.0</span>
        </div>
      </div>
    </div>
  );
}
