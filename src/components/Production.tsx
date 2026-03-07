import React, { useState, useEffect } from "react";
import { Project, Scene, Take, Character, Setting } from "../types";
import {
  generateImage,
  generateVideo,
  pollVideoOperation,
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
} from "lucide-react";
import ProgressBar from "./ProgressBar";
import { ImageModal } from "./ImageModal";

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
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(
    project.scenes[0]?.id || null,
  );
  const [infoModalTake, setInfoModalTake] = useState<Take | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);

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
      // Video generation is slow, so we increment slowly
      interval = setInterval(() => {
        setVideoProgress((prev) => {
          if (prev >= 98) return prev;
          // Slower progress for video
          return prev + Math.random() * 0.5;
        });
      }, 1000);
    } else {
      setVideoProgress(100);
    }
    return () => clearInterval(interval);
  }, [generatingVideoId]);

  const handleGenerateFrame = async (
    sceneId: string,
    takeId: string,
    type: "start" | "end",
    silent = false,
  ) => {
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

      const prompt = `
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
        
        INSTRUÇÕES DE CONSISTÊNCIA:
        1. Usa as imagens de referência fornecidas para manter a aparência exata das personagens e do cenário.
        2. As personagens devem ser instantaneamente reconhecíveis e consistentes com os seus designs originais.
        3. O cenário deve manter a mesma arquitetura, iluminação e atmosfera definida no concept art.
        4. Integra as personagens de forma natural no cenário de acordo com a ação descrita.
        
        Altamente detalhado, iluminação dramática, composição profissional.
      `;
      const imageUrl = await generateImage(prompt, "16:9", referenceImages);
      return imageUrl;
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

  const onGenerateFrame = async (sceneId: string, takeId: string, type: "start" | "end") => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    const take = scene?.takes.find((t) => t.id === takeId);
    
    if (take && !checkConsistencyRequirements(take)) {
      return;
    }

    const imageUrl = await handleGenerateFrame(sceneId, takeId, type);
    if (imageUrl) {
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

  const handleGenerateAllFramesForScene = async (sceneId: string) => {
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    // Check all takes for consistency requirements
    let allRequirementsMet = true;
    for (const take of scene.takes) {
      if (!take.startFrameUrl || !take.endFrameUrl) {
        if (!checkConsistencyRequirements(take)) {
          allRequirementsMet = false;
          break;
        }
      }
    }

    if (!allRequirementsMet) return;

    setIsGeneratingBulk(true);
    setBulkProgress(0);
    try {
      const updatedTakes = [...scene.takes];
      for (let i = 0; i < updatedTakes.length; i++) {
        setBulkProgress((i / updatedTakes.length) * 100);
        const take = updatedTakes[i];
        
        // Generate start frame if missing
        if (!take.startFrameUrl) {
          const startUrl = await handleGenerateFrame(sceneId, take.id, "start", true);
          if (startUrl) {
            updatedTakes[i].startFrameUrl = startUrl;
            updatedTakes[i].updatedAt = Date.now();
          }
        }
        
        // Generate end frame if missing
        if (!take.endFrameUrl) {
          const endUrl = await handleGenerateFrame(sceneId, take.id, "end", true);
          if (endUrl) {
            updatedTakes[i].endFrameUrl = endUrl;
            updatedTakes[i].updatedAt = Date.now();
          }
        }
      }

      const updatedScenes = project.scenes.map((s) =>
        s.id === sceneId ? { ...s, takes: updatedTakes } : s,
      );
      setProject({ ...project, scenes: updatedScenes });
      alert(`Todos os frames da cena "${scene.title}" foram gerados!`);
    } catch (error) {
      console.error(error);
      alert("Erro na geração em massa.");
    } finally {
      setIsGeneratingBulk(false);
    }
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
            const startUrl = await handleGenerateFrame(scene.id, take.id, "start", true);
            if (startUrl) {
              updatedTakes[j].startFrameUrl = startUrl;
              updatedTakes[j].updatedAt = Date.now();
            }
          }
          if (!take.endFrameUrl) {
            const endUrl = await handleGenerateFrame(scene.id, take.id, "end", true);
            if (endUrl) {
              updatedTakes[j].endFrameUrl = endUrl;
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
          const operation = await generateVideo(
            prompt,
            take.startFrameUrl,
            take.endFrameUrl,
          );

          // Update state with operation ID
          const updatedScenes = project.scenes.map((s) => {
            if (s.id === sceneId) {
              return {
                ...s,
                takes: s.takes.map((t) =>
                  t.id === take.id ? { ...t, videoOperationId: operation.name } : t,
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
    setGeneratingVideoId(takeId);
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

      // Check if API key is selected
      const hasKey = await (window as any).aistudio?.hasSelectedApiKey?.();
      if (!hasKey) {
        if ((window as any).aistudio?.openSelectKey) {
          await (window as any).aistudio.openSelectKey();
        } else {
          alert("Por favor, configura a tua Chave API Gemini primeiro.");
          return;
        }
      }

      const operation = await generateVideo(
        prompt,
        take.startFrameUrl,
        take.endFrameUrl,
      );

      // Save operation name to state so we know it's generating
      const updatedScenes = project.scenes.map((s) => {
        if (s.id === sceneId) {
          return {
            ...s,
            takes: s.takes.map((t) =>
              t.id === takeId ? { ...t, videoOperationId: operation.name } : t,
            ),
          };
        }
        return s;
      });
      setProject({ ...project, scenes: updatedScenes });

      // Start polling
      try {
        const videoUrl = await pollVideoOperation(operation.name);

        // Update with final video URL
        setProject(prev => ({
          ...prev,
          scenes: prev.scenes.map((s) => {
            if (s.id === sceneId) {
              return {
                ...s,
                takes: s.takes.map((t) =>
                  t.id === takeId
                    ? { ...t, videoUrl, videoOperationId: undefined }
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
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar vídeo. Verifica a consola.");

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
      if (take.startFrameUrl) {
        newStartFrameUrl = await generateImage(basePrompt, "16:9", referenceImages);
      }

      // Regenerate end frame if it exists
      let newEndFrameUrl = take.endFrameUrl;
      if (take.endFrameUrl) {
        newEndFrameUrl = await generateImage(basePrompt + " (End of action)", "16:9", referenceImages);
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
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateAllFramesForScene(scene.id);
                      }}
                      className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded hover:bg-indigo-200 transition-colors"
                      title="Gerar todos os frames desta cena"
                    >
                      Frames
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateAllVideosForScene(scene.id);
                      }}
                      className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded hover:bg-emerald-200 transition-colors"
                      title="Renderizar todos os vídeos desta cena"
                    >
                      Vídeos
                    </button>
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

                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Start Frame */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500 uppercase">
                        Frame Inicial
                      </span>
                      <button
                        onClick={() =>
                          onGenerateFrame(
                            expandedSceneId!,
                            take.id,
                            "start",
                          )
                        }
                        disabled={generatingImageId === `${take.id}-start`}
                        className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                      >
                        {generatingImageId === `${take.id}-start` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        Gerar
                      </button>
                    </div>
                    <div className="aspect-video bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 flex items-center justify-center relative group">
                      {take.startFrameUrl ? (
                        <>
                          <img
                            src={take.startFrameUrl}
                            alt="Frame Inicial"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
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
                      <button
                        onClick={() =>
                          onGenerateFrame(expandedSceneId!, take.id, "end")
                        }
                        disabled={generatingImageId === `${take.id}-end`}
                        className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                      >
                        {generatingImageId === `${take.id}-end` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        Gerar
                      </button>
                    </div>
                    <div className="aspect-video bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 flex items-center justify-center relative group">
                      {take.endFrameUrl ? (
                        <>
                          <img
                            src={take.endFrameUrl}
                            alt="Frame Final"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
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
                        <button
                          onClick={() => setInfoModalTake(take)}
                          className="text-xs flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-2 py-1 rounded transition-colors"
                          title="Info de Produção"
                        >
                          <Info className="w-3 h-3" />
                          Info
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
                      </div>
                    </div>
                    <div className="aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center relative group">
                      {take.videoUrl ? (
                        <video
                          src={take.videoUrl}
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : take.videoOperationId ? (
                        <div className="absolute inset-0 bg-zinc-900/90 flex items-center justify-center p-6">
                          <ProgressBar
                            progress={videoProgress}
                            label="A renderizar vídeo..."
                            modelName="Flow"
                          />
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

      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url || null}
        title={selectedImage?.title}
      />
    </div>
  );
}
