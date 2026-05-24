import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

type ImagePayload = { mimeType: string; data: string };

const PROMPT = `You are looking at one or more photos of the inside of a fridge, provided in order (photo 0, photo 1, photo 2, ...).

Your goal is to produce a reliable inventory the user can act on. ACCURACY matters far more than COMPLETENESS. It is much better to omit a real item than to invent a wrong one — a wrong item poisons the user's trust in everything else on the list.

Rules:
1. Only list items you can identify with high confidence from what is clearly visible. If an item is inside an opaque container, in an unmarked plastic bag, fully behind something else, or only a sliver is showing — skip it. Do not guess.
2. Use the GENERIC name when you cannot see distinguishing detail. Examples:
   - "apple" — not "gala apple" — unless the label or sticker is readable.
   - "leafy greens" — not "spinach" — if it could plausibly be lettuce, spinach, or similar.
   - "cheese" — not "cheddar" — unless the wrapper / label tells you the type.
   - "sauce bottle" is fine if you cannot read the label; do not invent "ketchup".
3. Container-shape inference is NOT enough. A round red item is not necessarily a tomato. A yellow tub is not necessarily butter.
4. Skip empty containers and skip items where you'd have to choose between two equally-plausible identifications.

For each item you DO list:
- name: as guided above.
- quantity (optional): a rough estimate only if clearly visible (e.g. "half", "1 bunch", "small container"). Omit if unsure.
- photo_index: which photo (0-based) the item appears in. If it appears in multiple, pick the clearest one.
- bbox: tight bounding box in [y_min, x_min, y_max, x_max] format, normalized to 0-1000 within that photo. y is the vertical axis (0 = top), x is horizontal (0 = left).

Return ONLY the structured list. A short, accurate list is the right answer.`;

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
                  photo_index: { type: Type.INTEGER },
                  bbox: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                    minItems: "4",
                    maxItems: "4",
                  },
                },
                required: ["name", "photo_index", "bbox"],
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
