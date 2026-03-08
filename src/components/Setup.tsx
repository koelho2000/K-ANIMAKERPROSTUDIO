import React, { useState } from "react";
import { Project } from "../types";
import { Settings, Zap, AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { getGenAI } from "../services/geminiService";

interface SetupProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  onStartMassProduction: () => void;
}

export default function Setup({ project, setProject, onStartMassProduction }: SetupProps) {
  const [isValidating, setIsValidating] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setProject((prev) => {
      const newValidation = { ...prev.validation };
      if (name === "title" || name === "idea" || name === "concept") {
        delete newValidation[name];
        newValidation.ignoreWarnings = false;
      }
      return { ...prev, [name]: value, validation: newValidation };
    });
  };

  const handleValidate = async () => {
    if (!project.title || !project.idea || !project.concept) return;
    
    setIsValidating(true);
    try {
      const ai = getGenAI();
      const prompt = `Avalia a consistência e suficiência dos seguintes campos para um projeto de filme de animação:
      
      Título: "${project.title}"
      Ideia Central: "${project.idea}"
      Conceito: "${project.concept}"
      Duração Selecionada: "${project.duration}"
      
      Critérios:
      1. O título é apelativo e faz sentido com o conceito?
      2. A Ideia Central tem conteúdo suficiente para a duração selecionada (${project.duration})? 
         - Para durações curtas (até 5 min), precisa de um arco básico claro.
         - Para durações médias (5-30 min), precisa de detalhes sobre o mundo e personagens.
         - Para durações longas (30-120 min), precisa de uma "quantificação" robusta de conteúdo: sub-tramas, múltiplos atos e profundidade narrativa significativa.
      3. O conceito é claro?
      
      Responde APENAS em formato JSON com a seguinte estrutura:
      {
        "title": { "status": "ok" | "warning" | "error", "message": "string" },
        "idea": { "status": "ok" | "warning" | "error", "message": "string" },
        "concept": { "status": "ok" | "warning" | "error", "message": "string" }
      }
      
      As mensagens devem ser em Português, curtas e construtivas.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || "{}");
      setProject(prev => ({ ...prev, validation: result }));
    } catch (error) {
      console.error("Erro na validação:", error);
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusColor = (status?: string) => {
    if (status === 'ok') return 'text-emerald-500';
    if (status === 'warning') return 'text-amber-500';
    if (status === 'error') return 'text-rose-500';
    return 'text-zinc-400';
  };

  const getStatusIcon = (status?: string) => {
    if (status === 'ok') return <CheckCircle2 className="w-4 h-4" />;
    if (status === 'warning' || status === 'error') return <AlertCircle className="w-4 h-4" />;
    return null;
  };

  const isConfigComplete = project.title.trim() !== "" && 
                          project.idea.trim() !== "" && 
                          project.concept.trim() !== "";

  const isValidated = (project.validation?.title?.status === 'ok' || (project.validation?.title?.status === 'warning' && project.validation?.ignoreWarnings)) && 
                      (project.validation?.idea?.status === 'ok' || (project.validation?.idea?.status === 'warning' && project.validation?.ignoreWarnings)) && 
                      (project.validation?.concept?.status === 'ok' || (project.validation?.concept?.status === 'warning' && project.validation?.ignoreWarnings));

  const hasWarnings = project.validation?.title?.status === 'warning' || 
                      project.validation?.idea?.status === 'warning' || 
                      project.validation?.concept?.status === 'warning';

  const toggleIgnoreWarnings = () => {
    setProject(prev => ({
      ...prev,
      validation: {
        ...prev.validation!,
        ignoreWarnings: !prev.validation?.ignoreWarnings
      }
    }));
  };

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">
            Configuração do Projeto
          </h2>
          <p className="text-zinc-500">
            Define o conceito central do teu filme de animação.
          </p>
        </div>
        <button
          onClick={handleValidate}
          disabled={isValidating || !isConfigComplete}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
            isValidating || !isConfigComplete
              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
              : "bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 shadow-sm"
          }`}
        >
          {isValidating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Analisar Consistência
        </button>
      </div>

      {hasWarnings && !isValidated && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Existem avisos na configuração</p>
              <p className="text-xs text-amber-700">Podes corrigir os campos ou ignorar os avisos para prosseguir.</p>
            </div>
          </div>
          <button
            onClick={toggleIgnoreWarnings}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            Ignorar Avisos e Prosseguir
          </button>
        </div>
      )}

      <div className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-zinc-100">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-700">
              Título
            </label>
            {project.validation?.title && (
              <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(project.validation.title.status)}`}>
                {getStatusIcon(project.validation.title.status)}
                {project.validation.title.status}
              </div>
            )}
          </div>
          <input
            type="text"
            name="title"
            value={project.title}
            onChange={handleChange}
            placeholder="Ex: O Último Robot"
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all ${
              project.validation?.title?.status === 'error' ? 'border-rose-200 focus:ring-rose-500/20' :
              project.validation?.title?.status === 'warning' ? 'border-amber-200 focus:ring-amber-500/20' :
              'border-zinc-200 focus:ring-indigo-500'
            }`}
          />
          {project.validation?.title?.message && (
            <p className={`mt-1.5 text-xs font-medium ${getStatusColor(project.validation.title.status)}`}>
              {project.validation.title.message}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-700">
              Ideia Central
            </label>
            {project.validation?.idea && (
              <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(project.validation.idea.status)}`}>
                {getStatusIcon(project.validation.idea.status)}
                {project.validation.idea.status}
              </div>
            )}
          </div>
          <textarea
            name="idea"
            value={project.idea}
            onChange={handleChange}
            rows={3}
            placeholder="Um breve resumo da história..."
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all resize-none ${
              project.validation?.idea?.status === 'error' ? 'border-rose-200 focus:ring-rose-500/20' :
              project.validation?.idea?.status === 'warning' ? 'border-amber-200 focus:ring-amber-500/20' :
              'border-zinc-200 focus:ring-indigo-500'
            }`}
          />
          {project.validation?.idea?.message && (
            <p className={`mt-1.5 text-xs font-medium ${getStatusColor(project.validation.idea.status)}`}>
              {project.validation.idea.message}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-700">
              Conceito / Tema
            </label>
            {project.validation?.concept && (
              <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(project.validation.concept.status)}`}>
                {getStatusIcon(project.validation.concept.status)}
                {project.validation.concept.status}
              </div>
            )}
          </div>
          <input
            type="text"
            name="concept"
            value={project.concept}
            onChange={handleChange}
            placeholder="Ex: Amizade, Cyberpunk, Natureza vs Tecnologia"
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all ${
              project.validation?.concept?.status === 'error' ? 'border-rose-200 focus:ring-rose-500/20' :
              project.validation?.concept?.status === 'warning' ? 'border-amber-200 focus:ring-amber-500/20' :
              'border-zinc-200 focus:ring-indigo-500'
            }`}
          />
          {project.validation?.concept?.message && (
            <p className={`mt-1.5 text-xs font-medium ${getStatusColor(project.validation.concept.status)}`}>
              {project.validation.concept.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Tipo de Filme
            </label>
            <select
              name="filmType"
              value={project.filmType}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
            >
              <option value="Animação 3D">Animação 3D</option>
              <option value="Animação 2D">Animação 2D</option>
              <option value="Stop Motion">Stop Motion</option>
              <option value="Anime">Anime</option>
              <option value="CGI Realista">CGI Realista</option>
              <option value="Motion Graphics">Motion Graphics</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Estilo de Filme
            </label>
            <select
              name="filmStyle"
              value={project.filmStyle}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
            >
              <option value="Fantasia">Fantasia</option>
              <option value="Sci-Fi">Sci-Fi</option>
              <option value="Aventura">Aventura</option>
              <option value="Comédia">Comédia</option>
              <option value="Drama">Drama</option>
              <option value="Terror">Terror</option>
              <option value="Noir">Noir</option>
              <option value="Cyberpunk">Cyberpunk</option>
              <option value="Épico">Épico</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Língua / Nacionalidade
            </label>
            <select
              name="language"
              value={project.language}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
            >
              <option value="Português (Portugal)">Português (Portugal)</option>
              <option value="Português (Brasil)">Português (Brasil)</option>
              <option value="Inglês">Inglês</option>
              <option value="Espanhol">Espanhol</option>
              <option value="Francês">Francês</option>
              <option value="Japonês">Japonês</option>
              <option value="Alemão">Alemão</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Duração
            </label>
            <select
              name="duration"
              value={project.duration}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
            >
              <option value="1 minuto">1 minuto</option>
              <option value="1 a 5 minutos">1 a 5 minutos</option>
              <option value="5 a 15 minutos">5 a 15 minutos</option>
              <option value="15 a 30 minutos">15 a 30 minutos</option>
              <option value="30 a 60 minutos">30 a 60 minutos</option>
              <option value="60 a 90 minutos">60 a 90 minutos</option>
              <option value="90 a 120 minutos">90 a 120 minutos</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Formato de Tela (Aspect Ratio)
            </label>
            <select
              name="aspectRatio"
              value={project.aspectRatio}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
            >
              <option value="16:9">16:9 (Cinema / TV)</option>
              <option value="9:16">9:16 (Vertical / TikTok / Reels)</option>
              <option value="4:3">4:3 (Clássico)</option>
              <option value="1:1">1:1 (Quadrado / Instagram)</option>
            </select>
          </div>
        </div>

        {/* Mass Production Activation */}
        <div className={`p-6 rounded-2xl border-2 transition-all ${
          isValidated 
            ? "bg-indigo-50 border-indigo-200 shadow-sm" 
            : "bg-zinc-50 border-zinc-100 opacity-60"
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${isValidated ? "bg-indigo-600 text-white" : "bg-zinc-200 text-zinc-400"}`}>
              <Zap className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-bold ${isValidated ? "text-indigo-900" : "text-zinc-500"}`}>
                Realização Filme em Massa
              </h3>
              <p className="text-sm text-zinc-600 mb-4">
                Inicia a produção automatizada de todo o filme (Guião, Personagens, Cenários, Takes e Vídeos) num único processo inteligente.
              </p>
              <button
                onClick={onStartMassProduction}
                disabled={!isValidated}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                  isValidated
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                }`}
              >
                <Settings className="w-5 h-5" />
                Ativar Produção em Massa
              </button>
              {!isValidated && (
                <p className="mt-2 text-xs text-amber-600 font-medium">
                  * Analisa a consistência e garante que todos os campos estão validados (OK) para desbloquear esta funcionalidade.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
