import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Sparkles, Play, RotateCcw, Check, Trash2 } from 'lucide-react';
import { extendVideo, pollVideoOperation } from '../services/geminiService';
import ProgressBar from './ProgressBar';

interface VideoExtenderProps {
  videoUrl: string;
  videoObject: any;
  aspectRatio: string;
  onSave: (newVideoUrl: string, newVideoObject: any) => void;
  onClose: () => void;
}

export default function VideoExtender({ videoUrl, videoObject, aspectRatio, onSave, onClose }: VideoExtenderProps) {
  const [prompt, setPrompt] = useState('');
  const [isExtending, setIsExtending] = useState(false);
  const [extensionProgress, setExtensionProgress] = useState(0);
  const [extensionStatus, setExtensionStatus] = useState('');
  const [extendedVideoUrl, setExtendedVideoUrl] = useState<string | null>(null);
  const [extendedVideoObject, setExtendedVideoObject] = useState<any>(null);
  const [isPlayingTotal, setIsPlayingTotal] = useState(false);
  
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const extendedVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isExtending) {
      setExtensionProgress(0);
      interval = setInterval(() => {
        setExtensionProgress((prev) => {
          if (prev >= 98) return prev;
          const increment = prev < 20 ? Math.random() * 2 : Math.random() * 0.4;
          return prev + increment;
        });
      }, 1000);
    } else {
      setExtensionProgress(100);
    }
    return () => clearInterval(interval);
  }, [isExtending]);

  const handleExtend = async () => {
    if (!prompt.trim()) {
      alert("Por favor, insere instruções para a extensão do vídeo.");
      return;
    }

    setIsExtending(true);
    setExtensionStatus("A preparar extensão...");
    
    try {
      const operation = await extendVideo(prompt, videoObject, aspectRatio);
      setExtensionStatus("A processar extensão (2-5 min)...");
      
      const result = await pollVideoOperation(operation);
      setExtendedVideoUrl(result.videoUrl);
      setExtendedVideoObject(result.videoObject);
      setExtensionStatus("Extensão concluída!");
    } catch (error: any) {
      console.error("Erro ao estender vídeo:", error);
      alert(`Erro na extensão: ${error.message}`);
    } finally {
      setIsExtending(false);
    }
  };

  const handlePlayTotal = () => {
    setIsPlayingTotal(true);
    if (originalVideoRef.current) {
      originalVideoRef.current.currentTime = 0;
      originalVideoRef.current.play();
    }
  };

  const handleOriginalEnded = () => {
    if (extendedVideoRef.current) {
      extendedVideoRef.current.currentTime = 0;
      extendedVideoRef.current.play();
    }
  };

  const handleDiscard = () => {
    if (window.confirm("Tens a certeza que desejas descartar esta extensão?")) {
      setExtendedVideoUrl(null);
      setExtendedVideoObject(null);
      setIsPlayingTotal(false);
    }
  };

  const handleSave = () => {
    if (extendedVideoUrl && extendedVideoObject) {
      onSave(extendedVideoUrl, extendedVideoObject);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Extender Vídeo</h3>
              <p className="text-xs text-zinc-500">Adiciona mais tempo ao teu vídeo com novas instruções.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Video Preview Area */}
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 relative group">
                {!extendedVideoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full relative">
                    <video
                      ref={originalVideoRef}
                      src={videoUrl}
                      onEnded={handleOriginalEnded}
                      className={`w-full h-full object-contain ${isPlayingTotal && originalVideoRef.current?.paused === false ? 'block' : 'hidden'}`}
                    />
                    <video
                      ref={extendedVideoRef}
                      src={extendedVideoUrl}
                      className={`w-full h-full object-contain ${isPlayingTotal && extendedVideoRef.current?.paused === false ? 'block' : 'hidden'}`}
                    />
                    {!isPlayingTotal && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <button
                          onClick={handlePlayTotal}
                          className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform shadow-xl"
                        >
                          <Play className="w-8 h-8 fill-current ml-1" />
                        </button>
                      </div>
                    )}
                    {isPlayingTotal && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full text-[10px] font-bold text-white uppercase tracking-widest">
                        Preview Total
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {extendedVideoUrl && (
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handlePlayTotal}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Reproduzir Tudo
                  </button>
                  <button
                    onClick={() => {
                      setIsPlayingTotal(false);
                      setExtendedVideoUrl(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 rounded-xl text-sm font-bold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Descartar Extensão
                  </button>
                </div>
              )}
            </div>

            {/* Controls Area */}
            <div className="space-y-6">
              {!extendedVideoUrl ? (
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider">
                    Instruções para a Extensão
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: A personagem sorri e acena para a câmara enquanto o fundo se dissolve em luz..."
                    className="w-full h-40 bg-zinc-800 border border-zinc-700 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    disabled={isExtending}
                  />
                  <button
                    onClick={handleExtend}
                    disabled={isExtending || !prompt.trim()}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-900/20"
                  >
                    {isExtending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {extensionStatus}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Gerar Extensão de Vídeo
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6 bg-indigo-600/5 border border-indigo-500/20 p-6 rounded-2xl">
                  <div className="flex items-center gap-3 text-indigo-400 mb-2">
                    <Check className="w-6 h-6" />
                    <h4 className="font-bold">Extensão Gerada com Sucesso!</h4>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    A extensão foi baseada no último frame do vídeo original. Podes pré-visualizar o resultado combinado ou guardar esta nova versão no teu Take.
                  </p>
                  <div className="pt-4 flex flex-col gap-3">
                    <button
                      onClick={handleSave}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-900/20"
                    >
                      <Check className="w-5 h-5" />
                      Guardar e Substituir no Take
                    </button>
                    <button
                      onClick={handleDiscard}
                      className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Tentar Outro Prompt
                    </button>
                  </div>
                </div>
              )}

              {isExtending && (
                <div className="p-6 bg-zinc-800/50 rounded-2xl border border-zinc-700 animate-in fade-in slide-in-from-bottom-4">
                  <ProgressBar
                    progress={extensionProgress}
                    label={extensionStatus}
                    modelName="Veo"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-zinc-900 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
