import React, { useState } from "react";
import { Project } from "../types";
import { 
  Download, 
  Maximize2, 
  X, 
  Image as ImageIcon, 
  Video as VideoIcon,
  ExternalLink,
  Library,
  CheckSquare,
  Square,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import IntelligentEditor from "./IntelligentEditor";

interface MediaLibraryProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  title: string;
  source: string;
}

export default function MediaLibrary({ project, setProject }: MediaLibraryProps) {
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');

  // Extract all media from project
  const mediaItems: MediaItem[] = [];

  // Characters
  project.characters.forEach(char => {
    if (char.imageUrl) {
      mediaItems.push({
        id: `char-img-${char.id}`,
        url: char.imageUrl,
        type: 'image',
        title: char.name,
        source: 'Personagem'
      });
    }
    if (char.viewsImageUrl) {
      mediaItems.push({
        id: `char-views-${char.id}`,
        url: char.viewsImageUrl,
        type: 'image',
        title: `${char.name} (Vistas)`,
        source: 'Personagem'
      });
    }
  });

  // Settings
  project.settings.forEach(set => {
    if (set.imageUrl) {
      mediaItems.push({
        id: `set-img-${set.id}`,
        url: set.imageUrl,
        type: 'image',
        title: set.name,
        source: 'Cenário'
      });
    }
  });

  // Scenes & Takes
  project.scenes.forEach((scene, sIdx) => {
    scene.takes.forEach((take, tIdx) => {
      const takeLabel = `C${sIdx + 1}.T${tIdx + 1}`;
      if (take.startFrameUrl) {
        mediaItems.push({
          id: `take-start-${take.id}`,
          url: take.startFrameUrl,
          type: 'image',
          title: `${takeLabel} - Frame Inicial`,
          source: 'Produção'
        });
      }
      if (take.endFrameUrl) {
        mediaItems.push({
          id: `take-end-${take.id}`,
          url: take.endFrameUrl,
          type: 'image',
          title: `${takeLabel} - Frame Final`,
          source: 'Produção'
        });
      }
      if (take.videoUrl) {
        mediaItems.push({
          id: `take-video-${take.id}`,
          url: take.videoUrl,
          type: 'video',
          title: `${takeLabel} - Vídeo`,
          source: 'Produção'
        });
      }
    });
  });

  // Intro & Outro
  if (project.intro) {
    if (project.intro.imageUrl) {
      mediaItems.push({
        id: 'intro-img',
        url: project.intro.imageUrl,
        type: 'image',
        title: 'Intro - Frame',
        source: 'Intro'
      });
    }
    if (project.intro.videoUrl) {
      mediaItems.push({
        id: 'intro-video',
        url: project.intro.videoUrl,
        type: 'video',
        title: 'Intro - Vídeo',
        source: 'Intro'
      });
    }
  }
  if (project.outro) {
    if (project.outro.imageUrl) {
      mediaItems.push({
        id: 'outro-img',
        url: project.outro.imageUrl,
        type: 'image',
        title: 'Créditos - Frame',
        source: 'Créditos'
      });
    }
    if (project.outro.videoUrl) {
      mediaItems.push({
        id: 'outro-video',
        url: project.outro.videoUrl,
        type: 'video',
        title: 'Créditos - Vídeo',
        source: 'Créditos'
      });
    }
  }

  const filteredItems = mediaItems.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    filteredItems.forEach((item, index) => {
      setTimeout(() => {
        handleDownload(item.url, `${item.title.replace(/\s+/g, '_')}.${item.type === 'image' ? 'png' : 'mp4'}`);
      }, index * 200);
    });
  };

  const handleDownloadSelected = () => {
    const itemsToDownload = filteredItems.filter(item => selectedIds.has(item.id));
    itemsToDownload.forEach((item, index) => {
      setTimeout(() => {
        handleDownload(item.url, `${item.title.replace(/\s+/g, '_')}.${item.type === 'image' ? 'png' : 'mp4'}`);
      }, index * 200);
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.every(item => selectedIds.has(item.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    }
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSaveEdit = (newUrl: string) => {
    if (!editingItem) return;

    setProject(prev => {
      const newProject = { ...prev };
      const id = editingItem.id;

      if (id.startsWith('char-img-')) {
        const charId = id.replace('char-img-', '');
        newProject.characters = newProject.characters.map(c => c.id === charId ? { ...c, imageUrl: newUrl } : c);
      } else if (id.startsWith('char-views-')) {
        const charId = id.replace('char-views-', '');
        newProject.characters = newProject.characters.map(c => c.id === charId ? { ...c, viewsImageUrl: newUrl } : c);
      } else if (id.startsWith('set-img-')) {
        const setId = id.replace('set-img-', '');
        newProject.settings = newProject.settings.map(s => s.id === setId ? { ...s, imageUrl: newUrl } : s);
      } else if (id.startsWith('take-start-')) {
        const takeId = id.replace('take-start-', '');
        newProject.scenes = newProject.scenes.map(s => ({
          ...s,
          takes: s.takes.map(t => t.id === takeId ? { ...t, startFrameUrl: newUrl } : t)
        }));
      } else if (id.startsWith('take-end-')) {
        const takeId = id.replace('take-end-', '');
        newProject.scenes = newProject.scenes.map(s => ({
          ...s,
          takes: s.takes.map(t => t.id === takeId ? { ...t, endFrameUrl: newUrl } : t)
        }));
      } else if (id.startsWith('take-video-')) {
        const takeId = id.replace('take-video-', '');
        newProject.scenes = newProject.scenes.map(s => ({
          ...s,
          takes: s.takes.map(t => t.id === takeId ? { ...t, videoUrl: newUrl } : t)
        }));
      } else if (id === 'intro-img') {
        if (newProject.intro) newProject.intro.imageUrl = newUrl;
      } else if (id === 'intro-video') {
        if (newProject.intro) newProject.intro.videoUrl = newUrl;
      } else if (id === 'outro-img') {
        if (newProject.outro) newProject.outro.imageUrl = newUrl;
      } else if (id === 'outro-video') {
        if (newProject.outro) newProject.outro.videoUrl = newUrl;
      }

      return newProject;
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <Library className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-zinc-900">Biblioteca de Media</h2>
            <p className="text-zinc-500 mt-1">Gere, visualize e descarregue todos os recursos visuais do seu projeto.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDownloadSelected}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Descarregar Selecionados ({selectedIds.size})
            </button>
          )}
            <button
              onClick={handleDownloadAll}
              disabled={filteredItems.length === 0}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              Descarregar {filter === 'all' ? 'Tudo' : filter === 'image' ? 'Imagens' : 'Vídeos'} ({filteredItems.length})
            </button>
          </div>
        </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex bg-zinc-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 md:flex-none px-6 py-2 text-xs font-bold rounded-lg transition-all ${
              filter === 'all' ? "bg-white shadow-sm text-indigo-600" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            TUDO ({mediaItems.length})
          </button>
          <button
            onClick={() => setFilter('image')}
            className={`flex-1 md:flex-none px-6 py-2 text-xs font-bold rounded-lg transition-all ${
              filter === 'image' ? "bg-white shadow-sm text-indigo-600" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            IMAGENS ({mediaItems.filter(i => i.type === 'image').length})
          </button>
          <button
            onClick={() => setFilter('video')}
            className={`flex-1 md:flex-none px-6 py-2 text-xs font-bold rounded-lg transition-all ${
              filter === 'video' ? "bg-white shadow-sm text-indigo-600" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            VÍDEOS ({mediaItems.filter(i => i.type === 'video').length})
          </button>
        </div>

        {filteredItems.length > 0 && (
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-zinc-200 w-full md:w-auto">
            <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-indigo-600 transition-colors"
            >
              {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              Selecionar Visíveis
            </button>
            <span className="text-zinc-300">|</span>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              {selectedIds.size} Selecionados
            </span>
          </div>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-zinc-200 rounded-3xl p-20 text-center">
          <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="w-10 h-10 text-zinc-300" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">Nenhum media gerado</h3>
          <p className="text-zinc-500 max-w-xs mx-auto mt-2">Comece a gerar personagens, cenários ou takes para ver os ficheiros aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredItems.map((item) => (
            <div 
              key={item.id}
              onClick={() => toggleItemSelection(item.id)}
              className={`group bg-white rounded-2xl border transition-all flex flex-col cursor-pointer relative ${
                selectedIds.has(item.id) ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-zinc-200 hover:border-zinc-300 shadow-sm hover:shadow-md'
              }`}
            >
              <div className="aspect-square bg-zinc-100 relative overflow-hidden">
                {item.type === 'image' ? (
                  <img 
                    src={item.url} 
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <video 
                      src={item.url} 
                      className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <VideoIcon className="w-10 h-10 text-white drop-shadow-lg" />
                    </div>
                  </div>
                )}
                
                {/* Selection Checkbox (always visible if selected, or on hover) */}
                <div className={`absolute top-2 right-2 z-10 transition-opacity ${selectedIds.has(item.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 ${
                    selectedIds.has(item.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/80 border-white text-zinc-400'
                  }`}>
                    {selectedIds.has(item.id) ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-zinc-200" />}
                  </div>
                </div>

                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => setEditingItem(item)}
                    className="p-2 bg-indigo-600 rounded-full text-white hover:scale-110 transition-transform"
                    title="Edição Inteligente"
                  >
                    <Sparkles className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setSelectedItem(item)}
                    className="p-2 bg-white rounded-full text-zinc-900 hover:scale-110 transition-transform"
                    title="Maximizar"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDownload(item.url, `${item.title.replace(/\s+/g, '_')}.${item.type === 'image' ? 'png' : 'mp4'}`)}
                    className="p-2 bg-white rounded-full text-zinc-900 hover:scale-110 transition-transform"
                    title="Descarregar"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>

                {/* Badge */}
                <div className="absolute top-2 left-2">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shadow-sm ${
                    item.type === 'image' ? 'bg-white text-zinc-900' : 'bg-emerald-500 text-white'
                  }`}>
                    {item.type}
                  </span>
                </div>
              </div>
              
              <div className="p-3">
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-0.5">
                  {item.source}
                </div>
                <h4 className="text-xs font-bold text-zinc-900 truncate" title={item.title}>
                  {item.title}
                </h4>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Screen Preview Modal */}
      {editingItem && (
        <IntelligentEditor 
          mediaItem={editingItem}
          aspectRatio={project.aspectRatio}
          onSave={handleSaveEdit}
          onClose={() => setEditingItem(null)}
        />
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-10 animate-in fade-in duration-300">
          <button 
            onClick={() => setSelectedItem(null)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10"
          >
            <X className="w-8 h-8" />
          </button>

          <div className="w-full h-full flex flex-col items-center justify-center gap-6">
            <div className="relative max-w-full max-h-[80vh] flex items-center justify-center">
              {selectedItem.type === 'image' ? (
                <img 
                  src={selectedItem.url} 
                  alt={selectedItem.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <video 
                  src={selectedItem.url} 
                  controls 
                  autoPlay
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                />
              )}
            </div>

            <div className="text-center space-y-2">
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                {selectedItem.source}
              </div>
              <h3 className="text-2xl font-bold text-white">{selectedItem.title}</h3>
              <div className="flex items-center justify-center gap-4 pt-4">
                <button
                  onClick={() => handleDownload(selectedItem.url, `${selectedItem.title.replace(/\s+/g, '_')}.${selectedItem.type === 'image' ? 'png' : 'mp4'}`)}
                  className="bg-white text-zinc-900 px-8 py-3 rounded-2xl font-bold hover:bg-zinc-100 transition-all flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Descarregar Ficheiro
                </button>
                <a 
                  href={selectedItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-zinc-800 text-white px-8 py-3 rounded-2xl font-bold hover:bg-zinc-700 transition-all flex items-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  Abrir Original
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
