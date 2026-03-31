import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Map, Plus, Image as ImageIcon, Download, Save, Sparkles, Loader2, Maximize2, ZoomIn, ZoomOut, Move, Camera } from 'lucide-react';
import { Project, Setting } from '../types';
import { generateImage } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { ImageModal } from './ImageModal';
import ProgressBar from './ProgressBar';
import CameraViewModal from './CameraViewModal';

interface WorldMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({ isOpen, onClose, project, setProject }) => {
  const [nodes, setNodes] = useState<Setting[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);
  const [worldMapProgress, setWorldMapProgress] = useState(0);
  const [worldMapTask, setWorldMapTask] = useState("");
  const [worldMapTasks, setWorldMapTasks] = useState<{name: string, status: 'pending'|'active'|'completed'}[]>([]);
  const [worldMapTime, setWorldMapTime] = useState(0);
  const [isGeneratingPerspectives, setIsGeneratingPerspectives] = useState(false);
  const [perspectivesProgress, setPerspectivesProgress] = useState(0);
  const [perspectivesTask, setPerspectivesTask] = useState("");
  const [perspectivesTasks, setPerspectivesTasks] = useState<{name: string, status: 'pending'|'active'|'completed'}[]>([]);
  const [perspectivesTime, setPerspectivesTime] = useState(0);
  const [isGeneratingNode, setIsGeneratingNode] = useState<string | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraNode, setCameraNode] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize nodes
  useEffect(() => {
    if (isOpen) {
      // Assign random positions to nodes without position
      const updatedSettings = project.settings.map((s, index) => {
        if (!s.position) {
          // Simple grid layout for initial positions
          const cols = Math.ceil(Math.sqrt(project.settings.length));
          const row = Math.floor(index / cols);
          const col = index % cols;
          return {
            ...s,
            position: { x: col * 300 + 100, y: row * 300 + 100 },
            connections: s.connections || []
          };
        }
        return { ...s, connections: s.connections || [] };
      });
      
      setNodes(updatedSettings);
      
      // Update project if positions were added
      if (updatedSettings.some(s => !project.settings.find(ps => ps.id === s.id)?.position)) {
        setProject(prev => ({ ...prev, settings: updatedSettings }));
      }
    }
  }, [isOpen, project.settings]);

  const handleMouseDownNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();

    if (connectingFromNodeId) {
      if (connectingFromNodeId !== nodeId) {
        handleConnectNodes(connectingFromNodeId, nodeId);
      }
      setConnectingFromNodeId(null);
      return;
    }

    const node = nodes.find(n => n.id === nodeId);
    if (node && node.position) {
      setIsDragging(nodeId);
      setSelectedNodeId(nodeId);
      // Calculate offset from mouse to node top-left
      // We need to account for pan and zoom
      const rect = (e.target as HTMLElement).closest('.node-element')?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: (e.clientX - rect.left) / zoom,
          y: (e.clientY - rect.top) / zoom
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      
      setNodes(prev => prev.map(n => 
        n.id === isDragging ? { ...n, position: { x, y } } : n
      ));
    } else if (isPanning) {
      setPan(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Save new positions to project
      setProject(prev => ({
        ...prev,
        settings: prev.settings.map(s => {
          const node = nodes.find(n => n.id === s.id);
          return node ? { ...s, position: node.position } : s;
        })
      }));
      setIsDragging(null);
    }
    setIsPanning(false);
  };

  const handleAddBranch = (sourceId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode || !sourceNode.position) return;

    const newSetting: Setting = {
      id: uuidv4(),
      name: `Caminho de ${sourceNode.name}`,
      description: `Uma área de transição ou caminho que liga a partir de ${sourceNode.name}.`,
      position: { x: sourceNode.position.x + 300, y: sourceNode.position.y + (Math.random() * 100 - 50) },
      connections: [sourceId]
    };

    // Also add connection to source node
    const updatedNodes = nodes.map(n => 
      n.id === sourceId 
        ? { ...n, connections: [...(n.connections || []), newSetting.id] }
        : n
    );

    setNodes([...updatedNodes, newSetting]);
    
    setProject(prev => ({
      ...prev,
      settings: [
        ...prev.settings.map(s => s.id === sourceId ? { ...s, connections: [...(s.connections || []), newSetting.id] } : s),
        newSetting
      ]
    }));
    
    setSelectedNodeId(newSetting.id);
  };

  const handleGeneratePerspectives = async (sourceId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode || !sourceNode.position) return;

    setIsGeneratingPerspectives(true);
    setPerspectivesProgress(0);
    setPerspectivesTask("A preparar as 5 perspetivas...");
    setPerspectivesTime(0);

    const timer = setInterval(() => {
      setPerspectivesTime(prev => prev + 1);
    }, 1000);

    try {
      const basePrompt = sourceNode.lastImagePrompt || `Cenário: ${sourceNode.name}. ${sourceNode.description}. Estilo visual: ${sourceNode.artisticStyle || project.filmStyle || 'cinematográfico'}. Altamente detalhado, iluminação dramática, composição profissional.`;
      
      let referenceBase64: string | undefined;
      if (sourceNode.imageUrl) {
        try {
          const response = await fetch(sourceNode.imageUrl);
          const blob = await response.blob();
          referenceBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error("Failed to load reference image", e);
        }
      }

      const viewsToGenerate = [
        { key: 'frontViewImageUrl', prompt: `${basePrompt} Front view of the environment.`, label: 'Frente' },
        { key: 'backViewImageUrl', prompt: `${basePrompt} Back view of the environment.`, label: 'Traseira' },
        { key: 'leftViewImageUrl', prompt: `${basePrompt} Left side view of the environment.`, label: 'Esquerda' },
        { key: 'rightViewImageUrl', prompt: `${basePrompt} Right side view of the environment.`, label: 'Direita' },
        { key: 'topViewImageUrl', prompt: `${basePrompt} Top down view (floor plan) of the environment.`, label: 'Topo' }
      ];

      const generatedViews: Record<string, string> = {};
      
      let completed = 0;
      for (const view of viewsToGenerate) {
        setPerspectivesTask(`A gerar perspetiva: ${view.label}...`);
        generatedViews[view.key] = await generateImage(view.prompt, "16:9", referenceBase64 ? [referenceBase64] : undefined);
        completed++;
        setPerspectivesProgress((completed / viewsToGenerate.length) * 100);
      }

      setPerspectivesTask("A compor imagem final...");
      
      // Create composite image
      const canvas = document.createElement('canvas');
      canvas.width = 1920 * 3;
      canvas.height = 1080 * 2;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const loadImg = (src: string): Promise<HTMLImageElement> => {
          return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.src = src;
          });
        };

        const [frontImg, backImg, leftImg, rightImg, topImg] = await Promise.all([
          loadImg(generatedViews.frontViewImageUrl),
          loadImg(generatedViews.backViewImageUrl),
          loadImg(generatedViews.leftViewImageUrl),
          loadImg(generatedViews.rightViewImageUrl),
          loadImg(generatedViews.topViewImageUrl)
        ]);

        ctx.drawImage(frontImg, 0, 0, 1920, 1080);
        ctx.drawImage(backImg, 1920, 0, 1920, 1080);
        ctx.drawImage(topImg, 3840, 0, 1920, 1080);
        ctx.drawImage(leftImg, 0, 1080, 1920, 1080);
        ctx.drawImage(rightImg, 1920, 1080, 1920, 1080);
      }
      
      const compositeImageUrl = canvas.toDataURL('image/jpeg', 0.9);

      const updateData = {
        viewsImageUrl: compositeImageUrl,
        frontViewImageUrl: generatedViews.frontViewImageUrl,
        backViewImageUrl: generatedViews.backViewImageUrl,
        leftViewImageUrl: generatedViews.leftViewImageUrl,
        rightViewImageUrl: generatedViews.rightViewImageUrl,
        topViewImageUrl: generatedViews.topViewImageUrl,
        lastViewsPrompt: basePrompt
      };

      setNodes(prev => prev.map(n => n.id === sourceId ? { ...n, ...updateData } : n));
      setProject(prev => ({
        ...prev,
        settings: prev.settings.map(s => s.id === sourceId ? { ...s, ...updateData } : s)
      }));

      setPerspectivesProgress(100);
      setPerspectivesTask("Perspetivas geradas com sucesso!");
      
      setTimeout(() => {
        setIsGeneratingPerspectives(false);
      }, 1500);

    } catch (error) {
      console.error(error);
      alert("Erro ao gerar perspetivas.");
      setIsGeneratingPerspectives(false);
    } finally {
      clearInterval(timer);
    }
  };

  const handleConnectNodes = (sourceId: string, targetId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode || !sourceNode.position || !targetNode.position) return;

    const newSetting: Setting = {
      id: uuidv4(),
      name: `Caminho: ${sourceNode.name} ↔ ${targetNode.name}`,
      description: `Uma área de transição ou caminho que liga ${sourceNode.name} a ${targetNode.name}.`,
      position: { 
        x: (sourceNode.position.x + targetNode.position.x) / 2, 
        y: (sourceNode.position.y + targetNode.position.y) / 2 
      },
      connections: [sourceId, targetId]
    };

    const updatedNodes = nodes.map(n => {
      if (n.id === sourceId || n.id === targetId) {
        return { ...n, connections: [...(n.connections || []), newSetting.id] };
      }
      return n;
    });

    setNodes([...updatedNodes, newSetting]);
    
    setProject(prev => ({
      ...prev,
      settings: [
        ...prev.settings.map(s => {
          if (s.id === sourceId || s.id === targetId) {
            return { ...s, connections: [...(s.connections || []), newSetting.id] };
          }
          return s;
        }),
        newSetting
      ]
    }));
    
    setSelectedNodeId(newSetting.id);
  };

  const handleGenerateWorldMap = async () => {
    setIsGeneratingWorld(true);
    setWorldMapProgress(0);
    setWorldMapTime(0);
    setWorldMapTask("A preparar prompt...");
    setWorldMapTasks([
      { name: "Preparar prompt", status: "active" },
      { name: "Comunicar com o modelo de imagem", status: "pending" },
      { name: "Processar imagem gerada", status: "pending" }
    ]);

    const startTime = Date.now();
    const timer = setInterval(() => {
      setWorldMapTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    let progressInterval: NodeJS.Timeout;

    try {
      const prompt = `Um mapa do mundo épico e detalhado para um projeto chamado "${project.title}". 
      Conceito: ${project.concept}. 
      O mapa deve mostrar as seguintes localizações interligadas: ${project.settings.map(s => s.name).join(', ')}.
      Estilo: Mapa de fantasia, cartografia artística, vista de cima, altamente detalhado, estilo ${project.filmStyle || 'cinematográfico'}.`;
      
      setWorldMapProgress(15);
      setWorldMapTask("A comunicar com o modelo de imagem...");
      setWorldMapTasks(prev => [
        { ...prev[0], status: "completed" },
        { ...prev[1], status: "active" },
        prev[2]
      ]);
      
      progressInterval = setInterval(() => {
        setWorldMapProgress(prev => {
          if (prev < 90) return prev + (90 - prev) * 0.1;
          return prev;
        });
      }, 500);

      const imageUrl = await generateImage(prompt, "16:9");
      
      clearInterval(progressInterval);
      setWorldMapProgress(95);
      setWorldMapTask("A processar imagem gerada...");
      setWorldMapTasks(prev => [
        prev[0],
        { ...prev[1], status: "completed" },
        { ...prev[2], status: "active" }
      ]);
      
      setProject(prev => ({
        ...prev,
        worldMapImageUrl: imageUrl,
        worldMapPrompt: prompt
      }));
      
      setWorldMapProgress(100);
      setWorldMapTask("Mapa gerado com sucesso!");
      setWorldMapTasks(prev => [
        prev[0],
        prev[1],
        { ...prev[2], status: "completed" }
      ]);
    } catch (error) {
      console.error(error);
      setWorldMapTask("Erro ao gerar mapa.");
      setWorldMapTasks(prev => prev.map(t => t.status === 'active' ? { ...t, status: 'pending' } : t));
      alert("Erro ao gerar o mapa do mundo.");
    } finally {
      clearInterval(timer);
      if (progressInterval!) clearInterval(progressInterval);
      setTimeout(() => {
        setIsGeneratingWorld(false);
      }, 1500);
    }
  };

  const handleGenerateNodeImage = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setIsGeneratingNode(nodeId);
    try {
      const prompt = `Cenário: ${node.name}. ${node.description}. Estilo visual: ${node.artisticStyle || project.filmStyle || 'cinematográfico'}. Altamente detalhado, iluminação dramática, composição profissional.`;
      const imageUrl = await generateImage(prompt, project.aspectRatio);
      
      setProject(prev => ({
        ...prev,
        settings: prev.settings.map(s => s.id === nodeId ? { ...s, imageUrl, lastImagePrompt: prompt } : s)
      }));
      
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, imageUrl, lastImagePrompt: prompt } : n));
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar imagem para o cenário.");
    } finally {
      setIsGeneratingNode(null);
    }
  };

  const handleSaveToMedia = (imageUrl: string, title: string) => {
    const newMedia = {
      id: uuidv4(),
      url: imageUrl,
      type: 'image' as const,
      title: title,
      source: 'Mapa do Mundo',
      createdAt: Date.now()
    };
    
    setProject(prev => ({
      ...prev,
      customMedia: [newMedia, ...(prev.customMedia || [])]
    }));
    
    showToast("Imagem guardada na Biblioteca de Media!");
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-white z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Map className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Mapa do Mundo</h2>
                <p className="text-sm text-zinc-500">Visualiza e interliga os cenários do teu projeto</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateWorldMap}
                disabled={isGeneratingWorld || isGeneratingPerspectives || nodes.length === 0}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isGeneratingWorld ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar Mapa Global
              </button>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden relative bg-zinc-50">
            
            {/* Progress Overlay */}
            {(isGeneratingWorld || isGeneratingPerspectives) && (
              <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-8">
                <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl border border-zinc-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-zinc-900">
                      {isGeneratingWorld ? "A Gerar Mapa Global" : "A Gerar Perspetivas"}
                    </h3>
                    <div className="text-sm font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
                      {isGeneratingWorld 
                        ? `${Math.floor(worldMapTime / 60)}:${(worldMapTime % 60).toString().padStart(2, '0')}`
                        : `${Math.floor(perspectivesTime / 60)}:${(perspectivesTime % 60).toString().padStart(2, '0')}`
                      }
                    </div>
                  </div>
                  <ProgressBar 
                    progress={isGeneratingWorld ? worldMapProgress : perspectivesProgress} 
                    label={isGeneratingWorld ? worldMapTask : perspectivesTask} 
                    modelName="Nanobana" 
                    tasks={isGeneratingWorld ? worldMapTasks : perspectivesTasks}
                  />
                  <p className="text-xs text-zinc-500 mt-4 text-center">
                    Este processo pode demorar alguns segundos. Por favor, aguarde.
                  </p>
                </div>
              </div>
            )}

            {/* Canvas Area */}
            <div 
              ref={containerRef}
              className={`flex-1 relative overflow-hidden ${connectingFromNodeId ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest('.node-element')) return;
                if (connectingFromNodeId) {
                  setConnectingFromNodeId(null);
                  return;
                }
                setIsPanning(true);
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
                  setZoom(prev => Math.max(0.2, Math.min(3, prev * zoomDelta)));
                }
              }}
            >
              {/* Controls */}
              <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2 bg-white p-2 rounded-xl shadow-lg border border-zinc-100">
                <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600"><ZoomIn className="w-5 h-5" /></button>
                <button onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600"><ZoomOut className="w-5 h-5" /></button>
                <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-600"><Maximize2 className="w-5 h-5" /></button>
              </div>

              {/* World Map Background Image (if generated) */}
              {project.worldMapImageUrl && (
                <div className="absolute top-6 left-6 z-20 w-64 bg-white rounded-xl shadow-lg border border-zinc-100 overflow-hidden">
                  <div className="p-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                    <h3 className="font-medium text-sm text-zinc-900">Mapa Global</h3>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          setCameraNode({
                            id: 'world-map',
                            name: 'Mapa do Mundo',
                            description: project.concept || 'O mundo do projeto',
                            topViewImageUrl: project.worldMapImageUrl,
                            sideViewImageUrl: project.worldMapImageUrl,
                            imageUrl: project.worldMapImageUrl,
                            artisticStyle: project.filmStyle
                          });
                          setIsCameraModalOpen(true);
                        }} 
                        className="p-1.5 hover:bg-zinc-200 rounded-md text-zinc-500" 
                        title="Vista de Câmara"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleSaveToMedia(project.worldMapImageUrl!, "Mapa do Mundo")} className="p-1.5 hover:bg-zinc-200 rounded-md text-zinc-500" title="Gravar na Biblioteca">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDownload(project.worldMapImageUrl!, "mapa-do-mundo")} className="p-1.5 hover:bg-zinc-200 rounded-md text-zinc-500" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative aspect-video group cursor-pointer" onClick={() => setSelectedImage({ url: project.worldMapImageUrl!, title: "Mapa do Mundo" })}>
                    <img src={project.worldMapImageUrl} alt="World Map" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={(e) => { e.stopPropagation(); setShowPromptPreview(project.worldMapPrompt || null); }} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md transition-colors">
                        Ver Prompt
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Graph Layer */}
              <div 
                className="absolute inset-0 origin-top-left"
                style={{ 
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transition: isPanning || isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
              >
                {/* Edges */}
                <svg className="absolute inset-0 overflow-visible pointer-events-none">
                  {nodes.map(node => 
                    node.connections?.map(targetId => {
                      const target = nodes.find(n => n.id === targetId);
                      if (!target || !node.position || !target.position) return null;
                      
                      // Draw line from center to center
                      const x1 = node.position.x + 120; // half width
                      const y1 = node.position.y + 80;  // half height
                      const x2 = target.position.x + 120;
                      const y2 = target.position.y + 80;
                      
                      return (
                        <g key={`${node.id}-${targetId}`}>
                          <line 
                            x1={x1} y1={y1} x2={x2} y2={y2} 
                            stroke="#cbd5e1" strokeWidth="3" strokeDasharray="6 6"
                          />
                          <circle cx={(x1+x2)/2} cy={(y1+y2)/2} r="4" fill="#94a3b8" />
                        </g>
                      );
                    })
                  )}
                  
                  {/* Connecting Line Preview */}
                  {connectingFromNodeId && (() => {
                    const sourceNode = nodes.find(n => n.id === connectingFromNodeId);
                    if (!sourceNode || !sourceNode.position) return null;
                    
                    const x1 = sourceNode.position.x + 120;
                    const y1 = sourceNode.position.y + 80;
                    
                    return (
                      <g>
                        <circle cx={x1} cy={y1} r="8" fill="#10b981" className="animate-pulse" />
                      </g>
                    );
                  })()}
                </svg>

                {/* Nodes */}
                {nodes.map(node => (
                  <div
                    key={node.id}
                    className={`node-element absolute w-[240px] bg-white rounded-xl shadow-md border-2 transition-colors cursor-pointer ${
                      connectingFromNodeId === node.id 
                        ? 'border-emerald-500 shadow-emerald-100 shadow-lg z-10 ring-4 ring-emerald-500/20' 
                        : connectingFromNodeId 
                          ? 'border-zinc-200 hover:border-emerald-400 z-0'
                          : selectedNodeId === node.id 
                            ? 'border-indigo-500 shadow-indigo-100 shadow-lg z-10' 
                            : 'border-zinc-200 hover:border-indigo-300 z-0'
                    }`}
                    style={{
                      left: node.position?.x || 0,
                      top: node.position?.y || 0,
                    }}
                    onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                  >
                    {/* Node Image */}
                    <div className="h-24 bg-zinc-100 rounded-t-lg overflow-hidden relative group cursor-pointer" onClick={(e) => { e.stopPropagation(); if (node.imageUrl) setSelectedImage({ url: node.imageUrl, title: node.name }); }}>
                      {node.imageUrl ? (
                        <img src={node.imageUrl} alt={node.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                          <ImageIcon className="w-8 h-8 opacity-50" />
                        </div>
                      )}
                      
                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleGenerateNodeImage(node.id); }}
                          disabled={isGeneratingNode === node.id}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white backdrop-blur-sm transition-colors"
                          title="Gerar Imagem"
                        >
                          {isGeneratingNode === node.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); setIsCameraModalOpen(true); }}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white backdrop-blur-sm transition-colors"
                          title="Vista de Câmara"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        {node.imageUrl && (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleSaveToMedia(node.imageUrl!, node.name); }}
                              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white backdrop-blur-sm transition-colors"
                              title="Gravar na Biblioteca"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setShowPromptPreview(node.lastImagePrompt || null); }}
                              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white backdrop-blur-sm transition-colors"
                              title="Ver Prompt"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Node Content */}
                    <div className="p-3">
                      <h4 className="font-bold text-zinc-900 truncate">{node.name}</h4>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{node.description}</p>
                    </div>
                    
                    {/* Add Branch Button */}
                    {selectedNodeId === node.id && !connectingFromNodeId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddBranch(node.id); }}
                        className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-700 hover:scale-110 transition-all z-20"
                        title="Adicionar Ramal"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Sidebar for Selected Node */}
            {selectedNodeId && (
              <div className="w-80 bg-white border-l border-zinc-100 p-6 overflow-y-auto z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg text-zinc-900">Detalhes do Cenário</h3>
                  <button onClick={() => setSelectedNodeId(null)} className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {nodes.find(n => n.id === selectedNodeId) && (() => {
                  const node = nodes.find(n => n.id === selectedNodeId)!;
                  return (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Nome</label>
                        <input
                          type="text"
                          value={node.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setNodes(prev => prev.map(n => n.id === node.id ? { ...n, name: newName } : n));
                            setProject(prev => ({
                              ...prev,
                              settings: prev.settings.map(s => s.id === node.id ? { ...s, name: newName } : s)
                            }));
                          }}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Descrição</label>
                        <textarea
                          value={node.description}
                          onChange={(e) => {
                            const newDesc = e.target.value;
                            setNodes(prev => prev.map(n => n.id === node.id ? { ...n, description: newDesc } : n));
                            setProject(prev => ({
                              ...prev,
                              settings: prev.settings.map(s => s.id === node.id ? { ...s, description: newDesc } : s)
                            }));
                          }}
                          rows={4}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                      
                      <div className="pt-4 border-t border-zinc-100">
                        <button
                          onClick={() => handleGenerateNodeImage(node.id)}
                          disabled={isGeneratingNode === node.id}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
                        >
                          {isGeneratingNode === node.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {node.imageUrl ? "Regenerar Imagem" : "Gerar Imagem"}
                        </button>
                      </div>

                      <div className="pt-4 border-t border-zinc-100 space-y-2">
                        <button
                          onClick={() => setIsCameraModalOpen(true)}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                          Vista de Câmara
                        </button>
                        <button
                          onClick={() => handleGeneratePerspectives(node.id)}
                          disabled={isGeneratingPerspectives}
                          className="w-full flex items-center justify-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-4 py-2 rounded-xl font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
                        >
                          {isGeneratingPerspectives ? <Loader2 className="w-4 h-4 animate-spin" /> : <Maximize2 className="w-4 h-4" />}
                          Gerar 5 Perspetivas
                        </button>
                        <button
                          onClick={() => setConnectingFromNodeId(connectingFromNodeId === node.id ? null : node.id)}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                            connectingFromNodeId === node.id 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                              : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          <Move className="w-4 h-4" />
                          {connectingFromNodeId === node.id ? 'A ligar... (Clique no destino)' : 'Ligar a outro cenário'}
                        </button>
                      </div>
                      
                      {node.imageUrl && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveToMedia(node.imageUrl!, node.name)}
                            className="flex-1 flex items-center justify-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors"
                          >
                            <Save className="w-4 h-4" />
                            Gravar
                          </button>
                          <button
                            onClick={() => handleDownload(node.imageUrl!, node.name)}
                            className="flex-1 flex items-center justify-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                      )}

                      {node.viewsImageUrl && (
                        <div className="pt-4 border-t border-zinc-100">
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">5 Perspetivas</label>
                          <div 
                            className="aspect-video bg-zinc-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-zinc-200 mb-2"
                            onClick={() => setSelectedImage({ url: node.viewsImageUrl!, title: `${node.name} - Perspetivas` })}
                          >
                            <img
                              src={node.viewsImageUrl}
                              alt={`${node.name} - Perspetivas`}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {[
                              { url: node.frontViewImageUrl, label: 'Frente' },
                              { url: node.backViewImageUrl, label: 'Traseira' },
                              { url: node.leftViewImageUrl, label: 'Esquerda' },
                              { url: node.rightViewImageUrl, label: 'Direita' },
                              { url: node.topViewImageUrl, label: 'Topo' }
                            ].map((view, idx) => view.url && (
                              <div key={idx} className="group relative aspect-video bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200">
                                <img src={view.url} alt={view.label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                  <button onClick={() => handleSaveToMedia(view.url!, `${node.name} - ${view.label}`)} className="p-1 bg-white/20 hover:bg-white/40 rounded text-white" title="Gravar na Biblioteca"><Save className="w-3 h-3" /></button>
                                  <button onClick={() => handleDownload(view.url!, `${node.name}-${view.label.toLowerCase()}`)} className="p-1 bg-white/20 hover:bg-white/40 rounded text-white" title="Download"><Download className="w-3 h-3" /></button>
                                  <button onClick={() => setSelectedImage({ url: view.url!, title: `${node.name} - ${view.label}` })} className="p-1 bg-white/20 hover:bg-white/40 rounded text-white" title="Maximizar"><ZoomIn className="w-3 h-3" /></button>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] p-0.5 text-center">{view.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Prompt Preview Modal */}
      {showPromptPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-zinc-900">Prompt Utilizado</h3>
              <button onClick={() => setShowPromptPreview(null)} className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-700 font-mono whitespace-pre-wrap">
              {showPromptPreview}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowPromptPreview(null)} className="px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url || null}
        title={selectedImage?.title}
      />

      <CameraViewModal
        isOpen={isCameraModalOpen}
        onClose={() => {
          setIsCameraModalOpen(false);
          setCameraNode(null);
        }}
        node={cameraNode || nodes.find(n => n.id === selectedNodeId)}
        project={project}
        onSaveToMedia={handleSaveToMedia}
        onReplaceImage={(nodeId, url, prompt) => {
          if (nodeId === 'world-map') {
            setProject(prev => ({
              ...prev,
              worldMapImageUrl: url,
              worldMapPrompt: prompt
            }));
            return;
          }
          setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, imageUrl: url, lastImagePrompt: prompt } : n));
          setProject(prev => {
            const setting = prev.settings.find(s => s.id === nodeId);
            const oldImageUrl = setting?.imageUrl;
            
            const newMedia = oldImageUrl ? {
              id: uuidv4(),
              url: oldImageUrl,
              type: 'image' as const,
              title: `Cenário Original: ${setting?.name || 'Cenário'}`,
              source: 'camera',
              createdAt: Date.now()
            } : null;

            return {
              ...prev,
              settings: prev.settings.map(s => s.id === nodeId ? { ...s, imageUrl: url, lastImagePrompt: prompt } : s),
              customMedia: newMedia ? [newMedia, ...(prev.customMedia || [])] : prev.customMedia
            };
          });
        }}
        onUpdateViews={(nodeId, topUrl, sideUrl, sourceImageUrl) => {
          if (nodeId === 'world-map') {
            // Not saving views for world map yet, but we could
            return;
          }
          setNodes(prev => prev.map(n => n.id === nodeId ? { 
            ...n, 
            topViewImageUrl: topUrl, 
            sideViewImageUrl: sideUrl,
            viewsGeneratedFromImageUrl: sourceImageUrl
          } : n));
          setProject(prev => ({
            ...prev,
            settings: prev.settings.map(s => s.id === nodeId ? { 
              ...s, 
              topViewImageUrl: topUrl, 
              sideViewImageUrl: sideUrl,
              viewsGeneratedFromImageUrl: sourceImageUrl
            } : s)
          }));
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
