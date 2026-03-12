import React, { useState, useRef, useEffect } from "react";
import { X, Eraser, Pen, Sparkles, Check, Loader2, RotateCcw, Undo, PlusCircle, Film, HelpCircle, Info } from "lucide-react";
import { generateImage, generateVideo, pollVideoOperation, extendVideo } from "../services/geminiService";
import ProgressBar from "./ProgressBar";
import { VideoModel } from "../types";

interface IntelligentEditorProps {
  mediaItem: {
    id: string;
    url: string;
    type: 'image' | 'video';
    title: string;
    source: string;
    videoObject?: any;
  };
  aspectRatio: string;
  initialMode?: 'edit' | 'extend';
  defaultVideoModel?: VideoModel;
  nextMediaUrl?: string;
  onSave: (newUrl: string, newVideoObject?: any) => void;
  onClose: () => void;
}

export default function IntelligentEditor({ 
  mediaItem, 
  aspectRatio, 
  initialMode = 'edit', 
  defaultVideoModel = 'flow',
  nextMediaUrl,
  onSave, 
  onClose 
}: IntelligentEditorProps) {
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [editedVideoObject, setEditedVideoObject] = useState<any>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [mode, setMode] = useState<'edit' | 'extend'>(initialMode);
  const [videoModel, setVideoModel] = useState<VideoModel>(defaultVideoModel);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [showNextPreview, setShowNextPreview] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 98) return prev;
          const increment = prev < 20 ? Math.random() * 2 : Math.random() * 0.4;
          return prev + increment;
        });
      }, 1000);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    if (mediaItem.type === 'image') {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = mediaItem.url;
      img.onload = () => {
        setupCanvases(img);
      };
    }
  }, [mediaItem]);

  const setupCanvases = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    // Calculate dimensions to fit container while maintaining aspect ratio
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const imgRatio = img.width / img.height;
    const containerRatio = containerWidth / containerHeight;

    let drawWidth, drawHeight;
    if (imgRatio > containerRatio) {
      drawWidth = containerWidth;
      drawHeight = containerWidth / imgRatio;
    } else {
      drawHeight = containerHeight;
      drawWidth = containerHeight * imgRatio;
    }

    canvas.width = drawWidth;
    canvas.height = drawHeight;
    maskCanvas.width = drawWidth;
    maskCanvas.height = drawHeight;

    ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
    
    // Initialize mask as transparent
    maskCtx.clearRect(0, 0, drawWidth, drawHeight);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    const rect = maskCanvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
      const ctx = maskCanvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const hasData = imageData.data.some((val, i) => i % 4 === 3 && val > 0);
        setHasMask(hasData);
      }
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    const rect = maskCanvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = brushSize;
    ctx.globalCompositeOperation = 'source-over';

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
      const ctx = maskCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        ctx.beginPath();
        setHasMask(false);
      }
    }
  };

  const handleProcess = async () => {
    if (!prompt) return;
    setIsProcessing(true);
    setStatus("A processar...");
    try {
      if (mediaItem.type === 'image') {
        const maskCanvas = maskCanvasRef.current;
        const referenceImages = [mediaItem.url];
        
        let finalPrompt = `${prompt} (baseado na imagem fornecida)`;
        
        if (hasMask && maskCanvas) {
          const maskDataUrl = maskCanvas.toDataURL('image/png');
          referenceImages.push(maskDataUrl);
          finalPrompt = `${prompt}. Altera apenas a área marcada a branco na segunda imagem (máscara). Mantém o resto da imagem original inalterado.`;
        }
        
        const result = await generateImage(finalPrompt, aspectRatio, referenceImages);
        setEditedUrl(result);
      } else {
        if (mode === 'edit') {
          setStatus("A editar vídeo...");
          const operation = await generateVideo(`${prompt} (baseado no vídeo fornecido)`, mediaItem.url, undefined, videoModel, aspectRatio);
          const result = await pollVideoOperation(operation);
          setEditedUrl(result.videoUrl);
          setEditedVideoObject(result.videoObject);
        } else {
          setStatus("A extender vídeo...");
          if (!mediaItem.videoObject) {
            throw new Error("Objeto de vídeo não encontrado para extensão.");
          }
          const operation = await extendVideo(prompt, mediaItem.videoObject, videoModel, aspectRatio);
          const result = await pollVideoOperation(operation);
          setEditedUrl(result.videoUrl);
          setEditedVideoObject(result.videoObject);
        }
      }
    } catch (error: any) {
      console.error("Erro na edição inteligente:", error);
      alert(`Erro ao processar: ${error.message || "Por favor, tenta novamente."}`);
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  };

  const handleConfirm = () => {
    if (editedUrl) {
      onSave(editedUrl, editedVideoObject);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-zinc-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-zinc-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Edição Inteligente</h3>
              <p className="text-xs text-zinc-500">
                {mediaItem.type === 'image' 
                  ? "Usa a caneta para marcar áreas e descreve as alterações."
                  : "Edita o conteúdo do vídeo ou extende a sua duração."}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Area */}
          <div className="flex-1 bg-zinc-100 relative flex items-center justify-center p-8 overflow-hidden" ref={containerRef}>
            {mediaItem.type === 'image' ? (
              <div className="relative shadow-2xl rounded-lg overflow-hidden cursor-crosshair">
                <canvas ref={canvasRef} className="max-w-full max-h-full" />
                <canvas 
                  ref={maskCanvasRef} 
                  className="absolute inset-0 max-w-full max-h-full opacity-50 pointer-events-auto"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasMask && !isDrawing && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/40 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2">
                      <Pen className="w-3 h-3" />
                      Desenha aqui para marcar a área a editar
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
                  <video 
                    src={mediaItem.url} 
                    controls 
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                    Original
                  </div>
                  
                  {mode === 'extend' && nextMediaUrl && (
                    <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                      <button
                        onClick={() => setShowNextPreview(!showNextPreview)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${
                          showNextPreview 
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' 
                            : 'bg-black/60 text-white border-white/10 hover:bg-black/80 backdrop-blur-md'
                        }`}
                      >
                        <Film className="w-3 h-3" />
                        {showNextPreview ? 'Ocultar Take Seguinte' : 'Ver Take Seguinte'}
                      </button>
                      
                      {showNextPreview && (
                        <div className="w-64 aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
                          <video 
                            src={nextMediaUrl} 
                            controls 
                            autoPlay
                            muted
                            loop
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600/80 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-tighter">
                            Take Seguinte (Referência)
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {editedUrl && (
                  <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
                    <video 
                      src={editedUrl} 
                      controls 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 px-3 py-1 bg-indigo-600/80 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                      {mode === 'edit' ? 'Editado' : 'Extendido'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Brush Size Control */}
            {mediaItem.type === 'image' && (
              <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-zinc-200 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-zinc-400 rounded-full" style={{ width: brushSize/2, height: brushSize/2 }} />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Tamanho</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="100" 
                  value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-32 accent-indigo-600"
                />
                <button 
                  onClick={clearMask}
                  className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-all"
                  title="Limpar Máscara"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Controls */}
          <div className="w-80 border-l border-zinc-100 flex flex-col bg-white">
            <div className="p-6 flex-1 space-y-6 overflow-y-auto">
              {/* Mode Selector for Video */}
              {mediaItem.type === 'video' && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Modo de Operação</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl">
                    <button
                      onClick={() => setMode('edit')}
                      className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                        mode === 'edit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      <Pen className="w-3 h-3" />
                      Editar
                    </button>
                    <button
                      onClick={() => setMode('extend')}
                      className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                        mode === 'extend' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      <PlusCircle className="w-3 h-3" />
                      Extender
                    </button>
                  </div>
                </div>
              )}

              {/* Model Selector for Video */}
              {mediaItem.type === 'video' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Modelo de Renderização</label>
                    <div className="group relative">
                      <HelpCircle className="w-3 h-3 text-zinc-400 cursor-help" />
                      <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-zinc-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-white/10">
                        <p className="font-bold mb-1 text-indigo-400">Guia Rápido:</p>
                        <ul className="space-y-1.5">
                          <li><span className="font-bold">Veo 3.1:</span> Máxima qualidade cinematográfica e áudio sincronizado.</li>
                          <li><span className="font-bold">Veo Fast:</span> Otimizado para velocidade e iterações.</li>
                          <li><span className="font-bold">Flow:</span> Consistência de personagens e extensões.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setVideoModel('veo-3.1')}
                      className={`flex items-center justify-between px-3 py-2 text-[10px] font-bold rounded-xl border-2 transition-all ${
                        videoModel === 'veo-3.1' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                      }`}
                    >
                      <span>VEO 3.1 (Cinematográfico)</span>
                      {videoModel === 'veo-3.1' && <Check className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => setVideoModel('veo-fast')}
                      className={`flex items-center justify-between px-3 py-2 text-[10px] font-bold rounded-xl border-2 transition-all ${
                        videoModel === 'veo-fast' ? 'border-amber-600 bg-amber-50 text-amber-600' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                      }`}
                    >
                      <span>VEO FAST (Rápido)</span>
                      {videoModel === 'veo-fast' && <Check className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => setVideoModel('flow')}
                      className={`flex items-center justify-between px-3 py-2 text-[10px] font-bold rounded-xl border-2 transition-all ${
                        videoModel === 'flow' ? 'border-emerald-600 bg-emerald-50 text-emerald-600' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                      }`}
                    >
                      <span>FLOW (Consistência)</span>
                      {videoModel === 'flow' && <Check className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  {mode === 'edit' ? 'Instruções de Edição' : 'Instruções de Extensão'}
                </label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={mode === 'edit' 
                    ? "Ex: Altera a cor da camisola para vermelho..." 
                    : "Ex: A personagem continua a caminhar e sorri..."}
                  className="w-full h-40 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                />
              </div>

              {isProcessing && (
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <ProgressBar 
                    progress={progress} 
                    label={status} 
                    modelName={videoModel === 'flow' ? 'Flow' : 'Veo'} 
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-100 space-y-3 bg-zinc-50/50">
              <button
                onClick={handleProcess}
                disabled={isProcessing || !prompt}
                className={`w-full py-4 text-white rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                  mode === 'edit' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    A Processar...
                  </>
                ) : (
                  <>
                    {mode === 'edit' ? <Sparkles className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                    {mode === 'edit' ? 'Gerar Alteração' : 'Gerar Extensão'}
                  </>
                )}
              </button>

              {editedUrl && (
                <button
                  onClick={handleConfirm}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Validar e Concluir
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
