import React from "react";
import { motion } from "motion/react";
import { Sparkles, Zap, Film } from "lucide-react";

interface ProgressBarProps {
  progress: number;
  label: string;
  modelName?: "Nanobana" | "Flow" | "Gemini" | "Veo" | "Veo 3.1" | "Veo Fast";
  tasks?: { name: string; status: 'pending' | 'active' | 'completed' }[];
}

export default function ProgressBar({ progress, label, modelName, tasks }: ProgressBarProps) {
  const getIcon = () => {
    switch (modelName) {
      case "Nanobana":
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case "Flow":
        return <Film className="w-4 h-4 text-indigo-500" />;
      case "Veo":
      case "Veo 3.1":
      case "Veo Fast":
        return <Film className="w-4 h-4 text-emerald-500" />;
      case "Gemini":
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2 text-zinc-600">
            {getIcon()}
            <span>{label}</span>
            {modelName && (
              <span className="text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-400 uppercase tracking-wider">
                {modelName}
              </span>
            )}
          </div>
          <span className="text-zinc-400">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
      
      {tasks && tasks.length > 0 && (
        <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100 space-y-2">
          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Tarefas</h4>
          <div className="space-y-1.5">
            {tasks.map((task, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                {task.status === 'completed' ? (
                  <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : task.status === 'active' ? (
                  <div className="w-3 h-3 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                ) : (
                  <div className="w-3 h-3 rounded-full border-2 border-zinc-200" />
                )}
                <span className={`${
                  task.status === 'completed' ? 'text-zinc-500 line-through' : 
                  task.status === 'active' ? 'text-zinc-900 font-medium' : 
                  'text-zinc-400'
                }`}>
                  {task.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
