import React from "react";
import { Coins, X, FileText, ImageIcon, Film, AlertCircle, TrendingUp } from "lucide-react";

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  usage: {
    textUnits: number;
    imagesCount: number;
    videosCount: number;
    textCost: number;
    imageCost: number;
    videoCost: number;
    totalCost: number;
    totalCredits: number;
  };
}

export function UsageModal({ isOpen, onClose, usage }: UsageModalProps) {
  if (!isOpen) return null;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
              <Coins className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Detalhe de Custos e Créditos</h3>
              <p className="text-xs text-zinc-500">Análise detalhada do consumo do projeto</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Total de Créditos</p>
              <p className="text-2xl font-black text-white">{usage.totalCredits}</p>
            </div>
            <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
              <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider mb-1">Custo Total Estimado</p>
              <p className="text-2xl font-black text-emerald-500">{formatCurrency(usage.totalCost)}</p>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">Divisão por Categoria</h4>
            
            {/* Text */}
            <div className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between group hover:bg-zinc-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                  <FileText className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Conteúdo de Texto</p>
                  <p className="text-xs text-zinc-500">{usage.textUnits} unidades geradas</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{formatCurrency(usage.textCost)}</p>
                <p className="text-[10px] text-zinc-500">0,05€ / unidade</p>
              </div>
            </div>

            {/* Images */}
            <div className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between group hover:bg-zinc-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center group-hover:bg-pink-500/20 transition-colors">
                  <ImageIcon className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Imagens e Frames</p>
                  <p className="text-xs text-zinc-500">{usage.imagesCount} imagens geradas</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{formatCurrency(usage.imageCost)}</p>
                <p className="text-[10px] text-zinc-500">0,25€ / imagem</p>
              </div>
            </div>

            {/* Videos */}
            <div className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between group hover:bg-zinc-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                  <Film className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Vídeos e Renderização</p>
                  <p className="text-xs text-zinc-500">{usage.videosCount} vídeos processados</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{formatCurrency(usage.videoCost)}</p>
                <p className="text-[10px] text-zinc-500">3,50€ / vídeo</p>
              </div>
            </div>
          </div>

          {/* Warning/Info */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-500">Ajuste de Faturação Google Cloud</p>
              <p className="text-[10px] text-amber-200/70 leading-relaxed">
                Os custos foram ajustados para refletir as taxas reais de processamento da Google (Gemini 1.5 Pro e Veo). 
                Estes valores são estimativas baseadas no volume de tokens e tempo de renderização.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-500">
            <TrendingUp className="w-4 h-4" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Cálculo em Tempo Real</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-colors text-sm"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
