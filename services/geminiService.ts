import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, SkipSegment } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeVideoContent = async (file: File): Promise<AnalysisResult> => {
  const ai = getClient();
  const model = "gemini-2.5-flash"; // Efficient for longer context processing

  const videoPart = await fileToGenerativePart(file);

  const prompt = `
    Analyze the audio and visual content of this video. 
    Identify segments that are "insignificant" to the core narrative or information flow.
    Insignificant segments include:
    1. Long periods of silence.
    2. Filler words (um, uh) or stalling.
    3. Repetitive redundant sentences.
    4. Long pauses between sentences.
    5. Intro/Outro music without speech (if long).
    
    The goal is to create a list of timestamps to skip so the viewer can watch a condensed version.
    
    Return the result strictly as a JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [videoPart, { text: prompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "A very brief 1-sentence summary of what the video is about.",
            },
            segments: {
              type: Type.ARRAY,
              description: "List of time segments to skip.",
              items: {
                type: Type.OBJECT,
                properties: {
                  start: { type: Type.NUMBER, description: "Start time in seconds" },
                  end: { type: Type.NUMBER, description: "End time in seconds" },
                  reason: { type: Type.STRING, description: "Short reason for skipping (e.g., 'Silence', 'Filler')" }
                },
                required: ["start", "end", "reason"]
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    const data = JSON.parse(text) as AnalysisResult;
    return data;

  } catch (error) {
    console.error("Error analyzing video:", error);
    throw error;
  }
};