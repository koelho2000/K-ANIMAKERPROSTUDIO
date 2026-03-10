import React, { useState, useEffect } from "react";
import { Project } from "../types";
import { 
  generateText, 
  generateImage, 
  generateVideo, 
  pollVideoOperation,
  getGenAI
} from "../services/geminiService";
import { 
  Loader2, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Type, 
  Music, 
  Clapperboard,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  X,
  ZoomIn,
  Users,
  Upload,
  Download
} from "lucide-react";
import ProgressBar from "./ProgressBar";
import { ImageModal } from "./ImageModal";

interface IntroOutroProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

const INTRO_TYPES = [
  { id: "cinematic", name: "Título Cinemático", description: "Título épico com iluminação dramática e fumo." },
  { id: "minimalist", name: "Minimalista Moderno", description: "Design limpo, tipografia elegante e cores sólidas." },
  { id: "retro", name: "Retro / Vintage", description: "Estilo anos 80, neon, grão de película e cores vibrantes." },
  { id: "atmospheric", name: "Atmosférico / Mistério", description: "Ambiente sombrio, revelação lenta através de sombras." },
];

const OUTRO_TYPES = [
  { id: "scrolling", name: "Créditos em Scroll", description: "Clássico scroll vertical de nomes sobre fundo preto." },
  { id: "fade", name: "Fade to Black", description: "O título do filme aparece uma última vez antes de escurecer." },
  { id: "cast", name: "Montagem do Elenco", description: "Imagens das personagens principais com os nomes dos atores." },
  { id: "thankyou", name: "Mensagem de Agradecimento", description: "Uma nota pessoal de agradecimento ao público." },
];

export default function IntroOutro({ project, setProject }: IntroOutroProps) {
  const [activeTab, setActiveTab] = useState<"intro" | "outro">("intro");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [editingVideoPrompt, setEditingVideoPrompt] = useState<string | null>(null);

  const intro = project.intro || { type: "cinematic", prompt: "" };
  const outro = project.outro || { type: "scrolling", prompt: "" };

  const currentData = activeTab === "intro" ? intro : outro;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGeneratingVideo || isGeneratingImage || isGeneratingPrompt) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 98) return prev;
          // Faster initially, then slower
          const increment = prev < 20 ? Math.random() * 5 : Math.random() * 0.5;
          return prev + increment;
        });
      }, 1000);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [isGeneratingVideo, isGeneratingImage, isGeneratingPrompt]);

  const updateData = (updates: any) => {
    setProject(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab as "intro" | "outro"], ...updates }
    }));
  };

  const handleGeneratePrompt = async () => {
    setIsGeneratingPrompt(true);
    setProgress(0);
    try {
      const typeInfo = (activeTab === "intro" ? INTRO_TYPES : OUTRO_TYPES).find(t => t.id === currentData.type);
      
      let extraInfo = "";
      if (activeTab === "outro") {
        const creditsText = `
          Empresa: ${project.outro?.company || "N/A"}
          Realização: ${project.outro?.director || "N/A"}
          Produção: ${project.outro?.producer || "N/A"}
          ${currentData.type === 'thankyou' ? `Mensagem de Agradecimento: ${project.outro?.thankYouMessage || "N/A"}` : ""}
        `;
        
        extraInfo = `
        Dados Adicionais para Créditos (Estes dados DEVEM aparecer visualmente no vídeo):
        ${creditsText}
        `;
      }

      const prompt = `Cria um prompt detalhado para a geração de um ${activeTab === "intro" ? "Início (Intro)" : "Fim (Créditos)"} de um filme de animação.
        Título do Filme: ${project.title}
        Tipo de Filme: ${project.filmType}
        Estilo Visual: ${project.filmStyle}
        Tipo de ${activeTab === "intro" ? "Intro" : "Outro"}: ${typeInfo?.name} (${typeInfo?.description})
        ${extraInfo}
        
        O prompt deve descrever visualmente a cena, a tipografia do texto "${activeTab === "intro" ? project.title : (currentData.type === 'thankyou' ? project.outro?.thankYouMessage || "OBRIGADO" : "FIM / CRÉDITOS")}", a iluminação, o movimento de câmara e a atmosfera.
        Para os créditos, certifica-te que o prompt inclui a exibição dos nomes da Empresa, Realizador e Produtor de forma legível e estilizada de acordo com o tipo selecionado.
        Responde apenas com o prompt em Inglês para ser usado numa ferramenta de geração de imagem/vídeo.`;
      
      const generatedPrompt = await generateText(prompt);
      updateData({ prompt: generatedPrompt });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar prompt.");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!currentData.prompt) {
      alert("Gera primeiro o prompt!");
      return;
    }
    setEditingPrompt(currentData.prompt);
  };

  const confirmGenerateImage = async (editedPrompt: string) => {
    setEditingPrompt(null);
    setIsGeneratingImage(true);
    setProgress(0);
    try {
      const imageUrl = await generateImage(editedPrompt, project.aspectRatio);
      updateData({ imageUrl, prompt: editedPrompt });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar imagem.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      updateData({ imageUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateVideo = async () => {
    if (!currentData.imageUrl) {
      alert("Gera primeiro a imagem base!");
      return;
    }
    const videoPrompt = `${currentData.prompt}. Add cinematic movement, sound of ${activeTab === "intro" ? "epic orchestral music" : "gentle closing music"}, and professional transitions.`;
    setEditingVideoPrompt(videoPrompt);
  };

  const confirmGenerateVideo = async (editedPrompt: string) => {
    setEditingVideoPrompt(null);
    setIsGeneratingVideo(true);
    setProgress(0);
    try {
      // Check if API key is selected (system or manual)
      const hasManualKey = !!localStorage.getItem('GEMINI_API_KEY_MANUAL');
      const hasSystemKey = await (window as any).aistudio?.hasSelectedApiKey?.();
      
      if (!hasManualKey && !hasSystemKey) {
        if ((window as any).aistudio?.openSelectKey) {
          await (window as any).aistudio.openSelectKey();
        } else {
          alert("Por favor, configura a tua Chave API Gemini primeiro (Sistema ou Manual no Menu Lateral).");
          setIsGeneratingVideo(false);
          return;
        }
      }

      const operation = await generateVideo(editedPrompt, currentData.imageUrl, undefined, currentData.videoModel || 'flow', project.aspectRatio);
      
      updateData({ videoOperationId: operation.name, lastVideoPrompt: editedPrompt });
      
      const { videoUrl, videoObject } = await pollVideoOperation(operation);
      updateData({ videoUrl, videoObject, videoOperationId: undefined });
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao gerar vídeo: ${error.message || 'Verifica a consola.'}`);
      updateData({ videoOperationId: undefined });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">Intro & Créditos</h2>
          <p className="text-zinc-500">
            Configura o início e o fim do teu filme com títulos e créditos profissionais.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab("intro")}
          className={`px-8 py-2.5 rounded-xl font-bold transition-all ${
            activeTab === "intro" ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Início (Intro)
        </button>
        <button
          onClick={() => setActiveTab("outro")}
          className={`px-8 py-2.5 rounded-xl font-bold transition-all ${
            activeTab === "outro" ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Fim (Créditos)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-200 space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Clapperboard className="w-4 h-4" />
                Tipo de {activeTab === "intro" ? "Intro" : "Créditos"}
              </label>
              <div className="grid grid-cols-1 gap-3">
                {(activeTab === "intro" ? INTRO_TYPES : OUTRO_TYPES).map((type) => (
                  <button
                    key={type.id}
                    onClick={() => updateData({ type: type.id })}
                    className={`text-left p-4 rounded-2xl border transition-all ${
                      currentData.type === type.id
                        ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10"
                        : "bg-zinc-50 border-zinc-100 hover:border-zinc-200"
                    }`}
                  >
                    <p className={`font-bold text-sm ${currentData.type === type.id ? "text-indigo-700" : "text-zinc-700"}`}>
                      {type.name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      {type.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Prompt Visual
                </label>
                <button
                  onClick={handleGeneratePrompt}
                  disabled={isGeneratingPrompt}
                  className="text-xs text-indigo-600 font-bold hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                >
                  {isGeneratingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Gerar com IA
                </button>
              </div>
              <textarea
                value={currentData.prompt}
                onChange={(e) => updateData({ prompt: e.target.value })}
                placeholder="Descreve como deve ser o visual..."
                className="w-full h-32 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            {activeTab === "outro" && (
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Dados dos Créditos
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Empresa</label>
                    <input
                      type="text"
                      value={project.outro?.company || ""}
                      onChange={(e) => updateData({ company: e.target.value })}
                      placeholder="Nome da Produtora/Empresa"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Realização</label>
                    <input
                      type="text"
                      value={project.outro?.director || ""}
                      onChange={(e) => updateData({ director: e.target.value })}
                      placeholder="Nome do Realizador"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Produção</label>
                    <input
                      type="text"
                      value={project.outro?.producer || ""}
                      onChange={(e) => updateData({ producer: e.target.value })}
                      placeholder="Nome do Produtor"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                  {currentData.type === 'thankyou' && (
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Mensagem de Agradecimento</label>
                      <textarea
                        value={project.outro?.thankYouMessage || ""}
                        onChange={(e) => updateData({ thankYouMessage: e.target.value })}
                        placeholder="Escreve aqui a tua nota pessoal de agradecimento..."
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none h-24 resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Image Generation */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-indigo-600" />
                    Keyframe Base
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-1.5 rounded-xl text-xs font-bold border border-zinc-200 transition-all flex items-center gap-2">
                      <Upload className="w-3 h-3" />
                      Upload
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleUploadImage}
                      />
                    </label>
                    <button
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage || !currentData.prompt}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Gerar Imagem
                    </button>
                  </div>
                </div>
                <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-zinc-100 rounded-2xl border border-zinc-200 overflow-hidden flex items-center justify-center relative group`}>
                  {currentData.imageUrl ? (
                    <>
                      <img src={currentData.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button 
                          onClick={() => setSelectedImage({ url: currentData.imageUrl!, title: activeTab === "intro" ? "Intro Keyframe" : "Credits Keyframe" })}
                          className="p-2 bg-white rounded-full text-zinc-900 hover:scale-110 transition-transform"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                        <a 
                          href={currentData.imageUrl}
                          download={`${activeTab}-keyframe.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-white rounded-full text-zinc-900 hover:scale-110 transition-transform flex items-center justify-center"
                          title="Descarregar Imagem"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6">
                      <ImageIcon className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                      <p className="text-xs text-zinc-400">Gera uma imagem para servir de base ao vídeo.</p>
                    </div>
                  )}
                  {isGeneratingImage && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-6">
                      <div className="w-full max-w-[200px]">
                        <ProgressBar progress={progress} label="A gerar imagem..." modelName="Nanobana" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Video Generation */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                    <Video className="w-5 h-5 text-emerald-600" />
                    Vídeo Final
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                      <button
                        onClick={() => updateData({ videoModel: 'flow' })}
                        className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${
                          (currentData.videoModel || 'flow') === 'flow'
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-zinc-400 hover:text-zinc-600"
                        }`}
                      >
                        FLOW
                      </button>
                      <button
                        onClick={() => updateData({ videoModel: 'veo' })}
                        className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${
                          currentData.videoModel === 'veo'
                            ? "bg-white text-emerald-600 shadow-sm"
                            : "text-zinc-400 hover:text-zinc-600"
                        }`}
                      >
                        VEO
                      </button>
                    </div>
                    <button
                      onClick={handleGenerateVideo}
                      disabled={isGeneratingVideo || !currentData.imageUrl || !!currentData.videoOperationId}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isGeneratingVideo || currentData.videoOperationId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Renderizar Vídeo
                    </button>
                  </div>
                </div>
                <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-zinc-100 rounded-2xl border border-zinc-200 overflow-hidden flex items-center justify-center relative group`}>
                  {currentData.videoUrl ? (
                    <>
                      <video 
                        src={currentData.videoUrl} 
                        controls 
                        className="w-full h-full object-cover"
                      />
                      <a 
                        href={currentData.videoUrl}
                        download={`${activeTab}-video.mp4`}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute top-4 right-4 p-2 bg-white/90 rounded-full text-zinc-900 opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-lg flex items-center justify-center"
                        title="Descarregar Vídeo"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </>
                  ) : (
                    <div className="text-center p-6">
                      <Video className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                      <p className="text-xs text-zinc-400">Renderiza o vídeo final com animação e música.</p>
                    </div>
                  )}
                  {(isGeneratingVideo || currentData.videoOperationId) && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                      <div className="w-full max-w-[240px]">
                        <ProgressBar 
                          progress={progress} 
                          label="A renderizar vídeo..." 
                          modelName={(currentData.videoModel || 'flow') === 'veo' ? 'Veo' : 'Flow'} 
                        />
                        <p className="mt-2 text-[10px] text-zinc-500">Isto pode demorar alguns minutos. Estamos a adicionar movimento e atmosfera.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sound/Music Info */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                <Music className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-sm">Som e Música</h4>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  O vídeo gerado incluirá uma banda sonora baseada no tipo de {activeTab === "intro" ? "intro" : "créditos"} selecionado. 
                  Podes ajustar o prompt visual para influenciar o estilo musical sugerido.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImageModal 
        isOpen={!!selectedImage}
        imageUrl={selectedImage?.url || null} 
        title={selectedImage?.title} 
        onClose={() => setSelectedImage(null)} 
      />

      {/* Prompt Validation Modal */}
      {editingPrompt !== null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-zinc-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Validar Prompt de Geração</h3>
                  <p className="text-xs text-zinc-500">Edita o prompt para garantir que o resultado da {activeTab === 'intro' ? 'Intro' : 'Créditos'} é o pretendido.</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingPrompt(null)}
                className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-zinc-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Prompt Visual</label>
                <textarea
                  value={editingPrompt}
                  onChange={(e) => setEditingPrompt(e.target.value)}
                  className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none font-mono"
                  placeholder="Descreve a cena detalhadamente..."
                />
              </div>
              
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Dica:</strong> Inclui detalhes sobre iluminação, estilo de animação e atmosfera para melhores resultados.
                </p>
              </div>
            </div>
            
            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingPrompt(null)}
                className="px-6 py-2.5 rounded-xl font-bold text-zinc-600 hover:bg-zinc-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmGenerateImage(editingPrompt)}
                className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Gerar Imagem Agora
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Video Prompt Validation Modal */}
      {editingVideoPrompt !== null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-zinc-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Validar Prompt de Vídeo</h3>
                  <p className="text-xs text-zinc-500">Edita o prompt para garantir que a animação do vídeo é a pretendida.</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingVideoPrompt(null)}
                className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-zinc-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Prompt de Vídeo</label>
                <textarea
                  value={editingVideoPrompt}
                  onChange={(e) => setEditingVideoPrompt(e.target.value)}
                  className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none font-mono"
                  placeholder="Descreve o movimento e atmosfera do vídeo..."
                />
              </div>
              
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Dica:</strong> Descreve movimentos de câmara como "pan", "zoom" ou "tracking shot" para melhores resultados.
                </p>
              </div>
            </div>
            
            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingVideoPrompt(null)}
                className="px-6 py-2.5 rounded-xl font-bold text-zinc-600 hover:bg-zinc-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmGenerateVideo(editingVideoPrompt)}
                className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Renderizar Vídeo Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
