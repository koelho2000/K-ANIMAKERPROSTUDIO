import React, { useState, useEffect } from "react";
import { Project, Scene, Take } from "../types";
import { 
  generateJSON,
  generateNarrationAudio,
  generateSubtitles,
  getVoiceForSettings,
  detectCharacters,
  detectSetting,
  extractDialogueLines,
  detectCharactersForDialogueLines
} from "../services/geminiService";
import {
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  X,
  Users,
  MapPin,
  Maximize2,
  Info,
  Zap,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Type } from "@google/genai";
import ProgressBar from "./ProgressBar";

interface ScenesProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function Scenes({ project, setProject }: ScenesProps) {
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [scenesProgress, setScenesProgress] = useState(0);
  const [generatingTakesId, setGeneratingTakesId] = useState<string | null>(
    null,
  );
  const [takesProgress, setTakesProgress] = useState(0);
  const [isGeneratingAllTakes, setIsGeneratingAllTakes] = useState(false);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [isAutoGeneratingDialogues, setIsAutoGeneratingDialogues] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [showCameraHelp, setShowCameraHelp] = useState(false);

  const getTargetCounts = () => {
    const sceneCounts = { low: 3, medium: 6, high: 12 };
    const takeCounts = { low: 2, medium: 4, high: 8 };
    
    const scenes = sceneCounts[project.sceneDetailLevel];
    const takes = takeCounts[project.takeDetailLevel];
    
    return { scenes, takes };
  };

  const { scenes: targetScenes, takes: targetTakes } = getTargetCounts();

  const cameraTypes = [
    { name: "Extreme Close-Up (ECU)", desc: "Foca num detalhe muito pequeno (ex: olhos)." },
    { name: "Close-Up (CU)", desc: "Foca no rosto da personagem para captar emoções." },
    { name: "Medium Shot (MS)", desc: "Personagem da cintura para cima. Equilíbrio entre sujeito e fundo." },
    { name: "Full Shot (FS)", desc: "Personagem de corpo inteiro, focando na ação física." },
    { name: "Wide Shot (WS)", desc: "Mostra a personagem e o ambiente envolvente." },
    { name: "Extreme Wide Shot (EWS)", desc: "Foco total no cenário, personagem minúscula ou ausente." },
    { name: "Low Angle", desc: "Câmara de baixo para cima, faz o sujeito parecer poderoso." },
    { name: "High Angle", desc: "Câmara de cima para baixo, faz o sujeito parecer vulnerável." },
    { name: "Bird's Eye View", desc: "Vista diretamente de cima, como um mapa." },
    { name: "Dolly / Tracking", desc: "A câmara move-se fisicamente acompanhando a ação." },
    { name: "Pan", desc: "A câmara roda horizontalmente num eixo fixo." },
    { name: "Tilt", desc: "A câmara roda verticalmente num eixo fixo." },
    { name: "Zoom In/Out", desc: "Aproximação ou afastamento ótico sem mover a câmara." },
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGeneratingScenes || isGeneratingAllTakes || isAutoDetecting || isAutoGeneratingDialogues) {
      setScenesProgress(0);
      interval = setInterval(() => {
        setScenesProgress((prev) => (prev >= 95 ? prev : prev + Math.random() * 8));
      }, 500);
    } else {
      setScenesProgress(100);
    }
    return () => clearInterval(interval);
  }, [isGeneratingScenes, isGeneratingAllTakes, isAutoDetecting, isAutoGeneratingDialogues]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generatingTakesId) {
      setTakesProgress(0);
      interval = setInterval(() => {
        setTakesProgress((prev) => (prev >= 95 ? prev : prev + Math.random() * 12));
      }, 400);
    } else {
      setTakesProgress(100);
    }
    return () => clearInterval(interval);
  }, [generatingTakesId]);

  const handleAutoDetectAll = () => {
    setIsAutoDetecting(true);
    setGlobalProgress(0);
    
    const totalTakes = project.scenes.reduce((acc, s) => acc + s.takes.length, 0);
    if (totalTakes === 0) {
      setIsAutoDetecting(false);
      return;
    }

    let processedTakes = 0;

    const updatedScenes = project.scenes.map((scene) => ({
      ...scene,
      takes: scene.takes.map((take) => {
        const charIds = detectCharacters(take.action, take.dialogueLines || [], [], project.characters);
        const settingId = detectSetting(take.action, undefined, project.settings);
        
        processedTakes++;
        setGlobalProgress(Math.round((processedTakes / totalTakes) * 100));
        
        return {
          ...take,
          characterIds: charIds,
          settingId: settingId || take.settingId
        };
      })
    }));

    setProject((prev) => ({ ...prev, scenes: updatedScenes }));
    setTimeout(() => setIsAutoDetecting(false), 1000);
  };

  const handleAutoGenerateAllDialogues = async () => {
    setIsAutoGeneratingDialogues(true);
    setGlobalProgress(0);

    const allTakes: { sceneId: string, takeId: string, action: string }[] = [];
    project.scenes.forEach(scene => {
      scene.takes.forEach(take => {
        allTakes.push({ sceneId: scene.id, takeId: take.id, action: take.action });
      });
    });

    if (allTakes.length === 0) {
      setIsAutoGeneratingDialogues(false);
      return;
    }

    let completed = 0;

    for (const tInfo of allTakes) {
      const lines = await extractDialogueLines(tInfo.action, project.characters);
      
      setProject(prev => ({
        ...prev,
        scenes: prev.scenes.map(s => {
          if (s.id === tInfo.sceneId) {
            return {
              ...s,
              takes: s.takes.map(t => {
                if (t.id === tInfo.takeId) {
                  return { ...t, dialogueLines: lines };
                }
                return t;
              })
            };
          }
          return s;
        })
      }));

      completed++;
      setGlobalProgress(Math.round((completed / allTakes.length) * 100));
    }

    setIsAutoGeneratingDialogues(false);
  };

  const handleGenerateScenes = async () => {
    setIsGeneratingScenes(true);
    try {
      const isPTPT = project.language === "Português (Portugal)";
      const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : project.language;
      
      const prompt = `
        Com base no seguinte guião de filme de animação, divide a história em exatamente ${targetScenes} cenas lógicas.
        Tipo de filme: ${project.filmType}
        Estilo de filme: ${project.filmStyle}
        Público Alvo: ${project.targetAudience || 'Adultos'}
        Língua: ${langSpec}
        Guião: ${project.script}
        
        ${isPTPT ? "IMPORTANTE: Todos os textos devem ser em Português de Portugal (ex: 'ecrã' em vez de 'tela')." : ""}
        IMPORTANTE: Deves gerar exatamente ${targetScenes} cenas para cumprir o nível de detalhe solicitado pelo utilizador.
      `;

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Título da cena (ex: Cena 1 - O Despertar)",
            },
            description: {
              type: Type.STRING,
              description: "Resumo do que acontece nesta cena",
            },
          },
          required: ["title", "description"],
        },
      };

      const result = await generateJSON(
        prompt,
        schema,
        "És um realizador de cinema a planear a estrutura do filme.",
      );
      const parsed = JSON.parse(result);

      const newScenes: Scene[] = parsed.map((s: any) => ({
        id: uuidv4(),
        title: s.title,
        description: s.description,
        takes: [],
      }));

      setProject({ ...project, scenes: newScenes });
      if (newScenes.length > 0) {
        setExpandedSceneId(newScenes[0].id);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar cenas.");
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const handleGenerateTakes = async (scene: Scene, silent = false) => {
    if (!silent) setGeneratingTakesId(scene.id);
    try {
      const isPTPT = project.language === "Português (Portugal)";
      const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : project.language;
      
      const charactersContext = project.characters
        .map((c) => `${c.name}: ${c.description}`)
        .join("\n");
      const settingsContext = project.settings
        .map((s) => `${s.name}: ${s.description}`)
        .join("\n");

      const prompt = `
        Para a seguinte cena de um filme de animação, divide-a em exatamente ${targetTakes} "takes" ou planos de câmara individuais.
        Cena: ${scene.title}
        Descrição: ${scene.description}
        Tipo de filme: ${project.filmType}
        Estilo de filme: ${project.filmStyle}
        Público Alvo: ${project.targetAudience || 'Adultos'}
        Língua: ${langSpec}
        
        ${isPTPT ? "IMPORTANTE: Todos os textos (acção, câmara, som, música, diálogo) devem ser em Português de Portugal." : ""}
        Contexto de Personagens:
        ${charactersContext}
        
        Contexto de Cenários:
        ${settingsContext}

        IMPORTANTE: Deves gerar exatamente ${targetTakes} takes para cumprir o nível de detalhe solicitado pelo utilizador.
        Para cada take, define a ação, o movimento/tipo de câmara, som ambiente, música e diálogo (se houver).
        Garante que as ações respeitam as descrições das personagens e cenários fornecidos.

        REGRAS DE IDENTIFICAÇÃO:
        1. Identifica TODAS as personagens que aparecem ou são mencionadas na 'ação' ou 'diálogo' de cada take.
        2. Coloca os nomes EXATOS das personagens (conforme fornecido no Contexto) na lista 'characterNames'.
        3. Identifica o cenário EXATO onde o take ocorre e coloca o seu nome em 'settingName'.
      `;

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              description: "Ação visual que acontece no plano",
            },
            camera: {
              type: Type.STRING,
              description:
                "Tipo de plano e movimento (ex: Close-up, Pan slowly to right)",
            },
            sound: {
              type: Type.STRING,
              description: "Efeitos sonoros e som ambiente",
            },
            music: { type: Type.STRING, description: "Indicações musicais" },
            dialogue: {
              type: Type.STRING,
              description: "Diálogo falado neste take (ou 'Nenhum')",
            },
            dialogueLines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  characterName: { type: Type.STRING },
                  text: { type: Type.STRING },
                },
                required: ["characterName", "text"],
              },
              description: "Linhas de diálogo com a personagem associada",
            },
            characterNames: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Nomes das personagens presentes neste take",
            },
            settingName: {
              type: Type.STRING,
              description: "Nome do cenário onde decorre este take",
            },
          },
          required: ["action", "camera", "sound", "music", "dialogue", "dialogueLines", "characterNames", "settingName"],
        },
      };

      const result = await generateJSON(
        prompt,
        schema,
        "És um realizador de cinema a criar uma storyboard detalhada.",
      );
      const parsed = JSON.parse(result);

      const newTakes: Take[] = parsed.map((t: any) => {
        const characterIds = detectCharacters(t.action, t.dialogueLines, t.characterNames || [], project.characters);
        const settingId = detectSetting(t.action, t.settingName, project.settings) || project.settings.find((s) => s.name === t.settingName)?.id;

        return {
          id: uuidv4(),
          action: t.action,
          camera: t.camera,
          sound: t.sound,
          music: t.music,
          dialogue: t.dialogue,
          dialogueLines: t.dialogueLines?.map((dl: any) => ({
            characterId: project.characters.find((c) => 
              c.name.toLowerCase() === dl.characterName?.toLowerCase() || 
              dl.characterName?.toLowerCase().includes(c.name.toLowerCase())
            )?.id || "",
            text: dl.text,
          })).filter((dl: any) => dl.characterId !== ""),
          characterIds,
          settingId,
          duration: 5, // Default duration
        };
      });

      return newTakes;
    } catch (error) {
      console.error(error);
      if (!silent) alert(`Erro ao gerar takes para a cena: ${scene.title}`);
      return null;
    } finally {
      if (!silent) setGeneratingTakesId(null);
    }
  };

  const handleGenerateAllTakes = async () => {
    setIsGeneratingAllTakes(true);
    try {
      const updatedScenes = [...project.scenes];
      for (let i = 0; i < updatedScenes.length; i++) {
        setScenesProgress((i / updatedScenes.length) * 100);
        const takes = await handleGenerateTakes(updatedScenes[i], true);
        if (takes) {
          updatedScenes[i] = { ...updatedScenes[i], takes };
        }
      }
      setProject({ ...project, scenes: updatedScenes });
      alert("Todos os takes foram gerados com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar todos os takes.");
    } finally {
      setIsGeneratingAllTakes(false);
      setScenesProgress(100);
    }
  };

  const onGenerateTakesForScene = async (scene: Scene) => {
    const takes = await handleGenerateTakes(scene);
    if (takes) {
      const updatedScenes = project.scenes.map((s) =>
        s.id === scene.id ? { ...s, takes } : s,
      );
      setProject({ ...project, scenes: updatedScenes });
      setExpandedSceneId(scene.id);
    }
  };

  const handleExtendScene = async (sceneId: string, percentage: number) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    const numNewTakes = Math.max(1, Math.round(scene.takes.length * (percentage / 100)));

    setGeneratingTakesId(sceneId);
    try {
      const charactersContext = project.characters
        .map((c) => `${c.name}: ${c.description}`)
        .join("\n");
      const settingsContext = project.settings
        .map((s) => `${s.name}: ${s.description}`)
        .join("\n");
      
      const currentTakesContext = scene.takes.map((t, i) => `Take ${i+1}: ${t.action}`).join("\n");

      const prompt = `
        Aumenta o detalhe da seguinte cena de um filme de animação, gerando exatamente ${numNewTakes} takes (planos de câmara) adicionais para tornar a cena mais rica e cinematográfica.
        
        Cena: ${scene.title}
        Descrição: ${scene.description}
        Tipo de filme: ${project.filmType}
        Estilo de filme: ${project.filmStyle}
        Público Alvo: ${project.targetAudience || 'Adultos'}
        
        Takes Atuais (para referência):
        ${currentTakesContext}

        Contexto de Personagens:
        ${charactersContext}
        
        Contexto de Cenários:
        ${settingsContext}

        Gera exatamente ${numNewTakes} novos takes que complementem os atuais ou que dividam a ação de forma mais detalhada. 
        Retorna APENAS os novos takes que devem ser ADICIONADOS à cena.

        REGRAS DE IDENTIFICAÇÃO:
        1. Identifica TODAS as personagens que aparecem ou são mencionadas na 'ação' ou 'diálogo' de cada take.
        2. Coloca os nomes EXATOS das personagens (conforme fornecido no Contexto) na lista 'characterNames'.
        3. Identifica o cenário EXATO onde o take ocorre e coloca o seu nome em 'settingName'.
      `;

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING },
            camera: { type: Type.STRING },
            sound: { type: Type.STRING },
            music: { type: Type.STRING },
            dialogue: { type: Type.STRING },
            dialogueLines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  characterName: { type: Type.STRING },
                  text: { type: Type.STRING },
                },
                required: ["characterName", "text"],
              },
            },
            characterNames: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            settingName: { type: Type.STRING },
          },
          required: ["action", "camera", "sound", "music", "dialogue", "dialogueLines", "characterNames", "settingName"],
        },
      };

      const result = await generateJSON(
        prompt,
        schema,
        "És um realizador de cinema a expandir uma storyboard para maior detalhe.",
      );
      const parsed = JSON.parse(result);

      const newTakes: Take[] = parsed.map((t: any) => {
        const characterIds = detectCharacters(t.action, t.dialogueLines, t.characterNames || [], project.characters);
        const settingId = detectSetting(t.action, t.settingName, project.settings) || project.settings.find((s) => s.name === t.settingName)?.id;

        return {
          id: uuidv4(),
          action: t.action,
          camera: t.camera,
          sound: t.sound,
          music: t.music,
          dialogue: t.dialogue,
          dialogueLines: t.dialogueLines?.map((dl: any) => ({
            characterId: project.characters.find((c) => 
              c.name.toLowerCase() === dl.characterName?.toLowerCase() || 
              dl.characterName?.toLowerCase().includes(c.name.toLowerCase())
            )?.id || "",
            text: dl.text,
          })).filter((dl: any) => dl.characterId !== ""),
          characterIds,
          settingId,
          duration: 5,
        };
      });

      const updatedScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: [...s.takes, ...newTakes],
          };
        }
        return s;
      });

      setProject({ ...project, scenes: updatedScenes });
      alert(`${newTakes.length} novos takes adicionados à cena!`);
    } catch (error) {
      console.error(error);
      alert("Erro ao estender a cena.");
    } finally {
      setGeneratingTakesId(null);
    }
  };

  const onRegenerateTake = async (sceneId: string, takeId: string) => {
    setGeneratingTakesId(takeId);
    try {
      const scene = project.scenes.find((s) => s.id === sceneId);
      const take = scene?.takes.find((t) => t.id === takeId);
      if (!scene || !take) return;

      const charactersContext = project.characters
        .map((c) => `${c.name}: ${c.description}`)
        .join("\n");
      const settingsContext = project.settings
        .map((s) => `${s.name}: ${s.description}`)
        .join("\n");

      const prompt = `
        Refina o seguinte take de um filme de animação.
        Cena: ${scene.title}
        Público Alvo: ${project.targetAudience || 'Adultos'}
        Take Atual:
        Ação: ${take.action}
        Câmara: ${take.camera}
        Diálogo: ${take.dialogue}
        
        Contexto de Personagens:
        ${charactersContext}
        
        Contexto de Cenários:
        ${settingsContext}

        Garante que o novo take é mais detalhado e respeita as descrições fornecidas.
        
        REGRAS DE IDENTIFICAÇÃO:
        1. Identifica TODAS as personagens que aparecem ou são mencionadas na 'ação' ou 'diálogo' de cada take.
        2. Coloca os nomes EXATOS das personagens (conforme fornecido no Contexto) na lista 'characterNames'.
        3. Identifica o cenário EXATO onde o take ocorre e coloca o seu nome em 'settingName'.
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          camera: { type: Type.STRING },
          sound: { type: Type.STRING },
          music: { type: Type.STRING },
          dialogue: { type: Type.STRING },
          dialogueLines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                characterName: { type: Type.STRING },
                text: { type: Type.STRING },
              },
              required: ["characterName", "text"],
            },
          },
          characterNames: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          settingName: { type: Type.STRING },
        },
        required: ["action", "camera", "sound", "music", "dialogue", "dialogueLines", "characterNames", "settingName"],
      };

      const result = await generateJSON(
        prompt,
        schema,
        "És um realizador de cinema a aperfeiçoar uma storyboard.",
      );
      const t = JSON.parse(result);
      const characterIds = detectCharacters(t.action, t.dialogueLines, t.characterNames || [], project.characters);
      const settingId = detectSetting(t.action, t.settingName, project.settings) || project.settings.find((s) => s.name === t.settingName)?.id;

      const updatedScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: s.takes.map((oldT) =>
              oldT.id === takeId
                ? {
                    ...oldT,
                    action: t.action,
                    camera: t.camera,
                    sound: t.sound,
                    music: t.music,
                    dialogue: t.dialogue,
                    dialogueLines: t.dialogueLines?.map((dl: any) => ({
                      characterId: project.characters.find((c) => 
                        c.name.toLowerCase() === dl.characterName?.toLowerCase() || 
                        dl.characterName?.toLowerCase().includes(c.name.toLowerCase())
                      )?.id || "",
                      text: dl.text,
                    })).filter((dl: any) => dl.characterId !== ""),
                    characterIds,
                    settingId,
                    duration: oldT.duration || 5,
                  }
                : oldT,
            ),
          };
        }
        return s;
      });
      setProject({ ...project, scenes: updatedScenes });
    } catch (error) {
      console.error(error);
      alert("Erro ao regenerar take.");
    } finally {
      setGeneratingTakesId(null);
    }
  };

  const updateTake = (
    sceneId: string,
    takeId: string,
    field: keyof Take,
    value: any,
  ) => {
    const updatedScenes = project.scenes.map((s) => {
      if (s.id === sceneId) {
        return {
          ...s,
          takes: s.takes.map((t) =>
            t.id === takeId ? { ...t, [field]: value } : t,
          ),
        };
      }
      return s;
    });
    setProject({ ...project, scenes: updatedScenes });
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">
            Cenas e Takes
          </h2>
          <p className="text-zinc-500">
            Divide o teu guião em cenas e planos de câmara.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleGenerateAllTakes}
            disabled={isGeneratingAllTakes || isGeneratingScenes || !project.scenes.length}
            className="flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isGeneratingAllTakes ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Gerar Todos os Takes
          </button>
          <button
            onClick={handleGenerateScenes}
            disabled={isGeneratingScenes || isGeneratingAllTakes || !project.script}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isGeneratingScenes ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Gerar Cenas Automaticamente
          </button>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-900">Configuração de Detalhe Ativa</p>
            <p className="text-xs text-indigo-700">
              Alvo: <span className="font-bold">{targetScenes} Cenas</span> com <span className="font-bold">{targetTakes} Takes</span> cada.
              Nível: {project.sceneDetailLevel === 'low' ? 'Mínimo' : project.sceneDetailLevel === 'medium' ? 'Médio' : 'Máximo'} / {project.takeDetailLevel === 'low' ? 'Mínimo' : project.takeDetailLevel === 'medium' ? 'Médio' : 'Máximo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-indigo-100 shadow-sm">
          <Zap className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-bold text-zinc-700">Total: {targetScenes * targetTakes} Takes</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-zinc-900">Ações Automáticas Globais</h3>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAutoDetectAll}
            disabled={isAutoDetecting || isAutoGeneratingDialogues || !project.scenes.length}
            className="flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isAutoDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Auto-detetar Personagens e Cenários
          </button>
          <button
            onClick={handleAutoGenerateAllDialogues}
            disabled={isAutoDetecting || isAutoGeneratingDialogues || !project.scenes.length}
            className="flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isAutoGeneratingDialogues ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Auto-gerar Diálogos
          </button>
        </div>
      </div>

      {(isGeneratingScenes || isGeneratingAllTakes || isAutoDetecting || isAutoGeneratingDialogues) && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
          <ProgressBar
            progress={isAutoDetecting || isAutoGeneratingDialogues ? globalProgress : scenesProgress}
            label={
              isGeneratingAllTakes ? "A gerar todos os takes do filme..." : 
              isGeneratingScenes ? "A estruturar cenas do filme..." :
              isAutoDetecting ? "A detetar personagens e cenários em todos os takes..." :
              "A extrair diálogos de todos os takes..."
            }
            modelName="Gemini"
          />
        </div>
      )}

      {/* Camera Help Modal */}
      {showCameraHelp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-indigo-600" />
                Guia de Tipos de Câmara
              </h3>
              <button
                onClick={() => setShowCameraHelp(false)}
                className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cameraTypes.map((type) => (
                  <div key={type.name} className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 hover:border-indigo-200 transition-colors">
                    <h4 className="font-bold text-zinc-900 text-sm mb-1">{type.name}</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">{type.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setShowCameraHelp(false)}
                className="bg-zinc-900 text-white px-8 py-2 rounded-xl font-bold hover:bg-zinc-800 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {project.scenes.map((scene) => (
          <div
            key={scene.id}
            className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden"
          >
            <div
              className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between cursor-pointer hover:bg-zinc-100 transition-colors"
              onClick={() =>
                setExpandedSceneId(
                  expandedSceneId === scene.id ? null : scene.id,
                )
              }
            >
              <div className="flex items-center gap-3">
                {expandedSceneId === scene.id ? (
                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                )}
                <div>
                  <h3 className="font-bold text-zinc-900">{scene.title}</h3>
                  <p className="text-sm text-zinc-500">
                    {scene.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium bg-zinc-200 text-zinc-700 px-2 py-1 rounded-md">
                  {scene.takes.length} Takes
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white border border-zinc-200 rounded-lg overflow-hidden">
                    <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 border-r border-zinc-100 bg-zinc-50 uppercase">
                      Extender
                    </div>
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtendScene(scene.id, pct);
                        }}
                        disabled={generatingTakesId === scene.id || scene.takes.length === 0}
                        className="px-2 py-1.5 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 border-r border-zinc-100 last:border-r-0 transition-colors disabled:opacity-50"
                        title={`Adicionar +${pct}% de takes (${Math.max(1, Math.round(scene.takes.length * (pct / 100)))} novos)`}
                      >
                        {pct}%
                      </button>
                    ))}
                    {generatingTakesId === scene.id && (
                      <div className="px-2 py-1.5">
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateTakesForScene(scene);
                    }}
                    disabled={generatingTakesId === scene.id}
                    className="flex items-center gap-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {generatingTakesId === scene.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Gerar Takes
                  </button>
                </div>
              </div>
            </div>

            {expandedSceneId === scene.id && (
              <div className="p-4 space-y-4 bg-white">
                {generatingTakesId === scene.id && (
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                    <ProgressBar
                      progress={takesProgress}
                      label="A detalhar takes da cena..."
                      modelName="Gemini"
                    />
                  </div>
                )}
                {scene.takes.length === 0 && !generatingTakesId ? (
                  <div className="text-center py-8 text-zinc-400 text-sm">
                    Ainda não foram gerados takes para esta cena. Clica em "Gerar Takes".
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scene.takes.map((take, index) => (
                      <div
                        key={take.id}
                        className="border border-zinc-200 rounded-xl p-4 flex gap-4"
                      >
                        <div className="font-mono text-zinc-400 font-bold text-lg pt-1 flex flex-col items-center gap-2">
                          <span>{(index + 1).toString().padStart(2, "0")}</span>
                          <button
                            onClick={() => onRegenerateTake(scene.id, take.id)}
                            disabled={generatingTakesId === take.id}
                            title="Regenerar este take"
                            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                          >
                            {generatingTakesId === take.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">
                              Ação
                            </label>
                            <textarea
                              value={take.action}
                              onChange={(e) =>
                                updateTake(
                                  scene.id,
                                  take.id,
                                  "action",
                                  e.target.value,
                                )
                              }
                              className="w-full text-sm text-zinc-800 bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded-lg p-2 outline-none resize-none h-20 transition-colors"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-zinc-500 uppercase">
                                Câmara
                              </label>
                              <button
                                onClick={() => setShowCameraHelp(true)}
                                className="text-indigo-600 hover:text-indigo-700 transition-colors"
                                title="Ajuda com tipos de câmara"
                              >
                                <HelpCircle className="w-4 h-4" />
                              </button>
                            </div>
                            <textarea
                              value={take.camera}
                              onChange={(e) =>
                                updateTake(
                                  scene.id,
                                  take.id,
                                  "camera",
                                  e.target.value,
                                )
                              }
                              className="w-full text-sm text-zinc-800 bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded-lg p-2 outline-none resize-none h-20 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">
                              Som e Música
                            </label>
                            <textarea
                              value={`Som: ${take.sound}\nMúsica: ${take.music}`}
                              onChange={(e) => {
                                // Simple split for demo purposes
                                const parts = e.target.value.split("\nMúsica: ");
                                updateTake(
                                  scene.id,
                                  take.id,
                                  "sound",
                                  parts[0].replace("Som: ", ""),
                                );
                                if (parts[1])
                                  updateTake(
                                    scene.id,
                                    take.id,
                                    "music",
                                    parts[1],
                                  );
                              }}
                              className="w-full text-sm text-zinc-800 bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded-lg p-2 outline-none resize-none h-20 transition-colors"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-zinc-500 uppercase">
                                Diálogo Estruturado
                              </label>
                              <button
                                onClick={async () => {
                                  const lines = await extractDialogueLines(take.action, project.characters);
                                  if (lines.length > 0) {
                                    updateTake(scene.id, take.id, "dialogueLines", lines);
                                  }
                                }}
                                className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                                title="Gerar diálogos estruturados a partir da ação"
                              >
                                <Zap className="w-3 h-3" /> AUTO-GERAR
                              </button>
                            </div>
                            <div className="space-y-2 bg-zinc-50 p-2 rounded-lg border border-transparent hover:border-zinc-200 transition-colors min-h-[80px]">
                              {(take.dialogueLines || []).map((line, lIndex) => (
                                <div key={lIndex} className="flex gap-2">
                                  <select
                                    value={line.characterId}
                                    onChange={(e) => {
                                      const newLines = [...(take.dialogueLines || [])];
                                      newLines[lIndex] = { ...line, characterId: e.target.value };
                                      updateTake(scene.id, take.id, "dialogueLines", newLines);
                                    }}
                                    className="text-[10px] bg-white border border-zinc-200 rounded px-1 outline-none w-24"
                                  >
                                    <option value="">Personagem...</option>
                                    {project.characters.map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    value={line.text}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const newLines = [...(take.dialogueLines || [])];
                                      
                                      // Smart detection: "Name: Text"
                                      const parts = val.split(':');
                                      if (parts.length > 1 && !line.characterId) {
                                        const potentialName = parts[0].trim().toLowerCase();
                                        const char = project.characters.find(c => 
                                          c.name.toLowerCase() === potentialName || 
                                          potentialName.includes(c.name.toLowerCase())
                                        );
                                        if (char) {
                                          newLines[lIndex] = { 
                                            characterId: char.id, 
                                            text: parts.slice(1).join(':').trim() 
                                          };
                                          updateTake(scene.id, take.id, "dialogueLines", newLines);
                                          return;
                                        }
                                      }

                                      newLines[lIndex] = { ...line, text: val };
                                      updateTake(scene.id, take.id, "dialogueLines", newLines);
                                    }}
                                    placeholder="Fala..."
                                    className="flex-1 text-xs bg-white border border-zinc-200 rounded px-2 py-1 outline-none"
                                  />
                                  <button
                                    onClick={() => {
                                      const newLines = (take.dialogueLines || []).filter((_, i) => i !== lIndex);
                                      updateTake(scene.id, take.id, "dialogueLines", newLines);
                                    }}
                                    className="text-zinc-400 hover:text-red-500"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              <div className="flex items-center justify-between mt-1">
                                <button
                                  onClick={() => {
                                    const newLines = [...(take.dialogueLines || []), { characterId: "", text: "" }];
                                    updateTake(scene.id, take.id, "dialogueLines", newLines);
                                  }}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> ADICIONAR LINHA
                                </button>
                                <button
                                  onClick={() => {
                                    const newLines = detectCharactersForDialogueLines(take.dialogueLines || [], project.characters);
                                    updateTake(scene.id, take.id, "dialogueLines", newLines);
                                  }}
                                  className="text-[10px] text-zinc-500 hover:text-indigo-600 font-bold flex items-center gap-1"
                                  title="Tentar detetar personagens nas falas existentes"
                                >
                                  <Users className="w-3 h-3" /> SINCRONIZAR
                                </button>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">
                              Duração (segundos)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={take.duration || 5}
                              onChange={(e) =>
                                updateTake(
                                  scene.id,
                                  take.id,
                                  "duration",
                                  parseInt(e.target.value),
                                )
                              }
                              className="w-full text-sm text-zinc-800 bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded-lg p-2 outline-none transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">
                              Transição (Saída)
                            </label>
                            <select
                              value={take?.transition || 'cut'}
                              onChange={(e) =>
                                updateTake(
                                  scene.id,
                                  take.id,
                                  "transition",
                                  e.target.value,
                                )
                              }
                              className="w-full text-sm text-zinc-800 bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded-lg p-2 outline-none transition-colors"
                            >
                              <option value="cut">Corte Seco (Cut)</option>
                              <option value="fade">Dissolver (Fade)</option>
                              <option value="fade-black">Fade para Preto</option>
                              <option value="fade-white">Fade para Branco</option>
                              <option value="wipe-left">Wipe Esquerda</option>
                              <option value="wipe-right">Wipe Direita</option>
                              <option value="zoom-in">Zoom In</option>
                              <option value="zoom-out">Zoom Out</option>
                            </select>
                          </div>

                          {/* Characters Selection */}
                          <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-xs font-semibold text-zinc-500 uppercase flex items-center gap-1">
                                <Users className="w-3 h-3" /> Personagens neste Take
                              </label>
                              <button
                                onClick={() => {
                                  const detectedIds = detectCharacters(take.action, take.dialogueLines || [], [], project.characters);
                                  updateTake(scene.id, take.id, "characterIds", detectedIds);
                                }}
                                className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                                title="Detectar personagens automaticamente a partir da ação e diálogo"
                              >
                                <Zap className="w-3 h-3" /> AUTO-DETECTAR
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {project.characters.map((char) => {
                                const isSelected = take.characterIds?.includes(char.id);
                                return (
                                  <button
                                    key={char.id}
                                    onClick={() => {
                                      const currentIds = take.characterIds || [];
                                      const newIds = isSelected
                                        ? currentIds.filter((id) => id !== char.id)
                                        : [...currentIds, char.id];
                                      updateTake(scene.id, take.id, "characterIds", newIds);
                                    }}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-2 ${
                                      isSelected
                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                                    }`}
                                  >
                                    {char.imageUrl && (
                                      <img
                                        src={char.imageUrl}
                                        alt={char.name}
                                        className="w-4 h-4 rounded-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    )}
                                    {char.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Setting Selection */}
                          <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-xs font-semibold text-zinc-500 uppercase flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Cenário deste Take
                              </label>
                              <button
                                onClick={() => {
                                  const detectedId = detectSetting(take.action, undefined, project.settings);
                                  if (detectedId) updateTake(scene.id, take.id, "settingId", detectedId);
                                }}
                                className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md transition-colors"
                                title="Detectar cenário automaticamente a partir da ação"
                              >
                                <Zap className="w-3 h-3" /> AUTO-DETECTAR
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {project.settings.map((setting) => {
                                const isSelected = take.settingId === setting.id;
                                return (
                                  <button
                                    key={setting.id}
                                    onClick={() =>
                                      updateTake(
                                        scene.id,
                                        take.id,
                                        "settingId",
                                        isSelected ? undefined : setting.id,
                                      )
                                    }
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-2 ${
                                      isSelected
                                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                                    }`}
                                  >
                                    {setting.imageUrl && (
                                      <img
                                        src={setting.imageUrl}
                                        alt={setting.name}
                                        className="w-4 h-4 rounded-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    )}
                                    {setting.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
