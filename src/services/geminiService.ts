import { GoogleGenAI, Type } from "@google/genai";

// Helper to get the AI instance with the selected API key
export const getGenAI = () => {
  // Try to get the selected key from the environment (injected by AI Studio)
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please select an API key.");
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

export const pollVideoOperation = async (operationName: string) => {
  const ai = getGenAI();
  let currentOperation = await ai.operations.getVideosOperation({
    operation: { name: operationName } as any,
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

  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
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
