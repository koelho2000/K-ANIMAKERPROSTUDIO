import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Save, FolderOpen, Circle, CheckCircle, Database, ArrowRight } from 'lucide-react';

interface ProjectProgressOverlayProps {
  isOpen: boolean;
  type: 'save' | 'load';
  progress: number;
  description: string;
  timeRemaining?: number;
  steps?: { label: string; status: 'pending' | 'current' | 'completed' }[];
  summary?: {
    sizeBefore: number;
    sizeAfter: number;
    changes: string[];
  };
  onClose?: () => void;
}

export function ProjectProgressOverlay({
  isOpen,
  type,
  progress,
  description,
  timeRemaining,
  steps,
  summary,
  onClose
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
        
        <p className="text-zinc-400 mb-6 min-h-[24px]">
          {description}{progress < 100 ? dots : ''}
        </p>

        {steps && steps.length > 0 && progress < 100 && (
          <div className="w-full text-left bg-zinc-950/50 rounded-xl p-4 mb-6 border border-zinc-800/50">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Progresso</h3>
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {step.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : step.status === 'current' ? (
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-700" />
                  )}
                  <span className={`text-sm ${
                    step.status === 'completed' ? 'text-zinc-300' :
                    step.status === 'current' ? 'text-indigo-400 font-medium' :
                    'text-zinc-600'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary && progress === 100 && (
          <div className="w-full text-left bg-zinc-950/50 rounded-xl p-4 mb-6 border border-zinc-800/50 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Resumo da Gravação</h3>
            
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 mb-4 border border-zinc-800">
              <div className="flex flex-col items-center">
                <span className="text-xs text-zinc-500 mb-1">Antes</span>
                <span className="text-sm font-mono text-zinc-300">{(summary.sizeBefore / 1024).toFixed(1)} KB</span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600" />
              <div className="flex flex-col items-center">
                <span className="text-xs text-zinc-500 mb-1">Depois</span>
                <span className="text-sm font-mono text-indigo-400">{(summary.sizeAfter / 1024).toFixed(1)} KB</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs text-zinc-500">Alterações detetadas:</span>
              <ul className="space-y-1">
                {summary.changes.map((change, idx) => (
                  <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                    <span className="text-indigo-500 mt-1">•</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {progress < 100 ? (
          <>
            <div className="w-full bg-zinc-800 rounded-full h-3 mb-4 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="w-full flex justify-between items-center text-sm font-medium">
              <span className="text-indigo-400">{Math.round(progress)}%</span>
              {timeRemaining !== undefined && (
                <span className="text-zinc-500">
                  Tempo estimado: {timeRemaining}s
                </span>
              )}
            </div>
          </>
        ) : (
          onClose && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors mt-2"
            >
              Concluir
            </button>
          )
        )}
      </div>
    </div>
  );
}
