import React from "react";
import { Project } from "../types";
import { 
  Table, 
  Clock, 
  CheckCircle2, 
  Circle, 
  ImageIcon, 
  Film, 
  LayoutList 
} from "lucide-react";

interface SummaryProps {
  project: Project;
}

export default function Summary({ project }: SummaryProps) {
  const introDuration = project.intro ? 5 : 0;
  const outroDuration = project.outro ? 5 : 0;
  const scenesDuration = project.scenes.reduce((acc, scene) => {
    return acc + scene.takes.reduce((tAcc, take) => tAcc + (take.duration || 5), 0);
  }, 0);

  const totalSeconds = introDuration + scenesDuration + outroDuration;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2 flex items-center gap-3">
            <LayoutList className="w-8 h-8 text-indigo-600" />
            Quadro Resumo do Filme
          </h2>
          <p className="text-zinc-500">
            Visão geral de todas as cenas, takes e estado de produção.
          </p>
        </div>
        <div className="bg-indigo-600 text-white px-6 py-4 rounded-2xl shadow-lg shadow-indigo-200 flex items-center gap-4">
          <Clock className="w-6 h-6" />
          <div>
            <div className="text-xs font-medium opacity-80 uppercase tracking-wider">Tempo Total Estimado</div>
            <div className="text-2xl font-black">{formatTime(totalSeconds)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Cena / Take</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Resumo / Ação</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">Frames</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">Vídeo</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Duração</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {/* Intro Row */}
            {project.intro && (
              <tr className="bg-indigo-50/30">
                <td className="px-6 py-4 font-black text-indigo-600">
                  INTRO
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-zinc-900">Início / Título</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{project.intro.type}</div>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-500 max-w-xs truncate">
                  {project.intro.prompt}
                </td>
                <td className="px-6 py-4 text-center">
                  {project.intro.imageUrl ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-200 mx-auto" />
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {project.intro.videoUrl ? (
                    <CheckCircle2 className="w-5 h-5 text-indigo-500 mx-auto" />
                  ) : (
                    <Circle className="w-5 h-5 text-zinc-200 mx-auto" />
                  )}
                </td>
                <td className="px-6 py-4 text-right text-sm font-mono text-zinc-600">
                  5s
                </td>
              </tr>
            )}

            {project.scenes.map((scene, sIdx) => (
              <React.Fragment key={scene.id}>
                {/* Scene Row */}
                <tr className="bg-zinc-50/50">
                  <td className="px-6 py-4 font-black text-zinc-900">
                    C{(sIdx + 1).toString().padStart(2, "0")}
                  </td>
                  <td colSpan={4} className="px-6 py-4">
                    <div className="font-bold text-zinc-900">{scene.title}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{scene.description}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-zinc-400">
                    {formatTime(scene.takes.reduce((acc, t) => acc + (t.duration || 5), 0))}
                  </td>
                </tr>
                {/* Take Rows */}
                {scene.takes.map((take, tIdx) => (
                  <tr key={take.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-zinc-400 pl-10">
                      {(sIdx + 1)}.{(tIdx + 1).toString().padStart(2, "0")}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-700">
                      Take {tIdx + 1}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500 max-w-xs truncate">
                      {take.action}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {take.startFrameUrl ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-200" />
                        )}
                        {take.endFrameUrl ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-200" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {take.videoUrl ? (
                        <CheckCircle2 className="w-5 h-5 text-indigo-500 mx-auto" />
                      ) : (
                        <Circle className="w-5 h-5 text-zinc-200 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-mono text-zinc-600">
                      {take.duration || 5}s
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}

            {/* Outro Row */}
            {project.outro && (
              <tr className="bg-rose-50/30">
                <td className="px-6 py-4 font-black text-rose-600">
                  FIM
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-zinc-900">Créditos Finais</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{project.outro.type}</div>
                  {(project.outro.company || project.outro.director || project.outro.producer) && (
                    <div className="mt-2 space-y-0.5">
                      {project.outro.company && <div className="text-[10px] text-zinc-400"><span className="font-bold uppercase">Empresa:</span> {project.outro.company}</div>}
                      {project.outro.director && <div className="text-[10px] text-zinc-400"><span className="font-bold uppercase">Realização:</span> {project.outro.director}</div>}
                      {project.outro.producer && <div className="text-[10px] text-zinc-400"><span className="font-bold uppercase">Produção:</span> {project.outro.producer}</div>}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-zinc-500 max-w-xs truncate">
                  {project.outro.prompt}
                </td>
                <td className="px-6 py-4 text-center">
                  {project.outro.imageUrl ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-200 mx-auto" />
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {project.outro.videoUrl ? (
                    <CheckCircle2 className="w-5 h-5 text-indigo-500 mx-auto" />
                  ) : (
                    <Circle className="w-5 h-5 text-zinc-200 mx-auto" />
                  )}
                </td>
                <td className="px-6 py-4 text-right text-sm font-mono text-zinc-600">
                  5s
                </td>
              </tr>
            )}

            {project.scenes.length === 0 && !project.intro && !project.outro && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">
                  Nenhuma cena ou take gerado até ao momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-zinc-900">
              {project.scenes.reduce((acc, s) => acc + s.takes.filter(t => t.startFrameUrl).length, 0) + 
               (project.intro?.imageUrl ? 1 : 0) + 
               (project.outro?.imageUrl ? 1 : 0)}
            </div>
            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Frames Gerados</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-zinc-900">
              {project.scenes.reduce((acc, s) => acc + s.takes.filter(t => t.videoUrl).length, 0) + 
               (project.intro?.videoUrl ? 1 : 0) + 
               (project.outro?.videoUrl ? 1 : 0)}
            </div>
            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Vídeos Renderizados</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-600">
            <LayoutList className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-zinc-900">
              {project.scenes.reduce((acc, s) => acc + s.takes.length, 0) + 
               (project.intro ? 1 : 0) + 
               (project.outro ? 1 : 0)}
            </div>
            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total de Elementos</div>
          </div>
        </div>
      </div>
    </div>
  );
}
