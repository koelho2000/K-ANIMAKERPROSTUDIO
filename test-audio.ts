import { GoogleGenAI, Modality } from "@google/genai";

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-native-audio-preview-12-2025",
    contents: "Generate a 5 second atmospheric soundtrack for a sci-fi scene.",
    config: {
      responseModalities: [Modality.AUDIO],
    }
  });
  console.log(response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType);
}
test().catch(console.error);
