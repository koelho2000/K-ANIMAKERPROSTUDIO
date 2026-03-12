import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VideoModel } from "../types";

export const getApiKey = () => {
  // 1. Try to get from localStorage (manually entered by user)
  const manualKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY_MANUAL') : null;
  
  // 2. Try to get from environment
  // In AI Studio, the key is often injected into process.env.API_KEY or similar
  const envKey = 
    (typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : null) ||
    (import.meta as any).env?.VITE_API_KEY || 
    (import.meta as any).env?.VITE_GEMINI_API_KEY;
  
  return manualKey || envKey;
};

// Helper to get the AI instance with the selected API key
export const getGenAI = () => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Chave API não encontrada. Por favor, configura a tua chave no menu lateral (Manual) ou seleciona uma chave do sistema.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper for retrying API calls with exponential backoff
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isQuotaError = 
        error.status === 429 || 
        error.message?.includes("429") || 
        error.message?.includes("quota") ||
        error.message?.includes("RESOURCE_EXHAUSTED");

      if (isQuotaError && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 2000 + Math.random() * 1000;
        console.warn(`Quota exceeded (429). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      const errorMsg = error.message?.toLowerCase() || "";
      if (errorMsg.includes("billing") || errorMsg.includes("pay-as-you-go") || errorMsg.includes("faturação")) {
        throw new Error("A tua chave API não tem uma conta de faturação associada. A geração de vídeo (Veo) e imagens de alta qualidade requerem um projeto pago no Google Cloud.");
      }

      if (errorMsg.includes("api_key_invalid") || errorMsg.includes("invalid api key")) {
        throw new Error("Chave API inválida. Por favor, verifica se a chave foi copiada corretamente.");
      }

      if (errorMsg.includes("permission_denied") || error.status === 403) {
        throw new Error("Acesso negado. A tua chave API pode não ter permissões para este modelo ou região.");
      }
      
      // If it's a quota error and we're out of retries, throw a better message
      if (isQuotaError) {
        throw new Error("Limite de quota atingido (429). Por favor, aguarda um momento antes de tentar novamente ou verifica a tua conta de faturação.");
      }
      
      throw error;
    }
  }
  throw lastError;
};

export const generateText = async (
  prompt: string,
  systemInstruction?: string,
) => {
  return withRetry(async () => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });
    return response.text || "";
  });
};

export const generateJSON = async (
  prompt: string,
  schema: any,
  systemInstruction?: string,
) => {
  return withRetry(async () => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return response.text || "";
  });
};

export const generateImage = async (prompt: string, aspectRatio: string = "16:9", referenceImagesBase64?: string[]) => {
  return withRetry(async () => {
    const ai = getGenAI();
    const parts: any[] = [{ text: prompt }];

    if (referenceImagesBase64 && referenceImagesBase64.length > 0) {
      referenceImagesBase64.forEach(img => {
        if (img && img.startsWith('data:')) {
          const parts_split = img.split(";base64,");
          if (parts_split.length === 2) {
            // Extract clean mime type (everything between 'data:' and the first ';')
            const mimeTypeMatch = parts_split[0].match(/data:([^;]+)/);
            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/png";
            const base64Data = parts_split[1];
            parts.unshift({
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            });
          }
        } else {
          console.warn("A ignorar imagem de referência que não é data URL ou está malformada:", img?.substring(0, 50));
        }
      });
    }

    const finalPrompt = `${prompt} | CRITICAL: NO TEXT, NO SUBTITLES, NO CAPTIONS, NO WATERMARKS, NO OVERLAYS. The output must be PURE VISUAL CONTENT ONLY. Do not include any written characters, letters, or numbers in the image.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: finalPrompt }, ...parts.slice(1)],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        const mimeType = part.inlineData.mimeType || "image/png";
        // Remove any potential whitespace or newlines from the base64 data
        const data = part.inlineData.data.replace(/[\s\n\r]/g, '');
        if (data.length > 0) {
          return `data:${mimeType};base64,${data}`;
        }
      }
    }
    throw new Error("No image generated.");
  });
};

export const generateVideo = async (
  prompt: string,
  startImageBase64?: string,
  endImageBase64?: string,
  model: VideoModel = 'flow',
  aspectRatio: string = "16:9",
) => {
  return withRetry(async () => {
    const ai = getGenAI();

    const config: any = {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: aspectRatio,
    };

    let modelName = 'veo-3.1-fast-generate-preview'; // Default to flow/fast
    
    if (model === 'veo-3.1') {
      modelName = 'veo-3.1-generate-preview';
    } else if (model === 'veo-fast') {
      modelName = 'veo-3.1-fast-generate-preview';
    } else if (model === 'flow') {
      modelName = 'veo-3.1-fast-generate-preview';
    }

    const finalPrompt = `${prompt} | CRITICAL: NO TEXT, NO SUBTITLES, NO CAPTIONS, NO WATERMARKS, NO OVERLAYS. The output must be PURE VISUAL CONTENT ONLY. Do not include any written characters, letters, or numbers in the video frames.`;

    const request: any = {
      model: modelName,
      prompt: finalPrompt,
      config,
    };

    if (startImageBase64 && startImageBase64.startsWith('data:')) {
      const parts_split = startImageBase64.split(";base64,");
      if (parts_split.length === 2) {
        const mimeTypeMatch = parts_split[0].match(/data:([^;]+)/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/png";
        request.image = {
          imageBytes: parts_split[1],
          mimeType: mimeType,
        };
      }
    } else if (startImageBase64) {
      console.warn("A ignorar imagem inicial do vídeo que não é data URL:", startImageBase64.substring(0, 50));
    }

    if (endImageBase64 && endImageBase64.startsWith('data:')) {
      const parts_split = endImageBase64.split(";base64,");
      if (parts_split.length === 2) {
        const mimeTypeMatch = parts_split[0].match(/data:([^;]+)/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/png";
        request.config.lastFrame = {
          imageBytes: parts_split[1],
          mimeType: mimeType,
        };
      }
    } else if (endImageBase64) {
      console.warn("A ignorar imagem final do vídeo que não é data URL:", endImageBase64.substring(0, 50));
    }

    const operation = await ai.models.generateVideos(request);
    return operation;
  });
};

export const pollVideoOperation = async (operationOrName: any) => {
  const ai = getGenAI();
  
  // Ensure we have an operation object with a name
  const operation = typeof operationOrName === 'string' 
    ? { name: operationOrName } 
    : operationOrName;

  console.log(`Iniciando polling para operação: ${operation.name}`);
  
  let currentOperation;
  try {
    currentOperation = await withRetry(() => ai.operations.getVideosOperation({
      operation: operation,
    }));
  } catch (error: any) {
    console.error("Erro ao obter operação inicial:", error);
    throw new Error(`Falha ao iniciar monitorização do vídeo: ${error.message}`);
  }

  let attempts = 0;
  while (!currentOperation.done) {
    attempts++;
    console.log(`Polling tentativa ${attempts} para ${operation.name}...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    
    try {
      currentOperation = await withRetry(() => ai.operations.getVideosOperation({
        operation: currentOperation,
      }));
    } catch (error: any) {
      console.error(`Erro na tentativa ${attempts}:`, error);
      // Don't throw immediately on a single network error, retry a few times
      if (attempts > 10) {
        throw new Error(`Erro persistente ao monitorizar vídeo: ${error.message}`);
      }
    }
  }

  if (currentOperation.error) {
    console.error("Operação terminou com erro:", currentOperation.error);
    const errorMsg = currentOperation.error.message || "Erro desconhecido na geração de vídeo.";
    const lowerMsg = errorMsg.toLowerCase();
    if (lowerMsg.includes("billing") || lowerMsg.includes("pay-as-you-go") || lowerMsg.includes("faturação")) {
      throw new Error("A tua chave API não tem uma conta de faturação associada. A geração de vídeo (Veo) requer um projeto pago no Google Cloud.");
    }
    throw new Error(`Erro na geração do vídeo: ${errorMsg}`);
  }

  const downloadLink =
    currentOperation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error("Geração de vídeo concluída, mas nenhum link foi retornado.");
  }

  console.log(`Vídeo pronto! Link: ${downloadLink}`);

  const apiKey = getApiKey();

  const response = await fetch(downloadLink, {
    method: "GET",
    headers: {
      "x-goog-api-key": apiKey as string,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erro ao descarregar vídeo:", errorText);
    throw new Error(`Falha ao descarregar o ficheiro de vídeo: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("O vídeo descarregado está vazio.");
  }

  const videoUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (result && result.length > 100) {
        resolve(result);
      } else {
        reject(new Error("Erro ao converter vídeo para Data URL ou ficheiro demasiado pequeno."));
      }
    };
    reader.onerror = () => reject(new Error("Erro na leitura do blob do vídeo."));
    reader.readAsDataURL(blob);
  });

  return {
    videoUrl,
    videoObject: currentOperation.response?.generatedVideos?.[0]?.video
  };
};

export const extendVideo = async (
  prompt: string,
  previousVideo: any,
  model: VideoModel = 'veo-3.1',
  aspectRatio: string = "16:9",
) => {
  return withRetry(async () => {
    const ai = getGenAI();

    const config: any = {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: aspectRatio,
    };

    let modelName = 'veo-3.1-fast-generate-preview';
    
    if (model === 'veo-3.1') {
      modelName = 'veo-3.1-generate-preview';
    } else if (model === 'veo-fast') {
      modelName = 'veo-3.1-fast-generate-preview';
    } else if (model === 'flow') {
      modelName = 'veo-3.1-fast-generate-preview';
    }

    const request: any = {
      model: modelName,
      prompt,
      video: previousVideo,
      config,
    };

    const operation = await ai.models.generateVideos(request);
    return operation;
  });
};

export const describeCharacterFromImage = async (base64Image: string, filmType?: string, filmStyle?: string, language: string = "Português (Portugal)") => {
  return withRetry(async () => {
    const ai = getGenAI();
    const [mimeType, base64Data] = base64Image.split(";base64,");
    
    const isPTPT = language === "Português (Portugal)";
    const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : language;
    const context = filmType && filmStyle ? `\nContexto do Projeto: Tipo de Filme: ${filmType}, Estilo Visual: ${filmStyle}.` : "";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType.replace("data:", ""),
            },
          },
          {
            text: `Descreve detalhadamente esta personagem de animação.${context} Inclui a sua aparência física, vestuário, cores principais e personalidade sugerida pela imagem. A descrição deve ser em ${langSpec} e adequada para ser usada como prompt de geração de imagem. ${isPTPT ? "Usa estritamente Português de Portugal." : ""}`,
          },
        ],
      },
    });

    return response.text || "";
  });
};

export const describeSettingFromImage = async (base64Image: string, filmType?: string, filmStyle?: string, language: string = "Português (Portugal)") => {
  return withRetry(async () => {
    const ai = getGenAI();
    const [mimeType, base64Data] = base64Image.split(";base64,");
    
    const isPTPT = language === "Português (Portugal)";
    const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : language;
    const context = filmType && filmStyle ? `\nContexto do Projeto: Tipo de Filme: ${filmType}, Estilo Visual: ${filmStyle}.` : "";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType.replace("data:", ""),
            },
          },
          {
            text: `Descreve detalhadamente este cenário ou localização para um filme de animação.${context} Foca-te na arquitetura, iluminação, cores, atmosfera e detalhes ambientais. NÃO incluas personagens na descrição. A descrição deve ser em ${langSpec} e adequada para ser usada como prompt de geração de imagem. ${isPTPT ? "Usa estritamente Português de Portugal." : ""}`,
          },
        ],
      },
    });

    return response.text || "";
  });
};

export const analyzeCoherence = async (
  prompt: string,
  imagesBase64?: string[],
) => {
  return withRetry(async () => {
    const ai = getGenAI();
    const parts: any[] = [{ text: prompt }];

    if (imagesBase64 && imagesBase64.length > 0) {
      imagesBase64.forEach((img) => {
        const [mimeType, base64Data] = img.split(";base64,");
        parts.unshift({
          inlineData: {
            data: base64Data,
            mimeType: mimeType.replace("data:", ""),
          },
        });
      });
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, enum: ["ok", "warning", "error"] },
        feedback: { type: Type.STRING },
        suggestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ["status", "feedback", "suggestions"],
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return JSON.parse(response.text || "{}");
  });
};

export const validateApiKey = async (key: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    // Try a very simple request to check if the key is valid
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "ping",
      config: { maxOutputTokens: 1 }
    });
    
    // If we got here, the key is valid for basic text
    return { valid: true, message: "Chave válida!" };
  } catch (error: any) {
    console.error("Erro ao validar chave:", error);
    let message = "Chave inválida.";
    if (error.message?.includes("API_KEY_INVALID")) {
      message = "Chave API inválida ou expirada.";
    } else if (error.message?.includes("billing")) {
      message = "Chave válida, mas sem conta de faturação associada.";
    } else if (error.status === 403) {
      message = "Acesso negado. Verifica as permissões da chave.";
    }
    return { valid: false, message };
  }
};

export const generateNarrationText = async (
  action: string,
  language: string,
  context: string,
  previousNarrations: string[] = [],
  targetDuration?: number
) => {
  return withRetry(async () => {
    const ai = getGenAI();
    const isPTPT = language === "Português (Portugal)";
    const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : language;
    
    const durationContext = targetDuration 
      ? `O take tem uma duração de EXATAMENTE ${targetDuration} segundos. O texto deve ser lido confortavelmente nesse tempo (aproximadamente ${Math.max(1, Math.floor(targetDuration * 2.5))} palavras).`
      : "Gera um texto de narração curto (máximo 2 frases).";

    const prompt = `Gera um texto de narração para um take de um filme.
    Acção do Take: "${action}"
    Língua: ${langSpec}
    Contexto do Filme: ${context}
    Narração anterior (para manter consistência): ${previousNarrations.slice(-2).join(" | ")}
    
    ${durationContext}
    ${isPTPT ? "IMPORTANTE: Usa estritamente Português de Portugal (ex: 'ecrã' em vez de 'tela', 'tu estás' em vez de 'você está', etc.)." : ""}
    O narrador deve ser expressivo e a entoação deve condizer com a acção. 
    Responde APENAS com o texto da narração, sem aspas ou comentários.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
    });
    return response.text || "";
  });
};

// Helper to convert base64 to Uint8Array
const base64ToUint8Array = (base64: string) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper to convert Uint8Array to base64
const uint8ArrayToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Helper to create a WAV header for 16-bit mono PCM
function createWavHeader(pcmLength: number, sampleRate: number = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  /* RIFF identifier */
  view.setUint32(0, 0x52494646, false); // "RIFF"
  /* file length */
  view.setUint32(4, 36 + pcmLength, true);
  /* RIFF type */
  view.setUint32(8, 0x57415645, false); // "WAVE"
  /* format chunk identifier */
  view.setUint32(12, 0x666d7420, false); // "fmt "
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  view.setUint32(36, 0x64617461, false); // "data"
  /* data chunk length */
  view.setUint32(40, pcmLength, true);

  return new Uint8Array(header);
}

const fetchAsBase64 = async (url: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Failed to fetch media for AI analysis:", url, error);
    return null;
  }
};

export const getVoiceForSettings = (gender: 'male' | 'female', ageGroup: 'child' | 'youth' | 'adult' | 'senior') => {
  if (gender === 'male') {
    if (ageGroup === 'child' || ageGroup === 'youth') return 'Puck';
    return 'Charon'; // Adult/Senior
  } else {
    if (ageGroup === 'child' || ageGroup === 'youth') return 'Kore';
    return 'Zephyr'; // Adult/Senior
  }
};

export const generateNarrationAudio = async (text: string, voiceName: string = 'Kore') => {
  return withRetry(async () => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType || "audio/pcm";

    if (base64Audio) {
      // If it's PCM, we need to wrap it in a WAV header for the browser to play it
      if (mimeType.includes("pcm")) {
        const pcmData = base64ToUint8Array(base64Audio);
        const wavHeader = createWavHeader(pcmData.length, 24000);
        const wavData = new Uint8Array(wavHeader.length + pcmData.length);
        wavData.set(wavHeader);
        wavData.set(pcmData, wavHeader.length);
        const finalBase64 = uint8ArrayToBase64(wavData);
        return `data:audio/wav;base64,${finalBase64}`;
      }
      
      // Otherwise use the provided mime type
      return `data:${mimeType};base64,${base64Audio}`;
    }
    throw new Error("Falha ao gerar áudio da narração.");
  });
};

export const generateSubtitles = async (
  action: string,
  narration: string,
  language: string,
  context: string,
  videoUrl?: string,
  narrationAudioUrl?: string
) => {
  return withRetry(async () => {
    const ai = getGenAI();
    const isPTPT = language === "Português (Portugal)";
    const langSpec = isPTPT ? "Português de Portugal (PT-PT)" : language;

    const parts: any[] = [];
    
    // Add context and instructions
    let prompt = `Gera legendas (diálogo) para um take de um filme.
    Acção do Take: "${action}"
    Texto da Narração: "${narration}"
    Língua: ${langSpec}
    Contexto do Filme: ${context}
    
    Instruções:
    1. O diálogo deve ser natural e condizer com a acção e a narração.
    2. Se houver narração, o diálogo não deve repetir exatamente o que o narrador diz, mas sim complementá-lo ou ser o que as personagens dizem nesse momento.
    3. Se houver vídeo ou áudio fornecido, analisa o conteúdo para extrair falas reais ou sons importantes que devam ser legendados.
    4. Mantém o texto curto e conciso para caber no ecrã como legenda.
    5. ${isPTPT ? "Usa estritamente Português de Portugal." : ""}
    6. Responde APENAS com o texto do diálogo/legenda, sem aspas ou comentários. Se não houver necessidade de diálogo, responde "Nenhum".`;

    parts.push({ text: prompt });

    if (videoUrl) {
      const videoBase64 = await fetchAsBase64(videoUrl);
      if (videoBase64) {
        parts.push({
          inlineData: {
            data: videoBase64,
            mimeType: "video/mp4" // Assuming mp4/webm
          }
        });
      }
    }

    if (narrationAudioUrl) {
      const audioBase64 = await fetchAsBase64(narrationAudioUrl);
      if (audioBase64) {
        parts.push({
          inlineData: {
            data: audioBase64,
            mimeType: "audio/wav"
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts },
    });
    
    return response.text || "";
  });
};
