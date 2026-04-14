import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Copy, FileText, Image as ImageIcon, Film, BookOpen, CheckCircle2 } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface MethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MethodologyModal({ isOpen, onClose }: MethodologyModalProps) {
  const methodologyContent = {
    title: "Metodologia K-ANIMAKER PRO STUDIO",
    sections: [
      {
        title: "1. Visão Geral do Sistema",
        icon: <BookOpen className="w-5 h-5 text-indigo-400" />,
        content: "O K-ANIMAKER PRO STUDIO é uma plataforma integrada de produção cinematográfica que utiliza Inteligência Artificial Generativa para automatizar e otimizar todas as fases da criação de um filme de animação. A metodologia baseia-se num fluxo de trabalho linear e iterativo, onde cada etapa alimenta a seguinte com dados estruturados."
      },
      {
        title: "2. Geração de Informação em Texto (LLM - Gemini)",
        icon: <FileText className="w-5 h-5 text-blue-400" />,
        content: "A inteligência narrativa é processada pelos modelos Gemini da Google. \n\n• História e Guião: A partir de uma ideia e conceito, o sistema gera um guião técnico completo, incluindo diálogos, ações e descrições de ambiente.\n• Personagens e Cenários: O modelo analisa o guião para extrair perfis psicológicos e físicos dos personagens, bem como descrições visuais detalhadas dos cenários.\n• Análise Crítica: O sistema avalia a consistência narrativa e sugere melhorias para garantir que a história é cativante e estruturalmente sólida."
      },
      {
        title: "3. Geração de Informação em Imagem (Imagen / Nanobana)",
        icon: <ImageIcon className="w-5 h-5 text-emerald-400" />,
        content: "A tradução do texto para visual é feita através de modelos de difusão de imagem de alta fidelidade.\n\n• Concept Art: Transforma as descrições textuais em representações visuais de personagens e ambientes.\n• Storyboarding: Gera quadros-chave para cada take do filme, definindo a composição, iluminação e estilo visual.\n• Vistas de Câmara: Cria perspetivas múltiplas (frente, perfil, topo) para garantir a consistência espacial e facilitar a animação posterior."
      },
      {
        title: "4. Geração de Informação em Vídeo (Veo / Flow)",
        icon: <Film className="w-5 h-5 text-purple-400" />,
        content: "A fase final de animação utiliza modelos de vídeo avançados como o Google Veo.\n\n• Image-to-Video: Os storyboards estáticos são animados, transformando imagens em sequências de vídeo fluidas.\n• Controlo de Movimento: O sistema interpreta os prompts de câmara (zoom, pan, tilt) e as ações dos personagens para gerar movimentos realistas e cinematográficos.\n• Produção em Massa: Permite a geração automatizada de múltiplos takes em paralelo, acelerando drasticamente o tempo de produção."
      }
    ]
  };

  const handleCopy = () => {
    const text = `${methodologyContent.title}\n\n${methodologyContent.sections.map(s => `${s.title}\n${s.content}`).join('\n\n')}`;
    navigator.clipboard.writeText(text);
    alert("Metodologia copiada para a área de transferência!");
  };

  const handleExportDocx = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: methodologyContent.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          ...methodologyContent.sections.flatMap(section => [
            new Paragraph({
              text: section.title,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: section.content,
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            }),
          ]),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "Metodologia_K-ANIMAKER.docx");
  };

  if (!isOpen) return null;

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
          className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Metodologia do Sistema</h2>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Documentação Técnica Detalhada</p>
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
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-6">
              <p className="text-zinc-300 leading-relaxed italic">
                "O K-ANIMAKER PRO STUDIO redefine a criação de animação ao fundir a criatividade humana com a precisão da Inteligência Artificial Generativa, permitindo que uma única pessoa realize visões cinematográficas complexas em tempo recorde."
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {methodologyContent.sections.map((section, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-6 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-zinc-900 rounded-lg">
                      {section.icon}
                    </div>
                    <h3 className="text-lg font-bold text-white">{section.title}</h3>
                  </div>
                  <div className="text-zinc-400 text-sm leading-relaxed whitespace-pre-wrap">
                    {section.content}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Vantagens da Metodologia
              </h3>
              <ul className="grid grid-cols-2 gap-4 text-sm text-zinc-400">
                <li className="flex items-center gap-2">• Redução de 90% no tempo de pré-produção</li>
                <li className="flex items-center gap-2">• Consistência visual entre cenas</li>
                <li className="flex items-center gap-2">• Automação de tarefas repetitivas</li>
                <li className="flex items-center gap-2">• Escalabilidade de produção</li>
              </ul>
            </div>
          </div>

          {/* Footer / Actions */}
          <div className="p-6 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              © 2026 K-ANIMAKER PRO STUDIO • Documentação Gerada Automaticamente
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                <Copy className="w-4 h-4" />
                Copiar Texto
              </button>
              <button
                onClick={handleExportDocx}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
              >
                <Download className="w-4 h-4" />
                Exportar DOCX
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
