import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import { Film, ArrowRight, Globe, User, Calendar, Tag, Plus, Upload, Loader2, Info } from "lucide-react";
import { Project } from "../types";
import { v4 as uuidv4 } from "uuid";
import { ProjectProgressOverlay } from "./ProjectProgressOverlay";

interface WelcomeProps {
  onStart: (project?: Project) => void;
}

export default function Welcome({ onStart }: WelcomeProps) {
  const version = "V4.0.0";
  const date = "19/03/2026";

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Overlay state
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [overlayDescription, setOverlayDescription] = useState('');
  const [overlaySteps, setOverlaySteps] = useState<{label: string, status: 'pending'|'current'|'completed'}[]>([]);
  const [overlayTime, setOverlayTime] = useState<number | undefined>(undefined);

  const handleCreateProject = () => {
    onStart(); // Starts with empty project
  };

  const handleLoadProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOverlayOpen(true);
    setOverlayProgress(10);
    setOverlayDescription('A ler ficheiro do projeto');
    setOverlayTime(3);
    setOverlaySteps([
      { label: 'A ler ficheiro', status: 'current' },
      { label: 'A analisar estrutura', status: 'pending' },
      { label: 'A carregar recursos', status: 'pending' }
    ]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setOverlayProgress(40);
        setOverlayDescription('A analisar estrutura do projeto');
        setOverlaySteps([
          { label: 'A ler ficheiro', status: 'completed' },
          { label: 'A analisar estrutura', status: 'current' },
          { label: 'A carregar recursos', status: 'pending' }
        ]);
        setOverlayTime(2);
        
        await new Promise(r => setTimeout(r, 800));
        
        const json = JSON.parse(event.target?.result as string);
        
        setOverlayProgress(80);
        setOverlayDescription('A carregar recursos e imagens');
        setOverlaySteps([
          { label: 'A ler ficheiro', status: 'completed' },
          { label: 'A analisar estrutura', status: 'completed' },
          { label: 'A carregar recursos', status: 'current' }
        ]);
        setOverlayTime(1);
        
        await new Promise(r => setTimeout(r, 800));
        
        setOverlayProgress(100);
        setOverlayDescription('Projeto carregado com sucesso!');
        setOverlaySteps([
          { label: 'A ler ficheiro', status: 'completed' },
          { label: 'A analisar estrutura', status: 'completed' },
          { label: 'A carregar recursos', status: 'completed' }
        ]);
        setOverlayTime(0);
        
        await new Promise(r => setTimeout(r, 1000));
        setIsOverlayOpen(false);
        onStart(json);
        
      } catch (error) {
        console.error("Erro ao carregar projeto:", error);
        alert("Erro ao carregar o ficheiro JSON.");
        setIsOverlayOpen(false);
      }
    };
    reader.readAsText(file);
    
    // Reset file input so the same file can be loaded again
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Left Panel - Branding */}
      <div className="w-1/2 flex flex-col items-center justify-center p-12 relative z-10 border-r border-zinc-800/50 bg-zinc-900/20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center justify-center w-24 h-24 bg-indigo-600 rounded-3xl mb-8 shadow-2xl shadow-indigo-500/20"
        >
          <Film className="w-12 h-12 text-white" />
        </motion.div>

        <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tighter text-center">
          K-ANIMAKER<br />
          <span className="text-indigo-500">PRO STUDIO</span>
        </h1>

        <p className="text-zinc-400 text-lg mb-12 max-w-md mx-auto leading-relaxed text-center">
          A plataforma definitiva para realizadores de animação. 
          Gera guiões, personagens e vídeos com o poder da Inteligência Artificial.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-12 w-full max-w-md">
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <Tag className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Versão</div>
            <div className="text-sm font-bold text-zinc-200">{version}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <Calendar className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Data</div>
            <div className="text-sm font-bold text-zinc-200">{date}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <User className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Autor</div>
            <div className="text-sm font-bold text-zinc-200">Koelho2000</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <Globe className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Website</div>
            <a href="https://www.koelho2000.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-indigo-400 hover:underline">
              koelho2000.com
            </a>
          </div>
        </div>
      </div>

      {/* Right Panel - Local Projects */}
      <div className="w-1/2 flex flex-col p-12 relative z-10 justify-center items-center">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Começar</h2>
            <p className="text-zinc-400">Crie um novo projeto ou carregue um ficheiro JSON existente.</p>
          </div>

          <button
            onClick={handleCreateProject}
            className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all hover:scale-105 shadow-xl shadow-indigo-500/20"
          >
            <Plus className="w-6 h-6" />
            <span className="text-lg">Novo Projeto</span>
          </button>

          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink-0 mx-4 text-zinc-500 text-sm">OU</span>
            <div className="flex-grow border-t border-zinc-800"></div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-bold transition-all hover:scale-105 border border-zinc-700"
          >
            <Upload className="w-6 h-6" />
            <span className="text-lg">Carregar Projeto (JSON)</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLoadProject}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>
      
      <ProjectProgressOverlay
        isOpen={isOverlayOpen}
        type="load"
        progress={overlayProgress}
        description={overlayDescription}
        steps={overlaySteps}
        timeRemaining={overlayTime}
      />
    </div>
  );
}
