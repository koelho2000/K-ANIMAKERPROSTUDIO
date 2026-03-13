import React, { useState, useEffect } from "react";
import { Project, Scene, Take, Character, Setting, VideoModel } from "../types";
import {
  generateImage,
  generateVideo,
  pollVideoOperation,
  extendVideo,
  analyzeCoherence,
} from "../services/geminiService";
import {
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Film,
  PlayCircle,
  AlertTriangle,
  Users,
  MapPin,
  Info,
  X,
  ZoomIn,
  Trash2,
  Upload,
  Download,
  PlusCircle,
} from "lucide-react";
import ProgressBar from "./ProgressBar";
import { ImageModal } from "./ImageModal";
import { PromptEditorModal } from "./PromptEditorModal";
import IntelligentEditor from "./IntelligentEditor";

interface ProductionProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function Production({ project, setProject }: ProductionProps) {
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(
    null,
  );
  const [imageProgress, setImageProgress] = useState(0);
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(
    null,
  );
  const [isAnalyzingTakeId, setIsAnalyzingTakeId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatus, setVideoStatus] = useState<string>("");
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<{
    sceneId: string;
    takeId: string;
    type: "start" | "end";
    prompt: string;
  } | null>(null);
  const [editingVideoPrompt, setEditingVideoPrompt] = useState<{
    sceneId: string;
    takeId: string;
    prompt: string;
  } | null>(null);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [importingVideo, setImportingVideo] = useState<{
    sceneId: string;
    takeId: string;
    prompt: string;
  } | null>(null);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(
    project.scenes[0]?.id || null,
  );
  const [infoModalTake, setInfoModalTake] = useState<Take | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [editingItem, setEditingItem] = useState<{ 
    id: string; 
    url: string; 
    type: 'image' | 'video'; 
    title: string; 
    source: string; 
    videoObject?: any; 
    initialMode?: 'edit' | 'extend';
    nextMediaUrl?: string;
  } | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generatingImageId || isGeneratingBulk) {
      if (!isGeneratingBulk) setImageProgress(0);
      interval = setInterval(() => {
        setImageProgress((prev) => (prev >= 95 ? prev : prev + Math.random() * 15));
      }, 300);
    } else {
      setImageProgress(100);
    }
    return () => clearInterval(interval);
  }, [generatingImageId, isGeneratingBulk]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generatingVideoId) {
      setVideoProgress(0);
      // Video generation is slow, so we increment slowly but steadily
      interval = setInterval(() => {
        setVideoProgress((prev) => {
          if (prev >= 98) return prev;
          // Faster initially (up to 20%), then slower
          const increment = prev < 20 ? Math.random() * 2 : Math.random() * 0.4;
          return prev + increment;
        });
      }, 1000);
    } else {
      setVideoProgress(100);
    }
    return () => clearInterval(interval);
  }, [generatingVideoId]);

  const getBase64FromUrl = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error fetching image for base64 conversion:", error);
      return url; // Fallback to original URL
    }
  };

  const handleGenerateFrame = async (
    sceneId: string,
    takeId: string,
    type: "start" | "end",
    silent = false,
    customPrompt?: string,
    startFrameOverride?: string,
  ): Promise<{ imageUrl: string; prompt: string } | null> => {
    if (!silent) setGeneratingImageId(`${takeId}-${type}`);
    try {
      const scene = project.scenes.find((s) => s.id === sceneId);
      const take = scene?.takes.find((t) => t.id === takeId);
      if (!scene || !take) return null;

      const takeCharacters = project.characters.filter((c) =>
        take.characterIds?.includes(c.id)
      );
      const takeSetting = project.settings.find((s) => s.id === take.settingId);

      // Collect reference images
      const referenceImages: string[] = [];
      if (takeSetting?.imageUrl) {
        const base64 = await getBase64FromUrl(takeSetting.imageUrl);
        referenceImages.push(base64);
      }
      for (const c of takeCharacters) {
        if (c.imageUrl) {
          const base64 = await getBase64FromUrl(c.imageUrl);
          referenceImages.push(base64);
        }
      }

      // Add start frame as reference for end frame
      const startFrame = startFrameOverride || take.startFrameUrl;
      if (type === "end" && startFrame) {
        const base64 = await getBase64FromUrl(startFrame);
        referenceImages.push(base64);
      }

      const prompt = customPrompt || `
        Cria um frame de animação cinematográfica de alta qualidade.
        Tipo de Filme: ${project.filmType}. 
        Estilo Visual: ${project.filmStyle}. 
        Cena: ${scene.title}. 
        Ação do Take: ${take.action}. 
        Câmara: ${take.camera}. 
        
        ${type === "end" ? "ESTE É O FRAME FINAL DO TAKE. Deve ser uma continuação direta e coerente do Frame Inicial fornecido." : ""}

        DIÁLOGO NESTE TAKE:
        ${take.dialogueLines && take.dialogueLines.length > 0
          ? take.dialogueLines.map(line => {
              const char = project.characters.find(c => c.id === line.characterId);
              return `${char?.name || "Personagem"}: ${line.text}`;
            }).join("\n")
          : take.dialogue && take.dialogue !== "Nenhum" ? take.dialogue : "Nenhum diálogo específico."}

        PERSONAGENS PRESENTES NESTE TAKE:
        ${takeCharacters.map((c) => `${c.name}: ${c.description}`).join("\n") || "Nenhuma personagem específica."}
        
        CENÁRIO DESTE TAKE:
        ${takeSetting ? `${takeSetting.name}: ${takeSetting.description}` : "Nenhum cenário específico definido."}
        
        INSTRUÇÕES DE CONSISTÊNCIA:
        1. Usa as imagens de referência fornecidas para manter a aparência exata das personagens e do cenário.
        ${type === "end" ? "2. Usa o Frame Inicial fornecido como referência obrigatória para garantir que a posição das personagens, a iluminação e o cenário são idênticos, mudando apenas o necessário para refletir o fim da ação descrita." : ""}
        ${type === "end" ? "3." : "2."} As personagens devem ser instantaneamente reconhecíveis e consistentes com os seus designs originais.
        ${type === "end" ? "4." : "3."} O cenário deve manter a mesma arquitetura, iluminação e atmosfera definida no concept art.
        ${type === "end" ? "5." : "4."} Integra as personagens de forma natural no cenário de acordo com a ação descrita.
        
        Altamente detalhado, iluminação dramática, composição profissional.
      `;
      const imageUrl = await generateImage(prompt, project.aspectRatio, referenceImages);
      return { imageUrl, prompt };
    } catch (error) {
      console.error(error);
      if (!silent) alert("Erro ao gerar frame.");
      return null;
    } finally {
      if (!silent) setGeneratingImageId(null);
    }
  };

  const getTakeConsistencyStatus = (take: Take) => {
    const missingImages: string[] = [];
    const missingDescriptions: string[] = [];

    const takeCharacters = project.characters.filter((c) =>
      take.characterIds?.includes(c.id)
    );
    const takeSetting = project.settings.find((s) => s.id === take.settingId);

    takeCharacters.forEach((c) => {
      if (!c.imageUrl) missingImages.push(`Personagem: ${c.name}`);
      if (!c.description) missingDescriptions.push(`Personagem: ${c.name}`);
    });

    if (takeSetting) {
      if (!takeSetting.imageUrl) missingImages.push(`Cenário: ${takeSetting.name}`);
      if (!takeSetting.description) missingDescriptions.push(`Cenário: ${takeSetting.name}`);
    }

    return {
      isReady: missingImages.length === 0 && missingDescriptions.length === 0,
      missingImages,
      missingDescriptions,
    };
  };

  const checkConsistencyRequirements = (take: Take) => {
    const status = getTakeConsistencyStatus(take);

    if (!status.isReady) {
      let message = "Aviso de Consistência:\n\n";
      if (status.missingImages.length > 0) {
        message += "Faltam imagens de referência para:\n- " + status.missingImages.join("\n- ") + "\n\n";
      }
      if (status.missingDescriptions.length > 0) {
        message += "Faltam descrições detalhadas para:\n- " + status.missingDescriptions.join("\n- ") + "\n\n";
      }
      message += "Deseja continuar a geração sem estas referências? A consistência visual poderá ser afetada.";
      return window.confirm(message);
    }

    return true;
  };

  const handleFileUpload = async (sceneId: string, takeId: string, type: "start" | "end", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const updatedScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: s.takes.map((t) =>
              t.id === takeId
                ? {
                    ...t,
                    [type === "start" ? "startFrameUrl" : "endFrameUrl"]: base64,
                    updatedAt: Date.now(),
                  }
                : t,
            ),
          };
        }
        return s;
      });
      setProject({ ...project, scenes: updatedScenes });
    };
    reader.readAsDataURL(file);
  };

  const handleVideoFileUpload = async (sceneId: string, takeId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const updatedScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: s.takes.map((t) =>
              t.id === takeId
                ? {
                    ...t,
                    videoUrl: base64,
                    videoOperationId: undefined,
                    videoObject: undefined,
                    updatedAt: Date.now(),
                  }
                : t,
            ),
          };
        }
        return s;
      });
      setProject({ ...project, scenes: updatedScenes });
      setImportingVideo(null);
    };
    reader.readAsDataURL(file);
  };

  const getDefaultFramePrompt = (sceneId: string, takeId: string) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    const take = scene?.takes.find((t) => t.id === takeId);
    if (!scene || !take) return "";

    const takeCharacters = project.characters.filter((c) =>
      take.characterIds?.includes(c.id)
    );
    const takeSetting = project.settings.find((s) => s.id === take.settingId);

    return `Cria um frame de animação cinematográfica de alta qualidade.
Tipo de Filme: ${project.filmType}. 
Estilo Visual: ${project.filmStyle}. 
Cena: ${scene.title}. 
Ação do Take: ${take.action}. 
Câmara: ${take.camera}. 

DIÁLOGO NESTE TAKE:
${take.dialogueLines && take.dialogueLines.length > 0
  ? take.dialogueLines.map(line => {
      const char = project.characters.find(c => c.id === line.characterId);
      return `${char?.name || "Personagem"}: ${line.text}`;
    }).join("\n")
  : take.dialogue && take.dialogue !== "Nenhum" ? take.dialogue : "Nenhum diálogo específico."}

PERSONAGENS PRESENTES NESTE TAKE:
${takeCharacters.map((c) => `${c.name}: ${c.description}`).join("\n") || "Nenhuma personagem específica."}

CENÁRIO DESTE TAKE:
${takeSetting ? `${takeSetting.name}: ${takeSetting.description}` : "Nenhum cenário específico definido."}

INSTRUÇÕES DE CONSISTÊNCIA:
1. Usa as imagens de referência fornecidas para manter a aparência exata das personagens e do cenário.
2. As personagens devem ser instantaneamente reconhecíveis e consistentes com os seus designs originais.
3. O cenário deve manter a mesma arquitetura, iluminação e atmosfera definida no concept art.
4. Integra as personagens de forma natural no cenário de acordo com a ação descrita.

Altamente detalhado, iluminação dramática, composição profissional.`.trim();
  };

  const getDefaultVideoPrompt = (sceneId: string, takeId: string) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    const take = scene?.takes.find((t) => t.id === takeId);
    if (!scene || !take) return "";

    const dialogueContext = take.dialogueLines && take.dialogueLines.length > 0
      ? " Diálogo: " + take.dialogueLines.map(line => {
          const char = project.characters.find(c => c.id === line.characterId);
          return `${char?.name || "Personagem"}: ${line.text}`;
        }).join(" | ")
      : take.dialogue && take.dialogue !== "Nenhum" ? ` Diálogo: ${take.dialogue}` : "";

    return `Tipo de Filme: ${project.filmType}. Estilo Visual: ${project.filmStyle}. Action: ${take.action}. Camera: ${take.camera}.${dialogueContext}`;
  };

  const onGenerateFrame = async (sceneId: string, takeId: string, type: "start" | "end") => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    const take = scene?.takes.find((t) => t.id === takeId);
    
    if (take && !checkConsistencyRequirements(take)) {
      return;
    }

    if (type === "end" && take && !take.startFrameUrl) {
      alert("Aviso: O Frame Final deve ser baseado no Frame Inicial para garantir coerência visual. Por favor, gera primeiro o Frame Inicial.");
      return;
    }

    const result = await handleGenerateFrame(sceneId, takeId, type);
    if (result) {
      const { imageUrl, prompt } = result;
      const updatedScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: s.takes.map((t) =>
              t.id === takeId
                ? {
                    ...t,
                    [type === "start" ? "startFrameUrl" : "endFrameUrl"]:
                      imageUrl,
                    [type === "start" ? "lastStartFramePrompt" : "lastEndFramePrompt"]: prompt,
                    updatedAt: Date.now(),
                  }
                : t,
            ),
          };
        }
        return s;
      });
      setProject({ ...project, scenes: updatedScenes });
    }
  };

  const handleDeleteFrame = (sceneId: string, takeId: string, type: "start" | "end") => {
    if (!window.confirm(`Tens a certeza que desejas apagar o ${type === 'start' ? 'Frame Inicial' : 'Frame Final'}?`)) return;

    const updatedScenes = project.scenes.map((s) => {
      if (s.id === sceneId) {
        return {
          ...s,
          takes: s.takes.map((t) =>
            t.id === takeId
              ? {
                  ...t,
                  [type === "start" ? "startFrameUrl" : "endFrameUrl"]: undefined,
                  updatedAt: Date.now(),
                }
              : t,
          ),
        };
      }
      return s;
    });
    setProject({ ...project, scenes: updatedScenes });
  };

  const handleGenerateAllStartFramesForScene = async (sceneId: string) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    setIsGeneratingBulk(true);
    setBulkProgress(0);
    try {
      const updatedTakes = [...scene.takes];
      for (let i = 0; i < updatedTakes.length; i++) {
        setBulkProgress((i / updatedTakes.length) * 100);
        const take = updatedTakes[i];
        if (!take.startFrameUrl) {
          const result = await handleGenerateFrame(sceneId, take.id, "start", true);
          if (result) {
            updatedTakes[i].startFrameUrl = result.imageUrl;
            updatedTakes[i].lastStartFramePrompt = result.prompt;
            updatedTakes[i].updatedAt = Date.now();
          }
        }
      }
      const updatedScenes = project.scenes.map((s) =>
        s.id === sceneId ? { ...s, takes: updatedTakes } : s,
      );
      setProject({ ...project, scenes: updatedScenes });
      alert(`Todos os frames iniciais da cena "${scene.title}" foram gerados!`);
    } catch (error) {
      console.error(error);
      alert("Erro na geração em massa.");
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  const handleGenerateAllEndFramesForScene = async (sceneId: string) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    setIsGeneratingBulk(true);
    setBulkProgress(0);
    try {
      const updatedTakes = [...scene.takes];
      for (let i = 0; i < updatedTakes.length; i++) {
        setBulkProgress((i / updatedTakes.length) * 100);
        const take = updatedTakes[i];
        if (!take.endFrameUrl) {
          const result = await handleGenerateFrame(sceneId, take.id, "end", true, undefined, take.startFrameUrl);
          if (result) {
            updatedTakes[i].endFrameUrl = result.imageUrl;
            updatedTakes[i].lastEndFramePrompt = result.prompt;
            updatedTakes[i].updatedAt = Date.now();
          }
        }
      }
      const updatedScenes = project.scenes.map((s) =>
        s.id === sceneId ? { ...s, takes: updatedTakes } : s,
      );
      setProject({ ...project, scenes: updatedScenes });
      alert(`Todos os frames finais da cena "${scene.title}" foram gerados!`);
    } catch (error) {
      console.error(error);
      alert("Erro na geração em massa.");
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  const handleDeleteAllStartFramesForScene = (sceneId: string) => {
    if (!window.confirm("Tens a certeza que desejas apagar TODOS os Frames Iniciais desta cena?")) return;
    const updatedScenes = project.scenes.map((s) => {
      if (s.id === sceneId) {
        return {
          ...s,
          takes: s.takes.map((t) => ({ ...t, startFrameUrl: undefined, updatedAt: Date.now() })),
        };
      }
      return s;
    });
    setProject({ ...project, scenes: updatedScenes });
  };

  const handleDeleteAllEndFramesForScene = (sceneId: string) => {
    if (!window.confirm("Tens a certeza que desejas apagar TODOS os Frames Finais desta cena?")) return;
    const updatedScenes = project.scenes.map((s) => {
      if (s.id === sceneId) {
        return {
          ...s,
          takes: s.takes.map((t) => ({ ...t, endFrameUrl: undefined, updatedAt: Date.now() })),
        };
      }
      return s;
    });
    setProject({ ...project, scenes: updatedScenes });
  };

  const handleDeleteAllVideosForScene = (sceneId: string) => {
    if (!window.confirm("Tens a certeza que desejas apagar TODOS os Vídeos desta cena?")) return;
    const updatedScenes = project.scenes.map((s) => {
      if (s.id === sceneId) {
        return {
          ...s,
          takes: s.takes.map((t) => ({ ...t, videoUrl: undefined, videoObject: undefined, videoOperationId: undefined, updatedAt: Date.now() })),
        };
      }
      return s;
    });
    setProject({ ...project, scenes: updatedScenes });
  };

  const handleGenerateAllFramesForAllScenes = async () => {
    setIsGeneratingBulk(true);
    setBulkProgress(0);
    try {
      const updatedScenes = [...project.scenes];
      const totalTakes = updatedScenes.reduce((acc, s) => acc + s.takes.length, 0);
      let processedTakes = 0;

      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];
        const updatedTakes = [...scene.takes];
        
        for (let j = 0; j < updatedTakes.length; j++) {
          setBulkProgress((processedTakes / totalTakes) * 100);
          const take = updatedTakes[j];
          if (!take.startFrameUrl) {
            const result = await handleGenerateFrame(scene.id, take.id, "start", true);
            if (result) {
              updatedTakes[j].startFrameUrl = result.imageUrl;
              updatedTakes[j].lastStartFramePrompt = result.prompt;
              updatedTakes[j].updatedAt = Date.now();
            }
          }
          if (!take.endFrameUrl) {
            const result = await handleGenerateFrame(scene.id, take.id, "end", true, undefined, take.startFrameUrl);
            if (result) {
              updatedTakes[j].endFrameUrl = result.imageUrl;
              updatedTakes[j].lastEndFramePrompt = result.prompt;
              updatedTakes[j].updatedAt = Date.now();
            }
          }
          processedTakes++;
        }
        updatedScenes[i] = { ...scene, takes: updatedTakes };
      }

      setProject({ ...project, scenes: updatedScenes });
      alert("Todos os frames de todas as cenas foram gerados!");
    } catch (error) {
      console.error(error);
      alert("Erro na geração global.");
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  const handleUpdateTakeModel = (sceneId: string, takeId: string, model: VideoModel) => {
    const updatedScenes = project.scenes.map((s) => {
      if (s.id === sceneId) {
        return {
          ...s,
          takes: s.takes.map((t) =>
            t.id === takeId ? { ...t, videoModel: model } : t
          ),
        };
      }
      return s;
    });
    setProject({ ...project, scenes: updatedScenes });
  };

  const handleSaveEdit = (newUrl: string, newVideoObject?: any) => {
    if (!editingItem) return;

    const id = editingItem.id;
    let takeId = '';
    let type: 'start' | 'end' | 'video' = 'start';

    if (id.startsWith('take-start-')) {
      takeId = id.replace('take-start-', '');
      type = 'start';
    } else if (id.startsWith('take-end-')) {
      takeId = id.replace('take-end-', '');
      type = 'end';
    } else if (id.startsWith('take-video-')) {
      takeId = id.replace('take-video-', '');
      type = 'video';
    }

    const updatedScenes = project.scenes.map((s) => ({
      ...s,
      takes: s.takes.map((t) => {
        if (t.id === takeId) {
          if (type === 'start') return { ...t, startFrameUrl: newUrl, updatedAt: Date.now() };
          if (type === 'end') return { ...t, endFrameUrl: newUrl, updatedAt: Date.now() };
          if (type === 'video') return { ...t, videoUrl: newUrl, videoObject: newVideoObject || t.videoObject, videoOperationId: undefined, updatedAt: Date.now() };
        }
        return t;
      })
    }));
    setProject({ ...project, scenes: updatedScenes });
  };

  const handleGenerateAllVideosForScene = async (sceneId: string) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    // Check if all takes have frames
    const incompleteTakes = scene.takes.filter(t => !t.startFrameUrl || !t.endFrameUrl);
    if (incompleteTakes.length > 0) {
      alert(`Faltam frames em ${incompleteTakes.length} takes desta cena. Gere todos os frames primeiro.`);
      return;
    }

    // Check if API key is selected
    if (!(window as any).aistudio?.hasSelectedApiKey?.()) {
      if ((window as any).aistudio?.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
      } else {
        alert("Please configure your Gemini API Key first.");
        return;
      }
    }

    setIsGeneratingBulk(true);
    setBulkProgress(0);
    try {
      const takesToRender = scene.takes.filter(t => !t.videoUrl && !t.videoOperationId);
      if (takesToRender.length === 0) {
        if (!window.confirm("Todos os vídeos desta cena já foram renderizados. Deseja renderizar novamente?")) return;
      }

      for (let i = 0; i < scene.takes.length; i++) {
        const take = scene.takes[i];
        if (takesToRender.length === 0 || (!take.videoUrl && !take.videoOperationId)) {
          setBulkProgress((i / scene.takes.length) * 100);
          
          // We don't await the full poll here because it would be sequential and very slow.
          // Instead, we trigger the generation and let the UI handle the polling or just trigger them all.
          // Actually, the user wants "at the same time", but Veo might have limits.
          // Let's trigger them and update the state.
          
          const dialogueContext = take.dialogueLines && take.dialogueLines.length > 0
            ? " Diálogo: " + take.dialogueLines.map(line => {
                const char = project.characters.find(c => c.id === line.characterId);
                return `${char?.name || "Personagem"}: ${line.text}`;
              }).join(" | ")
            : take.dialogue && take.dialogue !== "Nenhum" ? ` Diálogo: ${take.dialogue}` : "";

          const prompt = `Tipo de Filme: ${project.filmType}. Estilo Visual: ${project.filmStyle}. Action: ${take.action}. Camera: ${take.camera}.${dialogueContext}`;
          
          // Collect reference images for consistency
          const takeCharacters = project.characters.filter((c) =>
            take.characterIds?.includes(c.id)
          );
          const takeSetting = project.settings.find((s) => s.id === take.settingId);
          const referenceImages: string[] = [];
          if (takeSetting?.imageUrl) {
            const base64 = await getBase64FromUrl(takeSetting.imageUrl);
            referenceImages.push(base64);
          }
          for (const c of takeCharacters) {
            if (c.imageUrl) {
              const base64 = await getBase64FromUrl(c.imageUrl);
              referenceImages.push(base64);
            }
          }

          const operation = await generateVideo(
            prompt,
            take.startFrameUrl,
            take.endFrameUrl,
            take.videoModel || project.videoModel || 'flow',
            project.aspectRatio,
            referenceImages
          );

          // Update state with operation ID and prompt
          const updatedScenes = project.scenes.map((s) => {
            if (s.id === sceneId) {
              return {
                ...s,
                takes: s.takes.map((t) =>
                  t.id === take.id ? { ...t, videoOperationId: operation.name, lastVideoPrompt: prompt } : t,
                ),
              };
            }
            return s;
          });
          setProject({ ...project, scenes: updatedScenes });

          // Start polling in background (don't await)
          pollVideoOperation(operation.name).then((videoUrl) => {
            setProject(prev => ({
              ...prev,
              scenes: prev.scenes.map((s) => {
                if (s.id === sceneId) {
                  return {
                    ...s,
                    takes: s.takes.map((t) =>
                      t.id === take.id
                        ? { ...t, videoUrl, videoOperationId: undefined }
                        : t,
                    ),
                  };
                }
                return s;
              })
            }));
          }).catch(err => {
            console.error(`Error rendering video for take ${take.id}:`, err);
            alert(`Erro ao renderizar vídeo (Take ${take.id}): ${err.message || 'Verifica se a tua chave API é válida e tem saldo.'}`);
            
            // Clear the loading state
            setProject(prev => ({
              ...prev,
              scenes: prev.scenes.map((s) => {
                if (s.id === sceneId) {
                  return {
                    ...s,
                    takes: s.takes.map((t) =>
                      t.id === take.id ? { ...t, videoOperationId: undefined } : t
                    ),
                  };
                }
                return s;
              })
            }));
          });
        }
      }
      alert(`Renderização de vídeos da cena "${scene.title}" iniciada!`);
    } catch (error) {
      console.error(error);
      alert("Erro ao iniciar renderização em massa.");
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  const handleGenerateVideo = async (sceneId: string, takeId: string) => {
    try {
      const scene = project.scenes.find((s) => s.id === sceneId);
      const take = scene?.takes.find((t) => t.id === takeId);
      if (!scene || !take) return;

      const dialogueContext = take.dialogueLines && take.dialogueLines.length > 0
        ? " Diálogo: " + take.dialogueLines.map(line => {
            const char = project.characters.find(c => c.id === line.characterId);
            return `${char?.name || "Personagem"}: ${line.text}`;
          }).join(" | ")
        : take.dialogue && take.dialogue !== "Nenhum" ? ` Diálogo: ${take.dialogue}` : "";

      const prompt = `Tipo de Filme: ${project.filmType}. Estilo Visual: ${project.filmStyle}. Action: ${take.action}. Camera: ${take.camera}.${dialogueContext}`;
      
      setEditingVideoPrompt({ sceneId, takeId, prompt });
    } catch (error) {
      console.error(error);
      alert("Erro ao preparar prompt do vídeo.");
    }
  };

  const confirmGenerateVideo = async (sceneId: string, takeId: string, editedPrompt: string) => {
    setEditingVideoPrompt(null);
    setGeneratingVideoId(takeId);
    setVideoStatus("A preparar pedido...");
    try {
      const scene = project.scenes.find((s) => s.id === sceneId);
      const take = scene?.takes.find((t) => t.id === takeId);
      if (!scene || !take) return;

      // Check if API key is selected (system or manual)
      const hasManualKey = !!localStorage.getItem('GEMINI_API_KEY_MANUAL');
      const hasSystemKey = await (window as any).aistudio?.hasSelectedApiKey?.();
      
      if (!hasManualKey && !hasSystemKey) {
        if ((window as any).aistudio?.openSelectKey) {
          await (window as any).aistudio.openSelectKey();
        } else {
          alert("Por favor, configura a tua Chave API Gemini primeiro (Sistema ou Manual no Menu Lateral).");
          setGeneratingVideoId(null);
          return;
        }
      }

      // Collect reference images for consistency
      const takeCharacters = project.characters.filter((c) =>
        take.characterIds?.includes(c.id)
      );
      const takeSetting = project.settings.find((s) => s.id === take.settingId);
      const referenceImages: string[] = [];
      if (takeSetting?.imageUrl) {
        const base64 = await getBase64FromUrl(takeSetting.imageUrl);
        referenceImages.push(base64);
      }
      for (const c of takeCharacters) {
        if (c.imageUrl) {
          const base64 = await getBase64FromUrl(c.imageUrl);
          referenceImages.push(base64);
        }
      }

      const operation = await generateVideo(
        editedPrompt,
        take.startFrameUrl,
        take.endFrameUrl,
        take.videoModel || project.videoModel || 'flow',
        project.aspectRatio,
        referenceImages
      );
      setVideoStatus("A aguardar renderização (2-5 min)...");

      // Save operation name and prompt to state so we know it's generating
      const updatedScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: s.takes.map((t) =>
              t.id === takeId ? { ...t, videoOperationId: operation.name, lastVideoPrompt: editedPrompt } : t,
            ),
          };
        }
        return s;
      });
      setProject({ ...project, scenes: updatedScenes });

      // Start polling
      try {
        const { videoUrl, videoObject } = await pollVideoOperation(operation);
        setVideoStatus("Vídeo pronto!");

        // Update with final video URL and object
        setProject(prev => ({
          ...prev,
          scenes: prev.scenes.map((s) => {
            if (s.id === sceneId) {
              return {
                ...s,
                takes: s.takes.map((t) =>
                  t.id === takeId
                    ? { ...t, videoUrl, videoObject, videoOperationId: undefined }
                    : t,
                ),
              };
            }
            return s;
          })
        }));
      } catch (err: any) {
        console.error("Erro ao processar vídeo:", err);
        alert(`Erro ao renderizar vídeo: ${err.message || 'Verifica se a tua chave API é válida e tem saldo.'}`);
        setProject(prev => ({
          ...prev,
          scenes: prev.scenes.map((s) => {
            if (s.id === sceneId) {
              return {
                ...s,
                takes: s.takes.map((t) =>
                  t.id === takeId ? { ...t, videoOperationId: undefined } : t
                ),
              };
            }
            return s;
          })
        }));
      }
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao gerar vídeo: ${error.message || 'Verifica a consola.'}`);

      // Clear operation id on error
      const errorScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: s.takes.map((t) =>
              t.id === takeId ? { ...t, videoOperationId: undefined } : t,
            ),
          };
        }
        return s;
      });
      setProject({ ...project, scenes: errorScenes });
    } finally {
      setGeneratingVideoId(null);
    }
  };

  const handleExtendTake = (sceneId: string, takeId: string) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    const take = scene?.takes.find((t) => t.id === takeId);
    if (!scene || !take || !take.videoObject) {
      alert("É necessário ter um vídeo gerado para o poder extender.");
      return;
    }

    // Find next take for reference
    const takeIndex = scene.takes.findIndex(t => t.id === takeId);
    let nextMediaUrl = scene.takes[takeIndex + 1]?.videoUrl;
    
    // If last take of scene, check first take of next scene
    if (!nextMediaUrl) {
      const sceneIndex = project.scenes.findIndex(s => s.id === sceneId);
      nextMediaUrl = project.scenes[sceneIndex + 1]?.takes[0]?.videoUrl;
    }

    setEditingItem({
      id: `take-video-${take.id}`,
      url: take.videoUrl!,
      type: 'video',
      title: `Take - Vídeo`,
      source: 'Produção',
      videoObject: take.videoObject,
      initialMode: 'extend',
      nextMediaUrl
    });
  };

  const handleAnalyzeTake = async (sceneId: string, takeId: string) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    const take = scene?.takes.find((t) => t.id === takeId);
    if (!scene || !take) return;

    if (!take.startFrameUrl && !take.endFrameUrl) {
      alert("Gere pelo menos um frame para analisar a coerência.");
      return;
    }

    setIsAnalyzingTakeId(takeId);
    try {
      const takeCharacters = project.characters.filter((c) =>
        take.characterIds?.includes(c.id)
      );
      const takeSetting = project.settings.find((s) => s.id === take.settingId);

      const prompt = `Analisa a coerência visual deste take de animação.
      
      Ação do Take: ${take.action}
      Câmara: ${take.camera}
      Tipo de Filme: ${project.filmType}
      Estilo Visual: ${project.filmStyle}
      
      CONTEXTO DE REFERÊNCIA:
      Personagens: ${takeCharacters.map(c => `${c.name}: ${c.description}`).join("; ")}
      Cenário: ${takeSetting ? `${takeSetting.name}: ${takeSetting.description}` : "N/A"}
      
      Critérios:
      1. Os frames gerados correspondem à ação e câmara descritas?
      2. As personagens e o cenário nos frames são coerentes com as imagens de referência (concept art)?
      3. O estilo visual está alinhado com o projeto (${project.filmStyle})?
      
      Responde em Português com um feedback construtivo e sugestões de melhoria.`;

      const images: string[] = [];
      if (take.startFrameUrl) images.push(take.startFrameUrl);
      if (take.endFrameUrl) images.push(take.endFrameUrl);
      
      // Add reference images for comparison
      if (takeSetting?.imageUrl) images.push(takeSetting.imageUrl);
      takeCharacters.forEach(c => {
        if (c.imageUrl) images.push(c.imageUrl);
      });

      const result = await analyzeCoherence(prompt, images);
      
      const updatedScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: s.takes.map((t) =>
              t.id === takeId ? { ...t, analysis: result } : t,
            ),
          };
        }
        return s;
      });
      setProject({ ...project, scenes: updatedScenes });
    } catch (error) {
      console.error(error);
      alert("Erro ao analisar o take.");
    } finally {
      setIsAnalyzingTakeId(null);
    }
  };

  const handleFixCoherence = async (sceneId: string, takeId: string) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    const take = scene?.takes.find((t) => t.id === takeId);
    if (!scene || !take || !take.analysis) return;

    if (!window.confirm("Deseja aplicar as sugestões da IA e regenerar os frames deste take?")) return;

    setGeneratingImageId(`${takeId}-fix`);
    try {
      const takeCharacters = project.characters.filter((c) =>
        take.characterIds?.includes(c.id)
      );
      const takeSetting = project.settings.find((s) => s.id === take.settingId);

      // Collect reference images
      const referenceImages: string[] = [];
      if (takeSetting?.imageUrl) referenceImages.push(takeSetting.imageUrl);
      takeCharacters.forEach((c) => {
        if (c.imageUrl) referenceImages.push(c.imageUrl);
      });

      const charactersContext = takeCharacters
        .map((c) => `${c.name}: ${c.description}`)
        .join("\n");
      const settingContext = takeSetting 
        ? `${takeSetting.name}: ${takeSetting.description}`
        : "Nenhum cenário específico definido.";

      const dialogueContext = take.dialogueLines && take.dialogueLines.length > 0
        ? take.dialogueLines.map(line => {
            const char = project.characters.find(c => c.id === line.characterId);
            return `${char?.name || "Personagem"}: ${line.text}`;
          }).join("\n")
        : take.dialogue && take.dialogue !== "Nenhum" ? take.dialogue : "Nenhum diálogo específico.";

      // Incorporate suggestions into the prompt
      const suggestionsContext = take.analysis.suggestions.join(". ");
      
      const basePrompt = `
        Cria um frame de animação cinematográfica de alta qualidade.
        Tipo de Filme: ${project.filmType}. 
        Estilo Visual: ${project.filmStyle}. 
        Cena: ${scene.title}. 
        Ação do Take: ${take.action}. 
        Câmara: ${take.camera}. 
        
        DIÁLOGO NESTE TAKE:
        ${dialogueContext}

        PERSONAGENS PRESENTES NESTE TAKE:
        ${charactersContext || "Nenhuma personagem específica."}
        
        CENÁRIO DESTE TAKE:
        ${settingContext}
        
        CORREÇÕES E SUGESTÕES DE COERÊNCIA A APLICAR:
        ${suggestionsContext}
        
        INSTRUÇÕES DE CONSISTÊNCIA:
        1. Usa as imagens de referência fornecidas para manter a aparência exata das personagens e do cenário.
        2. Aplica rigorosamente as sugestões de correção listadas acima para garantir a coerência com o projeto.
        
        Altamente detalhado, iluminação dramática, composição profissional.
      `;

      // Regenerate start frame if it exists
      let newStartFrameUrl = take.startFrameUrl;
      let newStartFramePrompt = take.lastStartFramePrompt;
      if (take.startFrameUrl) {
        newStartFramePrompt = basePrompt;
        newStartFrameUrl = await generateImage(newStartFramePrompt, project.aspectRatio, referenceImages);
      }

      // Regenerate end frame if it exists
      let newEndFrameUrl = take.endFrameUrl;
      let newEndFramePrompt = take.lastEndFramePrompt;
      if (take.endFrameUrl) {
        newEndFramePrompt = basePrompt + " (End of action)";
        newEndFrameUrl = await generateImage(newEndFramePrompt, project.aspectRatio, referenceImages);
      }

      const updatedScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: s.takes.map((t) =>
              t.id === takeId
                ? {
                    ...t,
                    startFrameUrl: newStartFrameUrl,
                    endFrameUrl: newEndFrameUrl,
                    lastStartFramePrompt: newStartFramePrompt,
                    lastEndFramePrompt: newEndFramePrompt,
                    analysis: undefined, // Clear analysis after fix
                    updatedAt: Date.now(),
                  }
                : t,
            ),
          };
        }
        return s;
      });
      setProject({ ...project, scenes: updatedScenes });
      alert("Frames regenerados com sucesso com base nas sugestões!");
    } catch (error) {
      console.error(error);
      alert("Erro ao aplicar correções automáticas.");
    } finally {
      setGeneratingImageId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">Produção</h2>
          <p className="text-zinc-500">
            Gera keyframes e renderiza vídeo para cada take.
          </p>
        </div>
        <button
          onClick={handleGenerateAllFramesForAllScenes}
          disabled={isGeneratingBulk || !project.scenes.length}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {isGeneratingBulk ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          Gerar Todos os Frames (Todas as Cenas)
        </button>
      </div>

      {isGeneratingBulk && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
          <ProgressBar
            progress={bulkProgress}
            label="A gerar frames em massa..."
            modelName="Nanobana"
          />
        </div>
      )}

      {/* Production Info Modal */}
      {infoModalTake && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                <Info className="w-6 h-6 text-indigo-600" />
                Informação de Produção
              </h3>
              <button
                onClick={() => setInfoModalTake(null)}
                className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-zinc-500" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ação</label>
                  <p className="text-zinc-700 bg-zinc-50 p-4 rounded-xl border border-zinc-100 leading-relaxed">
                    {infoModalTake.action}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Câmara</label>
                  <p className="text-zinc-700 bg-zinc-50 p-4 rounded-xl border border-zinc-100 leading-relaxed">
                    {infoModalTake.camera}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Som e Música</label>
                  <p className="text-zinc-700 bg-zinc-50 p-4 rounded-xl border border-zinc-100 leading-relaxed">
                    {infoModalTake.sound}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Diálogo</label>
                  <div className="text-zinc-700 bg-zinc-50 p-4 rounded-xl border border-zinc-100 leading-relaxed">
                    {infoModalTake.dialogueLines && infoModalTake.dialogueLines.length > 0 ? (
                      <div className="space-y-2">
                        {infoModalTake.dialogueLines.map((line, idx) => {
                          const char = project.characters.find(c => c.id === line.characterId);
                          return (
                            <div key={idx} className="flex gap-2 text-xs">
                              <span className="font-bold text-indigo-600 min-w-[80px]">{char?.name || "???"}:</span>
                              <span className="text-zinc-700 italic">"{line.text}"</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm italic">{infoModalTake.dialogue || "Sem diálogo"}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Personagens</label>
                  <div className="flex flex-wrap gap-2 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    {infoModalTake.characterIds && infoModalTake.characterIds.length > 0 ? (
                      project.characters
                        .filter(c => infoModalTake.characterIds?.includes(c.id))
                        .map(c => (
                          <div key={c.id} className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-zinc-200 text-xs font-medium">
                            {c.imageUrl && <img src={c.imageUrl} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />}
                            {c.name}
                          </div>
                        ))
                    ) : (
                      <span className="text-zinc-400 text-xs">Nenhuma personagem selecionada</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cenário</label>
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                    {infoModalTake.settingId ? (
                      (() => {
                        const setting = project.settings.find(s => s.id === infoModalTake.settingId);
                        return setting ? (
                          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-zinc-200 text-xs font-medium w-fit">
                            {setting.imageUrl && <img src={setting.imageUrl} className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />}
                            {setting.name}
                          </div>
                        ) : <span className="text-zinc-400 text-xs">Cenário não encontrado</span>;
                      })()
                    ) : (
                      <span className="text-zinc-400 text-xs">Nenhum cenário selecionado</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setInfoModalTake(null)}
                className="bg-zinc-900 text-white px-8 py-2 rounded-xl font-bold hover:bg-zinc-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar for Scenes */}
        <div className="w-64 shrink-0 space-y-2">
          {project.scenes.map((scene) => (
            <div
              key={scene.id}
              onClick={() => setExpandedSceneId(scene.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors cursor-pointer ${
                expandedSceneId === scene.id
                  ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"
                  : "bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200"
              }`}
            >
              <div className="truncate font-bold">
                Cena {(project.scenes.indexOf(scene) + 1).toString().padStart(2, "0")}
              </div>
              <div className="truncate text-xs opacity-80">{scene.title}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs font-normal opacity-70">
                    {scene.takes.length} Takes
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateAllStartFramesForScene(scene.id);
                        }}
                        className="flex-1 text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-200 transition-colors font-bold uppercase"
                        title="Gerar todos os frames iniciais desta cena"
                      >
                        Gerar F. Inicial
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAllStartFramesForScene(scene.id);
                        }}
                        className="text-[9px] bg-rose-100 text-rose-600 px-1.5 py-1 rounded hover:bg-rose-200 transition-colors font-bold uppercase"
                        title="Apagar todos os frames iniciais desta cena"
                      >
                        Apagar
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateAllEndFramesForScene(scene.id);
                        }}
                        className="flex-1 text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-1 rounded hover:bg-indigo-200 transition-colors font-bold uppercase"
                        title="Gerar todos os frames finais desta cena"
                      >
                        Gerar F. Final
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAllEndFramesForScene(scene.id);
                        }}
                        className="text-[9px] bg-rose-100 text-rose-600 px-1.5 py-1 rounded hover:bg-rose-200 transition-colors font-bold uppercase"
                        title="Apagar todos os frames finais desta cena"
                      >
                        Apagar
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateAllVideosForScene(scene.id);
                        }}
                        className="flex-1 text-[9px] bg-emerald-100 text-emerald-600 px-1.5 py-1 rounded hover:bg-emerald-200 transition-colors font-bold uppercase"
                        title="Renderizar todos os vídeos desta cena"
                      >
                        Renderizar Vídeos
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAllVideosForScene(scene.id);
                        }}
                        className="text-[9px] bg-rose-100 text-rose-600 px-1.5 py-1 rounded hover:bg-rose-200 transition-colors font-bold uppercase"
                        title="Apagar todos os vídeos desta cena"
                      >
                        Apagar
                      </button>
                    </div>
                  </div>
                </div>
            </div>
          ))}
        </div>

        {/* Main Content for Takes */}
        <div className="flex-1 space-y-6">
          {project.scenes
            .find((s) => s.id === expandedSceneId)
            ?.takes.map((take, index) => (
              <div
                key={take.id}
                className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden"
              >
                <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-zinc-900">
                      Take {(project.scenes.indexOf(project.scenes.find(s => s.id === expandedSceneId)!) + 1)}
                      .{(index + 1).toString().padStart(2, "0")}
                    </h3>
                    <button
                      onClick={() => setInfoModalTake(take)}
                      className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-500 transition-colors"
                      title="Ver Informação de Produção"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    {(take.startFrameUrl || take.endFrameUrl) && (
                      <button
                        onClick={() => handleAnalyzeTake(expandedSceneId!, take.id)}
                        disabled={isAnalyzingTakeId === take.id}
                        className={`p-1.5 rounded-lg transition-all ${
                          take.analysis 
                            ? take.analysis.status === 'ok' ? 'text-emerald-500 bg-emerald-50' : 
                              take.analysis.status === 'warning' ? 'text-amber-500 bg-amber-50' : 
                              'text-rose-500 bg-rose-50'
                            : 'text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title="Analisar Coerência do Take"
                      >
                        {isAnalyzingTakeId === take.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {/* Character & Setting Alerts */}
                    <div className="flex gap-2">
                      {(() => {
                        const status = getTakeConsistencyStatus(take);
                        return (
                          <div 
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              status.isReady 
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                                : "bg-rose-50 text-rose-600 border-rose-200"
                            }`}
                            title={status.isReady ? "Consistência Garantida: Todas as referências presentes." : "Inconsistência Detetada: Faltam referências!"}
                          >
                            {status.isReady ? <Sparkles className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {status.isReady ? "Consistência OK" : "Faltam Referências"}
                          </div>
                        );
                      })()}

                      {project.characters.filter(char => 
                        take.characterIds?.includes(char.id)
                      ).map(char => {
                        const isOutdated = take.updatedAt && char.updatedAt && char.updatedAt > take.updatedAt;
                        return (
                          <div 
                            key={char.id}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isOutdated 
                                ? "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse" 
                                : "bg-zinc-200 text-zinc-600"
                            }`}
                            title={isOutdated ? "A personagem foi alterada após a geração deste take!" : char.name}
                          >
                            <Users className="w-3 h-3" />
                            {char.name}
                            {isOutdated && (
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span className="hidden sm:inline">Desatualizado</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                      
                      {take.settingId && (() => {
                        const setting = project.settings.find(s => s.id === take.settingId);
                        if (!setting) return null;
                        const isOutdated = take.updatedAt && setting.updatedAt && setting.updatedAt > take.updatedAt;
                        return (
                          <div 
                            key={setting.id}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isOutdated 
                                ? "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse" 
                                : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            }`}
                            title={isOutdated ? "O cenário foi alterado após a geração deste take!" : setting.name}
                          >
                            <MapPin className="w-3 h-3" />
                            {setting.name}
                            {isOutdated && (
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span className="hidden sm:inline">Desatualizado</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="text-sm text-zinc-500 max-w-md truncate">
                    {take.action}
                  </div>
                </div>

                {take.analysis && (
                  <div className={`mx-6 mt-4 p-4 rounded-2xl border text-xs space-y-2 ${
                    take.analysis.status === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 
                    take.analysis.status === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' : 
                    'bg-rose-50 border-rose-100 text-rose-800'
                  }`}>
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                      <AlertTriangle className="w-3 h-3" />
                      Análise de Coerência do Take: {take.analysis.status}
                    </div>
                    <p className="leading-relaxed">{take.analysis.feedback}</p>
                    {take.analysis.suggestions.length > 0 && (
                      <ul className="list-disc list-inside space-y-1 opacity-80">
                        {take.analysis.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    )}
                    {take.analysis.status === 'warning' && (
                      <div className="pt-2">
                        <button
                          onClick={() => handleFixCoherence(expandedSceneId!, take.id)}
                          disabled={generatingImageId === `${take.id}-fix`}
                          className="flex items-center gap-2 bg-white/50 hover:bg-white text-amber-700 px-3 py-1.5 rounded-lg font-bold transition-all border border-amber-200 shadow-sm disabled:opacity-50"
                        >
                          {generatingImageId === `${take.id}-fix` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          Aplicar Correções Automáticas
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="px-6 pt-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Referências de Consistência</span>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const takeCharacters = project.characters.filter((c) =>
                            take.characterIds?.includes(c.id)
                          );
                          const takeSetting = project.settings.find((s) => s.id === take.settingId);
                          
                          return (
                            <>
                              {takeSetting?.imageUrl && (
                                <div className="relative group">
                                  <img 
                                    src={takeSetting.imageUrl} 
                                    alt={takeSetting.name}
                                    className="w-12 h-12 rounded-lg object-cover border border-zinc-200 shadow-sm"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                    <MapPin className="w-3 h-3 text-white" />
                                  </div>
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                                    Cenário: {takeSetting.name}
                                  </div>
                                </div>
                              )}
                              {takeCharacters.map(c => (
                                <div key={c.id} className="relative group">
                                  {c.imageUrl ? (
                                    <img 
                                      src={c.imageUrl} 
                                      alt={c.name}
                                      className="w-12 h-12 rounded-lg object-cover border border-zinc-200 shadow-sm"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                                      <Users className="w-4 h-4 text-zinc-300" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                    <Users className="w-3 h-3 text-white" />
                                  </div>
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                                    Personagem: {c.name}
                                  </div>
                                </div>
                              ))}
                              {takeCharacters.length === 0 && !takeSetting?.imageUrl && (
                                <span className="text-[10px] text-zinc-400 italic">Nenhuma referência definida</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Start Frame */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500 uppercase">
                        Frame Inicial
                      </span>
                      <div className="flex items-center gap-1">
                        <label className="cursor-pointer text-[10px] flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2 py-1 rounded transition-colors">
                          <Upload className="w-3 h-3" />
                          Importar
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => handleFileUpload(expandedSceneId!, take.id, "start", e)}
                          />
                        </label>
                        <button
                          onClick={() =>
                            setEditingPrompt({
                              sceneId: expandedSceneId!,
                              takeId: take.id,
                              type: "start",
                              prompt: getDefaultFramePrompt(expandedSceneId!, take.id)
                            })
                          }
                          disabled={generatingImageId === `${take.id}-start`}
                          className="text-[10px] flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                          {generatingImageId === `${take.id}-start` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          Gerar
                        </button>
                      </div>
                    </div>
                    <div 
                      className="w-full bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 flex items-center justify-center relative group"
                      style={{ aspectRatio: (project.aspectRatio || '16:9').replace(':', '/') }}
                    >
                      {take.startFrameUrl ? (
                        <>
                          <img
                            src={take.startFrameUrl}
                            alt="Frame Inicial"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              console.error("Erro ao carregar Frame Inicial");
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'flex flex-col items-center gap-2 text-rose-500 p-4 text-center';
                                errorDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg><span class="text-[10px] font-bold">Erro ao carregar imagem. Tenta gerar novamente.</span>';
                                parent.appendChild(errorDiv);
                              }
                            }}
                          />
                          <button
                            onClick={() => setEditingItem({
                              id: `take-start-${take.id}`,
                              url: take.startFrameUrl!,
                              type: 'image',
                              title: `Take ${index + 1} - Frame Inicial`,
                              source: 'Produção'
                            })}
                            className="absolute top-2 right-[72px] bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-indigo-600 shadow-sm transition-all z-20"
                            title="Edição Inteligente"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedImage({ url: take.startFrameUrl!, title: `Take ${index + 1} - Frame Inicial` })}
                            className="absolute top-2 right-2 bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-indigo-600 shadow-sm transition-all z-20"
                            title="Maximizar"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFrame(expandedSceneId!, take.id, "start")}
                            className="absolute top-2 right-10 bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-red-600 shadow-sm transition-all z-20"
                            title="Apagar Frame Inicial"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <a
                            href={take.startFrameUrl}
                            download={`take-${index + 1}-start-frame.png`}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute top-2 left-2 bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-indigo-600 shadow-sm transition-all z-20"
                            title="Descarregar Frame Inicial"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </>
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-300" />
                      )}

                      {generatingImageId === `${take.id}-start` && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
                          <ProgressBar
                            progress={imageProgress}
                            label="A gerar..."
                            modelName="Nanobana"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* End Frame */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500 uppercase">
                        Frame Final (Opcional)
                      </span>
                      <div className="flex items-center gap-1">
                        <label className="cursor-pointer text-[10px] flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2 py-1 rounded transition-colors">
                          <Upload className="w-3 h-3" />
                          Importar
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => handleFileUpload(expandedSceneId!, take.id, "end", e)}
                          />
                        </label>
                        <button
                          onClick={() =>
                            setEditingPrompt({
                              sceneId: expandedSceneId!,
                              takeId: take.id,
                              type: "end",
                              prompt: getDefaultFramePrompt(expandedSceneId!, take.id)
                            })
                          }
                          disabled={generatingImageId === `${take.id}-end`}
                          className="text-[10px] flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                          {generatingImageId === `${take.id}-end` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          Gerar
                        </button>
                      </div>
                    </div>
                    <div 
                      className="w-full bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 flex items-center justify-center relative group"
                      style={{ aspectRatio: (project.aspectRatio || '16:9').replace(':', '/') }}
                    >
                      {take.endFrameUrl ? (
                        <>
                          <img
                            src={take.endFrameUrl}
                            alt="Frame Final"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              console.error("Erro ao carregar Frame Final");
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'flex flex-col items-center gap-2 text-rose-500 p-4 text-center';
                                errorDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg><span class="text-[10px] font-bold">Erro ao carregar imagem. Tenta gerar novamente.</span>';
                                parent.appendChild(errorDiv);
                              }
                            }}
                          />
                          <button
                            onClick={() => setEditingItem({
                              id: `take-end-${take.id}`,
                              url: take.endFrameUrl!,
                              type: 'image',
                              title: `Take ${index + 1} - Frame Final`,
                              source: 'Produção'
                            })}
                            className="absolute top-2 right-[72px] bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-indigo-600 shadow-sm transition-all z-20"
                            title="Edição Inteligente"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedImage({ url: take.endFrameUrl!, title: `Take ${index + 1} - Frame Final` })}
                            className="absolute top-2 right-2 bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-indigo-600 shadow-sm transition-all z-20"
                            title="Maximizar"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFrame(expandedSceneId!, take.id, "end")}
                            className="absolute top-2 right-10 bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-red-600 shadow-sm transition-all z-20"
                            title="Apagar Frame Final"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <a
                            href={take.endFrameUrl}
                            download={`take-${index + 1}-end-frame.png`}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute top-2 left-2 bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-indigo-600 shadow-sm transition-all z-20"
                            title="Descarregar Frame Final"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </>
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-300" />
                      )}

                      {generatingImageId === `${take.id}-end` && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
                          <ProgressBar
                            progress={imageProgress}
                            label="A gerar..."
                            modelName="Nanobana"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Video */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500 uppercase">
                        Vídeo Final
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                          <button
                            onClick={() => handleUpdateTakeModel(expandedSceneId!, take.id, 'veo-3.1')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${
                              (take.videoModel || project.videoModel) === 'veo-3.1'
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-zinc-400 hover:text-zinc-600"
                            }`}
                          >
                            VEO 3.1
                          </button>
                          <button
                            onClick={() => handleUpdateTakeModel(expandedSceneId!, take.id, 'veo-fast')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${
                              (take.videoModel || project.videoModel) === 'veo-fast'
                                ? "bg-white text-amber-600 shadow-sm"
                                : "text-zinc-400 hover:text-zinc-600"
                            }`}
                          >
                            FAST
                          </button>
                          <button
                            onClick={() => handleUpdateTakeModel(expandedSceneId!, take.id, 'flow')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${
                              (take.videoModel || project.videoModel) === 'flow'
                                ? "bg-white text-emerald-600 shadow-sm"
                                : "text-zinc-400 hover:text-zinc-600"
                            }`}
                          >
                            FLOW
                          </button>
                        </div>
                        <button
                          onClick={() => setInfoModalTake(take)}
                          className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-2 py-1 rounded transition-colors"
                          title="Info de Produção"
                        >
                          <Info className="w-3 h-3" />
                          Info
                        </button>
                        <button
                          onClick={() => {
                            const prompt = take.lastVideoPrompt || getDefaultVideoPrompt(expandedSceneId!, take.id);
                            setImportingVideo({ sceneId: expandedSceneId!, takeId: take.id, prompt });
                          }}
                          className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-2 py-1 rounded transition-colors"
                          title="Importar vídeo manualmente"
                        >
                          <Upload className="w-3 h-3" />
                          Importar
                        </button>
                        <button
                          onClick={() =>
                            handleGenerateVideo(expandedSceneId!, take.id)
                          }
                          disabled={
                            generatingVideoId === take.id ||
                            !!take.videoOperationId
                          }
                          className="text-xs flex items-center gap-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded font-medium transition-colors disabled:opacity-50"
                        >
                          {generatingVideoId === take.id ||
                          take.videoOperationId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Film className="w-3 h-3" />
                          )}
                          Renderizar Vídeo
                        </button>
                        {take.videoUrl && take.videoObject && (
                          <button
                            onClick={() =>
                              handleExtendTake(expandedSceneId!, take.id)
                            }
                            disabled={
                              generatingVideoId === take.id ||
                              !!take.videoOperationId
                            }
                            className="text-xs flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded font-medium transition-colors disabled:opacity-50"
                            title="Extender vídeo em +7 segundos (Apenas VEO)"
                          >
                            {generatingVideoId === take.id ||
                            take.videoOperationId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <PlusCircle className="w-3 h-3" />
                            )}
                            Extender
                          </button>
                        )}
                      </div>
                    </div>
                    <div 
                      className="w-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center relative group"
                      style={{ aspectRatio: (project.aspectRatio || '16:9').replace(':', '/') }}
                    >
                      {take.videoUrl ? (
                        <>
                          <video
                            src={take.videoUrl}
                            controls
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => {
                              const currentScene = project.scenes.find(s => s.id === expandedSceneId);
                              let nextMediaUrl = currentScene?.takes[index + 1]?.videoUrl;
                              if (!nextMediaUrl && currentScene) {
                                const sceneIndex = project.scenes.indexOf(currentScene);
                                nextMediaUrl = project.scenes[sceneIndex + 1]?.takes[0]?.videoUrl;
                              }
                              
                              setEditingItem({
                                id: `take-video-${take.id}`,
                                url: take.videoUrl!,
                                type: 'video',
                                title: `Take ${index + 1} - Vídeo`,
                                source: 'Produção',
                                videoObject: take.videoObject,
                                nextMediaUrl
                              });
                            }}
                            className="absolute top-2 right-10 bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-indigo-600 shadow-sm transition-all z-20 flex items-center justify-center"
                            title="Edição Inteligente"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <a
                            href={take.videoUrl}
                            download={`take-${index + 1}-video.mp4`}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute top-2 right-2 bg-white/90 text-zinc-700 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white hover:text-indigo-600 shadow-sm transition-all z-20 flex items-center justify-center"
                            title="Descarregar Vídeo"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </>
                      ) : (take.videoOperationId || generatingVideoId === take.id) ? (
                        <div className="absolute inset-0 bg-zinc-900/90 flex flex-col items-center justify-center p-6 text-center">
                          <ProgressBar
                            progress={videoProgress}
                            label={videoStatus || "A renderizar vídeo..."}
                            modelName={(take.videoModel || project.videoModel) === 'veo-3.1' ? 'Veo 3.1' : (take.videoModel || project.videoModel) === 'veo-fast' ? 'Veo Fast' : 'Flow'}
                          />
                          <p className="mt-2 text-[8px] text-zinc-500 italic">
                            Isto pode demorar 2-5 min. Podes continuar a trabalhar.
                          </p>
                        </div>
                      ) : (
                        <PlayCircle className="w-8 h-8 text-zinc-700" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {(!project.scenes.find((s) => s.id === expandedSceneId) ||
            project.scenes.find((s) => s.id === expandedSceneId)?.takes
              .length === 0) && (
            <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200 text-zinc-500">
              Não foram encontrados takes para esta cena. Volta ao separador "Cenas e Takes" para os gerares.
            </div>
          )}
        </div>
      </div>

      {/* Video Import Modal */}
      {importingVideo && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Importar Vídeo</h3>
                  <p className="text-xs text-zinc-500">Faz o upload de um vídeo externo.</p>
                </div>
              </div>
              <button onClick={() => setImportingVideo(null)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Formato Necessário</span>
                  <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">{project.aspectRatio}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Prompt Definido</span>
                  <p className="text-[11px] text-indigo-900 leading-relaxed bg-white/50 p-2 rounded-lg border border-indigo-100/50 max-h-32 overflow-y-auto custom-scrollbar">
                    {importingVideo.prompt}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Selecionar Ficheiro</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleVideoFileUpload(importingVideo.sceneId, importingVideo.takeId, e)}
                  className="w-full text-sm text-zinc-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Editor Modal */}
      {editingPrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-zinc-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Validar Prompt de Geração</h3>
                  <p className="text-xs text-zinc-500">Edita o prompt para garantir que o resultado é o pretendido.</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingPrompt(null)}
                className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                  Prompt para o Frame {editingPrompt.type === 'start' ? 'Inicial' : 'Final'}
                </label>
                <textarea
                  value={editingPrompt.prompt}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt: e.target.value })}
                  className="w-full h-64 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none font-mono leading-relaxed"
                  placeholder="Descreve o frame em detalhe..."
                />
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  <strong>Dica:</strong> O prompt já inclui o contexto do filme, personagens e cenário. 
                  Podes adicionar detalhes específicos sobre a pose, iluminação ou expressão facial para este take.
                </p>
              </div>
            </div>
            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingPrompt(null)}
                className="px-6 py-2.5 rounded-xl font-bold text-zinc-600 hover:bg-zinc-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const { sceneId, takeId, type, prompt } = editingPrompt;
                  setEditingPrompt(null);
                  setGeneratingImageId(`${takeId}-${type}`);
                  const result = await handleGenerateFrame(sceneId, takeId, type, false, prompt);
                  if (result) {
                    const updatedScenes = project.scenes.map((s) => {
                      if (s.id === sceneId) {
                        return {
                          ...s,
                          takes: s.takes.map((t) =>
                            t.id === takeId
                              ? {
                                  ...t,
                                  [type === "start" ? "startFrameUrl" : "endFrameUrl"]: result.imageUrl,
                                  [type === "start" ? "lastStartFramePrompt" : "lastEndFramePrompt"]: result.prompt,
                                  updatedAt: Date.now(),
                                }
                              : t,
                          ),
                        };
                      }
                      return s;
                    });
                    setProject({ ...project, scenes: updatedScenes });
                  }
                }}
                className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Confirmar e Gerar
              </button>
            </div>
          </div>
        </div>
      )}

      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url || null}
        title={selectedImage?.title}
      />
      <PromptEditorModal
        isOpen={!!editingVideoPrompt}
        onClose={() => setEditingVideoPrompt(null)}
        onConfirm={(editedPrompt) => confirmGenerateVideo(editingVideoPrompt!.sceneId, editingVideoPrompt!.takeId, editedPrompt)}
        initialPrompt={editingVideoPrompt?.prompt || ""}
        title="Validar Prompt de Vídeo"
        description="Edita o prompt para garantir que a animação do vídeo corresponde à tua visão."
      />

      {editingItem && (
        <IntelligentEditor 
          mediaItem={editingItem}
          aspectRatio={project.aspectRatio}
          initialMode={editingItem.initialMode}
          defaultVideoModel={project.videoModel}
          nextMediaUrl={editingItem.nextMediaUrl}
          onSave={handleSaveEdit}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
