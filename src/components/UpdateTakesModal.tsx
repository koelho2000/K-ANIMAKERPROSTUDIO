import React, { useState, useEffect } from 'react';
import { Project, Scene, Take } from '../types';
import { Loader2, CheckCircle2, XCircle, AlertCircle, ArrowRight, Image as ImageIcon, FileText, Layers } from 'lucide-react';
import { generateJSON } from '../services/geminiService';
import { Type } from '@google/genai';

interface UpdateTask {
  sceneId: string;
  sceneTitle: string;
  takeId: string;
  takeIndex: number;
  status: 'pending' | 'analyzing' | 'applying' | 'done' | 'error';
  changeType?: 'text' | 'none';
  details?: string;
  error?: string;
  changes?: {
    action?: { old: string, new: string };
    camera?: { old: string, new: string };
    sound?: { old: string, new: string };
    dialogue?: { old: string, new: string };
  };
}

interface UpdateTakesModalProps {
  project: Project;
  setProject: (project: Project) => void;
  onClose: () => void;
  triggerType: 'characters' | 'settings';
}

export const UpdateTakesModal: React.FC<UpdateTakesModalProps> = ({
  project,
  setProject,
  onClose,
  triggerType
}) => {
  const [tasks, setTasks] = useState<UpdateTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Initialize tasks based on outdated takes
    const newTasks: UpdateTask[] = [];
    
    project.scenes.forEach(scene => {
      scene.takes.forEach((take, index) => {
        let isOutdated = false;
        
        if (triggerType === 'characters') {
          const takeCharacters = project.characters.filter(c => take.characterIds?.includes(c.id));
          isOutdated = takeCharacters.some(c => c.updatedAt && c.updatedAt > (take.updatedAt || 0));
        } else {
          const takeSetting = project.settings.find(s => s.id === take.settingId);
          isOutdated = !!(takeSetting && takeSetting.updatedAt && takeSetting.updatedAt > (take.updatedAt || 0));
        }

        if (isOutdated) {
          newTasks.push({
            sceneId: scene.id,
            sceneTitle: scene.title,
            takeId: take.id,
            takeIndex: index,
            status: 'pending'
          });
        }
      });
    });
    
    setTasks(newTasks);
  }, [project, triggerType]);

  const startUpdate = async () => {
    setIsProcessing(true);
    const updatedScenes = [...project.scenes];
    let hasChanges = false;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Update task status to analyzing
      setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'analyzing' } : t));
      
      try {
        const sceneIndex = updatedScenes.findIndex(s => s.id === task.sceneId);
        const scene = updatedScenes[sceneIndex];
        const takeIndex = scene.takes.findIndex(t => t.id === task.takeId);
        const take = scene.takes[takeIndex];

        const charactersContext = project.characters
          .map((c) => `${c.name}: ${c.description} (Estilo: ${c.artisticStyle || 'N/A'})`)
          .join("\n");
        const settingsContext = project.settings
          .map((s) => `${s.name}: ${s.description}`)
          .join("\n");

        const prompt = `
          O utilizador atualizou as descrições de personagens ou cenários.
          Precisamos de analisar se o seguinte take precisa de ser reescrito.

          Cena: ${scene.title}
          Público Alvo: ${project.targetAudience || 'Adultos'}
          
          Take Atual:
          Ação: ${take.action}
          Câmara: ${take.camera}
          Som: ${take.sound}
          Diálogo: ${take.dialogue}
          
          Contexto Atualizado de Personagens:
          ${charactersContext}
          
          Contexto Atualizado de Cenários:
          ${settingsContext}

          Analisa as alterações e determina o 'changeType':
          - 'text': se a ação, câmara, som ou diálogo precisam de ser reescritos para refletir a nova personalidade, história ou contexto (ex: a personagem agora é má, o cenário agora é uma ruína).
          - 'none': se as alterações não afetam o texto deste take de todo (ex: apenas a aparência visual mudou).

          Fornece também uma breve justificação ('details') do porquê dessa decisão em Português.

          Se o 'changeType' for 'text', fornece o novo texto para o take (action, camera, sound, dialogue) e identifica as personagens e cenário.
          Se for 'none', podes deixar os campos de texto vazios.
        `;

        const schema = {
          type: Type.OBJECT,
          properties: {
            changeType: { type: Type.STRING, enum: ['text', 'none'] },
            details: { type: Type.STRING },
            action: { type: Type.STRING },
            camera: { type: Type.STRING },
            sound: { type: Type.STRING },
            dialogue: { type: Type.STRING },
            characterNames: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            settingName: { type: Type.STRING },
            dialogueLines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  characterName: { type: Type.STRING },
                  text: { type: Type.STRING },
                },
                required: ["characterName", "text"],
              },
            },
          },
          required: ["changeType", "details"],
        };

        const t = await generateJSON(
          prompt,
          schema,
          "És um realizador de cinema e diretor de arte a analisar alterações num guião."
        );
        
        let changes: UpdateTask['changes'] = undefined;
        
        if (t.changeType === 'text') {
          changes = {};
          if (t.action && t.action !== take.action) changes.action = { old: take.action, new: t.action };
          if (t.camera && t.camera !== take.camera) changes.camera = { old: take.camera, new: t.camera };
          if (t.sound && t.sound !== take.sound) changes.sound = { old: take.sound, new: t.sound };
          if (t.dialogue && t.dialogue !== take.dialogue) changes.dialogue = { old: take.dialogue, new: t.dialogue };
        }

        setTasks(prev => prev.map((tk, idx) => idx === i ? { 
          ...tk, 
          status: 'applying',
          changeType: t.changeType,
          details: t.details,
          changes
        } : tk));

        if (t.changeType !== 'none') {
          hasChanges = true;
          
          const updatedTake = { ...take };
          
          if (t.changeType === 'text') {
            updatedTake.action = t.action || take.action;
            updatedTake.camera = t.camera || take.camera;
            updatedTake.sound = t.sound || take.sound;
            updatedTake.dialogue = t.dialogue || take.dialogue;
            
            if (t.dialogueLines) {
              updatedTake.dialogueLines = t.dialogueLines.map((dl: any) => ({
                characterId: project.characters.find((c) => 
                  c.name.toLowerCase() === dl.characterName?.toLowerCase() || 
                  dl.characterName?.toLowerCase().includes(c.name.toLowerCase())
                )?.id || "",
                text: dl.text,
              }));
            }
          }
          
          updatedTake.updatedAt = Date.now();
          
          const newTakes = [...scene.takes];
          newTakes[takeIndex] = updatedTake;
          updatedScenes[sceneIndex] = { ...scene, takes: newTakes };
        } else {
          // Even if none, update the timestamp so it doesn't show as outdated anymore
          hasChanges = true;
          const updatedTake = { ...take, updatedAt: Date.now() };
          const newTakes = [...scene.takes];
          newTakes[takeIndex] = updatedTake;
          updatedScenes[sceneIndex] = { ...scene, takes: newTakes };
        }

        setTasks(prev => prev.map((tk, idx) => idx === i ? { ...tk, status: 'done' } : tk));
      } catch (error: any) {
        console.error(error);
        setTasks(prev => prev.map((tk, idx) => idx === i ? { 
          ...tk, 
          status: 'error',
          error: error.message || 'Erro desconhecido'
        } : tk));
      }
      
      setProgress(((i + 1) / tasks.length) * 100);
    }

    if (hasChanges) {
      setProject({ ...project, scenes: updatedScenes });
    }
    setIsProcessing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <div className="w-5 h-5 rounded-full border-2 border-zinc-300" />;
      case 'analyzing': return <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />;
      case 'applying': return <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />;
      case 'done': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-rose-500" />;
      default: return null;
    }
  };

  const getChangeTypeBadge = (type?: string) => {
    switch (type) {
      case 'text': 
        return <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-md"><FileText className="w-3 h-3" /> Texto</span>;
      case 'none': 
        return <span className="flex items-center gap-1 px-2 py-1 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-md">Sem alteração</span>;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Atualizar Cenas e Takes</h2>
            <p className="text-sm text-zinc-500 mt-1">
              A analisar {tasks.length} takes afetados pelas alterações recentes.
            </p>
          </div>
          {!isProcessing && (progress === 100 || tasks.length === 0) && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
            >
              <XCircle className="w-6 h-6 text-zinc-400" />
            </button>
          )}
        </div>

        <div className="p-6 flex-1 overflow-y-auto bg-zinc-50/30">
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-900">Tudo atualizado!</h3>
              <p className="text-zinc-500">Não existem takes desatualizados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task, idx) => (
                <div key={`${task.sceneId}-${task.takeId}`} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getStatusIcon(task.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-zinc-900 truncate">
                          {task.sceneTitle} <span className="text-zinc-400 font-normal">/ Take {task.takeIndex + 1}</span>
                        </h4>
                        {getChangeTypeBadge(task.changeType)}
                      </div>
                      
                      {task.status === 'analyzing' && (
                        <p className="text-sm text-indigo-600 flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" /> A analisar impacto das alterações...
                        </p>
                      )}
                      
                      {task.status === 'applying' && (
                        <p className="text-sm text-amber-600 flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" /> A aplicar atualizações...
                        </p>
                      )}

                      {task.details && (
                        <div className="mt-2 text-sm text-zinc-600 bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                          <p className="font-medium text-zinc-700 mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Análise da IA:
                          </p>
                          {task.details}
                        </div>
                      )}

                      {task.changes && Object.keys(task.changes).length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Alterações Efetuadas:</p>
                          {Object.entries(task.changes).map(([key, value]) => {
                            const val = value as { old: string, new: string };
                            return (
                            <div key={key} className="bg-white border border-zinc-200 rounded-lg overflow-hidden text-sm">
                              <div className="bg-zinc-50 px-3 py-1.5 border-b border-zinc-200 font-medium text-zinc-700 capitalize">
                                {key === 'action' ? 'Ação' : key === 'camera' ? 'Câmara' : key === 'sound' ? 'Som' : 'Diálogo'}
                              </div>
                              <div className="grid grid-cols-2 divide-x divide-zinc-200">
                                <div className="p-3 bg-rose-50/30">
                                  <span className="text-xs font-semibold text-rose-500 block mb-1">Antes:</span>
                                  <p className="text-zinc-600 line-through decoration-rose-300/50">{val.old || <span className="italic text-zinc-400">Vazio</span>}</p>
                                </div>
                                <div className="p-3 bg-emerald-50/30">
                                  <span className="text-xs font-semibold text-emerald-500 block mb-1">Depois:</span>
                                  <p className="text-zinc-800">{val.new || <span className="italic text-zinc-400">Vazio</span>}</p>
                                </div>
                              </div>
                            </div>
                          )})}
                        </div>
                      )}

                      {task.error && (
                        <p className="mt-2 text-sm text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100">
                          Erro: {task.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-zinc-100 bg-white">
          {tasks.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-zinc-700">Progresso</span>
                <span className="text-zinc-500">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {progress === 100 || tasks.length === 0 ? 'Fechar' : 'Cancelar'}
            </button>
            
            {progress < 100 && tasks.length > 0 && (
              <button
                onClick={startUpdate}
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    A processar...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5" />
                    Iniciar Atualização
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
