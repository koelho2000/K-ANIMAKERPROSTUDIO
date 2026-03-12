import React, { useState, useEffect } from "react";
import { Project } from "../types";
import { generateText } from "../services/geminiService";
import { Loader2, Sparkles } from "lucide-react";
import ProgressBar from "./ProgressBar";

interface StoryProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function Story({ project, setProject }: StoryProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 5;
        });
      }, 500);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const isPTPT = project.language === "Português (Portugal)";
      const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : project.language;
      
      const prompt = `
        Gera um guião detalhado (story script) para um filme de animação com as seguintes características:
        - Título: ${project.title}
        - Ideia Central: ${project.idea}
        - Conceito/Tema: ${project.concept}
        - Tipo de Filme: ${project.filmType}
        - Estilo de Filme: ${project.filmStyle}
        - Público Alvo: ${project.targetAudience || 'Adultos'}
        - Língua/Nacionalidade: ${langSpec}
        - Duração Esperada: ${project.duration}

        ${isPTPT ? "IMPORTANTE: O guião deve ser escrito estritamente em Português de Portugal (ex: 'ecrã' em vez de 'tela', 'comboio' em vez de 'trem', 'autocarro' em vez de 'ônibus', etc.)." : ""}
        O guião deve incluir uma estrutura de 3 atos, descrições ricas dos ambientes e o arco narrativo principal.
      `;
      const script = await generateText(
        prompt,
        "És um argumentista premiado de cinema de animação.",
      );
      setProject({ ...project, script });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar guião. Verifica a consola.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">
            Guião da História
          </h2>
          <p className="text-zinc-500">
            Gera ou edita o guião principal para o teu filme.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !project.idea}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          Gerar Guião
        </button>
      </div>

      {isGenerating && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
          <ProgressBar
            progress={progress}
            label="A gerar guião da história..."
            modelName="Gemini"
          />
        </div>
      )}

      <div className="bg-white p-2 rounded-2xl shadow-sm border border-zinc-100 h-[600px]">
        <textarea
          value={project.script}
          onChange={(e) => setProject({ ...project, script: e.target.value })}
          placeholder="O teu guião aparecerá aqui..."
          className="w-full h-full p-6 resize-none outline-none font-serif text-lg leading-relaxed text-zinc-800 bg-transparent"
        />
      </div>
    </div>
  );
}
