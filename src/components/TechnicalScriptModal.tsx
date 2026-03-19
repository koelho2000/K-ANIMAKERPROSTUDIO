import React, { useState } from 'react';
import { Project } from '../types';
import { X, Copy, CheckCircle2, RefreshCw } from 'lucide-react';

interface TechnicalScriptModalProps {
  project: Project;
  setProject?: React.Dispatch<React.SetStateAction<Project>>;
  onClose: () => void;
}

export const TechnicalScriptModal: React.FC<TechnicalScriptModalProps> = ({ project, setProject, onClose }) => {
  const [copied, setCopied] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getDefaultVideoPrompt = (scene: any, take: any) => {
    const soundContext = take.sound && take.sound !== "Nenhum" ? ` Som: ${take.sound}.` : "";
    
    const characterNames = (take.characters || []).map((id: string) => {
      const char = project.characters.find((c: any) => c.id === id);
      return char ? char.name : '';
    }).filter(Boolean).join(', ');
    
    const dialogueContext = take.dialogue && take.dialogue !== "Nenhum" ? ` Diálogo (${characterNames}): ${take.dialogue}.` : "";
    
    const narratorType = project.narrator?.type === "character" 
      ? ` (${project.characters.find((c: any) => c.id === project.narrator.characterId)?.name || 'Personagem'})`
      : project.narrator?.type === "custom"
        ? ` (${project.narrator.customName})`
        : "";
    
    const narrationContext = take.narration && take.narration !== "Nenhum" ? ` Narração${narratorType}: ${take.narration}.` : "";

    return `Tipo de Filme: ${project.filmType}. Estilo Visual: ${project.filmStyle}. Action: ${take.action}. Camera: ${take.camera}.${soundContext}${dialogueContext}${narrationContext}`;
  };

  const getIntroVideoPrompt = (forceDefault = false) => {
    if (!forceDefault && project.intro?.lastVideoPrompt) return project.intro.lastVideoPrompt;
    if (!project.intro?.prompt) return "";
    const music = project.intro.musicOptions || { style: "Cinematic", mood: "Epic", intensity: "Medium" };
    const musicPrompt = `Music Style: ${music.style}, Mood: ${music.mood}, Intensity: ${music.intensity}.`;
    return `${project.intro.prompt}. Add cinematic movement, sound of epic orchestral music, and professional transitions. ${musicPrompt}`;
  };

  const getOutroVideoPrompt = (forceDefault = false) => {
    if (!forceDefault && project.outro?.lastVideoPrompt) return project.outro.lastVideoPrompt;
    if (!project.outro?.prompt) return "";
    const music = project.outro.musicOptions || { style: "Cinematic", mood: "Epic", intensity: "Medium" };
    const musicPrompt = `Music Style: ${music.style}, Mood: ${music.mood}, Intensity: ${music.intensity}.`;
    return `${project.outro.prompt}. Add cinematic movement, sound of gentle closing music, and professional transitions. ${musicPrompt}`;
  };

  const handleForceUpdate = () => {
    if (!setProject) return;
    
    if (window.confirm("Isto irá atualizar todos os prompts de vídeo com os dados mais recentes (nomes de personagens, cenários, etc.), substituindo quaisquer edições manuais feitas nos prompts. Queres continuar?")) {
      setProject(prev => {
        const updated = { ...prev };
        
        if (updated.intro) {
          updated.intro = {
            ...updated.intro,
            lastVideoPrompt: getIntroVideoPrompt(true)
          };
        }
        
        if (updated.outro) {
          updated.outro = {
            ...updated.outro,
            lastVideoPrompt: getOutroVideoPrompt(true)
          };
        }
        
        updated.scenes = updated.scenes.map(scene => ({
          ...scene,
          takes: scene.takes.map(take => ({
            ...take,
            lastVideoPrompt: getDefaultVideoPrompt(scene, take)
          }))
        }));
        
        return updated;
      });
    }
  };

  const generateTableData = () => {
    const rows: any[] = [];
    let runningTime = 0;

      // Intro
      if (project.intro) {
        rows.push({
          runningTime: formatTime(runningTime),
          duration: '5s',
          sceneRef: 'Intro',
          takeRef: '-',
          settingRef: '-',
          charactersRef: '-',
          action: '-',
          sound: '-',
          camera: '-',
          dialogue: '-',
          narration: '-',
          soundtrack: '-',
          promptVideo: getIntroVideoPrompt() || '-'
        });
        runningTime += 5;
      }

      // Scenes
      project.scenes.forEach((scene, sIdx) => {
        scene.takes.forEach((take, tIdx) => {
          const duration = take.duration || 5;
          
          const setting = project.settings.find(s => s.id === take.settingId);
          const characters = project.characters
            .filter(c => take.characterIds?.includes(c.id))
            .map(c => c.name)
            .join(', ');

          const dialogueText = take.dialogueLines && take.dialogueLines.length > 0
            ? take.dialogueLines.map(line => {
                const char = project.characters.find(c => c.id === line.characterId);
                return `${char?.name || 'Personagem'}: ${line.text}`;
              }).join(' | ')
            : take.dialogue && take.dialogue !== 'Nenhum' ? take.dialogue : '-';

          const gender = project.narrationSettings?.gender || 'female';
          const ageGroup = project.narrationSettings?.ageGroup || 'adult';
          const genderText = gender === 'male' ? 'Masculino' : 'Feminino';
          const ageMap: Record<string, string> = { child: 'Criança', youth: 'Jovem', adult: 'Adulto', senior: 'Idoso' };
          const ageText = ageMap[ageGroup] || '';
          const narratorType = `(Voz: ${genderText}, ${ageText})`;
          
          const narrationText = take.narration && take.narration !== "Nenhum" ? `${narratorType} ${take.narration}` : '-';

          rows.push({
            runningTime: formatTime(runningTime),
            duration: `${duration}s`,
            sceneRef: `Cena ${sIdx + 1}`,
            takeRef: `Take ${tIdx + 1}`,
            settingRef: setting?.name || '-',
            charactersRef: characters || '-',
            action: take.action || '-',
            sound: take.sound || '-',
            camera: take.camera || '-',
            dialogue: dialogueText,
            narration: narrationText,
            soundtrack: scene.soundtrack?.style || '-',
            promptVideo: take.lastVideoPrompt || getDefaultVideoPrompt(scene, take) || '-'
          });
          runningTime += duration;
        });
      });

      // Outro
      if (project.outro) {
        rows.push({
          runningTime: formatTime(runningTime),
          duration: '5s',
          sceneRef: 'Outro',
          takeRef: '-',
          settingRef: '-',
          charactersRef: '-',
          action: '-',
          sound: '-',
          camera: '-',
          dialogue: '-',
          narration: '-',
          soundtrack: '-',
          promptVideo: getOutroVideoPrompt() || '-'
        });
      }

    return rows;
  };

  const rows = generateTableData();

    const handleCopy = () => {
      const headers = [
        'Tempo Corrido', 'Duração', 'Ref Cena', 'Ref Take', 'Ref Cenario', 
        'Ref Personagens', 'Acção', 'Som', 'Camera', 'Dialogo', 'Narração', 
        'Soundtrack', 'Prompt Video'
      ];
      
      const tsvContent = [
        headers.join('\t'),
        ...rows.map(row => [
          row.runningTime,
          row.duration,
          row.sceneRef,
          row.takeRef,
          row.settingRef,
          row.charactersRef,
          row.action,
          row.sound,
          row.camera,
          row.dialogue,
          row.narration,
          row.soundtrack,
          row.promptVideo
        ].map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join('\t'))
      ].join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Guião Técnico</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Vista detalhada de todos os takes do projeto.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {setProject && (
              <button
                onClick={handleForceUpdate}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl font-medium transition-colors"
                title="Atualizar todos os prompts de vídeo com os dados mais recentes"
              >
                <RefreshCw className="w-4 h-4" />
                Forçar Atualização
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-medium transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Tabela
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-zinc-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-zinc-50/30">
          <div className="inline-block min-w-full align-middle">
            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Tempo Corrido</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Duração</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Ref Cena</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Ref Take</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Ref Cenario</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Ref Personagens</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider min-w-[200px]">Acção</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider min-w-[150px]">Som</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider min-w-[150px]">Camera</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider min-w-[200px]">Dialogo</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider min-w-[200px]">Narração</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider min-w-[200px]">Soundtrack</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider min-w-[300px]">Prompt Video</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-zinc-200">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-zinc-500 whitespace-nowrap">{row.runningTime}</td>
                      <td className="px-4 py-3 text-sm font-mono text-zinc-500 whitespace-nowrap">{row.duration}</td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900 whitespace-nowrap">{row.sceneRef}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">{row.takeRef}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">{row.settingRef}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">{row.charactersRef}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{row.action}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{row.sound}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{row.camera}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{row.dialogue}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{row.narration}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{row.soundtrack}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500 font-mono text-xs whitespace-pre-wrap">{row.promptVideo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
