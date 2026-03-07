import { GoogleGenAI, Type } from "@google/genai";

// Helper to get the AI instance with the selected API key
export const getGenAI = () => {
  // 1. Try to get from localStorage (manually entered by user)
  const manualKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY_MANUAL') : null;
  
  // 2. Try to get from environment (injected by AI Studio)
  const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  
  const apiKey = manualKey || envKey;
  
  if (!apiKey) {
    throw new Error("API Key not found. Please select an API key or enter it manually in Settings.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateText = async (
  prompt: string,
  systemInstruction?: string,
) => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction,
    },
  });
  return response.text || "";
};

export const generateJSON = async (
  prompt: string,
  schema: any,
  systemInstruction?: string,
) => {
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
};

export const generateImage = async (prompt: string, aspectRatio: string = "16:9", referenceImagesBase64?: string[]) => {
  const ai = getGenAI();
  const parts: any[] = [{ text: prompt }];

  if (referenceImagesBase64 && referenceImagesBase64.length > 0) {
    referenceImagesBase64.forEach(img => {
      const [mimeType, base64Data] = img.split(";base64,");
      parts.unshift({
        inlineData: {
          data: base64Data,
          mimeType: mimeType.replace("data:", ""),
        },
      });
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: {
      parts: parts,
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated.");
};

export const generateVideo = async (
  prompt: string,
  startImageBase64?: string,
  endImageBase64?: string,
) => {
  const ai = getGenAI();

  const config: any = {
    numberOfVideos: 1,
    resolution: "720p",
    aspectRatio: "16:9",
  };

  const request: any = {
    model: "veo-3.1-fast-generate-preview",
    prompt,
    config,
  };

  if (startImageBase64) {
    const [mimeType, base64Data] = startImageBase64.split(";base64,");
    request.image = {
      imageBytes: base64Data,
      mimeType: mimeType.replace("data:", ""),
    };
  }

  if (endImageBase64) {
    const [mimeType, base64Data] = endImageBase64.split(";base64,");
    request.config.lastFrame = {
      imageBytes: base64Data,
      mimeType: mimeType.replace("data:", ""),
    };
  }

  const operation = await ai.models.generateVideos(request);
  return operation;
};

export const pollVideoOperation = async (operationOrName: any) => {
  const ai = getGenAI();
  
  // Ensure we have an operation object with a name
  const operation = typeof operationOrName === 'string' 
    ? { name: operationOrName } 
    : operationOrName;

  let currentOperation = await ai.operations.getVideosOperation({
    operation: operation,
  });

  while (!currentOperation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    currentOperation = await ai.operations.getVideosOperation({
      operation: currentOperation,
    });
  }

  const downloadLink =
    currentOperation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error("Video generation failed or no URI returned.");
  }

  // Use the same key logic as getGenAI for the fetch
  const manualKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY_MANUAL') : null;
  const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  const apiKey = manualKey || envKey;

  const response = await fetch(downloadLink, {
    method: "GET",
    headers: {
      "x-goog-api-key": apiKey as string,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.statusText}`);
  }

  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const describeCharacterFromImage = async (base64Image: string, filmType?: string, filmStyle?: string) => {
  const ai = getGenAI();
  const [mimeType, base64Data] = base64Image.split(";base64,");
  
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
          text: `Descreve detalhadamente esta personagem de animação.${context} Inclui a sua aparência física, vestuário, cores principais e personalidade sugerida pela imagem. A descrição deve ser em Português e adequada para ser usada como prompt de geração de imagem.`,
        },
      ],
    },
  });

  return response.text || "";
};

export const describeSettingFromImage = async (base64Image: string, filmType?: string, filmStyle?: string) => {
  const ai = getGenAI();
  const [mimeType, base64Data] = base64Image.split(";base64,");
  
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
          text: `Descreve detalhadamente este cenário ou localização para um filme de animação.${context} Foca-te na arquitetura, iluminação, cores, atmosfera e detalhes ambientais. NÃO incluas personagens na descrição. A descrição deve ser em Português e adequada para ser usada como prompt de geração de imagem.`,
        },
      ],
    },
  });

  return response.text || "";
};

export const analyzeCoherence = async (
  prompt: string,
  imagesBase64?: string[],
) => {
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
};
