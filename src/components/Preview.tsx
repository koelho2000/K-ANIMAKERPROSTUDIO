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
  Mic,
  Settings as SettingsIcon,
  Globe,
  Scissors,
  Zap,
  Maximize2,
  ArrowRightLeft,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
  { code: "pt-PT", name: "Português (Portugal)" },
  { code: "en", name: "Inglês" },
  { code: "pt-BR", name: "Português (Brasil)" },
  { code: "es", name: "Espanhol" },
  { code: "fr", name: "Francês" },
  { code: "de", name: "Alemão" },
  { code: "it", name: "Italiano" },
];

export default function Preview({ project, setProject }: PreviewProps) {
  const [isPlayingFullMovie, setIsPlayingFullMovie] = useState(false);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isNarrationEnabled, setIsNarrationEnabled] = useState(true);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'json' | 'mp4'>('json');
  const [exportStatus, setExportStatus] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const narrationAudioRef = useRef<HTMLAudioElement>(null);
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
  const subtitleSettings = {
    enabled: false,
    language: project.language || 'pt-PT',
    translations: {},
    ...project.subtitleSettings
  };

  const transitionVariants = {
    cut: {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      exit: { opacity: 1 },
    },
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    'fade-black': {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    'fade-white': {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    'wipe-left': {
      initial: { clipPath: 'inset(0 0 0 100%)' },
      animate: { clipPath: 'inset(0 0 0 0%)' },
      exit: { clipPath: 'inset(0 100% 0 0%)' },
    },
    'wipe-right': {
      initial: { clipPath: 'inset(0 100% 0 0%)' },
      animate: { clipPath: 'inset(0 0 0 0%)' },
      exit: { clipPath: 'inset(0 0 0 100%)' },
    },
    'zoom-in': {
      initial: { scale: 0.8, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 1.2, opacity: 0 },
    },
    'zoom-out': {
      initial: { scale: 1.2, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.8, opacity: 0 },
    },
  };

  const currentTransition = currentClipIndex > 0 && movieClips[currentClipIndex - 1]
    ? (movieClips[currentClipIndex - 1] as any)?.transition || project.globalTransition || 'cut'
    : 'cut';

  const exitTransition = (currentClip as any)?.transition || project.globalTransition || 'cut';

  const handleToggleSubtitles = () => {
    setProject(prev => {
      const currentEnabled = prev.subtitleSettings?.enabled || false;
      return {
        ...prev,
        subtitleSettings: {
          ...(prev.subtitleSettings || { language: prev.language || 'pt-PT' }),
          enabled: !currentEnabled
        }
      };
    });
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

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioDest = audioCtx.createMediaStreamDestination();

    const stream = canvas.captureStream(30); // 30 FPS
    const combinedStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks()
    ]);

    const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
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
      audioCtx.close();
      alert("Exportação MP4 (WebM) concluída! O vídeo foi gerado com som, transições e legendas.");
    };

    recorder.start();

    // Rendering Loop
    const totalClips = movieClips.length;
    
    const renderClip = async (index: number, prevTransition: TransitionType) => {
      const clip = movieClips[index];
      if (!clip.videoUrl) return;
      
      const transition = (clip as any)?.transition || project.globalTransition || 'cut';
      
      setExportStatus(`A renderizar Clip ${index + 1} de ${totalClips}...`);
      setExportProgress((index / totalClips) * 100);

      const video = document.createElement('video');
      video.src = clip.videoUrl;
      video.crossOrigin = "anonymous";
      video.muted = false;
      video.playsInline = true;
      video.volume = 1.0;
      
      const source = audioCtx.createMediaElementSource(video);
      source.connect(audioDest);

      let narrationSource: MediaElementAudioSourceNode | null = null;
      let narrationAudio: HTMLAudioElement | null = null;

      if (isNarrationEnabled && (clip as Take).narrationAudioUrl) {
        narrationAudio = document.createElement('audio');
        narrationAudio.src = (clip as Take).narrationAudioUrl!;
        narrationAudio.crossOrigin = "anonymous";
        narrationSource = audioCtx.createMediaElementSource(narrationAudio);
        narrationSource.connect(audioDest);
      }
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve(null);
        video.onerror = (e) => reject(e);
      });

      if (narrationAudio) {
        await narrationAudio.play();
      }
      await video.play();

      return new Promise<void>((resolve) => {
        let frameId: number;
        const drawFrame = () => {
          if (video.paused || video.ended) {
            cancelAnimationFrame(frameId);
            video.pause();
            video.src = "";
            video.load();
            source.disconnect();
            if (narrationAudio) {
              narrationAudio.pause();
              narrationAudio.src = "";
              narrationAudio.load();
              narrationSource?.disconnect();
            }
            resolve();
            return;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Apply Transformations for Zoom transitions
          const timePassed = video.currentTime;
          const timeLeft = video.duration - video.currentTime;
          let scale = 1;
          let offsetX = 0;
          let offsetY = 0;

          if (timePassed < 0.5 && prevTransition.startsWith('zoom')) {
            const p = timePassed / 0.5;
            scale = prevTransition === 'zoom-in' ? 0.8 + (0.2 * p) : 1.2 - (0.2 * p);
          } else if (timeLeft < 0.5 && transition.startsWith('zoom')) {
            const p = 1 - (timeLeft / 0.5);
            scale = transition === 'zoom-in' ? 1 + (0.2 * p) : 1 - (0.2 * p);
          }

          ctx.save();
          if (scale !== 1) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(scale, scale);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Draw Subtitles
          if (subtitleSettings.enabled) {
            const text = subtitleSettings.translatedLanguage && subtitleSettings.translations?.[clip.id] 
              ? subtitleSettings.translations[clip.id] 
              : (clip.dialogue && clip.dialogue !== "Nenhum" && clip.dialogue !== "" ? clip.dialogue : null);

            if (text) {
              ctx.font = "bold 48px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
              ctx.shadowBlur = 12;
              ctx.lineWidth = 6;
              ctx.strokeStyle = "black";
              ctx.strokeText(text, canvas.width / 2, canvas.height - 60);
              ctx.fillStyle = "white";
              ctx.fillText(text, canvas.width / 2, canvas.height - 60);
              ctx.shadowBlur = 0;
            }
          }

          // Handle "IN" Transitions
          if (timePassed < 0.5 && prevTransition !== 'cut') {
            const p = 1 - (timePassed / 0.5);
            if (prevTransition === 'fade' || prevTransition === 'fade-black') {
              ctx.fillStyle = `rgba(0, 0, 0, ${p})`;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (prevTransition === 'fade-white') {
              ctx.fillStyle = `rgba(255, 255, 255, ${p})`;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (prevTransition === 'wipe-left') {
              ctx.fillStyle = 'black';
              ctx.fillRect(0, 0, canvas.width * p, canvas.height);
            } else if (prevTransition === 'wipe-right') {
              ctx.fillStyle = 'black';
              ctx.fillRect(canvas.width * (1 - p), 0, canvas.width * p, canvas.height);
            }
          }

          // Handle "OUT" Transitions
          if (timeLeft < 0.5 && transition !== 'cut') {
            const p = 1 - (timeLeft / 0.5);
            if (transition === 'fade' || transition === 'fade-black') {
              ctx.fillStyle = `rgba(0, 0, 0, ${p})`;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (transition === 'fade-white') {
              ctx.fillStyle = `rgba(255, 255, 255, ${p})`;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (transition === 'wipe-left') {
              ctx.fillStyle = 'black';
              ctx.fillRect(canvas.width * (1 - p), 0, canvas.width * p, canvas.height);
            } else if (transition === 'wipe-right') {
              ctx.fillStyle = 'black';
              ctx.fillRect(0, 0, canvas.width * p, canvas.height);
            }
          }

          frameId = requestAnimationFrame(drawFrame);
        };
        frameId = requestAnimationFrame(drawFrame);
      });
    };

    for (let i = 0; i < totalClips; i++) {
      const prevTransition = i > 0 && movieClips[i-1] ? (movieClips[i-1] as any)?.transition || project.globalTransition || 'cut' : 'cut';
      await renderClip(i, prevTransition);
    }
    
    setExportProgress(100);
    setExportStatus("A finalizar ficheiro...");
    recorder.stop();
  };

  const handleTranslateSubtitles = async (targetLangCode: string) => {
    // If selecting the same as project language, we can just clear translations
    // or if it's already translated to this, do nothing
    if (targetLangCode === 'original') {
      setProject(prev => ({
        ...prev,
        subtitleSettings: {
          ...(prev.subtitleSettings || { language: prev.language || 'pt-PT', enabled: true }),
          enabled: true,
          translatedLanguage: undefined,
          translations: {}
        }
      }));
      return;
    }

    setIsTranslating(true);
    try {
      const targetLangName = SUGGESTED_LANGUAGES.find(l => l.code === targetLangCode)?.name || targetLangCode;
      const translations: Record<string, string> = {};
      
      const takesToTranslate = allTakes.filter(t => t.dialogue && t.dialogue !== "Nenhum");
      
      for (const take of takesToTranslate) {
        const isPTPT = targetLangName === "Português (Portugal)" || targetLangCode === "pt-PT";
        const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : targetLangName;
        
        const prompt = `Traduz o seguinte diálogo de filme de ${project.language || 'Português'} para ${langSpec}. 
        Diálogo: "${take.dialogue}"
        Público Alvo: ${project.targetAudience || 'Adultos'}
        ${isPTPT ? "IMPORTANTE: Usa estritamente Português de Portugal (ex: 'ecrã' em vez de 'tela', 'tu estás' em vez de 'você está', etc.)." : ""}
        Responde apenas com a tradução direta, sem aspas ou explicações.`;
        
        const translated = await generateText(prompt);
        translations[take.id] = translated.trim();
      }

      setProject(prev => ({
        ...prev,
        subtitleSettings: {
          ...(prev.subtitleSettings || { language: prev.language || 'pt-PT', enabled: true }),
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
    if (narrationAudioRef.current) {
      narrationAudioRef.current.pause();
      narrationAudioRef.current.currentTime = 0;
    }
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
      if (isNarrationEnabled && narrationAudioRef.current && (currentClip as Take).narrationAudioUrl) {
        narrationAudioRef.current.play().catch(e => console.error("Narration auto-play failed", e));
      }
    }
  }, [currentClipIndex, isPlayingFullMovie]);

  const getSubtitleText = () => {
    if (!subtitleSettings.enabled || !currentClip) return null;
    
    if (subtitleSettings.translatedLanguage && subtitleSettings.translations?.[currentClip.id]) {
      return subtitleSettings.translations[currentClip.id];
    }
    
    return currentClip.dialogue && currentClip.dialogue !== "Nenhum" && currentClip.dialogue !== "" ? currentClip.dialogue : null;
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
              <div className="relative group overflow-hidden">
                <div 
                  className="w-full bg-black flex items-center justify-center relative"
                  style={{ aspectRatio: (project.aspectRatio || '16:9').replace(':', '/') }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentClipIndex}
                      variants={transitionVariants}
                      initial={currentTransition === 'cut' ? false : "initial"}
                      animate="animate"
                      exit="exit"
                      transition={{ 
                        duration: currentTransition === 'cut' ? 0 : 0.5,
                        ease: "easeInOut"
                      }}
                      className="absolute inset-0 w-full h-full flex items-center justify-center"
                    >
                      {/* Background for fade-black/white */}
                      {(currentTransition === 'fade-black' || exitTransition === 'fade-black') && (
                        <div className="absolute inset-0 bg-black -z-10" />
                      )}
                      {(currentTransition === 'fade-white' || exitTransition === 'fade-white') && (
                        <div className="absolute inset-0 bg-white -z-10" />
                      )}
                      
                      {(currentClip as any)?.videoUrl && (
                        <video
                          ref={videoRef}
                          src={currentClip.videoUrl}
                          className="w-full h-full object-contain"
                          onEnded={isPlayingFullMovie ? handleNextClip : undefined}
                          onPlay={() => {
                            if (isNarrationEnabled && narrationAudioRef.current) {
                              narrationAudioRef.current.play().catch(e => console.error("Narration play failed", e));
                            }
                          }}
                          onPause={() => {
                            if (narrationAudioRef.current) {
                              narrationAudioRef.current.pause();
                            }
                          }}
                          onSeeked={() => {
                            if (isNarrationEnabled && narrationAudioRef.current && videoRef.current) {
                              // Only sync if within bounds
                              if (videoRef.current.currentTime < narrationAudioRef.current.duration) {
                                narrationAudioRef.current.currentTime = videoRef.current.currentTime;
                              }
                            }
                          }}
                          controls={!isPlayingFullMovie}
                          autoPlay={isPlayingFullMovie}
                          muted={false}
                        />
                      )}
                      {isNarrationEnabled && (currentClip as Take).narrationAudioUrl && (
                        <audio
                          ref={narrationAudioRef}
                          src={(currentClip as Take).narrationAudioUrl}
                          autoPlay={isPlayingFullMovie}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Subtitle Overlay */}
                  {subtitleSettings.enabled && getSubtitleText() && (
                    <div className="absolute bottom-12 left-0 right-0 flex justify-center px-8 pointer-events-none z-50">
                      <div className="text-white px-6 py-3 text-center text-sm md:text-lg font-bold max-w-[85%] drop-shadow-[0_2px_4px_rgba(0,0,0,1)] [text-shadow:_0_1px_8px_rgb(0_0_0_/_100%)] leading-relaxed">
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
              <div 
                className="w-full bg-zinc-800 flex flex-col items-center justify-center text-zinc-500"
                style={{ aspectRatio: (project.aspectRatio || '16:9').replace(':', '/') }}
              >
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
                <Mic className="w-5 h-5 text-rose-600" />
                Narração IA
              </h3>
              <button
                onClick={() => setIsNarrationEnabled(!isNarrationEnabled)}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  isNarrationEnabled ? "bg-rose-600" : "bg-zinc-200"
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  isNarrationEnabled ? "left-7" : "left-1"
                }`} />
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 italic">
              Ativa ou desativa a narração gerada por IA durante a reprodução e exportação.
            </p>
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
              <button
                onClick={() => handleTranslateSubtitles('original')}
                className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  !subtitleSettings.translatedLanguage 
                    ? "bg-indigo-50 border-indigo-200" 
                    : "bg-zinc-50 border-zinc-100 hover:border-zinc-200"
                }`}
              >
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 text-left">Língua Original</p>
                  <span className="text-sm font-medium text-zinc-700">{project.language || "Português"}</span>
                </div>
                {!subtitleSettings.translatedLanguage && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </button>

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
                <div 
                  className="w-full bg-black rounded-xl overflow-hidden border border-zinc-200 relative"
                  style={{ aspectRatio: (project.aspectRatio || '16:9').replace(':', '/') }}
                >
                  {clip.videoUrl && (
                    <video src={clip.videoUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  )}
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
                      value={(clip as any)?.transition || project.globalTransition || 'cut'}
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
