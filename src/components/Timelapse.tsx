import React, { useState, useMemo, useEffect, useRef } from "react";
import { Project, Scene, Take } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Clock, 
  Camera, 
  Users, 
  MapPin, 
  Play, 
  Image as ImageIcon, 
  ChevronRight, 
  ChevronLeft,
  Info,
  Sparkles,
  Film,
  Mic,
  Download,
  Save,
  Loader2,
  Volume2
} from "lucide-react";
import { generateNarrationText, generateNarrationAudio } from "../services/geminiService";

interface TimelapseProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

interface TimelineEvent {
  sceneIndex: number;
  takeIndex: number;
  scene: Scene;
  take: Take;
  globalIndex: number;
  startTime: number;
  endTime: number;
}

export default function Timelapse({ project, setProject }: TimelapseProps) {
  const [selectedEventIndex, setSelectedEventIndex] = useState<number>(0);
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [narrationText, setNarrationText] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];
    let globalIndex = 0;
    let currentTime = 0;
    
    project.scenes.forEach((scene, sIdx) => {
      scene.takes.forEach((take, tIdx) => {
        const duration = take.duration || 5; // Default to 5s if not set
        events.push({
          sceneIndex: sIdx,
          takeIndex: tIdx,
          scene,
          take,
          globalIndex: globalIndex++,
          startTime: currentTime,
          endTime: currentTime + duration
        });
        currentTime += duration;
      });
    });
    return events;
  }, [project.scenes]);

  const selectedEvent = timelineEvents[selectedEventIndex];

  useEffect(() => {
    setNarrationText(selectedEvent.take.narration || "");
  }, [selectedEvent.take.id]);

  const handleGenerateNarration = async () => {
    setIsGeneratingNarration(true);
    try {
      const previousNarrations = timelineEvents
        .slice(0, selectedEventIndex)
        .map(e => e.take.narration)
        .filter(Boolean) as string[];

      const text = await generateNarrationText(
        selectedEvent.take.action,
        project.language,
        `Filme: ${project.title}. Conceito: ${project.concept}`,
        previousNarrations
      );
      
      setNarrationText(text);
      
      const audioUrl = await generateNarrationAudio(text);
      
      const updatedScenes = [...project.scenes];
      updatedScenes[selectedEvent.sceneIndex].takes[selectedEvent.takeIndex] = {
        ...selectedEvent.take,
        narration: text,
        narrationAudioUrl: audioUrl
      };
      
      setProject({ ...project, scenes: updatedScenes });
    } catch (error) {
      console.error("Erro ao gerar narração:", error);
    } finally {
      setIsGeneratingNarration(false);
    }
  };

  const handleSaveNarration = async () => {
    try {
      const audioUrl = await generateNarrationAudio(narrationText);
      const updatedScenes = [...project.scenes];
      updatedScenes[selectedEvent.sceneIndex].takes[selectedEvent.takeIndex] = {
        ...selectedEvent.take,
        narration: narrationText,
        narrationAudioUrl: audioUrl
      };
      setProject({ ...project, scenes: updatedScenes });
    } catch (error) {
      console.error("Erro ao salvar narração:", error);
    }
  };

  const handleExportNarration = () => {
    if (!selectedEvent.take.narrationAudioUrl) return;
    const link = document.createElement('a');
    link.href = selectedEvent.take.narrationAudioUrl;
    link.download = `narration_s${selectedEvent.sceneIndex+1}_t${selectedEvent.takeIndex+1}.wav`;
    link.click();
  };

  const handleGenerateAllNarrations = async () => {
    if (isGeneratingAll) return;
    setIsGeneratingAll(true);
    
    try {
      const updatedScenes = [...project.scenes];
      let currentNarrations: string[] = [];

      for (let sIdx = 0; sIdx < updatedScenes.length; sIdx++) {
        for (let tIdx = 0; tIdx < updatedScenes[sIdx].takes.length; tIdx++) {
          const take = updatedScenes[sIdx].takes[tIdx];
          if (take.narration && take.narrationAudioUrl) {
            currentNarrations.push(take.narration);
            continue;
          }

          const text = await generateNarrationText(
            take.action,
            project.language,
            `Filme: ${project.title}. Conceito: ${project.concept}`,
            currentNarrations
          );
          
          const audioUrl = await generateNarrationAudio(text);
          
          updatedScenes[sIdx].takes[tIdx] = {
            ...take,
            narration: text,
            narrationAudioUrl: audioUrl
          };
          currentNarrations.push(text);
        }
      }
      
      setProject({ ...project, scenes: updatedScenes });
    } catch (error) {
      console.error("Erro ao gerar todas as narrações:", error);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const playNarrationAlone = () => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  };

  if (timelineEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-zinc-50">
        <div className="w-20 h-20 bg-zinc-200 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-zinc-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Linha do Tempo Vazia</h2>
        <p className="text-zinc-500 max-w-md">
          Ainda não tens cenas ou takes definidos. Começa por criar a tua história e cenas para veres a evolução aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-zinc-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600" />
            Timelapse da Produção
          </h2>
          <p className="text-zinc-500 text-sm">Visualiza a evolução da tua narrativa e elementos visuais.</p>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-zinc-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>{timelineEvents.length} Momentos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{project.scenes.length} Cenas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{timelineEvents[timelineEvents.length - 1].endTime}s Total</span>
          </div>
        </div>
        <button
          onClick={handleGenerateAllNarrations}
          disabled={isGeneratingAll}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
        >
          {isGeneratingAll ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
          {isGeneratingAll ? "A Gerar Tudo..." : "Gerar Todas as Narrações"}
        </button>
      </div>

      {/* Timeline Navigation */}
      <div className="bg-white border-b border-zinc-200 p-4 relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-4 custom-scrollbar scroll-smooth">
          {timelineEvents.map((event, idx) => {
            const isActive = selectedEventIndex === idx;
            const hasMedia = event.take.videoUrl || event.take.startFrameUrl || event.take.endFrameUrl;
            
            return (
              <button
                key={event.take.id}
                onClick={() => setSelectedEventIndex(idx)}
                className={`flex-shrink-0 group relative flex flex-col items-center gap-2 transition-all ${
                  isActive ? "w-40" : "w-16 hover:w-20"
                }`}
              >
                {/* Time Label Above */}
                <div className={`text-[9px] font-mono mb-1 ${isActive ? "text-indigo-600 font-bold" : "text-zinc-400"}`}>
                  {event.startTime}s
                </div>

                {/* Connector Line */}
                {idx < timelineEvents.length - 1 && (
                  <div className="absolute top-4 left-1/2 w-full h-0.5 bg-zinc-100 -z-10" />
                )}
                
                {/* Node */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isActive 
                    ? "bg-indigo-600 border-indigo-600 text-white scale-125 shadow-lg shadow-indigo-200" 
                    : hasMedia 
                    ? "bg-white border-indigo-400 text-indigo-600" 
                    : "bg-white border-zinc-200 text-zinc-400"
                }`}>
                  {isActive ? (
                    <span className="text-[10px] font-bold">{idx + 1}</span>
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded-full ${hasMedia ? "bg-indigo-400" : "bg-zinc-300"}`} />
                  )}
                </div>

                {/* Label (only when active or hover) */}
                <AnimatePresence>
                  {(isActive || idx % 5 === 0) && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-center"
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-wider truncate w-full px-1 ${
                        isActive ? "text-indigo-600" : "text-zinc-400"
                      }`}>
                        C{event.sceneIndex + 1}.T{event.takeIndex + 1}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Active Indicator Bar */}
                {isActive && (
                  <motion.div 
                    layoutId="active-bar"
                    className="absolute -bottom-4 w-full h-1 bg-indigo-600 rounded-t-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Display Area */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Left: Media Preview */}
        <div className="flex-1 bg-zinc-900 p-6 flex flex-col items-center justify-center relative group">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedEvent.take.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full flex items-center justify-center"
            >
              {selectedEvent.take.videoUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video 
                    src={selectedEvent.take.videoUrl} 
                    controls 
                    className="max-w-full max-h-full rounded-xl shadow-2xl border border-white/10"
                  />
                  {selectedEvent.take.narrationAudioUrl && (
                    <div className="absolute top-4 right-4">
                      <audio src={selectedEvent.take.narrationAudioUrl} controls className="h-8 w-48 opacity-50 hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
              ) : selectedEvent.take.startFrameUrl ? (
                <img 
                  src={selectedEvent.take.startFrameUrl} 
                  alt="Frame Inicial"
                  className="max-w-full max-h-full rounded-xl shadow-2xl border border-white/10 object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex flex-col items-center text-zinc-500 gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-zinc-800 flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">Sem media disponível para este momento.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls Overlay */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 pointer-events-none">
            <button 
              onClick={() => setSelectedEventIndex(prev => Math.max(0, prev - 1))}
              disabled={selectedEventIndex === 0}
              className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all pointer-events-auto disabled:opacity-0"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setSelectedEventIndex(prev => Math.min(timelineEvents.length - 1, prev + 1))}
              disabled={selectedEventIndex === timelineEvents.length - 1}
              className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all pointer-events-auto disabled:opacity-0"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Media Info Badge */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-white text-xs font-bold">
                <Film className="w-3.5 h-3.5 text-indigo-400" />
                Cena {selectedEvent.sceneIndex + 1}
              </div>
              <div className="w-px h-3 bg-white/20" />
              <div className="flex items-center gap-1.5 text-white text-xs font-bold">
                <Camera className="w-3.5 h-3.5 text-indigo-400" />
                Take {selectedEvent.takeIndex + 1}
              </div>
            </div>
            {selectedEvent.take.videoUrl && (
              <div className="bg-emerald-500/20 backdrop-blur-md px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                <Play className="w-3 h-3 fill-current" />
                Vídeo Finalizado
              </div>
            )}
          </div>
        </div>

        {/* Right: Details Panel */}
        <div className="w-full lg:w-96 bg-white border-l border-zinc-200 flex flex-col overflow-y-auto">
          <div className="p-6 space-y-8">
            {/* Action Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Play className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="font-bold text-zinc-900">Acção</h3>
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed bg-zinc-50 p-4 rounded-xl border border-zinc-100 italic">
                "{selectedEvent.take.action}"
              </p>
            </section>

            {/* Characters Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-zinc-900">Personagens</h3>
              </div>
              <div className="space-y-2">
                {selectedEvent.take.characterIds && selectedEvent.take.characterIds.length > 0 ? (
                  selectedEvent.take.characterIds.map(id => {
                    const char = project.characters.find(c => c.id === id);
                    if (!char) return null;
                    return (
                      <div key={id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-100">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                          {char.imageUrl ? (
                            <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-400">
                              <Users className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{char.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate w-40">{char.description}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-zinc-400 italic px-2">Nenhuma personagem associada a este take.</p>
                )}
              </div>
            </section>

            {/* Space Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="font-bold text-zinc-900">Espaço / Cenário</h3>
              </div>
              {selectedEvent.take.settingId ? (() => {
                const setting = project.settings.find(s => s.id === selectedEvent.take.settingId);
                if (!setting) return <p className="text-xs text-zinc-400 italic px-2">Cenário não encontrado.</p>;
                return (
                  <div className="p-4 rounded-xl border border-zinc-100 bg-zinc-50 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-zinc-200 overflow-hidden border border-zinc-300">
                        {setting.imageUrl ? (
                          <img src={setting.imageUrl} alt={setting.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-400">
                            <MapPin className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-bold text-zinc-900">{setting.name}</p>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{setting.description}</p>
                  </div>
                );
              })() : (
                <p className="text-xs text-zinc-400 italic px-2">Nenhum cenário associado a este take.</p>
              )}
            </section>

            {/* Narration Section */}
            <section className="pt-6 border-t border-zinc-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-rose-600" />
                  </div>
                  <h3 className="font-bold text-zinc-900">Narração IA</h3>
                </div>
                <button
                  onClick={handleGenerateNarration}
                  disabled={isGeneratingNarration}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {isGeneratingNarration ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {selectedEvent.take.narration ? "Regerar" : "Gerar"}
                </button>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    value={narrationText}
                    onChange={(e) => setNarrationText(e.target.value)}
                    placeholder="O texto da narração aparecerá aqui..."
                    className="w-full h-24 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-sm text-zinc-600 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none resize-none"
                  />
                  {narrationText !== selectedEvent.take.narration && (
                    <button
                      onClick={handleSaveNarration}
                      className="absolute bottom-2 right-2 p-1.5 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
                      title="Salvar Alterações"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {selectedEvent.take.narrationAudioUrl && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                      <div className="flex items-center gap-2 text-rose-700">
                        <Volume2 className="w-4 h-4" />
                        <span className="text-xs font-bold">Áudio Gerado</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={playNarrationAlone}
                          className="p-1.5 bg-white text-rose-600 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors"
                          title="Ouvir Narração"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleExportNarration}
                          className="p-1.5 bg-white text-rose-600 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors"
                          title="Exportar MP3"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <audio ref={audioRef} src={selectedEvent.take.narrationAudioUrl} className="hidden" />
                  </div>
                )}
              </div>
            </section>

            {/* Metadata Section */}
            <section className="pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="font-bold text-zinc-900">Metadados de IA</h3>
              </div>
              <div className="space-y-4">
                {selectedEvent.take.lastVideoPrompt && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Prompt de Vídeo</label>
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-[10px] font-mono text-zinc-500 leading-relaxed">
                      {selectedEvent.take.lastVideoPrompt}
                    </div>
                  </div>
                )}
                {selectedEvent.take.lastStartFramePrompt && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Prompt de Frame</label>
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-[10px] font-mono text-zinc-500 leading-relaxed">
                      {selectedEvent.take.lastStartFramePrompt}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-2">
                  <span className="flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    {selectedEvent.take.camera}
                  </span>
                  {selectedEvent.take.updatedAt && (
                    <span>Atualizado: {new Date(selectedEvent.take.updatedAt).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Duração: {selectedEvent.take.duration || 5}s
                  </span>
                  <span className="flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Início: {selectedEvent.startTime}s | Fim: {selectedEvent.endTime}s
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
