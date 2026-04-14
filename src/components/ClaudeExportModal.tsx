import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, FileJson, Terminal, Layers, Film, Image as ImageIcon, ExternalLink, Info, Copy, Check } from 'lucide-react';

interface ClaudeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExport: () => void;
}

export default function ClaudeExportModal({ isOpen, onClose, onConfirmExport }: ClaudeExportModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const claudePrompt = "Atua como um Diretor de Produção e Engenheiro de Software especializado em Remotion. Analisa o ficheiro JSON de produção cinematográfica anexo que contém toda a estrutura narrativa, personagens, cenários, cenas e takes, incluindo todos os prompts visuais e técnicos já gerados. O teu objetivo é liderar o processo completo de produção utilizando estes dados: 1. Início: Analisa a hierarquia do projeto e define a estrutura de pastas e componentes Remotion. 2. Geração de Personagens: Utiliza os prompts de personagens presentes no JSON para gerar as várias vistas (frente, perfil, costas, topo) garantindo uma referência visual 360º sólida. 3. Criação de Cenários: Utiliza os prompts de cenários do JSON para gerar as perspetivas necessárias, assegurando que a iluminação e o estilo artístico são preservados. 4. Criação do Mundo: Mapeia a ligação entre cenários conforme definido no JSON, estabelecendo as regras visuais do universo. 5. Produção de Cenas e Takes: Utiliza os prompts de 'startFrame' e 'endFrame' de cada take presentes no JSON para a geração de imagens. É CRÍTICO manter a consistência absoluta das personagens e cenários em todos os takes, usando as referências visuais extraídas. 6. Áudio e Sonoplastia: Utiliza os diálogos, narração e descrições sonoras do JSON para integrar no projeto, incluindo sugestões de banda sonora e SFX. 7. Desenvolvimento Remotion: Escreve o código TypeScript para cada cena como uma Composição Remotion, aplicando as durações, transições e movimentos de câmara (pan, zoom, tilt) especificados no JSON. 8. Conclusão: Cria a Composição Principal que orquestra tudo e fornece os comandos de CLI para renderizar o filme em 4K. Gera todo o código num formato pronto a usar e guia-me em cada passo da implementação.";

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(claudePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const instructions = [
    {
      title: "1. Preparação do Ambiente",
      icon: <Terminal className="w-5 h-5 text-indigo-400" />,
      content: "Certifique-se de que tem o ambiente Remotion configurado localmente. Este ficheiro JSON servirá como a 'Source of Truth' para o seu projeto de vídeo programático."
    },
    {
      title: "2. Integração com Claude",
      icon: <Info className="w-5 h-5 text-blue-400" />,
      content: "Carregue este ficheiro JSON no Claude (Anthropic). Utilize o prompt: 'Analisa este ficheiro de produção cinematográfica e ajuda-me a criar os componentes Remotion necessários para renderizar cada take e cena conforme as descrições técnicas.'"
    },
    {
      title: "3. Produção de Imagens",
      icon: <ImageIcon className="w-5 h-5 text-emerald-400" />,
      content: "O Claude irá ler as descrições de 'action' e 'camera' para gerar prompts precisos. Pode usar estes prompts para gerar os 'startFrame' e 'endFrame' de cada take, garantindo consistência visual absoluta."
    },
    {
      title: "4. Animação e Vídeo",
      icon: <Film className="w-5 h-5 text-purple-400" />,
      content: "Com as imagens geradas, utilize o Remotion para orquestrar a animação. O JSON contém os tempos de duração e transições, permitindo que o Claude escreva o código de interpolação e efeitos de câmara (Ken Burns, Zoom, etc)."
    },
    {
      title: "5. Renderização Final",
      icon: <Layers className="w-5 h-5 text-amber-400" />,
      content: "O resultado será um projeto Remotion altamente estruturado onde cada cena é uma composição e cada take é uma sequência, permitindo exportar o filme final em 4K com precisão matemática."
    }
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center text-amber-400">
                <FileJson className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Exportação Claude + Remotion</h2>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Workflow de Produção Programática</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            <div className="bg-amber-600/5 border border-amber-500/10 rounded-2xl p-6">
              <p className="text-zinc-300 text-sm leading-relaxed">
                Este exportador gera um esquema de dados otimizado para ser interpretado por LLMs (como o Claude). 
                A estrutura permite a criação automática de projetos <strong>Remotion</strong>, facilitando a produção de vídeos baseada em código.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Prompt Mestre para o Claude
                </h3>
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-all border border-zinc-700"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copiado!" : "Copiar Prompt"}
                </button>
              </div>
              <div className="bg-black/40 border border-zinc-800 rounded-2xl p-4 font-mono text-[10px] text-zinc-400 leading-relaxed select-all">
                {claudePrompt}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-indigo-400" />
                Instruções de Utilização
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {instructions.map((item, idx) => (
                  <div key={idx} className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-5 flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm mb-1">{item.title}</h4>
                      <p className="text-zinc-400 text-xs leading-relaxed">{item.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Terminal className="w-3 h-3" />
              <span>JSON v1.0 • Remotion Compatible</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onConfirmExport();
                  onClose();
                }}
                className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-500/20"
              >
                <Download className="w-4 h-4" />
                Exportar JSON
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
