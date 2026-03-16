import React, { useState } from "react";
import { Project, Scene } from "../types";
import { Music, Play, Trash2, Sparkles, Loader2, Clock, Volume2, RefreshCw } from "lucide-react";
import { generateSoundtrackDescription, generateSoundtrackAudio } from "../services/geminiService";

interface SoundtrackProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function Soundtrack({ project, setProject }: SoundtrackProps) {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isDescribing, setIsDescribing] = useState<string | null>(null);

  const calculateSceneDuration = (scene: Scene) => {
    return scene.takes.reduce((acc, take) => acc + (take.duration || 5), 0);
  };

  const handleGenerateDescription = async (sceneId: string) => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setIsDescribing(sceneId);
    try {
      const sceneAction = scene.takes.map(t => t.action).join(". ");
      const description = await generateSoundtrackDescription(sceneAction, project.filmStyle, project.filmType);
      
      const updatedScenes = project.scenes.map(s => 
        s.id === sceneId ? { ...s, soundtrack: { ...s.soundtrack, style: description } } : s
      );
      setProject({ ...project, scenes: updatedScenes });
    } catch (error) {
      console.error("Erro ao gerar descrição da banda sonora:", error);
    } finally {
      setIsDescribing(null);
    }
  };

  const handleGenerateAudio = async (sceneId: string) => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene || !scene.soundtrack?.style) return;

    setIsGenerating(sceneId);
    try {
      const audioUrl = await generateSoundtrackAudio(scene.soundtrack.style);
      
      const updatedScenes = project.scenes.map(s => 
        s.id === sceneId ? { ...s, soundtrack: { ...s.soundtrack, audioUrl } } : s
      );
      setProject({ ...project, scenes: updatedScenes });
    } catch (error) {
      console.error("Erro ao gerar áudio da banda sonora:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleDeleteAudio = (sceneId: string) => {
    if (!window.confirm("Tens a certeza que desejas apagar a banda sonora desta cena?")) return;
    
    const updatedScenes = project.scenes.map(s => 
      s.id === sceneId ? { ...s, soundtrack: s.soundtrack ? { ...s.soundtrack, audioUrl: undefined } : undefined } : s
    );
    setProject({ ...project, scenes: updatedScenes });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Music className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Soundtrack</h1>
          <p className="text-zinc-500">Gera bandas sonoras personalizadas para cada cena do teu filme.</p>
        </div>
      </div>

      <div className="space-y-6">
        {project.scenes.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-zinc-200 shadow-sm">
            <Music className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900">Nenhuma cena encontrada</h3>
            <p className="text-zinc-500 max-w-md mx-auto mt-2">
              Cria cenas no menu "Cenas e Takes" para poderes gerar bandas sonoras.
            </p>
          </div>
        ) : (
          project.scenes.map((scene, index) => {
            const duration = calculateSceneDuration(scene);
            return (
              <div key={scene.id} className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center font-bold text-zinc-400 shadow-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900">{scene.title}</h2>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                          <Clock className="w-3.5 h-3.5" />
                          {duration}s total
                        </span>
                        <span className="w-1 h-1 rounded-full bg-zinc-300" />
                        <span className="text-xs font-medium text-zinc-500">
                          {scene.takes.length} takes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Ação da Cena</h3>
                    <p className="text-sm text-zinc-600 leading-relaxed line-clamp-2">
                      {scene.takes.map(t => t.action).join(" ")}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100">
                    <div>
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                        Estilo Musical
                        <button 
                          onClick={() => handleGenerateDescription(scene.id)}
                          disabled={isDescribing === scene.id}
                          className="text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {isDescribing === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {scene.soundtrack?.style ? "Regerar" : "Sugerir Estilo"}
                        </button>
                      </h3>
                      <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 min-h-[80px] flex items-center justify-center text-center">
                        {scene.soundtrack?.style ? (
                          <p className="text-sm font-medium text-zinc-700 italic">"{scene.soundtrack.style}"</p>
                        ) : (
                          <p className="text-xs text-zinc-400 italic">Clica em "Sugerir Estilo" para analisar a cena.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Áudio da Banda Sonora</h3>
                      <div className="flex items-center gap-3">
                        {scene.soundtrack?.audioUrl ? (
                          <div className="flex-1 flex items-center gap-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
                              <Volume2 className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <audio src={scene.soundtrack.audioUrl} controls className="w-full h-8" />
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleGenerateAudio(scene.id)}
                                disabled={isGenerating === scene.id}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                title="Gerar novamente"
                              >
                                {isGenerating === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => handleDeleteAudio(scene.id)}
                                className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all"
                                title="Apagar áudio"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGenerateAudio(scene.id)}
                            disabled={isGenerating === scene.id || !scene.soundtrack?.style}
                            className="flex-1 flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none"
                          >
                            {isGenerating === scene.id ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>A gerar áudio...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-5 h-5" />
                                <span>Gerar Banda Sonora</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {!scene.soundtrack?.style && !scene.soundtrack?.audioUrl && (
                        <p className="text-[10px] text-zinc-400 mt-2 text-center">
                          Gera primeiro uma sugestão de estilo para poderes criar o áudio.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
