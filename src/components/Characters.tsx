import { useState, useEffect } from "react";
import React from "react";
import { Project, Character } from "../types";
import {
  generateJSON,
  generateImage,
  describeCharacterFromImage,
  analyzeCoherence,
} from "../services/geminiService";
import {
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  Upload,
  FileText,
  ZoomIn,
  AlertTriangle,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { v4 as uuidv4 } from "uuid";
import { Type } from "@google/genai";
import ProgressBar from "./ProgressBar";
import { ImageModal } from "./ImageModal";
import { PromptEditorModal } from "./PromptEditorModal";

interface CharactersProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function Characters({ project, setProject }: CharactersProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(
    null,
  );
  const [generatingViewsId, setGeneratingViewsId] = useState<string | null>(
    null,
  );
  const [isImportingId, setIsImportingId] = useState<string | null>(null);
  const [isAnalyzingId, setIsAnalyzingId] = useState<string | null>(null);
  const [imageProgress, setImageProgress] = useState(0);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<{ id: string; prompt: string; type: 'main' | 'views' } | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setExtractProgress(0);
      interval = setInterval(() => {
        setExtractProgress((prev) => (prev >= 95 ? prev : prev + Math.random() * 10));
      }, 400);
    } else {
      setExtractProgress(100);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generatingImageId || generatingViewsId || isImportingId) {
      setImageProgress(0);
      interval = setInterval(() => {
        setImageProgress((prev) => (prev >= 95 ? prev : prev + Math.random() * 15));
      }, 300);
    } else {
      setImageProgress(100);
    }
    return () => clearInterval(interval);
  }, [generatingImageId, generatingViewsId, isImportingId]);

  const handleExportPDF = async () => {
    if (project.characters.length === 0) {
      alert("Não há personagens para exportar.");
      return;
    }

    setIsExportingPDF(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = 20;

      // Title
      doc.setFontSize(24);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text("Report de Personagens", margin, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.setTextColor(113, 113, 122); // Zinc-500
      doc.text(`Projeto: ${project.title || "Sem Nome"}`, margin, yPos);
      yPos += 15;

      for (const char of project.characters) {
        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        // Character Name
        doc.setFontSize(18);
        doc.setTextColor(24, 24, 27); // Zinc-900
        doc.text(char.name, margin, yPos);
        yPos += 8;

        // Description
        doc.setFontSize(10);
        doc.setTextColor(63, 63, 70); // Zinc-700
        const splitDescription = doc.splitTextToSize(char.description, pageWidth - (margin * 2));
        doc.text(splitDescription, margin, yPos);
        yPos += (splitDescription.length * 5) + 10;

        // Concept Image
        if (char.imageUrl) {
          try {
            const imgData = await getBase64FromUrl(char.imageUrl);
            const imgProps = doc.getImageProperties(imgData);
            const imgWidth = 80;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            
            if (yPos + imgHeight > 280) {
              doc.addPage();
              yPos = 20;
            }
            
            doc.addImage(imgData, "PNG", margin, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 10;
          } catch (e) {
            console.error("Erro ao adicionar imagem ao PDF", e);
          }
        }

        // Turnaround Views
        if (char.viewsImageUrl) {
          try {
            const imgData = await getBase64FromUrl(char.viewsImageUrl);
            const imgProps = doc.getImageProperties(imgData);
            const imgWidth = pageWidth - (margin * 2);
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            if (yPos + imgHeight > 280) {
              doc.addPage();
              yPos = 20;
            }

            doc.setFontSize(8);
            doc.setTextColor(161, 161, 170); // Zinc-400
            doc.text("QUADRO DE VISTAS (TURNAROUND)", margin, yPos - 2);
            doc.addImage(imgData, "PNG", margin, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 20;
          } catch (e) {
            console.error("Erro ao adicionar vistas ao PDF", e);
          }
        }

        yPos += 10; // Space between characters
      }

      doc.save(`${project.title || "projeto"}-personagens.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar o report em PDF.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const getBase64FromUrl = async (url: string): Promise<string> => {
    if (url.startsWith("data:")) return url;
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleGenerateCharacters = async () => {
    setIsGenerating(true);
    try {
      const prompt = `
        Com base no seguinte guião de filme de animação, extrai as personagens principais e descreve-as visualmente e psicologicamente.
        Para cada personagem, define também as características da sua voz para dobragem (língua/país, idade aproximada e personalidade vocal).
        Tipo de filme: ${project.filmType}
        Estilo de filme: ${project.filmStyle}
        Guião: ${project.script}
      `;

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nome da personagem" },
            description: {
              type: Type.STRING,
              description:
                "Descrição detalhada (aparência, personalidade, papel na história)",
            },
            voice: {
              type: Type.OBJECT,
              properties: {
                language: { type: Type.STRING, description: "Língua falada (ex: Português)" },
                country: { type: Type.STRING, description: "País/Sotaque (ex: Portugal)" },
                age: { type: Type.STRING, description: "Idade aproximada da voz" },
                personality: { type: Type.STRING, description: "Personalidade da voz (ex: Rouca, Enérgica, Sombria)" },
              },
              required: ["language", "country", "age", "personality"],
            },
          },
          required: ["name", "description", "voice"],
        },
      };

      const result = await generateJSON(
        prompt,
        schema,
        "És um character designer de cinema de animação.",
      );
      const parsed = JSON.parse(result);

      const newCharacters: Character[] = parsed.map((c: any) => ({
        id: uuidv4(),
        name: c.name,
        description: c.description,
        voice: c.voice,
      }));

      setProject({ ...project, characters: newCharacters });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar personagens.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async (character: Character) => {
    const prompt = `Character design for an animated film. 
      Estilo Visual: ${project.filmStyle}. 
      Visual Description: ${character.description}. 
      One single front-facing view of the character, full body, neutral background.`;
    
    setEditingPrompt({ id: character.id, prompt, type: 'main' });
  };

  const confirmGenerateImage = async (editedPrompt: string) => {
    const charId = editingPrompt?.id;
    if (!charId) return;

    setEditingPrompt(null);
    setGeneratingImageId(charId);
    try {
      setActivePrompt(editedPrompt);
      const imageUrl = await generateImage(editedPrompt, "1:1");

      const updatedCharacters = project.characters.map((c) =>
        c.id === charId ? { ...c, imageUrl, lastImagePrompt: editedPrompt, updatedAt: Date.now() } : c,
      );
      setProject({ ...project, characters: updatedCharacters });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar imagem da personagem.");
    } finally {
      setGeneratingImageId(null);
      setActivePrompt(null);
    }
  };

  const handleGenerateViews = async (character: Character) => {
    if (!character.imageUrl) {
      alert("Gere primeiro a imagem principal da personagem.");
      return;
    }

    const prompt = `Character design turnaround sheet based on the provided character image. 
      Estilo Visual: ${project.filmStyle}. 
      Generate exactly these views: front view in "T" pose, left side view, right side view, top view, and back view. 
      Maintain perfect consistency with the reference image. 
      Neutral background, highly detailed.`;
    
    setEditingPrompt({ id: character.id, prompt, type: 'views' });
  };

  const confirmGenerateViews = async (editedPrompt: string) => {
    const charId = editingPrompt?.id;
    if (!charId) return;

    const character = project.characters.find(c => c.id === charId);
    if (!character?.imageUrl) return;

    setEditingPrompt(null);
    setGeneratingViewsId(charId);
    try {
      setActivePrompt(editedPrompt);
      const referenceBase64 = await getBase64FromUrl(character.imageUrl);
      const viewsImageUrl = await generateImage(editedPrompt, "16:9", [referenceBase64]);

      const updatedCharacters = project.characters.map((c) =>
        c.id === charId ? { ...c, viewsImageUrl, lastViewsPrompt: editedPrompt, updatedAt: Date.now() } : c,
      );
      setProject({ ...project, characters: updatedCharacters });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar vistas da personagem.");
    } finally {
      setGeneratingViewsId(null);
      setActivePrompt(null);
    }
  };

  const handleGenerateAllImages = async () => {
    const charsToGenerate = project.characters.filter(c => !c.imageUrl || !c.viewsImageUrl);
    if (charsToGenerate.length === 0) {
      if (!window.confirm("Todas as personagens já têm imagens e vistas. Deseja regenerar todas?")) return;
    }

    setGeneratingImageId("bulk-characters");
    try {
      const updatedCharacters = [...project.characters];
      for (let i = 0; i < updatedCharacters.length; i++) {
        let char = updatedCharacters[i];
        
        // 1. Generate main image if missing or if we're regenerating all
        if (charsToGenerate.length === 0 || !char.imageUrl) {
          setGeneratingImageId(char.id);
          const prompt = `Character design for an animated film. 
            Estilo Visual: ${project.filmStyle}. 
            Visual Description: ${char.description}. 
            One single front-facing view of the character, full body, neutral background.`;
          setActivePrompt(prompt);
          const imageUrl = await generateImage(prompt, "1:1");
          char = { ...char, imageUrl, lastImagePrompt: prompt, updatedAt: Date.now() };
          updatedCharacters[i] = char;
          setProject({ ...project, characters: [...updatedCharacters] });
        }

        // 2. Generate views if missing or if we're regenerating all
        if (char.imageUrl && (charsToGenerate.length === 0 || !char.viewsImageUrl)) {
          setGeneratingViewsId(char.id);
          const viewsPrompt = `Character design turnaround sheet based on the provided character image. 
            Estilo Visual: ${project.filmStyle}. 
            Generate exactly these views: front view in "T" pose, left side view, right side view, top view, and back view. 
            Maintain perfect consistency with the reference image. 
            Neutral background, highly detailed.`;
          setActivePrompt(viewsPrompt);
          const referenceBase64 = await getBase64FromUrl(char.imageUrl);
          const viewsImageUrl = await generateImage(viewsPrompt, "16:9", [referenceBase64]);
          char = { ...char, viewsImageUrl, lastViewsPrompt: viewsPrompt, updatedAt: Date.now() };
          updatedCharacters[i] = char;
          setProject({ ...project, characters: [...updatedCharacters] });
          setGeneratingViewsId(null);
        }
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar imagens das personagens.");
    } finally {
      setGeneratingImageId(null);
      setGeneratingViewsId(null);
      setActivePrompt(null);
    }
  };

  const handleExportImage = async (imageUrl: string, fileName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao exportar imagem:", error);
      alert("Não foi possível exportar a imagem. Tente novamente.");
    }
  };

  const handleImportImage = async (character: Character, file: File) => {
    setIsImportingId(character.id);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 1. Get description from image
      const newDescription = await describeCharacterFromImage(base64, project.filmType, project.filmStyle);

      // 2. Update character
      const updatedCharacter: Character = {
        ...character,
        imageUrl: base64,
        description: newDescription,
        updatedAt: Date.now(),
      };

      const updatedCharacters = project.characters.map((c) =>
        c.id === character.id ? updatedCharacter : c,
      );
      setProject({ ...project, characters: updatedCharacters });

      // 3. Automatically generate views
      await handleGenerateViews(updatedCharacter);
    } catch (error) {
      console.error(error);
      alert("Erro ao importar imagem da personagem.");
    } finally {
      setIsImportingId(null);
    }
  };

  const handleAnalyzeCharacter = async (character: Character) => {
    if (!character.imageUrl) {
      alert("Gere primeiro a imagem da personagem para analisar.");
      return;
    }

    setIsAnalyzingId(character.id);
    try {
      const prompt = `Analisa a coerência visual desta personagem de animação.
      
      Nome: ${character.name}
      Descrição Prevista: ${character.description}
      Tipo de Filme: ${project.filmType}
      Estilo Visual: ${project.filmStyle}
      
      Critérios:
      1. A imagem corresponde à descrição textual?
      2. O design é adequado para o tipo de filme (${project.filmType})?
      3. Existem inconsistências anatómicas ou de estilo?
      
      Responde em Português com um feedback construtivo e sugestões de melhoria.`;

      const images = [character.imageUrl];
      if (character.viewsImageUrl) images.push(character.viewsImageUrl);

      const result = await analyzeCoherence(prompt, images);
      
      const updatedCharacters = project.characters.map((c) =>
        c.id === character.id ? { ...c, analysis: result } : c,
      );
      setProject({ ...project, characters: updatedCharacters });
    } catch (error) {
      console.error(error);
      alert("Erro ao analisar a personagem.");
    } finally {
      setIsAnalyzingId(null);
    }
  };

  const addCharacter = () => {
    setProject({
      ...project,
      characters: [
        ...project.characters,
        { id: uuidv4(), name: "Nova Personagem", description: "" },
      ],
    });
  };

  const updateCharacter = (
    id: string,
    field: keyof Character | "voice",
    value: any,
  ) => {
    const updated = project.characters.map((c) => {
      if (c.id === id) {
        if (field === "voice") {
          return { ...c, voice: { ...c.voice, ...value } };
        }
        return { ...c, [field]: value };
      }
      return c;
    });
    setProject({ ...project, characters: updated });
  };

  const removeCharacter = (id: string) => {
    setProject({
      ...project,
      characters: project.characters.filter((c) => c.id !== id),
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">Personagens</h2>
          <p className="text-zinc-500">
            Define o elenco do teu filme de animação.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleGenerateAllImages}
            disabled={generatingImageId !== null || project.characters.length === 0}
            className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {generatingImageId === "bulk-characters" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Gerar Todas as Imagens
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || project.characters.length === 0}
            className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isExportingPDF ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileText className="w-5 h-5 text-indigo-600" />
            )}
            Exportar Report (PDF)
          </button>
          <button
            onClick={addCharacter}
            className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Adicionar Personagem
          </button>
          <button
            onClick={handleGenerateCharacters}
            disabled={isGenerating || !project.script}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Extrair do Guião
          </button>
        </div>
      </div>

      {isGenerating && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
          <ProgressBar
            progress={extractProgress}
            label="A extrair personagens do guião..."
            modelName="Gemini"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {project.characters.map((char) => (
          <div
            key={char.id}
            className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col"
          >
            <div className="aspect-square bg-zinc-100 relative group">
              {char.imageUrl && (
                <img
                  src={char.imageUrl}
                  alt={char.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              
              {!char.imageUrl && (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                  <span className="text-sm">Sem imagem gerada</span>
                </div>
              )}

              {/* Top-right Actions (Always on top) */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                {char.imageUrl && (
                  <>
                    <button
                      onClick={() => setSelectedImage({ url: char.imageUrl!, title: `${char.name} - Concept Art` })}
                      className="bg-white/90 text-zinc-700 p-2 rounded-lg hover:bg-white hover:text-indigo-600 shadow-sm transition-colors"
                      title="Maximizar"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExportImage(char.imageUrl!, `${char.name}-concept`)}
                      className="bg-white/90 text-zinc-700 p-2 rounded-lg hover:bg-white hover:text-indigo-600 shadow-sm transition-colors"
                      title="Exportar Imagem"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </>
                )}
                <label className="bg-white/90 text-zinc-700 p-2 rounded-lg hover:bg-white hover:text-indigo-600 shadow-sm cursor-pointer transition-colors" title="Importar Imagem">
                  <Upload className="w-4 h-4" />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportImage(char, file);
                    }}
                  />
                </label>
              </div>

              {(generatingImageId === char.id || isImportingId === char.id) && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-40 overflow-y-auto">
                  <ProgressBar
                    progress={imageProgress}
                    label={isImportingId === char.id ? "A analisar imagem..." : "A gerar concept art..."}
                    modelName={isImportingId === char.id ? "Gemini" : "Nanobana"}
                  />
                  {activePrompt && generatingImageId === char.id && (
                    <div className="mt-4 w-full">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Prompt Utilizado:</p>
                      <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 text-[10px] text-zinc-500 font-mono leading-relaxed max-h-32 overflow-y-auto">
                        {activePrompt}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                <button
                  onClick={() => handleGenerateImage(char)}
                  disabled={generatingImageId === char.id}
                  className="bg-white text-zinc-900 px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {generatingImageId === char.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  )}
                  {char.imageUrl ? "Regenerar Concept" : "Gerar Concept Art"}
                </button>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) =>
                      updateCharacter(char.id, "name", e.target.value)
                    }
                    className="font-bold text-lg text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-indigo-500 outline-none w-full transition-colors"
                    placeholder="Nome da Personagem"
                  />
                  {char.imageUrl && (
                    <button
                      onClick={() => handleAnalyzeCharacter(char)}
                      disabled={isAnalyzingId === char.id}
                      className={`p-1.5 rounded-lg transition-all ${
                        char.analysis 
                          ? char.analysis.status === 'ok' ? 'text-emerald-500 bg-emerald-50' : 
                            char.analysis.status === 'warning' ? 'text-amber-500 bg-amber-50' : 
                            'text-rose-500 bg-rose-50'
                          : 'text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
                      title="Analisar Coerência"
                    >
                      {isAnalyzingId === char.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => removeCharacter(char.id)}
                  className="text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {char.analysis && (
                <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                  char.analysis.status === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 
                  char.analysis.status === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' : 
                  'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                    <AlertTriangle className="w-3 h-3" />
                    Análise de Coerência: {char.analysis.status}
                  </div>
                  <p className="leading-relaxed">{char.analysis.feedback}</p>
                  {char.analysis.suggestions.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 opacity-80">
                      {char.analysis.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <textarea
                value={char.description}
                onChange={(e) =>
                  updateCharacter(char.id, "description", e.target.value)
                }
                className="text-sm text-zinc-600 bg-transparent resize-none h-24 outline-none border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded-lg p-2 transition-colors"
                placeholder="Descrição da personagem..."
              />

              {/* Voice Section */}
              <div className="space-y-3 pt-2 border-t border-zinc-100">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Voz e Personalidade</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-500 uppercase">Língua/País</label>
                    <input
                      type="text"
                      value={char.voice?.language || ""}
                      onChange={(e) => updateCharacter(char.id, "voice", { language: e.target.value })}
                      placeholder="Ex: PT-PT"
                      className="w-full text-[11px] bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-500 uppercase">Idade da Voz</label>
                    <input
                      type="text"
                      value={char.voice?.age || ""}
                      onChange={(e) => updateCharacter(char.id, "voice", { age: e.target.value })}
                      placeholder="Ex: 30"
                      className="w-full text-[11px] bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-zinc-500 uppercase">Personalidade Vocal</label>
                  <input
                    type="text"
                    value={char.voice?.personality || ""}
                    onChange={(e) => updateCharacter(char.id, "voice", { personality: e.target.value })}
                    placeholder="Ex: Rouca, Enérgica..."
                    className="w-full text-[11px] bg-zinc-50 border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Character Views Section */}
            <div className="border-t border-zinc-100 p-4 bg-zinc-50/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Vistas da Personagem
                </h4>
                {char.viewsImageUrl && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedImage({ url: char.viewsImageUrl!, title: `${char.name} - Vistas` })}
                      className="text-zinc-400 hover:text-indigo-600 transition-colors"
                      title="Maximizar"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExportImage(char.viewsImageUrl!, `${char.name}-views`)}
                      className="text-zinc-400 hover:text-indigo-600 transition-colors"
                      title="Exportar Vistas"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="aspect-video bg-zinc-100 rounded-xl relative group overflow-hidden border border-zinc-200">
                {char.viewsImageUrl ? (
                  <img
                    src={char.viewsImageUrl}
                    alt={`${char.name} views`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-30" />
                    <span className="text-xs text-center px-4">
                      T-pose, frente, trás, lados e topo
                    </span>
                  </div>
                )}

                {generatingViewsId === char.id && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-40 overflow-y-auto">
                    <ProgressBar
                      progress={imageProgress}
                      label="A gerar vistas..."
                      modelName="Nanobana"
                    />
                    {activePrompt && (
                      <div className="mt-2 w-full">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Prompt Utilizado:</p>
                        <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-2 text-[9px] text-zinc-500 font-mono leading-relaxed max-h-20 overflow-y-auto">
                          {activePrompt}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                  <button
                    onClick={() => handleGenerateViews(char)}
                    disabled={generatingViewsId === char.id}
                    className="bg-white text-zinc-900 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                  >
                    {generatingViewsId === char.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {char.viewsImageUrl ? "Regenerar" : "Gerar Vistas"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url || null}
        title={selectedImage?.title}
      />

      <PromptEditorModal
        isOpen={!!editingPrompt}
        onClose={() => setEditingPrompt(null)}
        onConfirm={(prompt) => {
          if (editingPrompt?.type === 'main') {
            confirmGenerateImage(prompt);
          } else {
            confirmGenerateViews(prompt);
          }
        }}
        initialPrompt={editingPrompt?.prompt || ""}
        title={editingPrompt?.type === 'main' ? "Editar Prompt de Personagem" : "Editar Prompt de Vistas (Turnaround)"}
        description="Ajusta o prompt para obteres o melhor resultado visual."
      />
    </div>
  );
}
