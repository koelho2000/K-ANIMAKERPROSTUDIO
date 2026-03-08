import React, { useState, useEffect } from "react";
import { Project, Setting } from "../types";
import { generateJSON, generateImage } from "../services/geminiService";
import {
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  Upload,
  ZoomIn,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Type } from "@google/genai";
import ProgressBar from "./ProgressBar";
import { describeSettingFromImage } from "../services/geminiService";
import { ImageModal } from "./ImageModal";
import { PromptEditorModal } from "./PromptEditorModal";

interface SettingsProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function Settings({ project, setProject }: SettingsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(
    null,
  );
  const [isImportingId, setIsImportingId] = useState<string | null>(null);
  const [imageProgress, setImageProgress] = useState(0);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<{ id: string; prompt: string } | null>(null);

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
    if (generatingImageId || isImportingId) {
      setImageProgress(0);
      interval = setInterval(() => {
        setImageProgress((prev) => (prev >= 95 ? prev : prev + Math.random() * 15));
      }, 300);
    } else {
      setImageProgress(100);
    }
    return () => clearInterval(interval);
  }, [generatingImageId, isImportingId]);

  const handleGenerateSettings = async () => {
    setIsGenerating(true);
    try {
      const prompt = `
        Com base no seguinte guião de filme de animação, extrai os cenários principais e descreve-os visualmente.
        Foca-te apenas no ambiente e arquitetura. É CRÍTICO que a descrição NÃO inclua personagens, apenas o cenário vazio.
        Tipo de filme: ${project.filmType}
        Estilo de filme: ${project.filmStyle}
        Guião: ${project.script}
      `;

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "Nome do cenário/localização",
            },
            description: {
              type: Type.STRING,
              description:
                "Descrição detalhada (atmosfera, iluminação, elementos chave)",
            },
          },
          required: ["name", "description"],
        },
      };

      const result = await generateJSON(
        prompt,
        schema,
        "És um concept artist de cenários de cinema de animação. Foca-te apenas no ambiente e arquitetura. NÃO incluas personagens nas descrições.",
      );
      const parsed = JSON.parse(result);

      const newSettings: Setting[] = parsed.map((s: any) => ({
        id: uuidv4(),
        name: s.name,
        description: s.description,
      }));

      setProject({ ...project, settings: newSettings });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar cenários.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async (setting: Setting) => {
    const prompt = `Concept art environment design for an animated film. 
      Tipo de Filme: ${project.filmType}. 
      Estilo Visual: ${project.filmStyle}. 
      Location Name: ${setting.name}. 
      Description: ${setting.description}. 
      Cinematic lighting, highly detailed, wide angle. 
      CRITICAL: NO CHARACTERS, NO PEOPLE, NO ANIMALS. Just the empty environment/location.`;
    
    setEditingPrompt({ id: setting.id, prompt });
  };

  const confirmGenerateImage = async (editedPrompt: string) => {
    const settingId = editingPrompt?.id;
    if (!settingId) return;

    setEditingPrompt(null);
    setGeneratingImageId(settingId);
    try {
      setActivePrompt(editedPrompt);
      const imageUrl = await generateImage(editedPrompt, project.aspectRatio);

      const updatedSettings = project.settings.map((s) =>
        s.id === settingId ? { ...s, imageUrl, updatedAt: Date.now() } : s,
      );
      setProject({ ...project, settings: updatedSettings });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar imagem do cenário.");
    } finally {
      setGeneratingImageId(null);
      setActivePrompt(null);
    }
  };

  const handleGenerateAllImages = async () => {
    const settingsToGenerate = project.settings.filter(s => !s.imageUrl);
    if (settingsToGenerate.length === 0) {
      if (!window.confirm("Todos os cenários já têm imagens. Deseja regenerar todas?")) return;
    }

    setGeneratingImageId("bulk-settings");
    try {
      const updatedSettings = [...project.settings];
      for (let i = 0; i < updatedSettings.length; i++) {
        const setting = updatedSettings[i];
        // If we confirmed to regenerate all, or if it doesn't have an image
        if (settingsToGenerate.length === 0 || !setting.imageUrl) {
          setGeneratingImageId(setting.id);
          const prompt = `Concept art environment design for an animated film. 
            Tipo de Filme: ${project.filmType}. 
            Estilo Visual: ${project.filmStyle}. 
            Location Name: ${setting.name}. 
            Description: ${setting.description}. 
            Cinematic lighting, highly detailed, wide angle. 
            CRITICAL: NO CHARACTERS, NO PEOPLE, NO ANIMALS. Just the empty environment/location.`;
          setActivePrompt(prompt);
          const imageUrl = await generateImage(prompt, project.aspectRatio);
          updatedSettings[i] = { ...setting, imageUrl, updatedAt: Date.now() };
          // Update project state incrementally to show progress
          setProject({ ...project, settings: [...updatedSettings] });
        }
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar imagens dos cenários.");
    } finally {
      setGeneratingImageId(null);
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

  const handleImportImage = async (setting: Setting, file: File) => {
    setIsImportingId(setting.id);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 1. Get description from image
      const newDescription = await describeSettingFromImage(base64, project.filmType, project.filmStyle);

      // 2. Update setting
      const updatedSettings = project.settings.map((s) =>
        s.id === setting.id
          ? {
              ...s,
              imageUrl: base64,
              description: newDescription,
              updatedAt: Date.now(),
            }
          : s,
      );
      setProject({ ...project, settings: updatedSettings });
    } catch (error) {
      console.error(error);
      alert("Erro ao importar imagem do cenário.");
    } finally {
      setIsImportingId(null);
    }
  };

  const addSetting = () => {
    setProject({
      ...project,
      settings: [
        ...project.settings,
        { id: uuidv4(), name: "Novo Cenário", description: "" },
      ],
    });
  };

  const updateSetting = (id: string, field: keyof Setting, value: string) => {
    const updated = project.settings.map((s) =>
      s.id === id ? { ...s, [field]: value } : s,
    );
    setProject({ ...project, settings: updated });
  };

  const removeSetting = (id: string) => {
    setProject({
      ...project,
      settings: project.settings.filter((s) => s.id !== id),
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">
            Cenários e Localizações
          </h2>
          <p className="text-zinc-500">
            Define os ambientes do teu filme de animação.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleGenerateAllImages}
            disabled={generatingImageId !== null || project.settings.length === 0}
            className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {generatingImageId === "bulk-settings" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Gerar Todas as Imagens
          </button>
          <button
            onClick={addSetting}
            className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Adicionar Cenário
          </button>
          <button
            onClick={handleGenerateSettings}
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
            label="A extrair cenários do guião..."
            modelName="Gemini"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {project.settings.map((setting) => (
          <div
            key={setting.id}
            className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col"
          >
            <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-zinc-100 relative group`}>
              {setting.imageUrl ? (
                <>
                  <img
                    src={setting.imageUrl}
                    alt={setting.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button
                      onClick={() => setSelectedImage({ url: setting.imageUrl!, title: `${setting.name} - Concept Art` })}
                      className="bg-white/90 text-zinc-700 p-2 rounded-lg hover:bg-white hover:text-indigo-600 shadow-sm transition-colors"
                      title="Maximizar"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExportImage(setting.imageUrl!, `${setting.name}-env`)}
                      className="bg-white/90 text-zinc-700 p-2 rounded-lg hover:bg-white hover:text-indigo-600 shadow-sm"
                      title="Exportar Imagem"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <label className="bg-white/90 text-zinc-700 p-2 rounded-lg hover:bg-white hover:text-indigo-600 shadow-sm cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImportImage(setting, file);
                        }}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                  <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                  <span className="text-sm">Sem imagem gerada</span>
                  <label className="mt-2 bg-white text-zinc-900 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 hover:bg-zinc-50 cursor-pointer flex items-center gap-2">
                    <Upload className="w-3 h-3" />
                    Importar Imagem
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportImage(setting, file);
                      }}
                    />
                  </label>
                </div>
              )}

              {(generatingImageId === setting.id || isImportingId === setting.id) && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-40 overflow-y-auto">
                  <ProgressBar
                    progress={imageProgress}
                    label={isImportingId === setting.id ? "A analisar imagem..." : "A gerar concept art..."}
                    modelName={isImportingId === setting.id ? "Gemini" : "Nanobana"}
                  />
                  {activePrompt && generatingImageId === setting.id && (
                    <div className="mt-4 w-full">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Prompt Utilizado:</p>
                      <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 text-[10px] text-zinc-500 font-mono leading-relaxed max-h-32 overflow-y-auto">
                        {activePrompt}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                <button
                  onClick={() => handleGenerateImage(setting)}
                  disabled={generatingImageId === setting.id}
                  className="bg-white text-zinc-900 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                  {generatingImageId === setting.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {setting.imageUrl ? "Regenerar Concept" : "Gerar Concept Art"}
                </button>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={setting.name}
                  onChange={(e) =>
                    updateSetting(setting.id, "name", e.target.value)
                  }
                  className="font-bold text-lg text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-indigo-500 outline-none w-full transition-colors"
                  placeholder="Nome do Cenário"
                />
                <button
                  onClick={() => removeSetting(setting.id)}
                  className="text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <textarea
                value={setting.description}
                onChange={(e) =>
                  updateSetting(setting.id, "description", e.target.value)
                }
                className="text-sm text-zinc-600 bg-transparent resize-none h-32 outline-none border border-transparent hover:border-zinc-200 focus:border-indigo-500 rounded-lg p-2 transition-colors"
                placeholder="Descrição do cenário..."
              />
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
        onConfirm={confirmGenerateImage}
        initialPrompt={editingPrompt?.prompt || ""}
        title="Editar Prompt de Cenário"
        description="Ajusta o prompt para obteres o melhor resultado visual."
      />
    </div>
  );
}
