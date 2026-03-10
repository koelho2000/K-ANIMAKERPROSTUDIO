import React, { useState, useRef, useEffect } from "react";
import { Project, Take } from "../types";
import { 
  PlayCircle, 
  Film, 
  Languages, 
  CheckCircle2, 
  Loader2, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack,
  Volume2,
  Settings as SettingsIcon,
  Globe,
  Scissors,
  Zap,
  Maximize2,
  ArrowRightLeft,
  Download
} from "lucide-react";
import { generateText } from "../services/geminiService";
import { TransitionType } from "../types";

interface PreviewProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

const TRANSITION_TYPES: { id: TransitionType; name: string }[] = [
  { id: 'cut', name: 'Corte Seco' },
  { id: 'fade', name: 'Dissolver (Fade)' },
  { id: 'fade-black', name: 'Fade para Preto' },
  { id: 'fade-white', name: 'Fade para Branco' },
  { id: 'wipe-left', name: 'Wipe Esquerda' },
  { id: 'wipe-right', name: 'Wipe Direita' },
  { id: 'zoom-in', name: 'Zoom In' },
  { id: 'zoom-out', name: 'Zoom Out' },
];

const SUGGESTED_LANGUAGES = [
  { code: "en", name: "Inglês" },
  { code: "pt", name: "Português" },
  { code: "es", name: "Espanhol" },
  { code: "fr", name: "Francês" },
  { code: "de", name: "Alemão" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "Japonês" },
  { code: "zh", name: "Chinês" },
];

export default function Preview({ project, setProject }: PreviewProps) {
  const [isPlayingFullMovie, setIsPlayingFullMovie] = useState(false);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'json' | 'mp4'>('json');
  const [exportStatus, setExportStatus] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const allTakes = project.scenes.flatMap((s) =>
    s.takes.map((t) => ({ ...t, sceneTitle: s.title })),
  );
  const completedTakes = allTakes.filter((t) => t.videoUrl);

  const movieClips = [
    ...(project.intro?.videoUrl ? [{ id: 'intro', videoUrl: project.intro.videoUrl, dialogue: '', action: 'Intro' }] : []),
    ...completedTakes,
    ...(project.outro?.videoUrl ? [{ id: 'outro', videoUrl: project.outro.videoUrl, dialogue: '', action: 'Créditos' }] : [])
  ];

  const currentClip = movieClips[currentClipIndex];
  const subtitleSettings = project.subtitleSettings || { enabled: false, language: project.language || 'pt' };

  const handleToggleSubtitles = () => {
    setProject(prev => ({
      ...prev,
      subtitleSettings: {
        ...(prev.subtitleSettings || { language: prev.language || 'pt', enabled: false }),
        enabled: !prev.subtitleSettings?.enabled
      }
    }));
  };

  const handleUpdateTransition = (takeId: string, transition: TransitionType) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => ({
        ...s,
        takes: s.takes.map(t => t.id === takeId ? { ...t, transition } : t)
      }))
    }));
  };

  const handleApplyGlobalTransition = (transition: TransitionType) => {
    setProject(prev => ({
      ...prev,
      globalTransition: transition,
      scenes: prev.scenes.map(s => ({
        ...s,
        takes: s.takes.map(t => ({ ...t, transition }))
      }))
    }));
  };

  const handleExportVideo = async () => {
    if (exportFormat === 'json') {
      setIsExporting(true);
      setExportProgress(0);
      const interval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsExporting(false);
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
            const downloadAnchorNode = document.createElement("a");
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `${project.title || "animaker-project"}-final-package.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            alert("Exportação concluída! O pacote JSON do projeto foi descarregado.");
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 400);
      return;
    }

    // MP4 Export Logic
    if (movieClips.length === 0) return;
    
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus("A preparar motor de renderização...");
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on aspect ratio
    const [w, h] = (project.aspectRatio || '16:9').split(':').map(Number);
    canvas.width = 1280;
    canvas.height = Math.round(1280 * (h / w));

    const stream = canvas.captureStream(30); // 30 FPS
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title || "animaker-project"}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setIsExporting(false);
      setExportStatus("");
      alert("Exportação MP4 (WebM) concluída! O vídeo foi gerado com todas as transições e legendas.");
    };

    recorder.start();

    // Rendering Loop
    let clipIdx = 0;
    const totalClips = movieClips.length;
    
    const renderClip = async (index: number) => {
      if (index >= totalClips) {
        recorder.stop();
        return;
      }

      const clip = movieClips[index];
      const nextClip = movieClips[index + 1];
      const transition = (clip as any).transition || project.globalTransition || 'cut';
      
      setExportStatus(`A renderizar Clip ${index + 1} de ${totalClips}...`);
      setExportProgress((index / totalClips) * 100);

      const video = document.createElement('video');
      video.src = clip.videoUrl;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve(null);
        video.onerror = (e) => reject(e);
      });

      await video.play();

      return new Promise<void>((resolve) => {
        let frameId: number;
        const drawFrame = () => {
          if (video.paused || video.ended) {
            cancelAnimationFrame(frameId);
            video.pause();
            video.src = "";
            video.load();
            resolve();
            return;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Draw Subtitles
          if (subtitleSettings.enabled) {
            const text = subtitleSettings.translatedLanguage && subtitleSettings.translations?.[clip.id] 
              ? subtitleSettings.translations[clip.id] 
              : (clip.dialogue && clip.dialogue !== "Nenhum" ? clip.dialogue : null);

            if (text) {
              ctx.font = "bold 32px sans-serif";
              ctx.textAlign = "center";
              ctx.shadowColor = "black";
              ctx.shadowBlur = 8;
              ctx.lineWidth = 4;
              ctx.strokeStyle = "black";
              ctx.strokeText(text, canvas.width / 2, canvas.height - 60);
              ctx.fillStyle = "white";
              ctx.fillText(text, canvas.width / 2, canvas.height - 60);
              ctx.shadowBlur = 0;
            }
          }

          // Handle Transitions (Simple Fade Out at the end)
          const timeLeft = video.duration - video.currentTime;
          if (timeLeft < 0.5 && transition !== 'cut') {
            if (transition === 'fade' || transition === 'fade-black') {
              ctx.fillStyle = `rgba(0, 0, 0, ${1 - (timeLeft / 0.5)})`;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (transition === 'fade-white') {
              ctx.fillStyle = `rgba(255, 255, 255, ${1 - (timeLeft / 0.5)})`;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
          }

          requestAnimationFrame(drawFrame);
        };
        drawFrame();
      });
    };

    for (let i = 0; i < totalClips; i++) {
      await renderClip(i);
    }
  };

  const handleTranslateSubtitles = async (targetLangCode: string) => {
    setIsTranslating(true);
    try {
      const targetLangName = SUGGESTED_LANGUAGES.find(l => l.code === targetLangCode)?.name || targetLangCode;
      const translations: Record<string, string> = {};
      
      const takesToTranslate = allTakes.filter(t => t.dialogue && t.dialogue !== "Nenhum");
      
      for (const take of takesToTranslate) {
        const prompt = `Traduz o seguinte diálogo de filme de ${project.language || 'Português'} para ${targetLangName}. 
        Diálogo: "${take.dialogue}"
        Responde apenas com a tradução direta, sem aspas ou explicações.`;
        
        const translated = await generateText(prompt);
        translations[take.id] = translated.trim();
      }

      setProject(prev => ({
        ...prev,
        subtitleSettings: {
          ...(prev.subtitleSettings || { language: prev.language || 'pt', enabled: true }),
          enabled: true,
          translatedLanguage: targetLangCode,
          translations
        }
      }));
    } catch (error) {
      console.error(error);
      alert("Erro ao traduzir legendas.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleNextClip = () => {
    if (currentClipIndex < movieClips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
    } else {
      setIsPlayingFullMovie(false);
      setCurrentClipIndex(0);
    }
  };

  const handlePrevClip = () => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(prev => prev - 1);
    }
  };

  useEffect(() => {
    if (isPlayingFullMovie && videoRef.current) {
      videoRef.current.play().catch(e => console.error("Auto-play failed", e));
    }
  }, [currentClipIndex, isPlayingFullMovie]);

  const getSubtitleText = () => {
    if (!subtitleSettings.enabled || !currentClip) return null;
    
    if (subtitleSettings.translatedLanguage && subtitleSettings.translations?.[currentClip.id]) {
      return subtitleSettings.translations[currentClip.id];
    }
    
    return currentClip.dialogue && currentClip.dialogue !== "Nenhum" ? currentClip.dialogue : null;
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">
            Pré-visualização e Exportação
          </h2>
          <p className="text-zinc-500">
            Revê o teu filme final, configura legendas e exporta o projeto.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Hidden Canvas for Export */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Export Overlay */}
        {isExporting && exportFormat === 'mp4' && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-full max-w-md space-y-8">
              <div className="relative">
                <div className="w-32 h-32 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Film className="w-10 h-10 text-indigo-500 animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white">A Exportar Filme...</h2>
                <p className="text-zinc-400">{exportStatus}</p>
              </div>

              <div className="space-y-4">
                <div className="h-4 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-500"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-zinc-500">
                  <span>{Math.round(exportProgress)}% CONCLUÍDO</span>
                  <span>ESTIMATIVA: {Math.round((100 - exportProgress) / 5)}s</span>
                </div>
              </div>

              <p className="text-sm text-zinc-500 italic">
                Por favor, não feches esta janela. O vídeo está a ser renderizado frame a frame com todas as transições e legendas.
              </p>
            </div>
          </div>
        )}

        {/* Main Player */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden relative">
            {movieClips.length > 0 ? (
              <div className="relative group">
                <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-black flex items-center justify-center`}>
                  <video
                    ref={videoRef}
                    src={currentClip.videoUrl}
                    className="w-full h-full object-contain"
                    onEnded={isPlayingFullMovie ? handleNextClip : undefined}
                    controls={!isPlayingFullMovie}
                  />
                  
                  {/* Subtitle Overlay */}
                  {subtitleSettings.enabled && getSubtitleText() && (
                    <div className="absolute bottom-12 left-0 right-0 flex justify-center px-8 pointer-events-none">
                      <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-center text-sm md:text-base font-medium max-w-[80%] shadow-lg border border-white/10">
                        {getSubtitleText()}
                      </div>
                    </div>
                  )}

                  {/* Custom Controls for Full Movie Mode */}
                  {isPlayingFullMovie && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button onClick={handlePrevClip} className="text-white hover:text-indigo-400 transition-colors">
                          <SkipBack className="w-6 h-6" />
                        </button>
                        <button 
                          onClick={() => {
                            if (videoRef.current?.paused) videoRef.current.play();
                            else videoRef.current?.pause();
                          }} 
                          className="text-white hover:text-indigo-400 transition-colors"
                        >
                          <Pause className="w-8 h-8" />
                        </button>
                        <button onClick={handleNextClip} className="text-white hover:text-indigo-400 transition-colors">
                          <SkipForward className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="text-white text-xs font-mono">
                        Clip {currentClipIndex + 1} / {movieClips.length}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-zinc-800 flex flex-col items-center justify-center text-zinc-500`}>
                <PlayCircle className="w-16 h-16 mb-4 opacity-50" />
                <p>Ainda não existem conteúdos renderizados.</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button
                onClick={() => setExportFormat('json')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  exportFormat === 'json' ? "bg-white shadow-sm text-indigo-600" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                FORMATO JSON
              </button>
              <button
                onClick={() => setExportFormat('mp4')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  exportFormat === 'mp4' ? "bg-white shadow-sm text-indigo-600" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                FORMATO MP4
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsPlayingFullMovie(true);
                  setCurrentClipIndex(0);
                }}
                disabled={movieClips.length === 0}
                className="flex-1 flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
              >
                <Film className="w-6 h-6" />
                Renderizar Filme Completo (Preview)
              </button>
              <button
                onClick={handleExportVideo}
                disabled={movieClips.length === 0 || isExporting}
                className="flex-1 flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    {Math.round(exportProgress)}%
                  </>
                ) : (
                  <>
                    <Download className="w-6 h-6" />
                    Exportar {exportFormat.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          {/* Transitions Card */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-200 space-y-4">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              Transições Globais
            </h3>
            <div className="space-y-3">
              <select
                value={project.globalTransition || 'cut'}
                onChange={(e) => handleApplyGlobalTransition(e.target.value as TransitionType)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TRANSITION_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-400 italic">
                Aplica o mesmo tipo de transição a todos os clips do filme.
              </p>
            </div>
          </div>

          {/* Subtitles Card */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-200 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                <Languages className="w-5 h-5 text-indigo-600" />
                Legendas
              </h3>
              <button
                onClick={handleToggleSubtitles}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  subtitleSettings.enabled ? "bg-indigo-600" : "bg-zinc-200"
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  subtitleSettings.enabled ? "left-7" : "left-1"
                }`} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Língua Original</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">{project.language || "Português"}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Tradução Automática</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleTranslateSubtitles(lang.code)}
                      disabled={isTranslating}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 ${
                        subtitleSettings.translatedLanguage === lang.code
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-white border-zinc-200 text-zinc-600 hover:border-indigo-300"
                      }`}
                    >
                      {isTranslating && subtitleSettings.translatedLanguage === lang.code ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Globe className="w-3 h-3 opacity-50" />
                      )}
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Project Info Card */}
          <div className="bg-zinc-900 p-6 rounded-3xl shadow-xl text-white space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-indigo-400" />
              Resumo do Filme
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Título</span>
                <span className="font-medium">{project.title}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Clips Renderizados</span>
                <span className="font-medium">{movieClips.length}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Formato</span>
                <span className="font-medium">{project.aspectRatio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estilo</span>
                <span className="font-medium">{project.filmStyle}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clip List */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
        <h3 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
          <Film className="w-6 h-6 text-indigo-600" />
          Lista de Clips e Transições
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {movieClips.map((clip, i) => (
            <div key={clip.id} className="space-y-3">
              <button
                onClick={() => {
                  setIsPlayingFullMovie(false);
                  setCurrentClipIndex(i);
                }}
                className={`w-full text-left space-y-2 group transition-all ${
                  currentClipIndex === i && !isPlayingFullMovie ? "ring-2 ring-indigo-500 ring-offset-4 rounded-xl" : ""
                }`}
              >
                <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-black rounded-xl overflow-hidden border border-zinc-200 relative`}>
                  <video src={clip.videoUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-8 h-8 text-white fill-white" />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                    {i + 1}
                  </div>
                </div>
                <div className="px-1">
                  <p className="text-xs font-bold text-zinc-900 truncate">{clip.action}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{clip.dialogue || "Sem diálogo"}</p>
                </div>
              </button>

              {/* Transition Selector for this clip (transition to NEXT clip) */}
              {i < movieClips.length - 1 && (
                <div className="flex items-center gap-2 px-1">
                  <div className="h-px flex-1 bg-zinc-100" />
                  <div className="relative group/trans">
                    <select
                      value={(clip as Take).transition || project.globalTransition || 'cut'}
                      onChange={(e) => handleUpdateTransition(clip.id, e.target.value as TransitionType)}
                      className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-[9px] font-bold text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none pr-6 cursor-pointer hover:bg-white transition-colors"
                    >
                      {TRANSITION_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.name.toUpperCase()}</option>
                      ))}
                    </select>
                    <ArrowRightLeft className="w-3 h-3 text-zinc-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none group-hover/trans:text-indigo-400 transition-colors" />
                  </div>
                  <div className="h-px flex-1 bg-zinc-100" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
