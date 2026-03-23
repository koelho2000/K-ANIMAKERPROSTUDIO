import React, { useState } from 'react';
import { Project } from '../types';
import { WorldMapModal } from './WorldMapModal';
import { Globe, Sparkles, Map, Clock, Navigation, Loader2 } from 'lucide-react';
import { generateText } from '../services/geminiService';

interface StoryworldProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function Storyworld({ project, setProject }: StoryworldProps) {
  const [isWorldMapOpen, setIsWorldMapOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateConnections = async () => {
    if (!project.scenes || project.scenes.length < 2) {
      alert("Precisa de pelo menos 2 cenas para gerar interligações.");
      return;
    }

    setIsGenerating(true);
    try {
      const sceneTransitions = project.scenes.slice(0, -1).map((scene, i) => {
        const nextScene = project.scenes[i + 1];
        const setting1 = project.settings.find(s => s.id === scene.takes?.[0]?.settingId)?.name || 'Desconhecido';
        const setting2 = project.settings.find(s => s.id === nextScene.takes?.[0]?.settingId)?.name || 'Desconhecido';
        return `De "${setting1}" (Cena ${i+1}) para "${setting2}" (Cena ${i+2})`;
      }).join('\n');

      const prompt = `Com base no seguinte Universo (Storyworld) e regras:
      Descrição: ${project.storyworld?.description || 'Não definido'}
      Regras: ${project.storyworld?.rules || 'Não definido'}
      
      Gera uma estimativa de tempo de viagem, distância e meio de transporte/transição para as seguintes mudanças de cenário na narrativa:
      ${sceneTransitions}
      
      Retorna APENAS um array JSON válido com a seguinte estrutura:
      [
        {
          "fromSceneIndex": 0,
          "toSceneIndex": 1,
          "distance": "ex: 50 km, 2 galáxias, a poucos passos",
          "time": "ex: 2 horas, 3 dias, instantâneo",
          "method": "ex: a pé, nave espacial, teletransporte"
        }
      ]`;

      const result = await generateText(prompt);
      
      let jsonStr = result;
      if (result.includes('```json')) {
        jsonStr = result.split('```json')[1].split('```')[0].trim();
      } else if (result.includes('```')) {
        jsonStr = result.split('```')[1].split('```')[0].trim();
      }

      const parsed = JSON.parse(jsonStr);
      
      setProject(prev => ({
        ...prev,
        storyworld: {
          ...prev.storyworld,
          connections: parsed
        }
      }));
    } catch (error) {
      console.error("Erro ao gerar interligações:", error);
      alert("Ocorreu um erro ao gerar as interligações. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };
  const handleGenerateStoryworld = async () => {
    setIsGenerating(true);
    try {
      const charactersInfo = project.characters?.map(c => `- ${c.name}: ${c.description}`).join('\n') || 'Nenhuma personagem definida.';
      const settingsInfo = project.settings?.map(s => `- ${s.name}: ${s.description}`).join('\n') || 'Nenhum cenário definido.';
      const scenesInfo = project.scenes?.map((s, i) => `Cena ${i+1}: ${s.title}\n${s.description}\nTakes:\n${s.takes?.map(t => `  - ${t.action}`).join('\n') || 'Nenhum take definido.'}`).join('\n\n') || 'Nenhuma cena definida.';

      const prompt = `Com base no seguinte guião e configurações, gera uma descrição detalhada do Universo (Storyworld) e as regras de Tempo, Distância e Espaço.
      
      Guião: ${project.script}
      Tipo de Filme: ${project.filmType}
      Estilo: ${project.filmStyle}
      
      Personagens:
      ${charactersInfo}
      
      Cenários:
      ${settingsInfo}
      
      Cenas e Takes:
      ${scenesInfo}
      
      Retorna APENAS um objeto JSON válido com a seguinte estrutura:
      {
        "description": "Descrição detalhada do universo, atmosfera, época, regras gerais...",
        "rules": "Regras de tempo (duração de dias, viagens no tempo), distâncias entre locais principais, regras espaciais e físicas..."
      }`;

      const result = await generateText(prompt);
      
      // Extract JSON from markdown code block if present
      let jsonStr = result;
      if (result.includes('```json')) {
        jsonStr = result.split('```json')[1].split('```')[0].trim();
      } else if (result.includes('```')) {
        jsonStr = result.split('```')[1].split('```')[0].trim();
      }

      const parsed = JSON.parse(jsonStr);
      
      setProject(prev => ({
        ...prev,
        storyworld: {
          description: parsed.description || prev.storyworld?.description,
          rules: parsed.rules || prev.storyworld?.rules
        }
      }));
    } catch (error) {
      console.error("Erro ao gerar Storyworld:", error);
      alert("Ocorreu um erro ao gerar o Storyworld. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 p-8 bg-zinc-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2 flex items-center gap-3">
              <Globe className="w-8 h-8 text-indigo-600" />
              Storyworld
            </h1>
            <p className="text-zinc-500">
              Gere o universo onde se passa a história, interligue cenários e visualize a narrativa geograficamente.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGenerateStoryworld}
              disabled={isGenerating || (!project.script && (!project.characters || project.characters.length === 0) && (!project.settings || project.settings.length === 0))}
              className="flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Gerar Storyworld
            </button>
            <button
              onClick={() => setIsWorldMapOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-emerald-200"
            >
              <Map className="w-5 h-5" />
              Abrir Mapa Mundo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Universe Description */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                O Universo
              </h2>
            </div>
            <textarea
              value={project.storyworld?.description || ''}
              onChange={(e) => setProject({
                ...project,
                storyworld: { ...project.storyworld, description: e.target.value }
              })}
              placeholder="Descreva o universo, as suas regras, a época, a atmosfera geral..."
              className="flex-1 w-full p-4 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[200px]"
            />
          </div>

          {/* Time, Distance, Space */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                Tempo, Distância e Espaço
              </h2>
            </div>
            <textarea
              value={project.storyworld?.rules || ''}
              onChange={(e) => setProject({
                ...project,
                storyworld: { ...project.storyworld, rules: e.target.value }
              })}
              placeholder="Defina as noções de tempo (ex: viagem no tempo, duração dos dias), distâncias entre locais principais e regras espaciais..."
              className="flex-1 w-full p-4 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[200px]"
            />
          </div>
        </div>

        {/* Narrative Flow / Geography */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-indigo-500" />
              Fluxo Geográfico da Narrativa
            </h2>
            <button
              onClick={handleGenerateConnections}
              disabled={isGenerating || !project.scenes || project.scenes.length < 2}
              className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Gerar Interligações
            </button>
          </div>
          <div className="bg-zinc-50 rounded-xl p-6 border border-zinc-200">
            {project.scenes && project.scenes.length > 0 ? (
              <div className="space-y-4">
                {project.scenes.map((scene, index) => {
                  const firstTake = scene.takes?.[0];
                  const setting = firstTake ? project.settings.find(s => s.id === firstTake.settingId) : null;
                  const connection = project.storyworld?.connections?.find(c => c.fromSceneIndex === index);
                  
                  return (
                    <div key={scene.id} className="flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 bg-white p-4 rounded-xl border border-zinc-200 flex items-center justify-between shadow-sm">
                          <div>
                            <h3 className="font-bold text-zinc-800">{scene.title}</h3>
                            <p className="text-sm text-zinc-500">
                              {setting ? setting.name : 'Cenário não definido'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {index < project.scenes.length - 1 && (
                        <div className="flex items-center gap-4 ml-4">
                          <div className="w-0.5 h-12 bg-zinc-200 shrink-0 mx-auto"></div>
                          {connection ? (
                            <div className="flex-1 bg-zinc-100/50 p-3 rounded-lg border border-zinc-200/50 text-sm text-zinc-600 grid grid-cols-3 gap-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Distância</span>
                                <span>{connection.distance}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Tempo</span>
                                <span>{connection.time}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Meio / Método</span>
                                <span>{connection.method}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 text-xs text-zinc-400 font-mono bg-zinc-100 px-3 py-2 rounded-lg border border-zinc-200/50">
                              → Transição para a próxima cena
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-zinc-500 py-8">
                Adicione cenas no menu "Cenas e Takes" para visualizar o fluxo geográfico.
              </p>
            )}
          </div>
        </div>
      </div>

      <WorldMapModal
        isOpen={isWorldMapOpen}
        onClose={() => setIsWorldMapOpen(false)}
        project={project}
        setProject={setProject}
      />
    </div>
  );
}
