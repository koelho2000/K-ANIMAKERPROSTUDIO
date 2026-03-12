import React from "react";
import { motion } from "motion/react";
import { Sparkles, Zap, Film } from "lucide-react";

interface ProgressBarProps {
  progress: number;
  label: string;
  modelName?: "Nanobana" | "Flow" | "Gemini" | "Veo" | "Veo 3.1" | "Veo Fast";
}

export default function ProgressBar({ progress, label, modelName }: ProgressBarProps) {
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
    <div className="w-full space-y-2">
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
  );
}
