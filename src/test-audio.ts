import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const prompt = `Generate an atmospheric soundtrack representing: epic orchestral. 
    This audio will be used as background music. 
    Make atmospheric sounds and music that match the style, strictly without human speech.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    console.log("Audio generation response parts:", parts.length);
    
    const audioPart = parts.find(p => p.inlineData?.mimeType?.includes('audio') || p.inlineData?.data);
    if (audioPart) {
      console.log("Success! Audio generated.");
    } else {
      console.log("No audio part found.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
