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

export const analyzeVideoContent = async (file: File, onProgress?: (status: string) => void): Promise<AnalysisResult> => {
  const ai = getClient();
  const model = "gemini-2.5-flash"; // Efficient for longer context processing

  let contentPart;

  // For files larger than 20MB, we must use the Files API (Media Upload)
  // This handles the "upload by parts" logic internally and bypasses inline payload limits.
  if (file.size > 20 * 1024 * 1024) {
      if (onProgress) onProgress("Uploading large video to Gemini (this bypasses size limits)...");
      
      try {
        // Upload the file using the Files API
        const uploadResult = await ai.files.upload({
            file: file,
            config: { displayName: file.name }
        });

        let fileUri = uploadResult.uri;
        let state = uploadResult.state;
        const name = uploadResult.name;

        // Wait for the file to be processed and active
        while (state === "PROCESSING") {
            if (onProgress) onProgress("Processing video on server...");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const fileStatus = await ai.files.get({ name });
            state = fileStatus.state;
        }

        if (state !== "ACTIVE") {
            throw new Error(`Video processing failed on server. State: ${state}`);
        }

        // Use the file URI for content generation
        contentPart = {
            fileData: {
                fileUri: fileUri,
                mimeType: uploadResult.mimeType
            }
        };
      } catch (error: any) {
          console.error("Large file upload failed:", error);
          throw new Error("Failed to upload large video. " + (error.message || "Unknown error"));
      }
  } else {
      // For smaller files, inline data is faster
      if (onProgress) onProgress("Encoding video data...");
      contentPart = await fileToGenerativePart(file);
  }

  if (onProgress) onProgress("Analyzing content for fluff and silence...");

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
        parts: [contentPart, { text: prompt }]
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