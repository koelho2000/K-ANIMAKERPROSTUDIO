import React from "react";
import { motion } from "motion/react";
import { Film, ArrowRight, Globe, User, Calendar, Tag } from "lucide-react";

interface WelcomeProps {
  onStart: () => void;
}

export default function Welcome({ onStart }: WelcomeProps) {
  const version = "V2.0.0";
  const date = "09 Março 2026";

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 max-w-2xl w-full px-6 text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center justify-center w-24 h-24 bg-indigo-600 rounded-3xl mb-8 shadow-2xl shadow-indigo-500/20"
        >
          <Film className="w-12 h-12 text-white" />
        </motion.div>

        <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tighter">
          K-ANIMAKER<br />
          <span className="text-indigo-500">PRO STUDIO</span>
        </h1>

        <p className="text-zinc-400 text-lg mb-12 max-w-md mx-auto leading-relaxed">
          A plataforma definitiva para realizadores de animação. 
          Gera guiões, personagens e vídeos com o poder da Inteligência Artificial.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
            <Tag className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Versão</div>
            <div className="text-sm font-bold text-zinc-200">{version}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
            <Calendar className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Data</div>
            <div className="text-sm font-bold text-zinc-200">{date}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
            <User className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Autor</div>
            <div className="text-sm font-bold text-zinc-200">Koelho2000</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
            <Globe className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Website</div>
            <a href="https://www.koelho2000.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-indigo-400 hover:underline">
              koelho2000.com
            </a>
          </div>
        </div>

        <button
          onClick={onStart}
          className="group relative inline-flex items-center gap-3 bg-white text-zinc-950 px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-105 active:scale-95"
        >
          Entrar no Estúdio
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>

        <div className="mt-12 text-zinc-600 text-xs font-medium tracking-widest uppercase">
          By Koelho2000
        </div>
      </motion.div>
    </div>
  );
}
