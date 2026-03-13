import React, { useState, useEffect } from "react";
import { Project, AutomationPhase, AutomationStatus, VideoModel } from "../types";
import { AUTOMATION_PHASES } from "../constants";
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
  Zap,
  Settings2
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { 
  generateImage, 
  generateVideo, 
  pollVideoOperation,
  getGenAI,
  generateNarrationText,
  generateNarrationAudio,
  generateSubtitles,
  getVoiceForSettings,
  detectCharacters,
  detectSetting
} from "../services/geminiService";

interface MassProductionOverlayProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  onClose: () => void;
  setStep: (step: number) => void;
}

const PHASES = AUTOMATION_PHASES;

const COST_TEXT = 0.01;
const COST_IMAGE = 0.05;
const COST_VIDEO = 0.50;

export default function MassProductionOverlay({ project, setProject, onClose, setStep }: MassProductionOverlayProps) {
  const automation = project.automation || {
    currentPhase: 1,
    status: "idle",
    autoMode: false,
    progress: 0,
    currentTask: "",
    logs: ["Pronto para iniciar a produção em massa."],
    totalCost: project.automation?.totalCost || 0
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [globalVideoModel, setGlobalVideoModel] = useState<VideoModel>(project.videoModel || 'flow');
  const [showInternalSettings, setShowInternalSettings] = useState(false);

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
    const enabledPhases = project.automation?.enabledPhases || PHASES.map(p => p.id);
    let phaseToStart = automation.currentPhase;
    
    if (!enabledPhases.includes(phaseToStart)) {
      const nextPhases = enabledPhases.filter(id => id > phaseToStart);
      if (nextPhases.length > 0) {
        phaseToStart = nextPhases[0] as AutomationPhase;
      } else if (enabledPhases.length > 0) {
        phaseToStart = enabledPhases[0] as AutomationPhase;
      }
    }

    updateAutomation({ status: "running", autoMode, currentPhase: phaseToStart });
    addLog(`Iniciando Fase ${phaseToStart} em modo ${autoMode ? "Automático" : "Manual"}.`);
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
    const enabledPhases = project.automation?.enabledPhases || PHASES.map(p => p.id);
    const nextPhases = enabledPhases.filter(id => id > automation.currentPhase);

    if (nextPhases.length > 0) {
      const nextPhase = nextPhases[0] as AutomationPhase;
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

    const enabledPhases = project.automation?.enabledPhases || PHASES.map(p => p.id);
    if (!enabledPhases.includes(automation.currentPhase)) {
      addLog(`Fase ${automation.currentPhase} ignorada (não selecionada).`);
      validatePhase();
      return;
    }

    setIsProcessing(true);

    try {
      const ai = getGenAI();
      
      if (automation.currentPhase === 1) {
        addLog("Gerando Guião, Personagens e Cenários...");
        updateAutomation({ progress: 10 });
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Cria um guião de curta metragem, 3 personagens principais, 2 cenários e prompts para Intro e Créditos Finais para um filme com o seguinte contexto:
          - Título: "${project.title}"
          - Ideia: "${project.idea}"
          - Conceito: "${project.concept}"
          - Estilo: ${project.filmStyle}
          - Tipo: ${project.filmType}
          - Público Alvo: ${project.targetAudience || 'Adultos'}
          
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
        addLog("Gerando imagens principais para Personagens...");
        
        if (project.characters.length === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Nenhum personagem para gerar imagens.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;
        for (const char of project.characters) {
          if (!char.imageUrl) {
            addLog(`Gerando imagem principal para: ${char.name}...`);
            const prompt = `Personagem de animação: ${char.name}. Descrição: ${char.description}. Estilo: ${project.filmStyle}. Tipo: ${project.filmType}. Público Alvo: ${project.targetAudience || 'Adultos'}.`;
            const imageUrl = await generateImage(prompt, "1:1");
            addCost(COST_IMAGE);
            
            setProject(prev => ({
              ...prev,
              characters: prev.characters.map(c => c.id === char.id ? { ...c, imageUrl, lastImagePrompt: prompt, updatedAt: Date.now() } : c)
            }));
          }
          completed++;
          updateAutomation({ progress: Math.round((completed / project.characters.length) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 2 concluída: Imagens principais geradas.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 3) {
        addLog("Gerando vistas (views) para Personagens...");
        
        if (project.characters.length === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Nenhum personagem para gerar vistas.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;
        for (const char of project.characters) {
          if (!char.viewsImageUrl) {
            addLog(`Gerando vistas para: ${char.name}...`);
            const prompt = `Character sheet with multiple views (front, side, back) for an animated character. 
              Character: ${char.name}. 
              Description: ${char.description}. 
              Estilo: ${project.filmStyle}. 
              Tipo: ${project.filmType}.
              Público Alvo: ${project.targetAudience || 'Adultos'}.
              Maintain consistency with the character's design.`;
            
            const referenceImages = char.imageUrl ? [char.imageUrl] : [];
            const viewsImageUrl = await generateImage(prompt, "1:1", referenceImages);
            addCost(COST_IMAGE);
            
            setProject(prev => ({
              ...prev,
              characters: prev.characters.map(c => c.id === char.id ? { ...c, viewsImageUrl, lastViewsPrompt: prompt, updatedAt: Date.now() } : c)
            }));
          }
          completed++;
          updateAutomation({ progress: Math.round((completed / project.characters.length) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 3 concluída: Vistas dos personagens geradas.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 4) {
        addLog("Gerando imagens para Cenários...");
        
        if (project.settings.length === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Nenhum cenário para gerar imagens.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;
        for (const setting of project.settings) {
          if (!setting.imageUrl) {
            addLog(`Gerando imagem para cenário: ${setting.name}...`);
            const prompt = `Concept art environment design for an animated film. 
              Location Name: ${setting.name}. 
              Description: ${setting.description}. 
              Estilo: ${project.filmStyle}. 
              Tipo: ${project.filmType}.
              Público Alvo: ${project.targetAudience || 'Adultos'}.
              CRITICAL: NO CHARACTERS, NO PEOPLE, NO ANIMALS. Just the empty environment/location.`;
            const imageUrl = await generateImage(prompt, project.aspectRatio);
            addCost(COST_IMAGE);
            
            setProject(prev => ({
              ...prev,
              settings: prev.settings.map(s => s.id === setting.id ? { ...s, imageUrl, lastImagePrompt: prompt, updatedAt: Date.now() } : s)
            }));
          }
          completed++;
          updateAutomation({ progress: Math.round((completed / project.settings.length) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 4 concluída: Imagens dos cenários geradas.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 5) {
        addLog("Gerando Cenas e Takes para todo o filme...");
        updateAutomation({ progress: 10 });

        const charactersContext = project.characters
          .map((c) => `${c.name}: ${c.description}`)
          .join("\n");
        const settingsContext = project.settings
          .map((s) => `${s.name}: ${s.description}`)
          .join("\n");

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Com base no guião: "${project.script}", cria uma lista de cenas e takes detalhados. 
          
          Contexto de Personagens:
          ${charactersContext}
          
          Contexto de Cenários:
          ${settingsContext}

          Responde em JSON com um array "scenes" onde cada cena tem "title", "description" e um array "takes" com:
          - "action": descrição da ação
          - "camera": tipo de plano
          - "sound": som ambiente
          - "music": música
          - "dialogue": texto do diálogo geral (resumo)
          - "dialogueLines": array de objetos { "characterName": string, "text": string } para cada fala específica
          - "characterNames": array com nomes das personagens presentes (conforme contexto)
          - "settingName": nome do cenário onde ocorre (conforme contexto)`,
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
            takes: (scene.takes || []).map((take: any) => {
              const dialogueLines = (take.dialogueLines || []).map((dl: any) => {
                const char = project.characters.find(c => 
                  c.name.toLowerCase() === dl.characterName?.toLowerCase() || 
                  dl.characterName?.toLowerCase().includes(c.name.toLowerCase())
                );
                return {
                  characterId: char?.id || "",
                  text: dl.text
                };
              }).filter((dl: any) => dl.characterId !== "");

              const charIds = detectCharacters(take.action, dialogueLines, take.characterNames || [], project.characters);
              const settingId = detectSetting(take.action, take.settingName, project.settings);
              
              return {
                id: Math.random().toString(36).substr(2, 9),
                action: take.action,
                camera: take.camera,
                sound: take.sound,
                music: take.music,
                dialogue: take.dialogue,
                dialogueLines: dialogueLines,
                characterIds: charIds,
                settingId: settingId,
                duration: 5,
                updatedAt: Date.now()
              };
            })
          })),
          automation: {
            ...prev.automation!,
            progress: 100,
            status: prev.automation!.autoMode ? "running" : "waiting_validation"
          }
        }));

        addLog("Fase 5 concluída: Cenas e Takes gerados com identificação automática.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 6) {
        addLog("Gerando Frame Inicial para todos os Takes...");
        
        const allTakes: { sceneId: string, takeId: string, action: string, camera: string, charIds?: string[], settingId?: string }[] = [];
        project.scenes.forEach(scene => {
          scene.takes.forEach(take => {
            if (!take.startFrameUrl) {
              allTakes.push({ 
                sceneId: scene.id, 
                takeId: take.id, 
                action: take.action, 
                camera: take.camera,
                charIds: take.characterIds,
                settingId: take.settingId
              });
            }
          });
        });

        if (allTakes.length === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Todos os frames iniciais já existem ou nenhum take encontrado.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;
        for (const tInfo of allTakes) {
          addLog(`Processando Frame Inicial para Take ${completed + 1}/${allTakes.length}...`);
          
          const scene = project.scenes.find(s => s.id === tInfo.sceneId);
          const take = scene?.takes.find(t => t.id === tInfo.takeId);
          
          if (take) {
            const takeCharacters = project.characters.filter(c => tInfo.charIds?.includes(c.id));
            const takeSetting = project.settings.find(s => s.id === tInfo.settingId);
            
            const referenceImages: string[] = [];
            if (takeSetting?.imageUrl) referenceImages.push(takeSetting.imageUrl);
            takeCharacters.forEach(c => { if (c.imageUrl) referenceImages.push(c.imageUrl); });

            const prompt = `Animação ${project.filmType}, Estilo ${project.filmStyle}. Público Alvo: ${project.targetAudience || 'Adultos'}. Cena: ${scene?.title}. Ação: ${take.action}. Câmara: ${take.camera}. Frame Inicial.`;
            const startFrameUrl = await generateImage(prompt, project.aspectRatio, referenceImages);
            addCost(COST_IMAGE);
            
            setProject(prev => ({
              ...prev,
              scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
                ...s,
                takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, startFrameUrl, lastStartFramePrompt: prompt, updatedAt: Date.now() } : t)
              } : s)
            }));
          }

          completed++;
          updateAutomation({ progress: Math.round((completed / allTakes.length) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 6 concluída: Todos os frames iniciais gerados.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 7) {
        addLog("Gerando Frame Final para todos os Takes...");
        
        const allTakes: { sceneId: string, takeId: string, action: string, camera: string, charIds?: string[], settingId?: string, startFrame?: string }[] = [];
        project.scenes.forEach(scene => {
          scene.takes.forEach(take => {
            if (!take.endFrameUrl) {
              allTakes.push({ 
                sceneId: scene.id, 
                takeId: take.id, 
                action: take.action, 
                camera: take.camera,
                charIds: take.characterIds,
                settingId: take.settingId,
                startFrame: take.startFrameUrl
              });
            }
          });
        });

        if (allTakes.length === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Todos os frames finais já existem ou nenhum take encontrado.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;
        for (const tInfo of allTakes) {
          addLog(`Processando Frame Final para Take ${completed + 1}/${allTakes.length}...`);
          
          const scene = project.scenes.find(s => s.id === tInfo.sceneId);
          const take = scene?.takes.find(t => t.id === tInfo.takeId);
          
          if (take) {
            const takeCharacters = project.characters.filter(c => tInfo.charIds?.includes(c.id));
            const takeSetting = project.settings.find(s => s.id === tInfo.settingId);
            
            const referenceImages: string[] = [];
            if (takeSetting?.imageUrl) referenceImages.push(takeSetting.imageUrl);
            takeCharacters.forEach(c => { if (c.imageUrl) referenceImages.push(c.imageUrl); });
            if (tInfo.startFrame) referenceImages.push(tInfo.startFrame);

            const prompt = `Animação ${project.filmType}, Estilo ${project.filmStyle}. Público Alvo: ${project.targetAudience || 'Adultos'}. Cena: ${scene?.title}. Ação: ${take.action}. Câmara: ${take.camera}. Frame Final. Deve ser uma continuação coerente do frame inicial.`;
            const endFrameUrl = await generateImage(prompt, project.aspectRatio, referenceImages);
            addCost(COST_IMAGE);
            
            setProject(prev => ({
              ...prev,
              scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
                ...s,
                takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, endFrameUrl, lastEndFramePrompt: prompt, updatedAt: Date.now() } : t)
              } : s)
            }));
          }

          completed++;
          updateAutomation({ progress: Math.round((completed / allTakes.length) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 7 concluída: Todos os frames finais gerados.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 8) {
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
          const taskName = `Renderizando vídeo para Take ${completed + 1}/${allTakes.length}`;
          addLog(taskName);
          updateAutomation({ currentTask: taskName });
          
          const prompt = `Animação ${project.filmType}, Estilo ${project.filmStyle}. Público Alvo: ${project.targetAudience || 'Adultos'}. Ação: ${tInfo.action}. Câmara: ${tInfo.camera}.`;
          const operation = await generateVideo(prompt, tInfo.start, tInfo.end, globalVideoModel, project.aspectRatio);
          addCost(COST_VIDEO);
          
          // Update operation ID and prompt
          setProject(prev => ({
            ...prev,
            scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
              ...s,
              takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, videoOperationId: operation.name, lastVideoPrompt: prompt } : t)
            } : s)
          }));

          // Poll for result
          addLog(`A aguardar renderização do Take ${completed + 1}... (Isto pode demorar 2-5 minutos)`);
          const { videoUrl, videoObject } = await pollVideoOperation(operation);
          addLog(`Take ${completed + 1} renderizado com sucesso!`);
          
          // Update final video URL and object
          setProject(prev => ({
            ...prev,
            scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
              ...s,
              takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, videoUrl, videoObject, videoOperationId: undefined } : t)
            } : s)
          }));

          completed++;
          updateAutomation({ progress: Math.round((completed / allTakes.length) * 100), currentTask: "" });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 8 concluída: Todos os vídeos dos takes renderizados.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 9) {
        addLog("Iniciando Fase 9: Renderização de Intro e Créditos...");
        updateAutomation({ progress: 10 });

        // Generate Intro Video if image exists
        if (project.intro?.imageUrl && !project.intro.videoUrl) {
          addLog("Renderizando vídeo para Intro...");
          const op = await generateVideo(project.intro.prompt, project.intro.imageUrl, undefined, globalVideoModel, project.aspectRatio);
          addCost(COST_VIDEO);
          setProject(prev => ({ ...prev, intro: { ...prev.intro!, videoOperationId: op.name, lastVideoPrompt: project.intro!.prompt } }));
          const { videoUrl: vUrl, videoObject: vObj } = await pollVideoOperation(op);
          setProject(prev => ({ ...prev, intro: { ...prev.intro!, videoUrl: vUrl, videoObject: vObj, videoOperationId: undefined } }));
        }
        updateAutomation({ progress: 50 });

        // Generate Outro Video if image exists
        if (project.outro?.imageUrl && !project.outro.videoUrl) {
          addLog("Renderizando vídeo para Créditos...");
          const op = await generateVideo(project.outro.prompt, project.outro.imageUrl, undefined, globalVideoModel, project.aspectRatio);
          addCost(COST_VIDEO);
          setProject(prev => ({ ...prev, outro: { ...prev.outro!, videoOperationId: op.name, lastVideoPrompt: project.outro!.prompt } }));
          const { videoUrl: vUrl, videoObject: vObj } = await pollVideoOperation(op);
          setProject(prev => ({ ...prev, outro: { ...prev.outro!, videoUrl: vUrl, videoObject: vObj, videoOperationId: undefined } }));
        }
        
        updateAutomation({ progress: 100 });
        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 9 concluída: Intro e Créditos renderizados.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 10) {
        addLog("Iniciando Fase 10: Geração de Narração IA...");
        
        const allTakes: { sceneId: string, takeId: string, action: string, duration?: number }[] = [];
        project.scenes.forEach(scene => {
          scene.takes.forEach(take => {
            if (!take.narrationAudioUrl) {
              allTakes.push({ 
                sceneId: scene.id, 
                takeId: take.id, 
                action: take.action,
                duration: take.duration
              });
            }
          });
        });

        if (allTakes.length === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Todas as narrações já existem ou nenhum take encontrado.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;
        let currentNarrations: string[] = [];
        const voiceName = getVoiceForSettings(
          project.narrationSettings?.gender || 'female',
          project.narrationSettings?.ageGroup || 'adult'
        );

        for (const tInfo of allTakes) {
          addLog(`Gerando narração para Take ${completed + 1}/${allTakes.length}...`);
          
          const take = project.scenes.find(s => s.id === tInfo.sceneId)?.takes.find(t => t.id === tInfo.takeId);

          const text = await generateNarrationText(
            tInfo.action,
            project.language,
            `Filme: ${project.title}. Conceito: ${project.concept}. Público Alvo: ${project.targetAudience || 'Adultos'}`,
            currentNarrations,
            tInfo.duration || 5,
            take?.dialogueLines || [],
            project.characters
          );
          
          const audioUrl = await generateNarrationAudio(
            text, 
            voiceName,
            take?.dialogueLines || [],
            project.characters
          );
          currentNarrations.push(text);

          setProject(prev => ({
            ...prev,
            scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
              ...s,
              takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, narration: text, narrationAudioUrl: audioUrl, updatedAt: Date.now() } : t)
            } : s)
          }));

          completed++;
          updateAutomation({ progress: Math.round((completed / allTakes.length) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 10 concluída: Todas as narrações geradas.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 11) {
        addLog("Iniciando Fase 11: Geração de Legendas IA...");
        
        const allTakes: { sceneId: string, takeId: string, action: string, narration?: string, videoUrl?: string, audioUrl?: string }[] = [];
        project.scenes.forEach(scene => {
          scene.takes.forEach(take => {
            if (!take.dialogue) {
              allTakes.push({ 
                sceneId: scene.id, 
                takeId: take.id, 
                action: take.action,
                narration: take.narration,
                videoUrl: take.videoUrl,
                audioUrl: take.narrationAudioUrl
              });
            }
          });
        });

        if (allTakes.length === 0) {
          updateAutomation({ progress: 100, status: automation.autoMode ? "running" : "waiting_validation" });
          addLog("Todas as legendas já existem ou nenhum take encontrado.");
          if (automation.autoMode) validatePhase();
          return;
        }

        let completed = 0;
        for (const tInfo of allTakes) {
          addLog(`Gerando legendas para Take ${completed + 1}/${allTakes.length}...`);
          
          const text = await generateSubtitles(
            tInfo.action,
            tInfo.narration || "",
            project.language,
            `Filme: ${project.title}. Conceito: ${project.concept}. Público Alvo: ${project.targetAudience || 'Adultos'}`,
            tInfo.videoUrl,
            tInfo.audioUrl
          );

          setProject(prev => ({
            ...prev,
            scenes: prev.scenes.map(s => s.id === tInfo.sceneId ? {
              ...s,
              takes: s.takes.map(t => t.id === tInfo.takeId ? { ...t, dialogue: text, updatedAt: Date.now() } : t)
            } : s)
          }));

          completed++;
          updateAutomation({ progress: Math.round((completed / allTakes.length) * 100) });
        }

        updateAutomation({ status: automation.autoMode ? "running" : "waiting_validation" });
        addLog("Fase 11 concluída: Todas as legendas geradas.");
        if (automation.autoMode) validatePhase();
      }
      else if (automation.currentPhase === 12) {
        addLog("Iniciando Montagem Final do Filme...");
        updateAutomation({ progress: 50 });
        
        // Simulate assembly
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        updateAutomation({ progress: 100, status: "completed" });
        addLog("Fase 12 concluída: Filme montado e pronto para visualização!");
        
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInternalSettings(!showInternalSettings)}
              className={`p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${
                showInternalSettings ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
              title="Opções de Automatização"
            >
              <Settings2 className="w-5 h-5" />
              <span className="hidden md:inline">Opções</span>
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {showInternalSettings && (
          <div className="bg-zinc-800/80 border-b border-zinc-700 p-4 animate-in slide-in-from-top-2 duration-300">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Configuração de Fases</h4>
                <button 
                  onClick={() => {
                    const allPhases = PHASES.map(p => p.id);
                    const currentEnabled = project.automation?.enabledPhases || allPhases;
                    const newPhases = currentEnabled.length === allPhases.length ? [] : allPhases;
                    updateAutomation({ enabledPhases: newPhases });
                  }}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {(project.automation?.enabledPhases || PHASES.map(p => p.id)).length === PHASES.length ? "Desativar Todas" : "Ativar Todas"}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PHASES.map(phase => {
                  const isEnabled = (project.automation?.enabledPhases || PHASES.map(p => p.id)).includes(phase.id);
                  return (
                    <button
                      key={phase.id}
                      onClick={() => {
                        const current = project.automation?.enabledPhases || PHASES.map(p => p.id);
                        const next = current.includes(phase.id) ? current.filter(id => id !== phase.id) : [...current, phase.id].sort((a, b) => a - b);
                        updateAutomation({ enabledPhases: next });
                      }}
                      className={`flex items-center gap-2 p-2 rounded-lg text-[10px] font-medium transition-all border ${
                        isEnabled ? "bg-indigo-600/10 border-indigo-500/30 text-white" : "bg-zinc-900/50 border-zinc-800 text-zinc-500"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isEnabled ? "bg-indigo-500 border-indigo-500" : "border-zinc-700"}`}>
                        {isEnabled && <CheckCircle2 className="w-2 h-2 text-white" />}
                      </div>
                      <span className="truncate">{phase.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
                    isCompleted ? "text-emerald-500" : 
                    !(project.automation?.enabledPhases || PHASES.map(p => p.id)).includes(phase.id) ? "opacity-30 grayscale" :
                    "text-zinc-500"
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
                  {(automation.currentPhase === 5 || automation.currentPhase === 6 || automation.currentPhase === 7 || automation.currentPhase === 8) && automation.status === "idle" && (
                    <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-700">
                      <button
                        onClick={() => setGlobalVideoModel('veo-3.1')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                          globalVideoModel === 'veo-3.1'
                            ? "bg-indigo-600 text-white shadow-lg"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        VEO 3.1
                      </button>
                      <button
                        onClick={() => setGlobalVideoModel('veo-fast')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                          globalVideoModel === 'veo-fast'
                            ? "bg-amber-600 text-white shadow-lg"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        VEO FAST
                      </button>
                      <button
                        onClick={() => setGlobalVideoModel('flow')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                          globalVideoModel === 'flow'
                            ? "bg-emerald-600 text-white shadow-lg"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        FLOW
                      </button>
                    </div>
                  )}
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
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Progresso da Fase</span>
                    {automation.currentTask && (
                      <span className="text-indigo-400 animate-pulse flex items-center gap-1">
                        • {automation.currentTask}
                        {automation.currentPhase === 8 && (
                          <span className="ml-1 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[8px] font-bold uppercase">
                            Motor: {globalVideoModel === 'veo-3.1' ? 'Veo 3.1' : globalVideoModel === 'veo-fast' ? 'Veo Fast' : 'Flow'}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
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
                    Validar e Seguir para Próxima Fase
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
          <span className="font-mono">K-ANIMAKER PRO V3.0.0</span>
        </div>
      </div>
    </div>
  );
}
