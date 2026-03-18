import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Save, FolderOpen } from 'lucide-react';

interface ProjectProgressOverlayProps {
  isOpen: boolean;
  type: 'save' | 'load';
  progress: number;
  description: string;
  timeRemaining?: number;
}

export function ProjectProgressOverlay({
  isOpen,
  type,
  progress,
  description,
  timeRemaining
}: ProjectProgressOverlayProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
          {progress === 100 ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          ) : type === 'save' ? (
            <Save className="w-8 h-8 text-indigo-500 animate-pulse" />
          ) : (
            <FolderOpen className="w-8 h-8 text-indigo-500 animate-pulse" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          {type === 'save' ? 'A Gravar Projeto' : 'A Carregar Projeto'}
        </h2>
        
        <p className="text-zinc-400 mb-8 min-h-[24px]">
          {description}{progress < 100 ? dots : ''}
        </p>

        <div className="w-full bg-zinc-800 rounded-full h-3 mb-4 overflow-hidden">
          <div 
            className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="w-full flex justify-between items-center text-sm font-medium">
          <span className="text-indigo-400">{Math.round(progress)}%</span>
          {timeRemaining !== undefined && progress < 100 && (
            <span className="text-zinc-500">
              Tempo estimado: {timeRemaining}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
