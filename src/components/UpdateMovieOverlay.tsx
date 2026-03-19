import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { X, Play, Pause, CheckSquare, Square, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { analyzeProjectForUpdates } from '../services/geminiService';

interface UpdateMovieOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export interface UpdateTask {
  id: string;
  category: string;
  title: string;
  description: string;
  action: 'create' | 'update' | 'delete';
  target: 'character' | 'setting' | 'scene' | 'soundtrack' | 'story' | 'script';
  data?: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  selected: boolean;
}

export function UpdateMovieOverlay({ isOpen, onClose, project, setProject }: UpdateMovieOverlayProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tasks, setTasks] = useState<UpdateTask[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTotalTime, setEstimatedTotalTime] = useState(0);
  
  const timerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (isOpen) {
      setIsRunning(false);
      setIsPaused(false);
      setProgress(0);
      setElapsedTime(0);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      handleAnalyze();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isPaused]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setTasks([]);
    try {
      const suggestedTasks = await analyzeProjectForUpdates(project);
      setTasks(suggestedTasks.map(t => ({ ...t, status: 'pending', selected: true })));
    } catch (error) {
      console.error("Erro ao analisar projeto:", error);
      alert("Erro ao analisar o projeto. Tenta novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    if (isRunning) return;
    setTasks(tasks.map(t => t.id === taskId ? { ...t, selected: !t.selected } : t));
  };

  const toggleAllSelection = () => {
    if (isRunning) return;
    const allSelected = tasks.every(t => t.selected);
    setTasks(tasks.map(t => ({ ...t, selected: !allSelected })));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const executeTasks = async () => {
    const selectedTasks = tasks.filter(t => t.selected && t.status !== 'completed');
    if (selectedTasks.length === 0) return;

    setIsRunning(true);
    setIsPaused(false);
    setElapsedTime(0);
    
    // Estimativa simples: 5 segundos por tarefa
    setEstimatedTotalTime(selectedTasks.length * 5);

    abortControllerRef.current = new AbortController();

    let completedCount = 0;
    let currentProject = { ...project };

    for (let i = 0; i < tasks.length; i++) {
      if (abortControllerRef.current?.signal.aborted) break;
      
      const task = tasks[i];
      if (!task.selected || task.status === 'completed') continue;

      // Update task status to running
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'running' } : t));

      try {
        // Apply the suggested data directly if provided
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate some work for UI feedback

        if (task.target === 'character') {
          if (task.action === 'create' && task.data) {
            currentProject.characters = [...currentProject.characters, task.data];
          } else if (task.action === 'update' && task.data) {
            currentProject.characters = currentProject.characters.map(c => c.id === task.data.id ? { ...c, ...task.data } : c);
          } else if (task.action === 'delete' && task.data) {
            currentProject.characters = currentProject.characters.filter(c => c.id !== task.data.id);
          }
        } else if (task.target === 'setting') {
          if (task.action === 'create' && task.data) {
            currentProject.settings = [...currentProject.settings, task.data];
          } else if (task.action === 'update' && task.data) {
            currentProject.settings = currentProject.settings.map(s => s.id === task.data.id ? { ...s, ...task.data } : s);
          } else if (task.action === 'delete' && task.data) {
            currentProject.settings = currentProject.settings.filter(s => s.id !== task.data.id);
          }
        } else if (task.target === 'scene') {
          if (task.action === 'create' && task.data) {
            currentProject.scenes = [...currentProject.scenes, task.data];
          } else if (task.action === 'update' && task.data) {
            currentProject.scenes = currentProject.scenes.map(s => s.id === task.data.id ? { ...s, ...task.data } : s);
          } else if (task.action === 'delete' && task.data) {
            currentProject.scenes = currentProject.scenes.filter(s => s.id !== task.data.id);
          }
        } else if (task.target === 'soundtrack') {
          if (task.action === 'update' && task.data) {
            currentProject.scenes = currentProject.scenes.map(s => s.id === task.data.sceneId ? { ...s, soundtrack: { ...s.soundtrack, ...task.data } } : s);
          }
        } else if (task.target === 'story') {
          if (task.action === 'update' && task.data) {
            if (task.data.idea) currentProject.idea = task.data.idea;
            if (task.data.concept) currentProject.concept = task.data.concept;
          }
        } else if (task.target === 'script') {
          if (task.action === 'update' && task.data) {
            currentProject.script = task.data.script;
          }
        }

        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed' } : t));
        completedCount++;
        setProgress((completedCount / selectedTasks.length) * 100);
        setProject(currentProject);
      } catch (error) {
        console.error(`Erro na tarefa ${task.id}:`, error);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error' } : t));
      }

      // Check pause state
      while (isPausedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (abortControllerRef.current?.signal.aborted) break;
      }
    }

    setIsRunning(false);
    setIsPaused(false);
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
    setIsPaused(false);
  };

  if (!isOpen) return null;

  const selectedCount = tasks.filter(t => t.selected).length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <RefreshCw className={`w-5 h-5 text-indigo-600 ${isAnalyzing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Update Filme</h3>
              <p className="text-sm text-zinc-500">Análise e sincronização de todos os elementos do projeto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning && !isPaused}
            className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/30">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
              <p className="font-medium">A analisar o projeto...</p>
              <p className="text-sm text-center max-w-md">
                A verificar a Configuração do Projeto, Guião, História, Personagens, Cenários, Soundtrack e Timelapse para identificar inconsistências.
              </p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="font-medium text-lg text-zinc-900">O projeto está atualizado!</p>
              <p className="text-sm text-center max-w-md">
                Não foram encontradas inconsistências ou elementos em falta no teu projeto.
              </p>
              <button
                onClick={handleAnalyze}
                className="mt-4 px-4 py-2 bg-white border border-zinc-200 rounded-xl font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Analisar Novamente
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-zinc-900">Diferenças e Sugestões Encontradas ({tasks.length})</h4>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleAnalyze}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar Análise
                  </button>
                  <button
                    onClick={toggleAllSelection}
                    disabled={isRunning}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                  >
                    {tasks.every(t => t.selected) ? "Desmarcar Tudo" : "Selecionar Tudo"}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {tasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={() => toggleTaskSelection(task.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      task.selected 
                        ? 'bg-indigo-50/50 border-indigo-200' 
                        : 'bg-white border-zinc-200 hover:border-indigo-200'
                    } ${isRunning ? 'pointer-events-none opacity-80' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : task.status === 'running' ? (
                          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                        ) : task.status === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-rose-500" />
                        ) : task.selected ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 text-zinc-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 uppercase tracking-wider">
                            {task.category}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            task.action === 'create' ? 'bg-emerald-100 text-emerald-700' :
                            task.action === 'update' ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {task.action === 'create' ? 'Criar' : task.action === 'update' ? 'Atualizar' : 'Remover'}
                          </span>
                        </div>
                        <h5 className="font-bold text-zinc-900">{task.title}</h5>
                        <p className="text-sm text-zinc-600 mt-1">{task.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {(isRunning || progress > 0) && (
          <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-zinc-900">
                Progresso: {completedCount} de {selectedCount} tarefas
              </span>
              <span className="text-sm font-medium text-zinc-500">
                {formatTime(elapsedTime)} / ~{formatTime(estimatedTotalTime)}
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${isPaused ? 'bg-amber-500' : 'bg-indigo-600'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs font-bold text-indigo-600">{Math.round(progress)}% Concluído</span>
              <span className="text-xs text-zinc-500">
                {isPaused ? 'Em pausa' : isRunning ? 'A executar...' : 'Concluído'}
              </span>
            </div>
          </div>
        )}

        <div className="p-6 border-t border-zinc-100 bg-white flex justify-between items-center">
          <div>
            {!isAnalyzing && tasks.length > 0 && !isRunning && progress === 0 && (
              <span className="text-sm text-zinc-500">
                {selectedCount} tarefas selecionadas
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {isRunning || isPaused ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-6 py-2.5 rounded-xl font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePauseResume}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? 'Retomar' : 'Pausar'}
                </button>
              </>
            ) : progress === 100 ? (
              <>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setProgress(0);
                    setElapsedTime(0);
                    handleAnalyze();
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Verificar Alterações
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={executeTasks}
                  disabled={isAnalyzing || tasks.length === 0 || selectedCount === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Aplicar Alterações
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
