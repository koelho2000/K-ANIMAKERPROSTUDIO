import React, { useState } from "react";
import { Project, EBook, EBookPage } from "../types";
import { Book, Image as ImageIcon, Sparkles, Loader2, ChevronLeft, ChevronRight, Edit3, Save, RefreshCw, Trash2, BookOpen, User, PenTool, Building2, Search, X, Maximize2, Layout, Clock, CheckCircle2, Circle, Type as TypeIcon, AlignLeft, AlignCenter, AlignRight, FileOutput, Download, FileText, Globe, FileJson, Upload } from "lucide-react";
import { getGenAI, generateImage } from "../services/geminiService";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";

interface EBookProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

const ProgressBar = ({ progress, label, modelName }: { progress: number, label: string, modelName: string }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
      <span className="text-zinc-500">{label}</span>
      <span className="text-indigo-600">{modelName}</span>
    </div>
    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
      <motion.div 
        className="h-full bg-indigo-600"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
      />
    </div>
  </div>
);

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
      
      const rawPages = result.pages || [];
      const pages: EBookPage[] = [];
      
      updateTaskStatus(1, 'running');
      // 1. Cover
      const cover = rawPages.find(p => p.type === 'cover');
      if (cover) {
        pages.push({ 
          id: uuidv4(), 
          ...cover, 
          imageUrl: withImages ? project.intro?.imageUrl : undefined,
          type: 'cover'
        });
      }

      // 2. Blank page (inside cover)
      pages.push({
        id: uuidv4(),
        type: 'blank',
        title: '',
        content: '',
      });
      updateTaskStatus(1, 'completed');

      // 3. Sub-cover and Content
      rawPages.filter(p => p.type !== 'cover' && p.type !== 'back-cover').forEach((p, i) => {
        const taskIndex = i + 2;
        if (taskIndex < tasks.length - 2) updateTaskStatus(taskIndex, 'running');
        
        let imageUrl = undefined;
        if (withImages && p.type === 'content' && p.sceneId) {
          const scene = project.scenes.find(s => s.id === p.sceneId);
          if (scene) {
            const takeWithImage = scene.takes.find(t => t.startFrameUrl || t.endFrameUrl);
            imageUrl = takeWithImage?.startFrameUrl || takeWithImage?.endFrameUrl;
          }
        }
        pages.push({ id: uuidv4(), ...p, imageUrl });
        
        if (taskIndex < tasks.length - 2) updateTaskStatus(taskIndex, 'completed');
      });

      // 4. "Sobre a Obra" (Penultimate) - Must be on an odd page number (index must be even)
      updateTaskStatus(tasks.length - 2, 'running');
      if (pages.length % 2 !== 0) {
        pages.push({ id: uuidv4(), type: 'blank', title: '', content: '' });
      }
      
      pages.push({
        id: uuidv4(),
        type: 'about',
        title: 'Sobre o Autor',
        content: `Esta obra foi escrita por ${project.author || 'N/A'}, sob a visão de ${project.director || 'N/A'}. O autor dedica-se a criar experiências memoráveis para um público de ${project.targetAudience || 'todas as idades'}.`,
      });
      updateTaskStatus(tasks.length - 2, 'completed');

      // 5. Back cover
      updateTaskStatus(tasks.length - 1, 'running');
      const backCover = rawPages.find(p => p.type === 'back-cover');
      pages.push({
        id: uuidv4(),
        type: 'back-cover',
        title: backCover?.title || 'Fim',
        content: backCover?.content || '',
        imageUrl: withImages ? project.outro?.imageUrl : undefined
      });
      updateTaskStatus(tasks.length - 1, 'completed');

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

  const prevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    }
  };

  const nextPage = () => {
    if (project.ebook && currentPageIndex < project.ebook.pages.length - 1) {
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const FONT_FAMILIES = [
    { name: 'Serif (Clássico)', value: "'Playfair Display', serif" },
    { name: 'Sans (Moderno)', value: "'Inter', sans-serif" },
    { name: 'Mono (Técnico)', value: "'JetBrains Mono', monospace" },
    { name: 'Cursive (Elegante)', value: "'Dancing Script', cursive" },
  ];

  const IMAGE_POSITIONS = [
    { id: 'top', label: 'Topo', icon: Layout },
    { id: 'left', label: 'Esquerda', icon: AlignLeft },
    { id: 'right', label: 'Direita', icon: AlignRight },
    { id: 'bottom', label: 'Base', icon: Layout },
    { id: 'between', label: 'Entre Título e Texto', icon: Layout },
  ];

  const handleUploadUserImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentPage) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setProject(prev => ({
        ...prev,
        ebook: prev.ebook ? {
          ...prev.ebook,
          pages: prev.ebook.pages.map(p => p.id === currentPage.id ? { ...p, imageUrl: base64 } : p)
        } : undefined
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = () => {
    if (!currentPage) return;
    setProject(prev => ({
      ...prev,
      ebook: prev.ebook ? {
        ...prev.ebook,
        pages: prev.ebook.pages.map(p => p.id === currentPage.id ? { ...p, imageUrl: undefined } : p)
      } : undefined
    }));
  };

  const handlePagination = () => {
    if (!project.ebook) return;

    const newPages: EBookPage[] = [];
    const MAX_CHARS_PER_PAGE = pageSize === 'A4' ? 2500 : 1200;

    project.ebook.pages.forEach(page => {
      if (page.type === 'content' && page.content.length > MAX_CHARS_PER_PAGE) {
        const words = page.content.split(' ');
        let currentChunk = '';
        let chunkIndex = 1;

        words.forEach(word => {
          if ((currentChunk + word).length > MAX_CHARS_PER_PAGE) {
            newPages.push({
              ...page,
              id: uuidv4(),
              title: chunkIndex === 1 ? page.title : `${page.title} (Cont.)`,
              content: currentChunk.trim(),
            });
            currentChunk = word + ' ';
            chunkIndex++;
          } else {
            currentChunk += word + ' ';
          }
        });

        if (currentChunk.trim()) {
          newPages.push({
            ...page,
            id: uuidv4(),
            title: `${page.title} (Fim)`,
            content: currentChunk.trim(),
          });
        }
      } else {
        newPages.push(page);
      }
    });

    setProject(prev => ({
      ...prev,
      ebook: prev.ebook ? { ...prev.ebook, pages: newPages } : undefined
    }));
    alert("Paginação concluída!");
  };

  const exportToHTML = () => {
    if (!project.ebook) return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${project.title}</title>
        <style>
          body { font-family: ${project.ebook.fontFamily || 'sans-serif'}; padding: 40px; line-height: 1.6; }
          .page { margin-bottom: 60px; page-break-after: always; max-width: 800px; margin-left: auto; margin-right: auto; }
          h1 { text-align: center; font-size: 3em; }
          h2 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
          img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 20px auto; }
          .content { font-size: ${project.ebook.fontSize || 16}px; }
        </style>
      </head>
      <body>
        ${project.ebook.pages.map(p => {
          if (p.type === 'blank') return '<div class="page"></div>';
          if (p.type === 'about') return `
            <div class="page" style="text-align: center; display: flex; flex-direction: column; justify-content: center; min-height: 80vh;">
              <h2 style="border-bottom: 4px solid #4f46e5; display: inline-block; margin: 0 auto 40px;">Sobre o Autor</h2>
              <p style="font-style: italic; font-size: 1.2em; max-width: 600px; margin: 0 auto;">${p.content}</p>
            </div>
          `;
          if (p.type === 'back-cover') return `
            <div class="page" style="text-align: center; display: flex; flex-direction: column; justify-content: space-between; min-height: 80vh;">
              <div style="margin-top: 100px;">
                <h1 style="font-size: 2.5em; margin-bottom: 40px;">K-Brothers Production</h1>
                ${p.imageUrl ? `<img src="${p.imageUrl}" style="max-width: 300px;" />` : ''}
                <h2 style="font-size: 1.5em; color: #666; border: none;">By Koelho2000</h2>
              </div>
              <div style="text-align: right; margin-top: auto; font-weight: bold; color: #999; font-size: 0.8em; letter-spacing: 2px;">
                ${new Date().toLocaleDateString('pt-PT')}
              </div>
            </div>
          `;
          return `
            <div class="page">
              ${p.imageUrl ? `<img src="${p.imageUrl}" />` : ''}
              <h2>${p.title}</h2>
              <div class="content" style="font-size: ${p.fontSize || project.ebook?.fontSize || 16}px;">${p.content.replace(/\n/g, '<br>')}</div>
            </div>
          `;
        }).join('')}
      </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title}.html`;
    a.click();
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: pageSize.toLowerCase()
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      for (let i = 0; i < (project.ebook?.pages.length || 0); i++) {
        const page = project.ebook!.pages[i];
        if (i > 0) doc.addPage();

        if (page.type === 'blank') continue;

        let y = margin;

        if (page.type === 'back-cover') {
          doc.setFontSize(24);
          doc.setFont("helvetica", "bold");
          doc.text("K-Brothers Production", pageWidth / 2, y + 40, { align: 'center' });
          
          if (page.imageUrl) {
            try {
              const imgData = await getBase64FromUrl(page.imageUrl);
              doc.addImage(imgData, 'JPEG', (pageWidth - 60) / 2, y + 60, 60, 60);
            } catch (e) {}
          }
          
          doc.setFontSize(18);
          doc.text("By Koelho2000", pageWidth / 2, y + 140, { align: 'center' });
          
          doc.setFontSize(10);
          doc.text(new Date().toLocaleDateString('pt-PT'), pageWidth - margin, pageHeight - margin, { align: 'right' });
          continue;
        }

        if (page.type === 'about') {
          doc.setFontSize(22);
          doc.setFont("helvetica", "bold");
          doc.text("Sobre o Autor", margin, y);
          y += 15;
          doc.setFontSize(14);
          doc.setFont("helvetica", "italic");
          const splitAbout = doc.splitTextToSize(page.content, contentWidth);
          doc.text(splitAbout, margin, y);
          continue;
        }

        // Normal content pages
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text(page.title, margin, y);
        y += 15;

        if (page.imageUrl) {
          try {
            const imgData = await getBase64FromUrl(page.imageUrl);
            // Simple logic for now, could be improved based on imagePosition
            doc.addImage(imgData, 'JPEG', margin, y, contentWidth, 100);
            y += 110;
          } catch (e) {}
        }

        doc.setFontSize(page.fontSize || project.ebook?.fontSize || 12);
        doc.setFont("helvetica", "normal");
        const splitText = doc.splitTextToSize(page.content, contentWidth);
        doc.text(splitText, margin, y);
      }

      doc.save(`${project.title}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Erro ao exportar PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToWord = () => {
    // Simple HTML-based Word export
    if (!project.ebook) return;
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><title>${project.title}</title></head>
      <body>
        ${project.ebook.pages.map(p => `
          <h1>${p.title}</h1>
          <p>${p.content.replace(/\n/g, '<br>')}</p>
          <br clear=all style='mso-break-type:section-break'>
        `).join('')}
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title}.doc`;
    a.click();
  };

  const exportToEPUB = () => {
    // Simple HTML-based EPUB (actually just a single HTML file that can be converted)
    exportToHTML();
    alert("O ficheiro HTML gerado pode ser convertido para EPUB usando ferramentas como o Calibre.");
  };

  const getBase64FromUrl = async (url: string): Promise<string> => {
    if (url.startsWith("data:")) return url;
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
                  style={{ 
                    fontFamily: currentPage?.fontFamily || project.ebook.fontFamily || 'inherit',
                    fontSize: `${currentPage?.fontSize || project.ebook.fontSize || 16}px`
                  }}
                >
                  <div className={`flex h-full ${
                    currentPage?.imagePosition === 'left' ? 'flex-row gap-8' : 
                    currentPage?.imagePosition === 'right' ? 'flex-row-reverse gap-8' : 
                    'flex-col'
                  }`}>
                    {currentPage?.imageUrl && (currentPage.imagePosition === 'top' || !currentPage.imagePosition) && 
                     currentPage.type !== 'back-cover' && currentPage.type !== 'blank' && currentPage.type !== 'about' && (
                      <div className="mb-8 rounded-xl overflow-hidden shadow-md aspect-video bg-zinc-100 shrink-0" style={{ width: `${currentPage.imageSize || 100}%`, alignSelf: 'center' }}>
                        <img 
                          src={currentPage.imageUrl} 
                          alt={currentPage.title}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    <div className="flex-1 flex flex-col min-w-0 h-full">
                      {currentPage?.type === 'blank' ? (
                        <div className="h-full flex items-center justify-center text-zinc-300 italic">
                          Página em branco
                        </div>
                      ) : currentPage?.type === 'about' ? (
                        <div className="h-full flex flex-col justify-center max-w-md mx-auto space-y-8">
                          <h2 className="text-3xl font-bold text-zinc-900 border-b-4 border-indigo-600 pb-4">Sobre o Autor</h2>
                          <div className="text-lg text-zinc-700 leading-relaxed italic">
                            {currentPage.content}
                          </div>
                        </div>
                      ) : currentPage?.type === 'back-cover' ? (
                        <div className="flex flex-col h-full justify-between py-12">
                          <div className="flex flex-col items-center gap-8">
                            <h2 className="text-3xl font-black text-zinc-900 tracking-tighter">K-Brothers Production</h2>
                            <div className="w-48 h-48 bg-zinc-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-zinc-200 overflow-hidden shadow-inner">
                              {currentPage.imageUrl ? (
                                <img src={currentPage.imageUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              ) : (
                                <ImageIcon className="w-12 h-12 text-zinc-300" />
                              )}
                            </div>
                            <p className="text-xl font-medium text-zinc-600">By Koelho2000</p>
                          </div>
                          <div className="text-right text-sm text-zinc-400 font-bold uppercase tracking-widest mt-auto">
                            {new Date().toLocaleDateString('pt-PT')}
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className={`font-bold text-zinc-900 mb-6 ${currentPage?.type === 'cover' ? 'text-4xl text-center mt-12' : 'text-2xl'}`}>
                            {currentPage?.title}
                          </h3>

                          {currentPage?.imageUrl && currentPage.imagePosition === 'between' && (
                            <div className="mb-6 rounded-xl overflow-hidden shadow-md aspect-video bg-zinc-100 shrink-0" style={{ width: `${currentPage.imageSize || 100}%`, alignSelf: 'center' }}>
                              <img 
                                src={currentPage.imageUrl} 
                                alt={currentPage.title}
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          
                          <div className={`text-zinc-700 leading-relaxed whitespace-pre-wrap flex-1 overflow-y-auto pr-2 custom-scrollbar ${currentPage?.type === 'cover' ? 'text-center text-lg italic' : ''}`}>
                            {currentPage?.content}
                          </div>
                        </>
                      )}
                    </div>

                    {currentPage?.imageUrl && (currentPage.imagePosition === 'left' || currentPage.imagePosition === 'right') && 
                     currentPage.type !== 'back-cover' && currentPage.type !== 'blank' && currentPage.type !== 'about' && (
                      <div className="rounded-xl overflow-hidden shadow-md bg-zinc-100 shrink-0" style={{ width: `${currentPage.imageSize || 40}%`, height: 'fit-content' }}>
                        <img 
                          src={currentPage.imageUrl} 
                          alt={currentPage.title}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    {currentPage?.imageUrl && currentPage.imagePosition === 'bottom' && 
                     currentPage.type !== 'back-cover' && currentPage.type !== 'blank' && currentPage.type !== 'about' && (
                      <div className="mt-8 rounded-xl overflow-hidden shadow-md aspect-video bg-zinc-100 shrink-0" style={{ width: `${currentPage.imageSize || 100}%`, alignSelf: 'center' }}>
                        <img 
                          src={currentPage.imageUrl} 
                          alt={currentPage.title}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-600" />
                  Editor de Página
                </h3>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="p-2 hover:bg-zinc-100 rounded-lg text-indigo-600 transition-all"
                  title="Exportar EBook"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2 mb-6">
                <button
                  onClick={handlePagination}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  Auto-Paginação
                </button>
              </div>

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

                    <div className="mt-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100 space-y-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Layout e Estilo</h4>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Posição da Imagem</label>
                          <div className="grid grid-cols-5 gap-1">
                            {IMAGE_POSITIONS.map(pos => (
                              <button
                                key={pos.id}
                                onClick={() => currentPage && setProject(prev => ({
                                  ...prev,
                                  ebook: prev.ebook ? {
                                    ...prev.ebook,
                                    pages: prev.ebook.pages.map(p => p.id === currentPage.id ? { ...p, imagePosition: pos.id as any } : p)
                                  } : undefined
                                }))}
                                className={`p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${currentPage?.imagePosition === pos.id || (!currentPage?.imagePosition && pos.id === 'top') ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300'}`}
                                title={pos.label}
                              >
                                <pos.icon className="w-4 h-4" />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Tamanho da Imagem ({currentPage?.imageSize || 100}%)</label>
                          <input 
                            type="range" 
                            min="10" 
                            max="100" 
                            value={currentPage?.imageSize || 100}
                            onChange={(e) => currentPage && setProject(prev => ({
                              ...prev,
                              ebook: prev.ebook ? {
                                ...prev.ebook,
                                pages: prev.ebook.pages.map(p => p.id === currentPage.id ? { ...p, imageSize: parseInt(e.target.value) } : p)
                              } : undefined
                            }))}
                            className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Fonte</label>
                            <select 
                              value={currentPage?.fontFamily || project.ebook.fontFamily || ""}
                              onChange={(e) => currentPage && setProject(prev => ({
                                ...prev,
                                ebook: prev.ebook ? {
                                  ...prev.ebook,
                                  pages: prev.ebook.pages.map(p => p.id === currentPage.id ? { ...p, fontFamily: e.target.value } : p)
                                } : undefined
                              }))}
                              className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-1.5 outline-none"
                            >
                              <option value="">Global</option>
                              {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Tamanho Letra</label>
                            <input 
                              type="number" 
                              value={currentPage?.fontSize || project.ebook.fontSize || 16}
                              onChange={(e) => currentPage && setProject(prev => ({
                                ...prev,
                                ebook: prev.ebook ? {
                                  ...prev.ebook,
                                  pages: prev.ebook.pages.map(p => p.id === currentPage.id ? { ...p, fontSize: parseInt(e.target.value) } : p)
                                } : undefined
                              }))}
                              className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-100">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-2">Estilo Global do EBook</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase mb-1">Fonte Global</label>
                            <select 
                              value={project.ebook.fontFamily || ""}
                              onChange={(e) => setProject(prev => ({
                                ...prev,
                                ebook: prev.ebook ? { ...prev.ebook, fontFamily: e.target.value } : undefined
                              }))}
                              className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-1.5 outline-none"
                            >
                              {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-zinc-400 uppercase mb-1">Tamanho Global</label>
                            <input 
                              type="number" 
                              value={project.ebook.fontSize || 16}
                              onChange={(e) => setProject(prev => ({
                                ...prev,
                                ebook: prev.ebook ? { ...prev.ebook, fontSize: parseInt(e.target.value) } : undefined
                              }))}
                              className="w-full text-xs bg-white border border-zinc-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

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
                        <div className="relative">
                          <button
                            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold transition-all border border-emerald-100 disabled:opacity-50"
                          >
                            <Upload className="w-4 h-4" />
                            Upload
                          </button>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleUploadUserImage}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                        <button
                          onClick={() => handleGeneratePageImage(currentPage.id)}
                          disabled={isGeneratingImage}
                          className="flex items-center justify-center gap-2 py-3 bg-white hover:bg-zinc-50 text-indigo-600 rounded-xl text-sm font-bold transition-all border border-zinc-200 disabled:opacity-50"
                        >
                          {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          Gerar IA
                        </button>
                        <button
                          onClick={handleDeleteImage}
                          className="flex items-center justify-center gap-2 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-sm font-bold transition-all border border-rose-100"
                        >
                          <Trash2 className="w-4 h-4" />
                          Apagar Imagem
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

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <FileOutput className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">Exportar EBook</h3>
                    <p className="text-sm text-zinc-500">Escolhe o formato de exportação desejado.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-500" />
                </button>
              </div>

              <div className="p-8 grid grid-cols-2 gap-4">
                <button
                  onClick={exportToPDF}
                  disabled={isExporting}
                  className="flex flex-col items-center gap-4 p-6 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-2xl transition-all group"
                >
                  <div className="w-16 h-16 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-rose-900">PDF</span>
                    <span className="text-xs text-rose-600">Ideal para impressão e leitura universal</span>
                  </div>
                </button>

                <button
                  onClick={exportToHTML}
                  className="flex flex-col items-center gap-4 p-6 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-2xl transition-all group"
                >
                  <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <Globe className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-indigo-900">HTML</span>
                    <span className="text-xs text-indigo-600">Versão web interativa</span>
                  </div>
                </button>

                <button
                  onClick={exportToWord}
                  className="flex flex-col items-center gap-4 p-6 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl transition-all group"
                >
                  <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <FileJson className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-blue-900">WORD</span>
                    <span className="text-xs text-blue-600">Documento editável (.doc)</span>
                  </div>
                </button>

                <button
                  onClick={exportToEPUB}
                  className="flex flex-col items-center gap-4 p-6 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-2xl transition-all group"
                >
                  <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <Book className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <span className="block font-bold text-emerald-900">EPUB</span>
                    <span className="text-xs text-emerald-600">Formato standard para E-Readers</span>
                  </div>
                </button>
              </div>

              {isExporting && (
                <div className="p-6 bg-zinc-50 border-t border-zinc-100">
                  <ProgressBar progress={50} label="A preparar ficheiros..." modelName="Exportador" />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                        <img src={img.url} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
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
