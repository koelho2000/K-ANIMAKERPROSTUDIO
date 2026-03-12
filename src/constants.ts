import { FileText, Image as ImageIcon, Clapperboard, Video, Zap, Film, Mic, Languages } from "lucide-react";

export const AUTOMATION_PHASES = [
  { id: 1, name: "Guião, Personagens e Cenários (Texto)", icon: FileText },
  { id: 2, name: "Personagens (Imagem Principal)", icon: ImageIcon },
  { id: 3, name: "Personagens (Vistas/Views)", icon: ImageIcon },
  { id: 4, name: "Cenários (Imagens)", icon: ImageIcon },
  { id: 5, name: "Cenas e Takes (Texto)", icon: Clapperboard },
  { id: 6, name: "Takes (Frame Inicial)", icon: ImageIcon },
  { id: 7, name: "Takes (Frame Final)", icon: ImageIcon },
  { id: 8, name: "Takes (Vídeos)", icon: Video },
  { id: 9, name: "Intro e Créditos (Vídeos)", icon: Zap },
  { id: 10, name: "Narração IA (Áudio)", icon: Mic },
  { id: 11, name: "Legendas IA (Texto)", icon: Languages },
  { id: 12, name: "Montagem Final do Filme", icon: Film },
];
