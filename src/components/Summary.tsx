import React from "react";
import { Project } from "../types";
import { 
  Table, 
  Clock, 
  CheckCircle2, 
  Circle, 
  ImageIcon, 
  Film, 
  LayoutList,
  Users,
  MapPin,
  Download,
  FileText
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

  const handleExport = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
        <meta charset="UTF-8">
        <title>Resumo do Filme: ${project.title}</title>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #18181b; max-width: 1000px; margin: 0 auto; padding: 40px; background: #f4f4f5; }
          .container { background: white; padding: 40px; border-radius: 24px; shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          h1 { font-size: 48px; font-weight: 900; margin-bottom: 8px; color: #4f46e5; letter-spacing: -0.02em; }
          h2 { font-size: 24px; font-weight: 800; margin-top: 40px; margin-bottom: 16px; border-bottom: 2px solid #e4e4e7; padding-bottom: 8px; color: #18181b; }
          h3 { font-size: 18px; font-weight: 700; margin-top: 24px; margin-bottom: 8px; color: #3730a3; }
          .meta { color: #71717a; font-size: 14px; margin-bottom: 32px; }
          .section { margin-bottom: 40px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; }
          .card { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 16px; padding: 16px; }
          .card img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; margin-bottom: 12px; background: #eee; }
          .card-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
          .card-desc { font-size: 12px; color: #71717a; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
          th { text-align: left; background: #f8fafc; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; }
          td { padding: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
          .take-row { background: #fff; }
          .scene-row { background: #f8fafc; font-weight: 700; }
          .duration { font-family: monospace; color: #64748b; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          .badge-ok { background: #dcfce7; color: #166534; }
          .badge-pending { background: #f1f5f9; color: #64748b; }
          .frame-preview { display: flex; gap: 4px; }
          .frame-preview img { width: 40px; height: 40px; border-radius: 4px; object-fit: cover; border: 1px solid #e2e8f0; }
          .prompt-box { background: #f1f5f9; border-radius: 8px; padding: 12px; margin-top: 8px; font-size: 11px; color: #475569; border-left: 4px solid #94a3b8; }
          .prompt-label { font-weight: 700; text-transform: uppercase; font-size: 9px; color: #64748b; margin-bottom: 4px; display: block; }
          .script-text { white-space: pre-wrap; background: #fafafa; padding: 24px; border-radius: 16px; border: 1px solid #e4e4e7; font-size: 14px; color: #3f3f46; }
          @media print {
            body { background: white; padding: 0; }
            .container { shadow: none; padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1>${project.title}</h1>
              <div class="meta">Documento de Produção • Gerado em ${new Date().toLocaleDateString('pt-PT')}</div>
            </div>
            <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">Imprimir / PDF</button>
          </div>

          <div class="section">
            <h2>Conceito e Ideia</h2>
            <p><strong>Ideia Base:</strong> ${project.idea}</p>
            <p><strong>Conceito Visual:</strong> ${project.concept}</p>
            <p><strong>Tipo de Filme:</strong> ${project.filmType} | <strong>Estilo:</strong> ${project.filmStyle}</p>
          </div>

          <div class="section">
            <h2>Guião da História</h2>
            <div class="script-text">${project.script || "Nenhum guião gerado ainda."}</div>
          </div>

          <div class="section">
            <h2>Personagens</h2>
            <div class="grid">
              ${project.characters.map(char => `
                <div class="card">
                  ${char.imageUrl ? `<img src="${char.imageUrl}" alt="${char.name}">` : `<div style="width:100%; aspect-ratio:1; background:#eee; border-radius:8px; margin-bottom:12px; display:flex; align-items:center; justify-content:center; color:#ccc;">Sem Imagem</div>`}
                  <div class="card-title">${char.name}</div>
                  <div class="card-desc">${char.description}</div>
                  ${char.lastImagePrompt ? `
                    <div class="prompt-box">
                      <span class="prompt-label">Prompt Imagem Principal</span>
                      ${char.lastImagePrompt}
                    </div>
                  ` : ''}
                  ${char.lastViewsPrompt ? `
                    <div class="prompt-box">
                      <span class="prompt-label">Prompt Turnaround (Vistas)</span>
                      ${char.lastViewsPrompt}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="section">
            <h2>Cenários</h2>
            <div class="grid">
              ${project.settings.map(set => `
                <div class="card">
                  ${set.imageUrl ? `<img src="${set.imageUrl}" alt="${set.name}">` : `<div style="width:100%; aspect-ratio:1; background:#eee; border-radius:8px; margin-bottom:12px; display:flex; align-items:center; justify-content:center; color:#ccc;">Sem Imagem</div>`}
                  <div class="card-title">${set.name}</div>
                  <div class="card-desc">${set.description}</div>
                  ${set.lastImagePrompt ? `
                    <div class="prompt-box">
                      <span class="prompt-label">Prompt de Geração</span>
                      ${set.lastImagePrompt}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="section">
            <h2>Plano de Cenas e Takes</h2>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cena / Take</th>
                  <th>Ação / Descrição</th>
                  <th>Frames</th>
                  <th>Estado Vídeo</th>
                  <th>Duração</th>
                </tr>
              </thead>
              <tbody>
                ${project.intro ? `
                  <tr class="scene-row">
                    <td>INTRO</td>
                    <td>Início / Título</td>
                    <td>
                      ${project.intro.prompt ? `
                        <div class="prompt-box">
                          <span class="prompt-label">Prompt Imagem</span>
                          ${project.intro.prompt}
                        </div>
                      ` : ''}
                      ${project.intro.lastVideoPrompt ? `
                        <div class="prompt-box">
                          <span class="prompt-label">Prompt Vídeo</span>
                          ${project.intro.lastVideoPrompt}
                        </div>
                      ` : ''}
                    </td>
                    <td><div class="frame-preview">${project.intro.imageUrl ? `<img src="${project.intro.imageUrl}">` : ''}</div></td>
                    <td><span class="badge ${project.intro.videoUrl ? 'badge-ok' : 'badge-pending'}">${project.intro.videoUrl ? 'Pronto' : 'Pendente'}</span></td>
                    <td class="duration">5s</td>
                  </tr>
                ` : ''}
                
                ${project.scenes.map((scene, sIdx) => `
                  <tr class="scene-row">
                    <td>C${(sIdx + 1).toString().padStart(2, "0")}</td>
                    <td>${scene.title}</td>
                    <td>${scene.description}</td>
                    <td></td>
                    <td></td>
                    <td class="duration">${formatTime(scene.takes.reduce((acc, t) => acc + (t.duration || 5), 0))}</td>
                  </tr>
                  ${scene.takes.map((take, tIdx) => `
                    <tr class="take-row">
                      <td style="padding-left: 24px; color: #94a3b8;">${sIdx + 1}.${tIdx + 1}</td>
                      <td>Take ${tIdx + 1}</td>
                      <td>
                        <strong>Ação:</strong> ${take.action}<br>
                        <strong>Câmara:</strong> ${take.camera}
                        
                        ${take.lastStartFramePrompt ? `
                          <div class="prompt-box">
                            <span class="prompt-label">Prompt Frame Inicial</span>
                            ${take.lastStartFramePrompt}
                          </div>
                        ` : ''}
                        ${take.lastEndFramePrompt ? `
                          <div class="prompt-box">
                            <span class="prompt-label">Prompt Frame Final</span>
                            ${take.lastEndFramePrompt}
                          </div>
                        ` : ''}
                        ${take.lastVideoPrompt ? `
                          <div class="prompt-box">
                            <span class="prompt-label">Prompt Vídeo</span>
                            ${take.lastVideoPrompt}
                          </div>
                        ` : ''}
                      </td>
                      <td>
                        <div class="frame-preview">
                          ${take.startFrameUrl ? `<img src="${take.startFrameUrl}">` : ''}
                          ${take.endFrameUrl ? `<img src="${take.endFrameUrl}">` : ''}
                        </div>
                      </td>
                      <td><span class="badge ${take.videoUrl ? 'badge-ok' : 'badge-pending'}">${take.videoUrl ? 'Pronto' : 'Pendente'}</span></td>
                      <td class="duration">${take.duration || 5}s</td>
                    </tr>
                  `).join('')}
                `).join('')}

                ${project.outro ? `
                  <tr class="scene-row">
                    <td>FIM</td>
                    <td>
                      <strong>Créditos Finais</strong><br>
                      ${project.outro.company ? `Empresa: ${project.outro.company}<br>` : ''}
                      ${project.outro.director ? `Realização: ${project.outro.director}<br>` : ''}
                      ${project.outro.producer ? `Produção: ${project.outro.producer}<br>` : ''}
                      ${project.outro.thankYouMessage ? `Mensagem: ${project.outro.thankYouMessage}<br>` : ''}
                    </td>
                    <td>
                      ${project.outro.prompt ? `
                        <div class="prompt-box">
                          <span class="prompt-label">Prompt Imagem</span>
                          ${project.outro.prompt}
                        </div>
                      ` : ''}
                      ${project.outro.lastVideoPrompt ? `
                        <div class="prompt-box">
                          <span class="prompt-label">Prompt Vídeo</span>
                          ${project.outro.lastVideoPrompt}
                        </div>
                      ` : ''}
                    </td>
                    <td><div class="frame-preview">${project.outro.imageUrl ? `<img src="${project.outro.imageUrl}">` : ''}</div></td>
                    <td><span class="badge ${project.outro.videoUrl ? 'badge-ok' : 'badge-pending'}">${project.outro.videoUrl ? 'Pronto' : 'Pendente'}</span></td>
                    <td class="duration">5s</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title || 'resumo-filme'}-producao.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-4 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <Download className="w-5 h-5 text-indigo-600" />
            Exportar Documento
          </button>
          <div className="bg-indigo-600 text-white px-6 py-4 rounded-2xl shadow-lg shadow-indigo-200 flex items-center gap-4">
            <Clock className="w-6 h-6" />
            <div>
              <div className="text-xs font-medium opacity-80 uppercase tracking-wider">Tempo Total Estimado</div>
              <div className="text-2xl font-black">{formatTime(totalSeconds)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Characters & Settings Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Characters */}
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Personagens ({project.characters.length})
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {project.characters.map((char) => (
                <div key={char.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200">
                  {char.imageUrl ? (
                    <img 
                      src={char.imageUrl} 
                      alt={char.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-8 h-8 text-zinc-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p className="text-white text-xs font-bold truncate">{char.name}</p>
                    <p className="text-white/70 text-[10px] line-clamp-2 leading-tight">{char.description}</p>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 group-hover:opacity-0 transition-opacity">
                    <p className="text-zinc-900 text-[10px] font-bold truncate">{char.name}</p>
                  </div>
                </div>
              ))}
              {project.characters.length === 0 && (
                <div className="col-span-full py-8 text-center text-zinc-400 text-sm italic">
                  Nenhuma personagem definida.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-500" />
              Cenários ({project.settings.length})
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {project.settings.map((set) => (
                <div key={set.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200">
                  {set.imageUrl ? (
                    <img 
                      src={set.imageUrl} 
                      alt={set.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-zinc-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p className="text-white text-xs font-bold truncate">{set.name}</p>
                    <p className="text-white/70 text-[10px] line-clamp-2 leading-tight">{set.description}</p>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 group-hover:opacity-0 transition-opacity">
                    <p className="text-zinc-900 text-[10px] font-bold truncate">{set.name}</p>
                  </div>
                </div>
              ))}
              {project.settings.length === 0 && (
                <div className="col-span-full py-8 text-center text-zinc-400 text-sm italic">
                  Nenhum cenário definido.
                </div>
              )}
            </div>
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
