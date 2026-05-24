import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

type Section = "wide" | "shelves" | "door" | "drawers";
type ImagePayload = { mimeType: string; data: string; section?: Section };

type Ingredient = {
  name: string;
  quantity?: string;
  photo_index: number;
  bbox: [number, number, number, number];
};

const SECTION_PRIORS: Record<Section, string> = {
  wide: "the whole interior of the fridge (general overview)",
  shelves: "a close-up of a single shelf — typically dairy, leftovers, eggs, larger produce, ready-to-eat items",
  door: "the door pockets — typically condiments, sauces, drinks, jars, dressings, milk cartons",
  drawers: "a crisper or meat drawer — typically loose produce (vegetables, fruit, herbs) or packaged proteins",
};

const PROMPT = `You are looking at one or more photos of the inside of a fridge.

Each photo has a section label indicating where it was taken from. Use the section context to bias your identification — but only when the visual evidence supports it. Section context tells you what is LIKELY in the photo, not what definitely is.

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
5. If a photo is labelled as a drawer, do not invent items you'd expect to find in a door (e.g. milk cartons). If a photo is labelled as a door, do not invent items you'd expect on a shelf (e.g. leftover containers). Section context is a prior, not a license to hallucinate.

For each item you DO list:
- name: as guided above.
- quantity (optional): a rough estimate only if clearly visible (e.g. "half", "1 bunch", "small container"). Omit if unsure.
- photo_index: which photo (0-based) the item appears in. If it appears in multiple, pick the clearest one.
- bbox: tight bounding box in [y_min, x_min, y_max, x_max] format, normalized to 0-1000 within that photo. y is the vertical axis (0 = top), x is horizontal (0 = left).

Return ONLY the structured list. A short, accurate list is the right answer.`;

const CRITIQUE_PROMPT = `You previously produced a list of items detected in these fridge photos.

Look at the photos again, carefully. For each numbered item in the list below, decide: is this item ACTUALLY clearly visible in the stated photo, at roughly the stated location?

Be skeptical. Reject items where:
- The thing at that location is ambiguous (could be one of several things).
- The bounding box covers a container whose contents aren't visible.
- The item was inferred from context rather than seen directly.
- The bounding box is wildly off — there's nothing matching the name at that location.

Return ONLY the indices (0-based, into the list below) of items that are LIKELY WRONG and should be removed.

Items to review:
`;

const ingredientItemSchema = {
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
};

function imageParts(images: ImagePayload[]) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  images.forEach((img, idx) => {
    const sectionLabel = img.section ? SECTION_PRIORS[img.section] : "unlabelled";
    parts.push({ text: `Photo ${idx}: ${sectionLabel}` });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  });
  return parts;
}

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
    // First pass — detect items.
    const detectResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: PROMPT }, ...imageParts(images)],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ingredients: { type: Type.ARRAY, items: ingredientItemSchema },
          },
          required: ["ingredients"],
        },
      },
    });

    const detectText = detectResponse.text;
    if (!detectText) {
      return new NextResponse("Empty response from Gemini", { status: 502 });
    }

    const detected: { ingredients: Ingredient[] } = JSON.parse(detectText);
    const ingredients = detected.ingredients ?? [];

    if (ingredients.length === 0) {
      return NextResponse.json({ ingredients: [] });
    }

    // Second pass — critique. Ask Gemini to flag false positives.
    const listText = ingredients
      .map(
        (it, i) =>
          `${i}. "${it.name}" at photo ${it.photo_index}, bbox [${it.bbox.join(", ")}]`,
      )
      .join("\n");

    let rejected: number[] = [];
    try {
      const critiqueResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: CRITIQUE_PROMPT + listText },
              ...imageParts(images),
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reject_indices: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
            },
            required: ["reject_indices"],
          },
        },
      });
      const critiqueText = critiqueResponse.text;
      if (critiqueText) {
        const parsed = JSON.parse(critiqueText);
        if (Array.isArray(parsed.reject_indices)) {
          rejected = parsed.reject_indices.filter(
            (n: unknown): n is number => typeof n === "number" && n >= 0 && n < ingredients.length,
          );
        }
      }
    } catch (err) {
      console.error("critique pass failed; returning unfiltered list", err);
    }

    const rejectedSet = new Set(rejected);
    const filtered = ingredients.filter((_, i) => !rejectedSet.has(i));

    return NextResponse.json({
      ingredients: filtered,
      _debug: { detected_count: ingredients.length, rejected_count: rejected.length },
    });
  } catch (err) {
    console.error("extract error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Extraction failed: ${msg}`, { status: 500 });
  }
}
