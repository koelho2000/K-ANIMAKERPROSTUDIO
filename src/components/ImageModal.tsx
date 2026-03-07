import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, ZoomIn } from "lucide-react";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl, title }) => {
  if (!imageUrl) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 md:p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-h-full max-w-full overflow-hidden rounded-lg bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
              <h3 className="text-sm font-medium text-white drop-shadow-md">{title || "Visualização da Imagem"}</h3>
              <div className="flex gap-2">
                <a
                  href={imageUrl}
                  download={`image-${Date.now()}.png`}
                  className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                  title="Descarregar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={20} />
                </a>
                <button
                  onClick={onClose}
                  className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                  title="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div className="flex items-center justify-center overflow-auto p-2 pt-16">
              <img
                src={imageUrl}
                alt={title || "Imagem maximizada"}
                className="max-h-[85vh] w-auto object-contain shadow-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Footer / Info */}
            <div className="bg-zinc-900 p-4 text-center">
              <p className="text-xs text-zinc-400">
                Clique fora da imagem ou no botão fechar para voltar.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
