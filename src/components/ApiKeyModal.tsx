import React, { useState } from "react";
import { Key, X, Check, AlertCircle } from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  currentKey: string;
}

export function ApiKeyModal({ isOpen, onClose, onSave, currentKey }: ApiKeyModalProps) {
  const [key, setKey] = useState(currentKey);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(key);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Chave API Gemini</h3>
              <p className="text-xs text-zinc-500">Configura a tua chave manualmente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Chave API (Alfanumérica)
            </label>
            <div className="relative">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Introduz a tua chave API aqui..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono text-sm"
              />
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              A tua chave será guardada apenas no teu navegador (localStorage). 
              Podes obter uma chave gratuita em <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>.
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-500">Nota sobre Vídeos (Veo)</p>
              <p className="text-[10px] text-amber-200/70 leading-relaxed">
                Para gerar vídeos, a chave deve pertencer a um projeto Google Cloud com faturação ativa. 
                Chaves do nível gratuito podem não suportar geração de vídeo.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 font-medium hover:bg-zinc-900 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!key.trim()}
            className={`flex-1 px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              showSuccess 
                ? "bg-emerald-600 text-white" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            }`}
          >
            {showSuccess ? (
              <>
                <Check className="w-5 h-5" />
                Guardado!
              </>
            ) : (
              "Guardar Chave"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
