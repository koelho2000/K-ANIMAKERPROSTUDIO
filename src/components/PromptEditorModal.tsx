import React, { useState, useEffect } from "react";
import { X, Sparkles, AlertCircle } from "lucide-react";

interface PromptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (editedPrompt: string) => void;
  initialPrompt: string;
  title: string;
  description?: string;
}

export function PromptEditorModal({
  isOpen,
  onClose,
  onConfirm,
  initialPrompt,
  title,
  description,
}: PromptEditorModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);

  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">{title}</h3>
              {description && <p className="text-sm text-zinc-500">{description}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              Prompt de Geração
              <span className="normal-case font-normal text-zinc-400">(Podes editar antes de gerar)</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-64 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm text-zinc-700 font-mono leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder="Escreve o prompt aqui..."
            />
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Dica:</strong> Mantém as instruções críticas (como "NO CHARACTERS") se quiseres garantir que o resultado respeita as regras do projeto.
            </p>
          </div>
        </div>

        <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-medium text-zinc-600 hover:bg-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(prompt)}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
          >
            <Sparkles className="w-5 h-5" />
            Confirmar e Gerar
          </button>
        </div>
      </div>
    </div>
  );
}
