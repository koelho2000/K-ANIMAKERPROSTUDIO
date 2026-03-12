import React, { useState, useRef, useEffect } from "react";
import { X, Eraser, Pen, Sparkles, Check, Loader2, RotateCcw, Undo } from "lucide-react";
import { generateImage, generateVideo, pollVideoOperation } from "../services/geminiService";

interface IntelligentEditorProps {
  mediaItem: {
    id: string;
    url: string;
    type: 'image' | 'video';
    title: string;
    source: string;
  };
  aspectRatio: string;
  onSave: (newUrl: string) => void;
  onClose: () => void;
}

export default function IntelligentEditor({ mediaItem, aspectRatio, onSave, onClose }: IntelligentEditorProps) {
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    setIsDrawing(true);
    draw(e);
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
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
      const ctx = maskCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        setHasMask(false);
      }
    }
  };

  const handleEdit = async () => {
    if (!prompt) return;
    setIsProcessing(true);
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
        // For video editing
        const operation = await generateVideo(`${prompt} (baseado no vídeo fornecido)`, mediaItem.url, undefined, 'flow', aspectRatio);
        const result = await pollVideoOperation(operation);
        setEditedUrl(result.videoUrl);
      }
    } catch (error) {
      console.error("Erro na edição inteligente:", error);
      alert("Erro ao processar a edição inteligente. Por favor, tenta novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (editedUrl) {
      onSave(editedUrl);
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
              <p className="text-xs text-zinc-500">Usa a caneta para marcar áreas e descreve as alterações.</p>
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
              <div className="w-full h-full flex items-center justify-center">
                <video 
                  src={mediaItem.url} 
                  controls 
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                />
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
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Instruções de Edição</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex: Altera a cor da camisola para vermelho e adiciona óculos de sol..."
                  className="w-full h-40 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                />
              </div>

              {editedUrl && (
                <div className="space-y-3 animate-in slide-in-from-bottom-4">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Resultado</label>
                  <div className="aspect-square bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 shadow-inner">
                    {mediaItem.type === 'image' ? (
                      <img src={editedUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <video src={editedUrl} className="w-full h-full object-cover" controls />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-100 space-y-3 bg-zinc-50/50">
              <button
                onClick={handleEdit}
                disabled={isProcessing || !prompt}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    A Processar...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Gerar Alteração
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
