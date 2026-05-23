import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  maxRetries: 4,
});

type Ingredient = { name: string; quantity?: string };

type RequestBody = {
  ingredients: Ingredient[];
  cuisine: string;
  timeBucket: string;
  mood: string;
  dietary: string;
};

function buildPrompt(body: RequestBody) {
  const ingredientList = body.ingredients
    .map((i) => (i.quantity ? `- ${i.name} (${i.quantity})` : `- ${i.name}`))
    .join("\n");

  const timeConstraint =
    body.timeBucket === "Under 20 min"
      ? "Total cook time must be under 20 minutes."
      : body.timeBucket === "Under 40 min"
        ? "Total cook time should be under 40 minutes."
        : "Cook time is flexible.";

  const moodLine =
    body.mood === "Surprise me"
      ? "Lean toward something a little unexpected or cross-cuisine if the ingredients allow."
      : "Stick to a familiar, well-loved dish — the kind of thing that reliably works.";

  const cuisineLine =
    body.cuisine === "Any"
      ? "Cuisine is open — pick whatever fits the ingredients best."
      : `Target cuisine: ${body.cuisine}.`;

  const dietaryLine = body.dietary.trim()
    ? `Constraints: ${body.dietary.trim()}.`
    : "";

  return `You are picking ONE recipe for a couple to cook tonight using mostly what they already have.

Ingredients in their fridge:
${ingredientList}

${cuisineLine}
${timeConstraint}
${moodLine}
${dietaryLine}

Rules:
- Prefer using items they already have. It's okay to require a few common pantry items (oil, salt, pepper, soy sauce, garlic, common spices, rice, pasta) — list those under extra_ingredients_needed.
- Don't invent ingredients that weren't listed and aren't obviously pantry staples.
- Recipes should be realistic — assume a normal home kitchen.
- Keep steps clear and concise. 4-8 steps usually.
- The "ingredients_used" list should be ONLY items from the fridge list above that the recipe actually uses.

Respond with ONLY a JSON object matching this schema:
{
  "title": "string — the recipe name",
  "cuisine": "string — short cuisine label",
  "time_minutes": number,
  "serves": number,
  "ingredients_used": ["string", ...],
  "extra_ingredients_needed": ["string with quantity if helpful", ...],
  "steps": ["string", ...],
  "notes": "string — optional one-line tip, or omit"
}`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new NextResponse("Missing ANTHROPIC_API_KEY", { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    return new NextResponse("No ingredients provided", { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new NextResponse("No JSON in Claude response", { status: 502 });
    }

    const recipe = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ recipe });
  } catch (err) {
    console.error("recipe error", err);
    if (err instanceof Anthropic.APIError) {
      if (err.status === 529 || err.status === 503) {
        return new NextResponse(
          "Claude is overloaded right now. Please try again in a moment.",
          { status: 503 },
        );
      }
      if (err.status === 429) {
        return new NextResponse(
          "Rate limited. Please wait a few seconds and try again.",
          { status: 429 },
        );
      }
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Recipe generation failed: ${msg}`, { status: 500 });
  }
}
