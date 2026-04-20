import {
  Save,
  Upload,
  Plus,
  Sparkles,
  RefreshCw,
  Menu,
  LayoutList,
  BookOpen,
  Library
} from "lucide-react";
import { ChangeEvent, useRef } from "react";

interface TopBarProps {
  currentStep: number;
  setStep: (step: number) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  onNewProject: () => void;
  onLoad: (e: ChangeEvent<HTMLInputElement>) => void;
  onSaveClick: () => void;
  onOpenIntelligentGenerator: () => void;
  onOpenUpdateMovie: () => void;
  hasUnsavedChanges: boolean;
}

export default function TopBar({
  currentStep,
  setStep,
  isSidebarOpen,
  setSidebarOpen,
  onNewProject,
  onLoad,
  onSaveClick,
  onOpenIntelligentGenerator,
  onOpenUpdateMovie,
  hasUnsavedChanges
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="h-16 bg-[#18181b] border-b border-zinc-800 flex items-center px-4 shadow-sm z-40 gap-3 overflow-x-auto custom-scrollbar shrink-0">
      <button
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
        title="Ocultar/Mostrar Menu Lateral"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="h-8 w-px bg-zinc-800 shrink-0 mx-1" />

      {/* Main Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onNewProject}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium text-emerald-400 hover:bg-emerald-500/10"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Projeto</span>
        </button>
        
        <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium text-sky-400 hover:bg-sky-500/10 cursor-pointer relative">
          <input
            type="file"
            accept=".json"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={onLoad}
            ref={fileInputRef}
          />
          <Upload className="w-4 h-4" />
          <span>Carregar...</span>
        </label>

        <button
          onClick={onSaveClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
            hasUnsavedChanges
              ? "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border border-indigo-500/30"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
          title="Gravar estado completo do projeto (JSON)"
        >
          <Save className="w-4 h-4" />
          <span>Gravar em JSON</span>
        </button>
      </div>

      <div className="h-8 w-px bg-zinc-800 shrink-0 mx-1" />

      {/* Views */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setStep(10)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            currentStep === 10
              ? "bg-teal-500/10 text-teal-400"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
        >
          <Library className={`w-4 h-4 ${currentStep === 10 ? "text-teal-400" : "text-zinc-500"}`} />
          <span className="whitespace-nowrap">Biblioteca de Media</span>
        </button>

        <button
          onClick={() => setStep(9)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            currentStep === 9
              ? "bg-amber-500/10 text-amber-500"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
        >
          <LayoutList className={`w-4 h-4 ${currentStep === 9 ? "text-amber-500" : "text-zinc-500"}`} />
          <span className="whitespace-nowrap">Quadro Resumo</span>
        </button>

        <button
          onClick={() => setStep(12)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            currentStep === 12
              ? "bg-rose-500/10 text-rose-500"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
        >
          <BookOpen className={`w-4 h-4 ${currentStep === 12 ? "text-rose-500" : "text-zinc-500"}`} />
          <span className="whitespace-nowrap">EBook</span>
        </button>
      </div>

      <div className="h-8 w-px bg-zinc-800 shrink-0 mx-1" />

      {/* Tools / Features */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenIntelligentGenerator}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium text-pink-400 hover:bg-pink-500/10"
        >
          <Sparkles className="w-4 h-4" />
          <span>Estúdio</span>
        </button>

        <button
          onClick={onOpenUpdateMovie}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium text-violet-400 hover:bg-violet-500/10"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Update Filme</span>
        </button>
      </div>

    </div>
  );
}
