import React, { useState, useEffect, useRef } from "react";
import { X, Sparkles, AlertCircle, Image as ImageIcon, Check, Upload } from "lucide-react";

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  selected: boolean;
}

interface VideoPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (editedPrompt: string, selectedImages: string[], adjustSettings: boolean) => void;
  initialPrompt: string;
  suggestedImages: { id: string; url: string; name: string }[];
  startFrameUrl?: string;
  currentModel: string;
  currentAspectRatio: string;
}

export function VideoPromptModal({
  isOpen,
  onClose,
  onConfirm,
  initialPrompt,
  suggestedImages,
  startFrameUrl,
  currentModel,
  currentAspectRatio,
}: VideoPromptModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [adjustSettings, setAdjustSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsAdjustment = currentModel !== 'veo-3.1' || currentAspectRatio !== '16:9';

  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt);
      setAdjustSettings(false);
      setImages(
        suggestedImages.map((img) => ({
          ...img,
          selected: true,
        }))
      );
    }
  }, [isOpen, initialPrompt, suggestedImages]);

  const toggleImage = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, selected: !img.selected } : img
      )
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setImages((prev) => [
        ...prev,
        {
          id: `custom-${Date.now()}`,
          url,
          name: file.name,
          selected: true,
        },
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Validar Prompt de Vídeo</h3>
              <p className="text-sm text-zinc-500">Edita o prompt e escolhe as imagens de referência.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              Prompt de Geração
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-32 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm text-zinc-700 font-mono leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder="Escreve o prompt aqui..."
            />
          </div>

          <div className="space-y-4">
            {startFrameUrl && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Frame Inicial (Obrigatório)
                </label>
                <div className="relative w-48 aspect-video rounded-xl overflow-hidden border-2 border-indigo-500 shadow-md">
                  <img src={startFrameUrl} alt="Frame Inicial" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <p className="absolute bottom-2 left-2 right-2 text-[10px] font-medium text-white truncate text-shadow-sm">
                    Frame Inicial
                  </p>
                  <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Imagens de Referência (Opcional)
                </label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  Adicionar Imagem
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => toggleImage(img.id)}
                    className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                      img.selected ? 'border-indigo-500 shadow-md' : 'border-transparent opacity-50 hover:opacity-80'
                    }`}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <p className="absolute bottom-2 left-2 right-2 text-[10px] font-medium text-white truncate text-shadow-sm">
                      {img.name}
                    </p>
                    {img.selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
                {images.length === 0 && (
                  <div className="col-span-full py-8 text-center border-2 border-dashed border-zinc-200 rounded-xl">
                    <p className="text-sm text-zinc-500">Nenhuma imagem de referência sugerida.</p>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 italic">
                Apenas o modelo Veo 3.1 com proporção 16:9 utilizará estas imagens de referência.
              </p>
              {needsAdjustment && images.some(img => img.selected) && (
                <div className="mt-2 flex items-start gap-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                  <input
                    type="checkbox"
                    id="adjustSettings"
                    checked={adjustSettings}
                    onChange={(e) => setAdjustSettings(e.target.checked)}
                    className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="adjustSettings" className="text-xs text-indigo-900 cursor-pointer">
                    <strong>Ajustar definições automaticamente:</strong> Alterar o modelo para Veo 3.1 e a proporção para 16:9 para utilizar as imagens de referência.
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Dica:</strong> Mantém as instruções críticas se quiseres garantir que o resultado respeita as regras do projeto.
            </p>
          </div>
        </div>

        <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-3 justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-medium text-zinc-600 hover:bg-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(prompt, images.filter(i => i.selected).map(i => i.url), adjustSettings)}
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
