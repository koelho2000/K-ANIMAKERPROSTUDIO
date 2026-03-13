import React, { useState } from "react";
import { Project, EBook, EBookPage } from "../types";
import { Book, Image as ImageIcon, Sparkles, Loader2, ChevronLeft, ChevronRight, Edit3, Save, RefreshCw, Trash2, BookOpen, User, PenTool, Building2, Search, X, Maximize2, Layout, Clock, CheckCircle2, Circle } from "lucide-react";
import { getGenAI, generateImage } from "../services/geminiService";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";

interface EBookProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function EBookComponent({ project, setProject }: EBookProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [withImages, setWithImages] = useState(true);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>('A5');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [regenOptions, setRegenOptions] = useState({
    detailLevel: 'medium',
    textLength: 'medium',
    descriptionLevel: 'medium',
    actionLevel: 'medium'
  });
  const [generationLogs, setGenerationLogs] = useState<{ task: string; status: 'waiting' | 'running' | 'completed' }[]>([]);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const allProjectImages = [
    ...(project.intro?.imageUrl ? [{ url: project.intro.imageUrl, source: 'Intro' }] : []),
    ...(project.outro?.imageUrl ? [{ url: project.outro.imageUrl, source: 'Outro' }] : []),
    ...project.characters.filter(c => c.imageUrl).map(c => ({ url: c.imageUrl!, source: `Personagem: ${c.name}` })),
    ...project.settings.filter(s => s.imageUrl).map(s => ({ url: s.imageUrl!, source: `Cenário: ${s.name}` })),
    ...project.scenes.flatMap(s => s.takes.flatMap(t => [
      ...(t.startFrameUrl ? [{ url: t.startFrameUrl, source: `Cena: ${s.title} (Início)` }] : []),
      ...(t.endFrameUrl ? [{ url: t.endFrameUrl, source: `Cena: ${s.title} (Fim)` }] : [])
    ]))
  ];

  const handleGeneratePageImage = async (pageId: string) => {
    const page = project.ebook?.pages.find(p => p.id === pageId);
    if (!page) return;

    setIsGeneratingImage(true);
    try {
      const prompt = `Ilustração para um EBook de animação. Estilo: ${project.filmStyle}. Cena: ${page.title}. Descrição: ${page.content}`;
      const imageUrl = await generateImage(prompt, project.aspectRatio);
      
      setProject(prev => ({
        ...prev,
        ebook: prev.ebook ? {
          ...prev.ebook,
          pages: prev.ebook.pages.map(p => p.id === pageId ? { ...p, imageUrl } : p)
        } : undefined
      }));
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar imagem para a página.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateEBook = async () => {
    if (project.scenes.length === 0) {
      alert("Precisas de ter cenas criadas para gerar o EBook.");
      return;
    }

    setIsGenerating(true);
    setGenerationStartTime(Date.now());
    setElapsedTime(0);
    
    const tasks = [
      { task: "Analisar estrutura do projeto", status: 'waiting' as const },
      { task: "Gerar capa e introdução", status: 'waiting' as const },
      ...project.scenes.map((s, i) => ({ task: `Escrever Cena ${i + 1}: ${s.title}`, status: 'waiting' as const })),
      { task: "Gerar contra-capa e créditos", status: 'waiting' as const },
      { task: "Processar ilustrações e layout", status: 'waiting' as const }
    ];
    setGenerationLogs(tasks);

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    try {
      const updateTaskStatus = (index: number, status: 'waiting' | 'running' | 'completed') => {
        setGenerationLogs(prev => prev.map((t, i) => i === index ? { ...t, status } : t));
      };

      updateTaskStatus(0, 'running');
      const ai = getGenAI();
      const isPTPT = project.language === "Português (Portugal)";
      const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : project.language;

      const prompt = `Gera o conteúdo de um EBook baseado no seguinte projeto de filme:
      Título: "${project.title}"
      Conceito: "${project.concept}"
      Estilo: "${project.filmStyle}"
      Público Alvo: "${project.targetAudience}"
      Realizador: "${project.director || 'N/A'}"
      Autor: "${project.author || 'N/A'}"
      Formato: ${pageSize} em ${orientation}
      
      Cenas:
      ${project.scenes.map((s, i) => `Cena ${i + 1}: ${s.title} - ${s.description}`).join('\n')}
      
      Estrutura do EBook:
      1. Capa (Título e subtítulo apelativo)
      2. Sub-capa (Pequeno resumo/introdução da história)
      3. Conteúdo (Uma página por cena, descrevendo a ação e diálogos de forma literária, adaptada ao público alvo)
      4. Contra-capa (Dados do editor/autor e uma mensagem final)
      
      Responde APENAS em formato JSON com a seguinte estrutura:
      {
        "pages": [
          { "type": "cover", "title": "string", "content": "string" },
          { "type": "sub-cover", "title": "string", "content": "string" },
          { "type": "content", "sceneId": "string", "title": "string", "content": "string" },
          ...
          { "type": "back-cover", "title": "string", "content": "string" }
        ]
      }
      
      Língua: ${langSpec}
      ${isPTPT ? "IMPORTANTE: Utiliza Português de Portugal (PT-PT)." : ""}`;

      updateTaskStatus(0, 'completed');
      updateTaskStatus(1, 'running');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || "{}");
      updateTaskStatus(1, 'completed');
      
      const pages: EBookPage[] = [];
      
      for (let i = 0; i < result.pages.length; i++) {
        const p = result.pages[i];
        const taskIndex = i === 0 ? 1 : (p.type === 'back-cover' ? tasks.length - 2 : i + 1);
        if (taskIndex < tasks.length) updateTaskStatus(taskIndex, 'running');

        let imageUrl = undefined;
        if (withImages) {
          if (p.type === 'content' && p.sceneId) {
            const scene = project.scenes.find(s => s.id === p.sceneId);
            if (scene) {
              const takeWithImage = scene.takes.find(t => t.startFrameUrl || t.endFrameUrl);
              imageUrl = takeWithImage?.startFrameUrl || takeWithImage?.endFrameUrl;
            }
          } else if (p.type === 'cover') {
            imageUrl = project.intro?.imageUrl;
          }
        }

        pages.push({
          id: uuidv4(),
          ...p,
          imageUrl
        });
        
        if (taskIndex < tasks.length) updateTaskStatus(taskIndex, 'completed');
      }

      updateTaskStatus(tasks.length - 1, 'running');
      setProject(prev => ({
        ...prev,
        ebook: {
          pages,
          generatedAt: Date.now(),
          withImages,
          pageSize,
          orientation
        }
      }));
      updateTaskStatus(tasks.length - 1, 'completed');
      setCurrentPageIndex(0);
    } catch (error) {
      console.error("Erro ao gerar EBook:", error);
      alert("Ocorreu um erro ao gerar o EBook. Tenta novamente.");
    } finally {
      clearInterval(timer);
      setIsGenerating(false);
      setGenerationStartTime(null);
    }
  };

  const handleRegeneratePage = async (pageId: string) => {
    const page = project.ebook?.pages.find(p => p.id === pageId);
    if (!page) return;

    setIsGenerating(true);
    try {
      const ai = getGenAI();
      const isPTPT = project.language === "Português (Portugal)";
      const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : project.language;

      const prompt = `Regera o conteúdo desta página específica do EBook:
      Tipo de Página: ${page.type}
      Título Atual: ${page.title}
      Conteúdo Atual: ${page.content}
      
      Preferências de Regeneração:
      - Nível de Detalhe: ${regenOptions.detailLevel}
      - Extensão do Texto: ${regenOptions.textLength}
      - Nível de Descrição: ${regenOptions.descriptionLevel}
      - Nível de Acção: ${regenOptions.actionLevel}
      
      Contexto do Projeto:
      Título: "${project.title}"
      Público Alvo: "${project.targetAudience}"
      Estilo: "${project.filmStyle}"
      
      Responde APENAS em formato JSON:
      { "title": "string", "content": "string" }
      
      Língua: ${langSpec}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || "{}");
      
      setProject(prev => ({
        ...prev,
        ebook: prev.ebook ? {
          ...prev.ebook,
          pages: prev.ebook.pages.map(p => p.id === pageId ? { ...p, ...result } : p)
        } : undefined
      }));
    } catch (error) {
      console.error("Erro ao regerar página:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editingPageId) return;
    setProject(prev => ({
      ...prev,
      ebook: prev.ebook ? {
        ...prev.ebook,
        pages: prev.ebook.pages.map(p => p.id === editingPageId ? { ...p, title: editTitle, content: editContent } : p)
      } : undefined
    }));
    setEditingPageId(null);
  };

  const startEditing = (page: EBookPage) => {
    setEditingPageId(page.id);
    setEditTitle(page.title);
    setEditContent(page.content);
  };

  const nextPage = () => {
    if (project.ebook && currentPageIndex < project.ebook.pages.length - 1) {
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    }
  };

  const currentPage = project.ebook?.pages[currentPageIndex];

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            EBook do Projeto
          </h2>
          <p className="text-zinc-500">
            Transforma o teu filme numa experiência de leitura interativa.
          </p>
        </div>
        {!project.ebook ? (
          <div className="flex flex-col items-end gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-2">
                <Layout className="w-4 h-4 text-zinc-400" />
                <select 
                  value={pageSize} 
                  onChange={(e) => setPageSize(e.target.value as any)}
                  className="text-sm font-medium text-zinc-700 outline-none bg-transparent"
                >
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-2">
                <Maximize2 className="w-4 h-4 text-zinc-400" />
                <select 
                  value={orientation} 
                  onChange={(e) => setOrientation(e.target.value as any)}
                  className="text-sm font-medium text-zinc-700 outline-none bg-transparent"
                >
                  <option value="portrait">Vertical</option>
                  <option value="landscape">Horizontal</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-2">
                <ImageIcon className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-700">Com Imagens</span>
                <button
                  onClick={() => setWithImages(!withImages)}
                  className={`w-10 h-5 rounded-full transition-all relative ${withImages ? 'bg-indigo-600' : 'bg-zinc-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${withImages ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
            <button
              onClick={handleGenerateEBook}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Gerar EBook
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.confirm("Desejas apagar o EBook atual e gerar um novo?")) {
                  setProject(prev => ({ ...prev, ebook: undefined }));
                }
              }}
              className="flex items-center gap-2 text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Reiniciar EBook
            </button>
          </div>
        )}
      </div>

      {project.ebook ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Virtual Book Display */}
          <div className="lg:col-span-8 flex flex-col items-center gap-6">
            <div className={`relative w-full ${project.ebook.orientation === 'landscape' ? 'aspect-[4/3]' : 'aspect-[3/4]'} max-w-md bg-white rounded-r-2xl shadow-2xl border-l-8 border-indigo-900 overflow-hidden group`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPageIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full flex flex-col p-12"
                >
                  {currentPage?.imageUrl && (
                    <div className="mb-8 rounded-xl overflow-hidden shadow-md aspect-video bg-zinc-100">
                      <img 
                        src={currentPage.imageUrl} 
                        alt={currentPage.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                    <h3 className={`font-bold text-zinc-900 ${currentPage?.type === 'cover' ? 'text-4xl text-center mt-12' : 'text-2xl'}`}>
                      {currentPage?.title}
                    </h3>
                    
                    <div className={`text-zinc-700 leading-relaxed whitespace-pre-wrap ${currentPage?.type === 'cover' ? 'text-center text-lg italic' : 'text-base'}`}>
                      {currentPage?.content}
                    </div>

                    {currentPage?.type === 'back-cover' && (
                      <div className="mt-12 pt-8 border-t border-zinc-100 space-y-2">
                        {project.outro?.company && (
                          <div className="flex items-center gap-2 text-sm text-zinc-500">
                            <Building2 className="w-4 h-4" />
                            <span className="font-bold">Editora/Produtora:</span> {project.outro.company}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                          <User className="w-4 h-4" />
                          <span className="font-bold">Realizador:</span> {project.director || 'N/A'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                          <PenTool className="w-4 h-4" />
                          <span className="font-bold">Autor:</span> {project.author || 'N/A'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    <span>{currentPage?.type === 'cover' ? 'Capa' : currentPage?.type === 'back-cover' ? 'Contra-capa' : `Página ${currentPageIndex}`}</span>
                    <span>{currentPageIndex + 1} / {project.ebook.pages.length}</span>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation Arrows */}
              <button
                onClick={prevPage}
                disabled={currentPageIndex === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg text-zinc-800 disabled:opacity-0 transition-all hover:bg-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextPage}
                disabled={currentPageIndex === project.ebook.pages.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg text-zinc-800 disabled:opacity-0 transition-all hover:bg-white"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={prevPage}
                disabled={currentPageIndex === 0}
                className="p-3 rounded-full bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="px-6 py-2 bg-zinc-100 rounded-full text-sm font-bold text-zinc-600">
                {currentPageIndex + 1} de {project.ebook.pages.length}
              </div>
              <button
                onClick={nextPage}
                disabled={currentPageIndex === project.ebook.pages.length - 1}
                className="p-3 rounded-full bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Editor Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                Editor de Página
              </h3>

              {editingPageId === currentPage?.id ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Título</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Conteúdo</label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={10}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingPageId(null)}
                      className="flex-1 bg-zinc-100 text-zinc-600 py-2 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-500 italic">
                    Estás a visualizar a {currentPage?.type === 'cover' ? 'Capa' : currentPage?.type === 'back-cover' ? 'Contra-capa' : `Página ${currentPageIndex}`}.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => currentPage && startEditing(currentPage)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-xl text-sm font-bold transition-all border border-zinc-100"
                    >
                      <Edit3 className="w-4 h-4" />
                      Editar Texto
                    </button>

                    <div className="mt-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100 space-y-3">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Opções de IA</h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Detalhe</label>
                          <select 
                            value={regenOptions.detailLevel}
                            onChange={(e) => setRegenOptions(prev => ({ ...prev, detailLevel: e.target.value }))}
                            className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-1.5 outline-none"
                          >
                            <option value="low">Baixo</option>
                            <option value="medium">Médio</option>
                            <option value="high">Alto</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Extensão</label>
                          <select 
                            value={regenOptions.textLength}
                            onChange={(e) => setRegenOptions(prev => ({ ...prev, textLength: e.target.value }))}
                            className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-1.5 outline-none"
                          >
                            <option value="short">Curto</option>
                            <option value="medium">Médio</option>
                            <option value="long">Longo</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Descrição</label>
                          <select 
                            value={regenOptions.descriptionLevel}
                            onChange={(e) => setRegenOptions(prev => ({ ...prev, descriptionLevel: e.target.value }))}
                            className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-1.5 outline-none"
                          >
                            <option value="low">Pouca</option>
                            <option value="medium">Média</option>
                            <option value="high">Muita</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Acção</label>
                          <select 
                            value={regenOptions.actionLevel}
                            onChange={(e) => setRegenOptions(prev => ({ ...prev, actionLevel: e.target.value }))}
                            className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-1.5 outline-none"
                          >
                            <option value="low">Pouca</option>
                            <option value="medium">Média</option>
                            <option value="high">Muita</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={() => currentPage && handleRegeneratePage(currentPage.id)}
                        disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                        Regerar com IA
                      </button>
                    </div>

                    {currentPage && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setShowMediaLibrary(true)}
                          className="flex items-center justify-center gap-2 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold transition-all border border-indigo-100"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Biblioteca
                        </button>
                        <button
                          onClick={() => handleGeneratePageImage(currentPage.id)}
                          disabled={isGeneratingImage}
                          className="flex items-center justify-center gap-2 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold transition-all border border-emerald-100 disabled:opacity-50"
                        >
                          {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          Gerar Nova
                        </button>
                      </div>
                    )}
                    
                    {currentPage?.type === 'content' && (
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Imagem da Página</label>
                        <div className="grid grid-cols-2 gap-2">
                          {project.scenes.find(s => s.id === currentPage.sceneId)?.takes.map((take, i) => (
                            (take.startFrameUrl || take.endFrameUrl) && (
                              <button
                                key={i}
                                onClick={() => {
                                  const url = take.startFrameUrl || take.endFrameUrl;
                                  setProject(prev => ({
                                    ...prev,
                                    ebook: prev.ebook ? {
                                      ...prev.ebook,
                                      pages: prev.ebook.pages.map(p => p.id === currentPage.id ? { ...p, imageUrl: url } : p)
                                    } : undefined
                                  }));
                                }}
                                className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${currentPage.imageUrl === (take.startFrameUrl || take.endFrameUrl) ? 'border-indigo-600' : 'border-transparent'}`}
                              >
                                <img src={take.startFrameUrl || take.endFrameUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </button>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {currentPage?.type === 'cover' && (
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Alterar Capa</label>
                        <div className="grid grid-cols-2 gap-2">
                          {project.intro?.imageUrl && (
                            <button
                              onClick={() => setProject(prev => ({
                                ...prev,
                                ebook: prev.ebook ? {
                                  ...prev.ebook,
                                  pages: prev.ebook.pages.map(p => p.id === currentPage.id ? { ...p, imageUrl: project.intro?.imageUrl } : p)
                                } : undefined
                              }))}
                              className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${currentPage.imageUrl === project.intro.imageUrl ? 'border-indigo-600' : 'border-transparent'}`}
                            >
                              <img src={project.intro.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </button>
                          )}
                          {/* Add more options if needed, like from scenes */}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-indigo-900 p-6 rounded-2xl text-white shadow-lg">
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Dica do Editor
              </h4>
              <p className="text-xs text-indigo-200 leading-relaxed">
                O EBook é gerado com base nas tuas cenas. Podes ajustar o tom e o estilo regerando páginas individuais ou editando o texto manualmente para melhor se adaptar ao teu público {project.targetAudience}.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-zinc-200">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mx-auto mb-6">
            <Book className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold text-zinc-900 mb-2">Ainda não tens um EBook</h3>
          <p className="text-zinc-500 max-w-md mx-auto mb-8">
            Cria uma versão literária do teu filme. O EBook incluirá capa, resumo, cenas ilustradas e contra-capa.
          </p>
          <button
            onClick={handleGenerateEBook}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-200 mx-auto disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
            Começar Geração do EBook
          </button>
        </div>
      )}

      {/* Progress Overlay */}
      <AnimatePresence>
        {isGenerating && generationLogs.length > 0 && (
          <div className="fixed inset-0 bg-zinc-900/90 backdrop-blur-md z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-zinc-100 bg-zinc-50/50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-900">Gerando o teu EBook</h3>
                      <p className="text-sm text-zinc-500">Isto pode demorar alguns minutos...</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-indigo-600">
                      {Math.round((generationLogs.filter(l => l.status === 'completed').length / generationLogs.length) * 100)}%
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>

                <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${(generationLogs.filter(l => l.status === 'completed').length / generationLogs.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4 max-h-[400px] custom-scrollbar">
                {generationLogs.map((log, i) => (
                  <div key={i} className={`flex items-center gap-4 transition-all ${log.status === 'waiting' ? 'opacity-30' : 'opacity-100'}`}>
                    {log.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : log.status === 'running' ? (
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-300 shrink-0" />
                    )}
                    <span className={`text-sm font-medium ${log.status === 'running' ? 'text-indigo-600 font-bold' : 'text-zinc-600'}`}>
                      {log.task}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-zinc-50 border-t border-zinc-100 text-center">
                <p className="text-xs text-zinc-400 font-medium italic">
                  "A paciência é a arte de ter esperança." — Luc de Clapiers
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Media Library Modal */}
      <AnimatePresence>
        {showMediaLibrary && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">Biblioteca de Media</h3>
                  <p className="text-sm text-zinc-500">Seleciona uma imagem do teu projeto para esta página.</p>
                </div>
                <button
                  onClick={() => setShowMediaLibrary(false)}
                  className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {allProjectImages.length > 0 ? (
                    allProjectImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (currentPage) {
                            setProject(prev => ({
                              ...prev,
                              ebook: prev.ebook ? {
                                ...prev.ebook,
                                pages: prev.ebook.pages.map(p => p.id === currentPage.id ? { ...p, imageUrl: img.url } : p)
                              } : undefined
                            }));
                            setShowMediaLibrary(false);
                          }
                        }}
                        className="group relative aspect-video rounded-xl overflow-hidden border-2 border-transparent hover:border-indigo-600 transition-all bg-zinc-100"
                      >
                        <img src={img.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <span className="text-[10px] text-white font-bold truncate">{img.source}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center text-zinc-400">
                      <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Ainda não tens imagens no teu projeto.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
                <button
                  onClick={() => setShowMediaLibrary(false)}
                  className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  );
}
