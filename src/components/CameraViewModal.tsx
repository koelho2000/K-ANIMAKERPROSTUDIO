import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Download, Save, Image as ImageIcon, Loader2, Sparkles, RotateCcw, Move, RefreshCw, Check } from 'lucide-react';
import { generateImage } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import ProgressBar from './ProgressBar';

interface CameraViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: any;
  project: any;
  onSaveToMedia: (url: string, title: string) => void;
  onReplaceImage: (nodeId: string, url: string, prompt: string) => void;
  onUpdateViews?: (nodeId: string, topUrl: string, sideUrl: string, sourceImageUrl: string) => void;
  isCharacter?: boolean;
}

export default function CameraViewModal({
  isOpen,
  onClose,
  node,
  project,
  onSaveToMedia,
  onReplaceImage,
  onUpdateViews,
  isCharacter = false
}: CameraViewModalProps) {
  const [cameraPos, setCameraPos] = useState({ x: 50, y: 50 }); // percentages
  const [rotation, setRotation] = useState(0); // degrees
  const [tilt, setTilt] = useState(0); // degrees
  const [height, setHeight] = useState(1.7); // meters
  const [cameraType, setCameraType] = useState('Câmara Cinematográfica');
  const [lens, setLens] = useState('35mm Standard');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [task, setTask] = useState('');
  const [tasks, setTasks] = useState<{name: string, status: 'pending'|'active'|'completed'}[]>([]);
  const [time, setTime] = useState(0);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const [isGeneratingViews, setIsGeneratingViews] = useState(false);
  const [viewsProgress, setViewsProgress] = useState(0);
  const [viewsTask, setViewsTask] = useState('');
  const [viewsTasks, setViewsTasks] = useState<{name: string, status: 'pending'|'active'|'completed'}[]>([]);
  const [topViewImage, setTopViewImage] = useState<string | null>(null);
  const [sideViewImage, setSideViewImage] = useState<string | null>(null);
  const [isSavedToMedia, setIsSavedToMedia] = useState(false);

  useEffect(() => {
    if (isOpen && node) {
      setTopViewImage(node.topViewImageUrl || null);
      setSideViewImage(node.sideViewImageUrl || null);
      setIsSavedToMedia(false);
    }
  }, [isOpen, node?.id, node?.topViewImageUrl, node?.sideViewImageUrl]);

  const getBase64FromUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          if (base64String) {
            resolve(base64String); // Return the full data URL
          } else {
            reject(new Error("Failed to extract base64 data"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting image to base64:", error);
      throw error;
    }
  };

  const generateViews = async (viewType: 'all' | 'top' | 'side' = 'all') => {
    if (!node) return;
    setIsGeneratingViews(true);
    setViewsProgress(0);
    setViewsTask('A inicializar vistas técnicas...');
    
    if (viewType === 'all' || viewType === 'top') setTopViewImage(null);
    if (viewType === 'all' || viewType === 'side') setSideViewImage(null);

    const initialTasks: {name: string, status: 'pending'|'active'|'completed'}[] = [
      { name: 'A gerar vista superior (planta)', status: 'pending' },
      { name: 'A gerar vista lateral (corte)', status: 'pending' },
      { name: 'A finalizar', status: 'pending' }
    ];
    setViewsTasks(initialTasks);

    try {
      let topUrl = (viewType === 'all' || viewType === 'top') ? null : node.topViewImageUrl;
      let sideUrl = (viewType === 'all' || viewType === 'side') ? null : node.sideViewImageUrl;
      const sourceImage = node.imageUrl || node.url;
      
      let referenceImages: string[] | undefined;
      if (sourceImage) {
        setViewsTask('A processar imagem de referência...');
        try {
          const base64 = await getBase64FromUrl(sourceImage);
          referenceImages = [base64];
        } catch (e) {
          console.error("Failed to get base64 for reference image", e);
        }
      }

      if (!topUrl && (viewType === 'all' || viewType === 'top')) {
        setViewsTasks(prev => prev.map((t, i) => i === 0 ? { ...t, status: 'active' } : t));
        setViewsTask('A gerar vista superior (planta)...');
        setViewsProgress(20);
        const topPrompt = isCharacter
          ? `Vista de topo (planta) estrita da personagem na imagem de referência. Vista perfeitamente de cima para baixo (top-down). A imagem deve basear-se APENAS na imagem da personagem fornecida como referência, mantendo as mesmas proporções, cores e detalhes. Foco EXCLUSIVO na personagem. Fundo branco puro ou transparente. Sem cenário, sem fundo, sem outros elementos. Apenas a personagem isolada.`
          : `Vista de topo (planta) estrita do sujeito/cenário na imagem de referência: ${node.name || ''}. ${node.description || ''}. Estilo arquitetónico/esquemático, vista perfeitamente de cima para baixo (top-down). A imagem deve focar-se EXCLUSIVAMENTE no sujeito ou cenário da imagem de referência, mantendo as mesmas proporções, cores e detalhes. Fundo neutro. Estilo visual: ${node.artisticStyle || project.filmStyle || 'cinematográfico'}.`;
        
        topUrl = await generateImage(topPrompt, '1:1', referenceImages);
        setTopViewImage(topUrl);
        setViewsProgress(50);
        setViewsTasks(prev => prev.map((t, i) => i === 0 ? { ...t, status: 'completed' } : t));
      } else {
        setViewsTasks(prev => prev.map((t, i) => i === 0 ? { ...t, status: 'completed' } : t));
        if (topUrl) setTopViewImage(topUrl);
      }

      if (!sideUrl && (viewType === 'all' || viewType === 'side')) {
        setViewsTasks(prev => prev.map((t, i) => i === 1 ? { ...t, status: 'active' } : t));
        setViewsTask('A gerar vista lateral (corte)...');
        setViewsProgress(70);
        const sidePrompt = isCharacter
          ? `Vista lateral em perfil estrito da personagem na imagem de referência. Vista perfeitamente de lado. A imagem deve basear-se APENAS na imagem da personagem fornecida como referência, mantendo as mesmas proporções, cores e detalhes. Foco EXCLUSIVO na personagem. Fundo branco puro ou transparente. Sem cenário, sem fundo, sem outros elementos. Apenas a personagem isolada.`
          : `Vista lateral em corte (cross-section) ou perfil estrito do sujeito/cenário na imagem de referência: ${node.name || ''}. ${node.description || ''}. Estilo arquitetónico/esquemático, vista perfeitamente de lado. A imagem deve focar-se EXCLUSIVAMENTE no sujeito ou cenário da imagem de referência, mantendo as mesmas proporções, cores e detalhes. Fundo neutro. Estilo visual: ${node.artisticStyle || project.filmStyle || 'cinematográfico'}.`;
        
        sideUrl = await generateImage(sidePrompt, '16:9', referenceImages);
        setSideViewImage(sideUrl);
        setViewsProgress(90);
        setViewsTasks(prev => prev.map((t, i) => i === 1 ? { ...t, status: 'completed' } : t));
      } else {
        setViewsTasks(prev => prev.map((t, i) => i === 1 ? { ...t, status: 'completed' } : t));
        if (sideUrl) setSideViewImage(sideUrl);
      }

      setViewsTasks(prev => prev.map((t, i) => i === 2 ? { ...t, status: 'active' } : t));
      if (onUpdateViews && topUrl && sideUrl) {
        onUpdateViews(node.id, topUrl, sideUrl, sourceImage || '');
      }
      
      setViewsTask('Vistas técnicas geradas com sucesso!');
      setViewsProgress(100);
      setViewsTasks(prev => prev.map((t, i) => i === 2 ? { ...t, status: 'completed' } : t));
      setTimeout(() => setIsGeneratingViews(false), 1000);

    } catch (error) {
      console.error('Error generating views:', error);
      setViewsTask('Erro ao gerar vistas técnicas.');
      setViewsTasks(prev => prev.map(t => t.status === 'active' ? { ...t, status: 'pending' } : t));
      setTimeout(() => setIsGeneratingViews(false), 2000);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenerating) {
      timer = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isGenerating]);

  if (!isOpen || !node) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateCameraPos(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      updateCameraPos(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateCameraPos = (e: React.MouseEvent) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCameraPos({ x, y });

    const dx = x - 50;
    const dy = y - 50;
    let newRotation = Math.atan2(dx, dy) * (180 / Math.PI);
    if (newRotation < 0) newRotation += 360;
    setRotation(Math.round(newRotation));
  };

  const handleRotationChange = (newRotation: number) => {
    setRotation(newRotation);
    const radius = 40;
    const rad = newRotation * (Math.PI / 180);
    const x = 50 + Math.sin(rad) * radius;
    const y = 50 + Math.cos(rad) * radius;
    setCameraPos({ x, y });
  };

  const getCameraDescription = (rot: number, t: number, h: number) => {
    let r = rot % 360;
    if (r < 0) r += 360;
    
    let angleDesc = "de frente (vista frontal)";
    if (r >= 22.5 && r < 67.5) angleDesc = "em três quartos de frente (lado direito)";
    else if (r >= 67.5 && r < 112.5) angleDesc = "de perfil (lado direito)";
    else if (r >= 112.5 && r < 157.5) angleDesc = "em três quartos de costas (lado direito)";
    else if (r >= 157.5 && r < 202.5) angleDesc = "de costas (vista traseira)";
    else if (r >= 202.5 && r < 247.5) angleDesc = "em três quartos de costas (lado esquerdo)";
    else if (r >= 247.5 && r < 292.5) angleDesc = "de perfil (lado esquerdo)";
    else if (r >= 292.5 && r < 337.5) angleDesc = "em três quartos de frente (lado esquerdo)";

    let tiltDesc = "ao nível dos olhos";
    if (t > 60) tiltDesc = "em vista de pássaro (top-down, olhando diretamente para baixo)";
    else if (t > 15) tiltDesc = "em picado (ângulo alto, olhando para baixo)";
    else if (t < -60) tiltDesc = "em vista de verme (bottom-up, olhando diretamente para cima)";
    else if (t < -15) tiltDesc = "em contrapicado (ângulo baixo, olhando para cima)";

    return `A câmara está posicionada a ${h} metros de altura, ${tiltDesc} (inclinação de ${t} graus), captando o sujeito ${angleDesc} (rotação de ${r} graus).`;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    setTime(0);
    setTask('A preparar a cena...');
    setTasks([
      { name: "Preparar a cena e calcular perspetiva", status: "active" },
      { name: "Renderizar a imagem da câmara", status: "pending" },
      { name: "Finalizar renderização", status: "pending" }
    ]);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
        setTask('A renderizar a perspetiva da câmara...');
        setTasks(prev => [
          { ...prev[0], status: "completed" },
          { ...prev[1], status: "active" },
          prev[2]
        ]);
      }, 500);

      const cameraDesc = getCameraDescription(rotation, tilt, height);

      const prompt = isCharacter
        ? `Personagem: ${node.name}. ${node.description}. 
Vista a partir de uma ${cameraType} com lente ${lens}.
${cameraDesc}
A imagem deve focar-se EXCLUSIVAMENTE na personagem da imagem de referência, mantendo as mesmas proporções, cores e detalhes.
Fundo branco puro ou transparente. Sem cenário, sem fundo. Apenas a personagem.
Estilo visual: ${node.artisticStyle || project.filmStyle || 'cinematográfico'}. 
Altamente detalhado, iluminação dramática, composição profissional.`
        : `Sujeito/Cenário: ${node.name}. ${node.description}. 
Vista a partir de uma ${cameraType} com lente ${lens}.
${cameraDesc}
A imagem deve focar-se EXCLUSIVAMENTE no sujeito ou cenário da imagem de referência, mantendo as mesmas proporções, cores e detalhes.
Estilo visual: ${node.artisticStyle || project.filmStyle || 'cinematográfico'}. 
Altamente detalhado, iluminação dramática, composição profissional.`;

      const sourceImage = node.imageUrl || node.url;
      let referenceImages: string[] | undefined;
      if (sourceImage) {
        try {
          const base64 = await getBase64FromUrl(sourceImage);
          referenceImages = [base64];
        } catch (e) {
          console.error("Failed to get base64 for reference image", e);
        }
      }

      const imageUrl = await generateImage(prompt, project.aspectRatio, referenceImages);
      
      clearInterval(progressInterval);
      setProgress(95);
      setTask('A finalizar renderização...');
      setTasks(prev => [
        prev[0],
        { ...prev[1], status: "completed" },
        { ...prev[2], status: "active" }
      ]);
      
      setGeneratedImage(imageUrl);
      setGeneratedPrompt(prompt);
      
      setTimeout(() => {
        setProgress(100);
        setTask('Imagem gerada com sucesso!');
        setTasks(prev => [
          prev[0],
          prev[1],
          { ...prev[2], status: "completed" }
        ]);
      }, 500);

      setTimeout(() => {
        setIsGenerating(false);
      }, 1500);
      
    } catch (error) {
      console.error(error);
      setTask('Erro ao gerar imagem.');
      setTasks(prev => prev.map(t => t.status === 'active' ? { ...t, status: 'pending' } : t));
      alert('Erro ao gerar imagem da câmara.');
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;
    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `camera-${node.name}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-zinc-900">Câmara: {node.name}</h2>
              <p className="text-sm text-zinc-500">Posicione a câmara e ajuste as definições</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Controls */}
          <div className="w-80 border-r border-zinc-100 bg-white flex flex-col overflow-y-auto">
            <div className="p-6 space-y-6">
              
              {(!topViewImage || !sideViewImage) && !isGeneratingViews && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center">
                  <p className="text-sm text-indigo-800 mb-3">
                    As vistas técnicas (planta e corte) ajudam a posicionar a câmara com precisão no espaço 3D.
                  </p>
                  <button
                    onClick={() => generateViews('all')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors w-full flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Gerar Vistas Técnicas
                  </button>
                </div>
              )}

              {topViewImage && sideViewImage && node.imageUrl && node.viewsGeneratedFromImageUrl && node.imageUrl !== node.viewsGeneratedFromImageUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs text-amber-800 mb-2 font-medium">
                    Aviso: A imagem do cenário foi alterada desde que estas vistas foram geradas.
                  </p>
                  <button
                    onClick={() => generateViews('all')}
                    disabled={isGeneratingViews}
                    className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors w-full flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingViews ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Atualizar Vistas Técnicas
                  </button>
                </div>
              )}

              {/* Camera Position Map */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-zinc-700">Vista Superior (Planta)</label>
                  {topViewImage && !isGeneratingViews && (
                    <button 
                      onClick={() => generateViews('top')}
                      className="text-xs text-zinc-500 hover:text-indigo-600 flex items-center gap-1"
                      title="Regenerar vista superior"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div 
                  ref={mapRef}
                  className="relative w-full aspect-square bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 cursor-crosshair"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {isGeneratingViews && !topViewImage ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 p-4">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                      <p className="text-xs text-zinc-600 text-center">{viewsTask}</p>
                      <div className="w-full max-w-[150px] mt-2">
                        <ProgressBar progress={viewsProgress} label="" modelName="Nanobana" tasks={viewsTasks} />
                      </div>
                    </div>
                  ) : null}

                  {topViewImage ? (
                    <img src={topViewImage} alt="Top view" className="w-full h-full object-cover opacity-80" />
                  ) : node.imageUrl ? (
                    <img src={node.imageUrl} alt="Top view" className="w-full h-full object-cover opacity-50 grayscale" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  
                  {/* Grid overlay */}
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
                    backgroundSize: '10% 10%'
                  }} />

                  {/* Camera Icon */}
                  <div 
                    className="absolute w-8 h-8 -ml-4 -mt-4 text-indigo-600 drop-shadow-md pointer-events-none transition-transform"
                    style={{ 
                      left: `${cameraPos.x}%`, 
                      top: `${cameraPos.y}%`,
                      transform: `rotate(${rotation}deg)`
                    }}
                  >
                    <div className="relative w-full h-full flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                      {/* View cone indicator */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-0 h-0 border-l-[10px] border-r-[10px] border-b-[15px] border-l-transparent border-r-transparent border-b-indigo-400/50" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 text-center">Arraste para posicionar a câmara</p>
              </div>

              {/* Side View Map */}
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-zinc-700">Vista Lateral (Corte)</label>
                  {sideViewImage && !isGeneratingViews && (
                    <button 
                      onClick={() => generateViews('side')}
                      className="text-xs text-zinc-500 hover:text-indigo-600 flex items-center gap-1"
                      title="Regenerar vista lateral"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="relative w-full aspect-video bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200">
                  {isGeneratingViews && !sideViewImage ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 p-4">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                      <p className="text-xs text-zinc-600 text-center">{viewsTask}</p>
                      <div className="w-full max-w-[150px] mt-2">
                        <ProgressBar progress={viewsProgress} label="" modelName="Nanobana" tasks={viewsTasks} />
                      </div>
                    </div>
                  ) : null}

                  {sideViewImage ? (
                    <img src={sideViewImage} alt="Side view" className="w-full h-full object-cover opacity-80" />
                  ) : node.imageUrl ? (
                    <img src={node.imageUrl} alt="Side view" className="w-full h-full object-cover opacity-50 grayscale" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}

                  {/* Height and Tilt Indicator */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Ground line */}
                    <div className="absolute bottom-4 left-0 right-0 h-0.5 bg-zinc-400/50" />
                    
                    {/* Character/Setting Height Reference */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 border-l-2 border-r-2 border-t-2 border-indigo-200/50 flex items-center justify-center"
                         style={{ height: isCharacter ? '60%' : '80%' }}>
                      <span className="text-[10px] text-indigo-400/70 font-mono">
                        {isCharacter ? (node.physical?.height || '1.7m') : 'Cenário'}
                      </span>
                    </div>

                    {/* Camera indicator */}
                    <div 
                      className="absolute left-1/2 w-6 h-6 -ml-3 text-indigo-600 drop-shadow-md transition-all duration-300"
                      style={{ 
                        bottom: `calc(1rem + ${Math.min(90, (height / (isCharacter ? parseFloat(node.physical?.height || '1.7') : 5)) * (isCharacter ? 60 : 80))}%)`,
                        transform: `rotate(${tilt}deg)`
                      }}
                    >
                      <Camera className="w-full h-full" />
                      {/* View cone indicator */}
                      <div className="absolute top-1/2 left-full -translate-y-1/2 w-0 h-0 border-t-[10px] border-b-[10px] border-l-[15px] border-t-transparent border-b-transparent border-l-indigo-400/50" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium text-zinc-700">Rotação (Pan)</label>
                    <span className="text-xs text-zinc-500">{rotation}°</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    value={rotation}
                    onChange={(e) => handleRotationChange(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium text-zinc-700">Inclinação (Tilt)</label>
                    <span className="text-xs text-zinc-500">{tilt}°</span>
                  </div>
                  <input 
                    type="range" 
                    min="-90" 
                    max="90" 
                    value={tilt}
                    onChange={(e) => setTilt(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                    <span>Abaixo (-90°)</span>
                    <span>Frente (0°)</span>
                    <span>Acima (90°)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium text-zinc-700">Altura</label>
                    <span className="text-xs text-zinc-500">{height}m</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="50" 
                    step="0.1"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Tipo de Câmara</label>
                  <select 
                    value={cameraType}
                    onChange={(e) => setCameraType(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option>Câmara Cinematográfica</option>
                    <option>DSLR</option>
                    <option>Mirrorless</option>
                    <option>Drone</option>
                    <option>CCTV / Segurança</option>
                    <option>GoPro / Ação</option>
                    <option>Smartphone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Lente</label>
                  <select 
                    value={lens}
                    onChange={(e) => setLens(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option>14mm Ultra-Wide</option>
                    <option>24mm Wide</option>
                    <option>35mm Standard</option>
                    <option>50mm Portrait</option>
                    <option>85mm Telephoto</option>
                    <option>200mm Zoom</option>
                    <option>Olho de Peixe (Fisheye)</option>
                    <option>Macro</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-100 bg-zinc-50 mt-auto">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                Gerar Vista da Câmara
              </button>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 bg-zinc-100 p-8 flex flex-col relative">
            {isGenerating && (
              <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-8">
                <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl border border-zinc-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-zinc-900">A Gerar Vista da Câmara</h3>
                    <div className="text-sm font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
                      {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                  <ProgressBar 
                    progress={progress} 
                    label={task} 
                    modelName="Nanobana" 
                    tasks={tasks}
                  />
                  <p className="text-xs text-zinc-500 mt-4 text-center">
                    A renderizar a perspetiva exata da câmara selecionada.
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex items-center justify-center relative">
              {generatedImage ? (
                <img src={generatedImage} alt="Vista da Câmara" className="w-full h-full object-contain" />
              ) : node.imageUrl ? (
                <div className="relative w-full h-full">
                  <img src={node.imageUrl} alt="Imagem de Referência" className="w-full h-full object-contain opacity-50" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 bg-white/20 backdrop-blur-[2px]">
                    <Camera className="w-16 h-16 mb-4 opacity-50 drop-shadow-md" />
                    <p className="font-medium bg-white/80 px-4 py-2 rounded-lg shadow-sm">Ajuste as definições e clique em "Gerar Vista da Câmara"</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-zinc-400">
                  <Camera className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>Ajuste as definições e clique em "Gerar Vista da Câmara"</p>
                </div>
              )}
            </div>

            {generatedImage && (
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-4 py-2 rounded-xl font-medium hover:bg-zinc-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => {
                    onSaveToMedia(generatedImage, `Vista da Câmara: ${node.name}`);
                    setIsSavedToMedia(true);
                    setTimeout(() => setIsSavedToMedia(false), 3000);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                    isSavedToMedia 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {isSavedToMedia ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {isSavedToMedia ? 'Gravado no Media!' : 'Gravar no Media'}
                </button>
                <button
                  onClick={() => {
                    if (generatedPrompt) {
                      onReplaceImage(node.id, generatedImage, generatedPrompt);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Substituir Imagem do Cenário
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
