import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

type ImagePayload = { mimeType: string; data: string };

const PROMPT = `You are looking at one or more photos of the inside of a fridge.

List every distinct food ingredient you can confidently identify. Be specific (e.g. "red bell pepper", not "vegetable"). Include condiments, sauces, leftovers, eggs, dairy, herbs, and anything wrapped or in containers if you can tell what it is.

For each item, give a rough quantity estimate if visible (e.g. "half", "1 bunch", "small container"). If you can't tell, omit quantity.

Skip:
- Empty containers
- Items you can't identify confidently
- Generic guesses

Return ONLY the structured list.`;

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return new NextResponse("Missing GEMINI_API_KEY", { status: 500 });
  }

  let images: ImagePayload[];
  try {
    ({ images } = await req.json());
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (!Array.isArray(images) || images.length === 0) {
    return new NextResponse("No images provided", { status: 400 });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            ...images.map((img) => ({
              inlineData: { mimeType: img.mimeType, data: img.data },
            })),
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                },
                required: ["name"],
              },
            },
          },
          required: ["ingredients"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return new NextResponse("Empty response from Gemini", { status: 502 });
    }

    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("extract error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Extraction failed: ${msg}`, { status: 500 });
  }
}
