import React from "react";
import { Project } from "../types";
import { PlayCircle, Download, Upload } from "lucide-react";

interface PreviewProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function Preview({ project, setProject }: PreviewProps) {
  const allTakes = project.scenes.flatMap((s) =>
    s.takes.map((t) => ({ ...t, sceneTitle: s.title })),
  );
  const completedTakes = allTakes.filter((t) => t.videoUrl);

  const hasIntro = project.intro?.videoUrl;
  const hasOutro = project.outro?.videoUrl;

  const handleSave = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(project));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute(
      "download",
      `${project.title || "animaker-project"}.json`,
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loadedProject = JSON.parse(event.target?.result as string);
        setProject(loadedProject);
        alert("Project loaded successfully!");
      } catch (error) {
        console.error(error);
        alert("Failed to load project file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">
            Pré-visualização e Exportação
          </h2>
          <p className="text-zinc-500">
            Revê o teu filme final e guarda o teu projeto.
          </p>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 px-4 py-2 rounded-xl font-medium transition-colors cursor-pointer">
            <Upload className="w-5 h-5" />
            Carregar Projeto
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleLoad}
            />
          </label>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors"
          >
            <Download className="w-5 h-5" />
            Guardar Projeto
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 overflow-hidden p-8">
        <h3 className="text-xl font-bold text-white mb-6">Corte do Realizador</h3>

        {completedTakes.length === 0 && !hasIntro && !hasOutro ? (
          <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-500 border border-zinc-700`}>
            <PlayCircle className="w-16 h-16 mb-4 opacity-50" />
            <p>Ainda não existem conteúdos renderizados.</p>
            <p className="text-sm mt-2">
              Vai aos separadores "Produção" ou "Intro & Créditos" para renderizar vídeos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Intro Video */}
            {hasIntro && (
              <div className="space-y-2">
                <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-black rounded-xl overflow-hidden border border-indigo-500/50 relative group`}>
                  <video
                    src={project.intro?.videoUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    Intro
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-white truncate">
                    {project.title}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    Início do Filme
                  </div>
                </div>
              </div>
            )}

            {/* Movie Takes */}
            {completedTakes.map((take, i) => (
              <div key={take.id} className="space-y-2">
                <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-black rounded-xl overflow-hidden border border-zinc-700 relative group`}>
                  <video
                    src={take.videoUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-xs font-mono text-indigo-400 mb-1">
                    Take {(i + 1).toString().padStart(2, "0")}
                  </div>
                  <div className="text-sm font-medium text-zinc-300 truncate">
                    {take.sceneTitle}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {take.action}
                  </div>
                </div>
              </div>
            ))}

            {/* Outro Video */}
            {hasOutro && (
              <div className="space-y-2">
                <div className={`aspect-[${(project.aspectRatio || '16:9').replace(':', '/')}] bg-black rounded-xl overflow-hidden border border-rose-500/50 relative group`}>
                  <video
                    src={project.outro?.videoUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    Créditos
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-white truncate">
                    FIM
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    Créditos Finais
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
