import React, { useState, useRef, useEffect } from "react";
import { X, Eraser, Pen, Sparkles, Check, Loader2, RotateCcw, Undo, PlusCircle, Film, HelpCircle, Info, Upload, Library, Image as ImageIcon, Maximize2 } from "lucide-react";
import { generateImage, generateVideo, pollVideoOperation, extendVideo } from "../services/geminiService";
import ProgressBar from "./ProgressBar";
import { VideoModel, Project } from "../types";
import { v4 as uuidv4 } from "uuid";

type ReferenceCategory = 'cenario' | 'personagem' | 'outro';

interface ReferenceImage {
  url: string;
  category: ReferenceCategory;
}

interface IntelligentEditorProps {
  mediaItem?: {
    id: string;
    url: string;
    type: 'image' | 'video';
    title: string;
    source: string;
    videoObject?: any;
  };
  project?: Project;
  aspectRatio: string;
  initialMode?: 'edit' | 'extend' | 'create';
  defaultVideoModel?: VideoModel;
  nextMediaUrl?: string;
  onSave: (newUrl: string, newVideoObject?: any, title?: string) => void;
  onClose: () => void;
}

export default function IntelligentEditor({ 
  mediaItem, 
  project,
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
  const [baseVideoToExtend, setBaseVideoToExtend] = useState<{ url: string, videoObject: any, title: string } | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [drawMode, setDrawMode] = useState<'brush' | 'eraser'>('brush');
  const [mode, setMode] = useState<'edit' | 'extend' | 'create'>(mediaItem ? initialMode : 'create');
  const [createType, setCreateType] = useState<'image' | 'video'>('image');
  const [videoModel, setVideoModel] = useState<VideoModel>(defaultVideoModel);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [showNextPreview, setShowNextPreview] = useState(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(
    mediaItem?.url ? [{ url: mediaItem.url, category: 'outro' }] : []
  );
  const [showLibrarySelector, setShowLibrarySelector] = useState(false);
  const [previewLibraryItem, setPreviewLibraryItem] = useState<{ url: string, type: 'image' | 'video', videoObject?: any, title?: string } | null>(null);
  const [customTitle, setCustomTitle] = useState(mediaItem?.title || "Nova Imagem Gerada");
  
  useEffect(() => {
    if (mode === 'create') {
      setCustomTitle(createType === 'image' ? "Nova Imagem Gerada" : "Novo Vídeo Gerado");
    }
  }, [createType, mode]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (mediaItem?.type === 'image') {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = mediaItem.url;
      img.onload = () => {
        setupCanvases(img);
      };
    } else if (referenceImages.length > 0) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = referenceImages[0].url;
      img.onload = () => {
        setupCanvases(img);
      };
    }
  }, [mediaItem, referenceImages]);

  const setupCanvases = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

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
    
    // We don't clear the mask here to preserve it if the user is just changing images
    // but we need to make sure it matches the new dimensions
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
    ctx.lineWidth = brushSize;

    if (drawMode === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    }

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
      if (mode === 'create') {
        if (createType === 'image') {
          const refs = referenceImages.map(r => r.url);
          
          // Construct a prompt that includes reference categories
          let enhancedPrompt = prompt;
          const cenarioRefs = referenceImages.filter(r => r.category === 'cenario');
          const personagemRefs = referenceImages.filter(r => r.category === 'personagem');
          
          if (cenarioRefs.length > 0 || personagemRefs.length > 0) {
            enhancedPrompt += "\n\nInstruções de Consistência:";
            if (cenarioRefs.length > 0) {
              enhancedPrompt += `\n- Usa as imagens de cenário fornecidas como referência visual para o ambiente.`;
            }
            if (personagemRefs.length > 0) {
              enhancedPrompt += `\n- Usa as imagens de personagem fornecidas como referência para a aparência e estilo da personagem.`;
            }
          }

          const result = await generateImage(enhancedPrompt, aspectRatio, refs);
          setEditedUrl(result);
        } else {
          if (baseVideoToExtend) {
            setStatus("A extender vídeo...");
            const operation = await extendVideo(prompt, baseVideoToExtend.videoObject, videoModel, aspectRatio);
            const result = await pollVideoOperation(operation);
            setEditedUrl(result.videoUrl);
            setEditedVideoObject(result.videoObject);
          } else {
            setStatus("A gerar vídeo...");
            // Use first reference image as starting frame if available
            const startImage = referenceImages.length > 0 ? referenceImages[0].url : undefined;
            const operation = await generateVideo(prompt, startImage, undefined, videoModel, aspectRatio, referenceImages.map(r => r.url));
            const result = await pollVideoOperation(operation);
            setEditedUrl(result.videoUrl);
            setEditedVideoObject(result.videoObject);
          }
        }
      } else if (mediaItem?.type === 'image') {
        const maskCanvas = maskCanvasRef.current;
        const refs = referenceImages.map(r => r.url);
        
        let enhancedPrompt = prompt;
        const cenarioRefs = referenceImages.filter(r => r.category === 'cenario');
        const personagemRefs = referenceImages.filter(r => r.category === 'personagem');
        
        if (cenarioRefs.length > 0 || personagemRefs.length > 0) {
          enhancedPrompt += "\n\nInstruções de Consistência:";
          if (cenarioRefs.length > 0) {
            enhancedPrompt += `\n- Usa as imagens de cenário fornecidas como referência visual para o ambiente.`;
          }
          if (personagemRefs.length > 0) {
            enhancedPrompt += `\n- Usa as imagens de personagem fornecidas como referência para a aparência e estilo da personagem.`;
          }
        }

        let finalPrompt = `${enhancedPrompt} (baseado nas referências fornecidas)`;
        
        if (hasMask && maskCanvas && refs.length > 0) {
          const maskDataUrl = maskCanvas.toDataURL('image/png');
          refs.push(maskDataUrl);
          finalPrompt = `${enhancedPrompt}. Altera apenas a área marcada a branco na última imagem (máscara). Mantém o resto da imagem de referência inalterado.`;
        }
        
        const result = await generateImage(finalPrompt, aspectRatio, refs);
        setEditedUrl(result);
      } else if (mediaItem) {
        if (mode === 'edit') {
          setStatus("A editar vídeo...");
          const operation = await generateVideo(`${prompt} (baseado no vídeo fornecido)`, mediaItem.url, undefined, videoModel, aspectRatio, referenceImages.map(r => r.url));
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
      onSave(editedUrl, editedVideoObject, customTitle);
      onClose();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setReferenceImages(prev => [{ url: base64, category: 'outro' }, ...prev]);
      };
      reader.readAsDataURL(file);
    }
    
    // Reset input value to allow uploading the same files again if needed
    e.target.value = '';
  };

  const getAllLibraryImages = () => {
    if (!project) return [];
    const images: string[] = [];
    project.characters.forEach(c => {
      if (c.imageUrl) images.push(c.imageUrl);
      if (c.viewsImageUrl) images.push(c.viewsImageUrl);
    });
    project.settings.forEach(s => {
      if (s.imageUrl) images.push(s.imageUrl);
    });
    project.scenes.forEach(s => s.takes.forEach(t => {
      if (t.startFrameUrl) images.push(t.startFrameUrl);
      if (t.endFrameUrl) images.push(t.endFrameUrl);
    }));
    project.customMedia?.forEach(m => {
      if (m.type === 'image') images.push(m.url);
    });
    return Array.from(new Set(images));
  };

  const getAllLibraryVideos = () => {
    if (!project) return [];
    const videos: { url: string, videoObject: any, title: string }[] = [];
    
    project.scenes.forEach(s => s.takes.forEach(t => {
      if (t.videoUrl && t.videoObject) {
        videos.push({ url: t.videoUrl, videoObject: t.videoObject, title: `Cena ${s.title} - Take` });
      }
    }));
    
    if (project.intro?.videoUrl && project.intro?.videoObject) {
      videos.push({ url: project.intro.videoUrl, videoObject: project.intro.videoObject, title: "Intro" });
    }
    
    if (project.outro?.videoUrl && project.outro?.videoObject) {
      videos.push({ url: project.outro.videoUrl, videoObject: project.outro.videoObject, title: "Outro" });
    }

    return videos;
  };

  const [showVideoLibrarySelector, setShowVideoLibrarySelector] = useState(false);

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
                {mode === 'create' 
                  ? (createType === 'image' ? "Descreve a imagem que pretendes gerar." : "Descreve o vídeo que pretendes gerar.")
                  : mediaItem?.type === 'image' 
                    ? "Descreve as alterações pretendidas com base nas referências."
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
            {mode === 'create' ? (
              <div className="flex flex-col items-center gap-6 text-center max-w-2xl w-full">
                {editedUrl ? (
                  <div className="relative w-full aspect-video shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-500 bg-black">
                    {createType === 'image' ? (
                      <img 
                        src={editedUrl} 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <video 
                        src={editedUrl} 
                        controls
                        className="w-full h-full object-contain"
                      />
                    )}
                    <div className="absolute top-6 left-6 px-4 py-1.5 bg-emerald-600/90 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest border border-white/10 shadow-lg">
                      Resultado Gerado
                    </div>
                  </div>
                ) : (
                  <div className="w-full space-y-8">
                    <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                      <Sparkles className="w-12 h-12 text-indigo-600" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-2xl font-black text-zinc-900 tracking-tight">Gerador Inteligente</h4>
                      <p className="text-zinc-500 max-w-md mx-auto">As referências adicionadas servem para manter a consistência visual de cenários e personagens.</p>
                    </div>
                    
                    {referenceImages.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {referenceImages.map((ref, idx) => (
                          <div key={idx} className="group relative w-32 aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-xl rotate-[-2deg] hover:rotate-0 transition-all duration-300">
                            <img src={ref.url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-[8px] font-bold text-white uppercase tracking-widest bg-indigo-600 px-2 py-1 rounded-full">
                                {ref.category === 'cenario' ? 'Cenário' : ref.category === 'personagem' ? 'Personagem' : 'Ref'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-center gap-4">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-700 hover:bg-zinc-50 hover:shadow-md transition-all active:scale-95"
                      >
                        <Upload className="w-4 h-4" />
                        Adicionar Referência
                      </button>
                      <button 
                        onClick={() => setShowLibrarySelector(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-700 hover:bg-zinc-50 hover:shadow-md transition-all active:scale-95"
                      >
                        <Library className="w-4 h-4" />
                        Biblioteca
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : mediaItem?.type === 'image' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                <div className="flex-1 w-full relative flex items-center justify-center min-h-0">
                  {editedUrl ? (
                    <div className="relative h-full shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-500">
                      <img 
                        src={editedUrl} 
                        className="h-full w-auto object-contain" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 left-4 px-3 py-1 bg-emerald-600/80 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                        Resultado Gerado
                      </div>
                    </div>
                  ) : referenceImages.length > 0 ? (
                    <div className="relative h-full shadow-2xl rounded-2xl overflow-hidden cursor-crosshair">
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
                    <div className="text-zinc-400 flex flex-col items-center gap-2">
                      <ImageIcon className="w-12 h-12 opacity-20" />
                      <p className="text-sm font-medium">Sem referências</p>
                    </div>
                  )}
                </div>

                {/* Drawing Controls */}
                {!editedUrl && referenceImages.length > 0 && (
                  <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-zinc-200 flex items-center gap-6">
                    <div className="flex items-center gap-2 p-1 bg-zinc-100 rounded-xl">
                      <button 
                        onClick={() => setDrawMode('brush')}
                        className={`p-2 rounded-lg transition-all ${drawMode === 'brush' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                        title="Pincel"
                      >
                        <Pen className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDrawMode('eraser')}
                        className={`p-2 rounded-lg transition-all ${drawMode === 'eraser' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                        title="Borracha"
                      >
                        <Eraser className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-4 border-l border-zinc-200 pl-6">
                      <div className="flex items-center gap-2">
                        <div className="bg-zinc-400 rounded-full" style={{ width: Math.max(4, brushSize/4), height: Math.max(4, brushSize/4) }} />
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
                    </div>

                    <button 
                      onClick={clearMask}
                      className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-all border-l border-zinc-200 pl-6"
                      title="Limpar Seleção"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {editedUrl && (
                  <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-zinc-200 shadow-sm">
                    <button 
                      onClick={() => setEditedUrl(null)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Tentar Novamente
                    </button>
                    {editedVideoObject && (
                      <button 
                        onClick={() => {
                          setBaseVideoToExtend({ url: editedUrl, videoObject: editedVideoObject, title: customTitle });
                          setEditedUrl(null);
                          setEditedVideoObject(null);
                          setMode('create');
                          setCreateType('video');
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-100"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Extender este Vídeo
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
                  <video 
                    src={mediaItem?.url} 
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
                    
                    {editedVideoObject && (
                      <div className="absolute bottom-4 right-4">
                        <button 
                          onClick={() => {
                            setBaseVideoToExtend({ url: editedUrl, videoObject: editedVideoObject, title: customTitle });
                            setEditedUrl(null);
                            setEditedVideoObject(null);
                            setMode('create');
                            setCreateType('video');
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-md text-indigo-600 rounded-xl text-xs font-bold shadow-xl hover:bg-white transition-all border border-indigo-100"
                        >
                          <PlusCircle className="w-4 h-4" />
                          Extender este Vídeo
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Sidebar Controls */}
          <div className="w-80 border-l border-zinc-100 flex flex-col bg-white">
            <div className="p-6 flex-1 space-y-6 overflow-y-auto custom-scrollbar">
              {/* Type Selector for Create Mode */}
              {mode === 'create' && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Tipo de Geração</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl">
                    <button
                      onClick={() => setCreateType('image')}
                      className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                        createType === 'image' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      <ImageIcon className="w-3 h-3" />
                      Imagem
                    </button>
                    <button
                      onClick={() => setCreateType('video')}
                      className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                        createType === 'video' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      <Film className="w-3 h-3" />
                      Vídeo
                    </button>
                  </div>
                </div>
              )}

              {/* Title input for creation */}
              {mode === 'create' && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Título da Media</label>
                  <input 
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Ex: Minha Nova Imagem"
                  />
                </div>
              )}

              {/* Reference Images Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Referências ({referenceImages.length})</label>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 hover:bg-zinc-100 rounded-lg text-indigo-600 transition-all"
                      title="Upload"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setShowLibrarySelector(true)}
                      className="p-1.5 hover:bg-zinc-100 rounded-lg text-indigo-600 transition-all"
                      title="Biblioteca"
                    >
                      <Library className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {referenceImages.map((ref, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-zinc-50 rounded-2xl border border-zinc-100 group relative">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                        <img src={ref.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Tipo de Referência</label>
                          <button 
                            onClick={() => setReferenceImages(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex gap-1">
                          {(['cenario', 'personagem', 'outro'] as ReferenceCategory[]).map(cat => (
                            <button
                              key={cat}
                              onClick={() => {
                                const newRefs = [...referenceImages];
                                newRefs[idx].category = cat;
                                setReferenceImages(newRefs);
                              }}
                              className={`flex-1 py-1 text-[8px] font-bold rounded-lg uppercase transition-all border ${
                                ref.category === cat 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
                              }`}
                            >
                              {cat === 'cenario' ? 'Cenário' : cat === 'personagem' ? 'Personagem' : 'Outro'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {referenceImages.length === 0 && (
                    <div className="py-8 border-2 border-dashed border-zinc-100 rounded-2xl flex flex-col items-center justify-center text-zinc-300">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Sem referências</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mode Selector for Video */}
              {mediaItem?.type === 'video' && (
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
                  <p className="text-[10px] text-zinc-400 italic px-1">
                    {mode === 'edit' ? "Re-gera o vídeo com base no prompt." : "Continua o vídeo a partir do último frame."}
                  </p>
                </div>
              )}

              {/* Model Selector for Video */}
              {(mediaItem?.type === 'video' || (mode === 'create' && createType === 'video')) && (
                <div className="space-y-3">
                  {mode === 'create' && createType === 'video' && (
                    <div className="space-y-3 pb-3 border-b border-zinc-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Vídeo Base (Opcional)</label>
                        <button 
                          onClick={() => setShowVideoLibrarySelector(true)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                        >
                          Selecionar
                        </button>
                      </div>
                      {baseVideoToExtend ? (
                        <div className="relative aspect-video rounded-xl overflow-hidden border border-indigo-200 bg-black group">
                          <video src={baseVideoToExtend.url} className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              onClick={() => setBaseVideoToExtend(null)}
                              className="p-2 bg-white text-red-600 rounded-full shadow-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-bold rounded uppercase">
                            Base para Extensão
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 border-2 border-dashed border-zinc-100 rounded-xl flex flex-col items-center justify-center text-zinc-300">
                          <Film className="w-6 h-6 mb-1" />
                          <span className="text-[10px] font-bold uppercase">Nenhum vídeo selecionado</span>
                        </div>
                      )}
                    </div>
                  )}
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
                  Instruções de Geração
                </label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={createType === 'image' 
                    ? "Ex: Uma personagem num estilo cyberpunk..." 
                    : "Ex: A personagem caminha pela cidade à noite..."}
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
                    <Sparkles className="w-5 h-5" />
                    Gerar Conteúdo
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

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        multiple
        className="hidden" 
      />

      {showLibrarySelector && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] relative">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Selecionar da Biblioteca</h3>
                <p className="text-xs text-zinc-500">Clica numa imagem para a pré-visualizar e selecionar</p>
              </div>
              <button onClick={() => setShowLibrarySelector(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto grid grid-cols-4 md:grid-cols-5 gap-4 custom-scrollbar bg-zinc-50/50">
              {getAllLibraryImages().map((url, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setPreviewLibraryItem({ url, type: 'image' })}
                  className="aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-sm hover:border-indigo-500 hover:shadow-md transition-all relative group bg-white"
                >
                  <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100" />
                  </div>
                </button>
              ))}
              {getAllLibraryImages().length === 0 && (
                <div className="col-span-full py-20 text-center text-zinc-400">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Nenhuma imagem encontrada na biblioteca.</p>
                </div>
              )}
            </div>

            {/* Selection Preview Pop-up */}
            {previewLibraryItem && previewLibraryItem.type === 'image' && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-zinc-950/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-white p-4 rounded-[32px] shadow-2xl border border-zinc-200 max-w-full max-h-full flex flex-col items-center gap-6 overflow-hidden">
                  <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-zinc-100 rounded-2xl overflow-hidden">
                    <img 
                      src={previewLibraryItem.url} 
                      className="max-w-full max-h-[55vh] object-contain" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => setPreviewLibraryItem(null)}
                      className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-bold transition-all"
                    >
                      Voltar
                    </button>
                    <button 
                      onClick={() => {
                        setReferenceImages(prev => [{ url: previewLibraryItem.url, category: 'outro' }, ...prev]);
                        setPreviewLibraryItem(null);
                        setShowLibrarySelector(false);
                      }}
                      className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Selecionar Imagem
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showVideoLibrarySelector && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] relative">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Selecionar Vídeo para Extender</h3>
                <p className="text-xs text-zinc-500">Clica num vídeo para o pré-visualizar e selecionar</p>
              </div>
              <button onClick={() => setShowVideoLibrarySelector(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4 custom-scrollbar bg-zinc-50/50">
              {getAllLibraryVideos().map((video, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setPreviewLibraryItem({ ...video, type: 'video' })}
                  className="group relative aspect-video rounded-2xl overflow-hidden border-2 border-white shadow-sm hover:border-indigo-500 hover:shadow-md transition-all bg-black"
                >
                  <video src={video.url} className="w-full h-full object-contain pointer-events-none" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center">
                    <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100" />
                    <span className="text-white text-[10px] font-bold uppercase mt-2 opacity-0 group-hover:opacity-100 px-4 text-center truncate w-full">{video.title}</span>
                  </div>
                </button>
              ))}
              {getAllLibraryVideos().length === 0 && (
                <div className="col-span-full py-20 text-center text-zinc-400">
                  <Film className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Nenhum vídeo gerado encontrado na biblioteca.</p>
                </div>
              )}
            </div>

            {/* Selection Preview Pop-up for Video */}
            {previewLibraryItem && previewLibraryItem.type === 'video' && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-zinc-950/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-white p-4 rounded-[32px] shadow-2xl border border-zinc-200 max-w-full max-h-full flex flex-col items-center gap-6 overflow-hidden">
                  <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-black rounded-2xl overflow-hidden">
                    <video 
                      src={previewLibraryItem.url} 
                      autoPlay 
                      loop 
                      controls
                      className="max-w-full max-h-[55vh] object-contain" 
                    />
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-bold text-zinc-900">{previewLibraryItem.title}</h4>
                  </div>
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => setPreviewLibraryItem(null)}
                      className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-bold transition-all"
                    >
                      Voltar
                    </button>
                    <button 
                      onClick={() => {
                        setBaseVideoToExtend({ 
                          url: previewLibraryItem.url, 
                          videoObject: previewLibraryItem.videoObject, 
                          title: previewLibraryItem.title || "Vídeo Selecionado" 
                        });
                        setPreviewLibraryItem(null);
                        setShowVideoLibrarySelector(false);
                      }}
                      className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Selecionar Vídeo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
