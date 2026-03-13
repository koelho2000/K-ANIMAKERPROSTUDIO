import React, { useState } from "react";
import { Project, EBook, EBookPage } from "../types";
import { Book, Image as ImageIcon, Sparkles, Loader2, ChevronLeft, ChevronRight, Edit3, Save, RefreshCw, Trash2, BookOpen, User, PenTool, Building2 } from "lucide-react";
import { getGenAI } from "../services/geminiService";
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

  const handleGenerateEBook = async () => {
    if (project.scenes.length === 0) {
      alert("Precisas de ter cenas criadas para gerar o EBook.");
      return;
    }

    setIsGenerating(true);
    try {
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

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || "{}");
      
      const pages: EBookPage[] = result.pages.map((p: any, index: number) => {
        let imageUrl = undefined;
        if (withImages) {
          if (p.type === 'content' && p.sceneId) {
            // Try to find an image from the scene's takes
            const scene = project.scenes.find(s => s.id === p.sceneId || project.scenes[index-2]?.id === p.sceneId);
            if (scene) {
              const takeWithImage = scene.takes.find(t => t.startFrameUrl || t.endFrameUrl);
              imageUrl = takeWithImage?.startFrameUrl || takeWithImage?.endFrameUrl;
            }
          } else if (p.type === 'cover') {
            imageUrl = project.intro?.imageUrl;
          }
        }

        return {
          id: uuidv4(),
          ...p,
          imageUrl
        };
      });

      setProject(prev => ({
        ...prev,
        ebook: {
          pages,
          generatedAt: Date.now(),
          withImages
        }
      }));
      setCurrentPageIndex(0);
    } catch (error) {
      console.error("Erro ao gerar EBook:", error);
      alert("Ocorreu um erro ao gerar o EBook. Tenta novamente.");
    } finally {
      setIsGenerating(false);
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
          <div className="flex items-center gap-4">
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
            <div className="relative w-full aspect-[3/4] max-w-md bg-white rounded-r-2xl shadow-2xl border-l-8 border-indigo-900 overflow-hidden group">
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
                    <button
                      onClick={() => currentPage && handleRegeneratePage(currentPage.id)}
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-xl text-sm font-bold transition-all border border-zinc-100"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                      Regerar com IA
                    </button>
                    
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
