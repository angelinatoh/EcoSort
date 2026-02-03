
import { GoogleGenAI, Type } from "@google/genai";
import { WasteClassification, Location } from "../types";

const generateSystemPrompt = (loc: Location) => `
You are EcoSort AI, a world-class sustainability and waste-sorting expert.

Goal:
Classify a waste item based on (1) its material properties and (2) the user's region/country.
Current Location: ${loc.country || 'Global'}

Rules:
1. Classify into standard categories: cardboard, paper, plastic, metal, glass, trash, or organic.
2. Recommend a bin stream: Recyclables, Residual (Landfill), Organic (Compost), E-waste, or Hazardous.
3. If the item is clean and dry, it's usually Recyclable. If soiled with food or liquids, it's usually Residual.
4. Use the specific color mapping for ${loc.country} if known, otherwise use standard global mapping:
   - Blue/Yellow: Recyclables (Paper/Plastic/Metal)
   - Green/Brown: Organic/Compost
   - Red/Black/Grey: Residual/Landfill
5. Ask ONE short follow-up question ONLY if material or contamination status is unclear.
6. Provide 1-2 practical tips for proper disposal.

Return JSON only.
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    item_detected: { type: Type.STRING },
    material: { type: Type.STRING, enum: ['paper', 'plastic', 'glass', 'metal', 'organic', 'ewaste', 'hazardous', 'mixed', 'other'] },
    confidence: { type: Type.NUMBER },
    needs_followup: { type: Type.BOOLEAN },
    followup_question: { type: Type.STRING, nullable: true },
    location: {
      type: Type.OBJECT,
      properties: {
        country: { type: Type.STRING }
      },
      required: ["country"]
    },
    bin_recommendation: {
      type: Type.OBJECT,
      properties: {
        stream: { type: Type.STRING, enum: ['Recyclables', 'Residual', 'Organic', 'E-waste', 'Hazardous'] },
        bin_color: { type: Type.STRING, enum: ['Blue', 'White', 'Green', 'Black', 'Brown', 'Yellow', 'Red', 'None'] },
        instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["stream", "bin_color", "instructions"]
    },
    why: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["item_detected", "material", "confidence", "needs_followup", "location", "bin_recommendation", "why"],
};

export const classifyWaste = async (base64Image: string, location: Location): Promise<WasteClassification> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: generateSystemPrompt(location) + "\nClassify this item captured in the photo." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    return JSON.parse(response.text || '{}') as WasteClassification;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Failed to classify item.");
  }
};

export const searchWasteLookup = async (query: string, location: Location): Promise<WasteClassification> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${generateSystemPrompt(location)}\n\nInput: Item name: "${query}"`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    const result = JSON.parse(response.text || '{}') as WasteClassification;
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
        result.sources = chunks.map((c: any) => c.web).filter(Boolean);
    }
    return result;
  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw new Error("Search failed.");
  }
};
