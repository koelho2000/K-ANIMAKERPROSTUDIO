import React from 'react';
import { Info, X } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function AlertModal({ isOpen, title, message, onClose }: AlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-zinc-600">{message}</p>
        </div>
        <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
