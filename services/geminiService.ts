
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Language, QuizQuestion } from "../types";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateQuizQuestions(lang: Language, count: number = 3): Promise<QuizQuestion[]> {
    const prompt = lang === 'de' 
      ? `Generiere ${count} lustige Pub-Quiz-Fragen für eine Silvesterparty 2024. Themen: Popkultur, das Jahr 2024, verrückte Traditionen.`
      : `2024 yılbaşı partisi için ${count} adet komik ve eğlenceli genel kültür sorusu hazırla. Konular: Popüler kültür, 2024 yılı, ilginç gelenekler.`;

    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING },
                minItems: 4,
                maxItems: 4
              },
              correctIndex: { type: Type.INTEGER }
            },
            required: ["question", "options", "correctIndex"]
          }
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse quiz questions", e);
      return [];
    }
  }

  async generateBingoCategories(lang: Language): Promise<string[]> {
    const prompt = lang === 'de'
      ? "Nenne 9 lustige Kategorien für ein Silvester-Aktions-Bingo (z.B. Pantomime, Singen, Flachwitz, etc.)."
      : "Yılbaşı Bingo oyunu için 9 tane eğlenceli kategori adı ver (örneğin: Pantomim, Şarkı Söyleme, Espri, vb.).";

    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      return ["Pantomime", "Singing", "Joke", "Dance", "Sketch", "Imitation", "Story", "Quiz", "Secret"];
    }
  }

  async speakModeratorText(text: string, lang: Language): Promise<Uint8Array | null> {
    const voiceName = lang === 'de' ? 'Kore' : 'Puck';
    
    try {
      const ai = this.getAI();
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

      const base64Data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Data) {
        return this.decodeBase64(base64Data);
      }
    } catch (error) {
      console.error("TTS Error:", error);
    }
    return null;
  }

  async generatePartyImage(prompt: string, size: "1K" | "2K" | "4K" = "1K"): Promise<string | null> {
    try {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: { aspectRatio: "16:9", imageSize: size }
        },
      });

      if (!response.candidates?.[0]?.content?.parts) return null;

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    } catch (e: any) {
      console.error("Image generation error", e);
      // Instructions: If "Requested entity was not found", reset key selection (handled in App.tsx via check)
      throw e;
    }
    return null;
  }

  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}
