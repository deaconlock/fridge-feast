"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { track } from "./providers";

type Stage = "capture" | "extracting" | "review" | "cooking" | "recipe";

type Ingredient = {
  name: string;
  quantity?: string;
};

type Recipe = {
  title: string;
  cuisine: string;
  time_minutes: number;
  serves: number;
  ingredients_used: string[];
  extra_ingredients_needed: string[];
  steps: string[];
  notes?: string;
};

type HistoryEntry = {
  id: string;
  recipe: Recipe;
  committedAt: string;
  cookedAt: string | null;
};

const HISTORY_KEY = "fridgefeast.history";

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const CUISINES = [
  "Any",
  "Asian",
  "Chinese",
  "Japanese",
  "Korean",
  "Thai",
  "Western",
  "Italian",
  "Mediterranean",
  "Indian",
  "Mexican",
];

const TIME_BUCKETS = ["Under 20 min", "Under 40 min", "Any"];
const MOODS = ["Tried & tested", "Surprise me"];
const PHOTO_LIMIT = 10;

export default function Home() {
  const [stage, setStage] = useState<Stage>("capture");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngredient, setNewIngredient] = useState("");
  const [cuisine, setCuisine] = useState("Any");
  const [timeBucket, setTimeBucket] = useState("Under 40 min");
  const [mood, setMood] = useState("Tried & tested");
  const [dietary, setDietary] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const recipesThisScanRef = useRef(0);

  const currentEntry = currentEntryId
    ? history.find((h) => h.id === currentEntryId) ?? null
    : null;
  const committed = currentEntry !== null;
  const cookedMarked = currentEntry?.cookedAt != null;

  useEffect(() => {
    track("session_started");
    setHistory(loadHistory());
  }, []);

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const next = files.slice(0, PHOTO_LIMIT - photos.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...next]);
    if (next.length > 0) {
      track("photo_added", { count: next.length, total_after: photos.length + next.length });
    }
    e.target.value = "";
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function extractIngredients() {
    setError(null);
    setStage("extracting");
    const startedAt = performance.now();

    try {
      const images = await Promise.all(
        photos.map(async ({ file }) => ({
          mimeType: file.type,
          data: await fileToBase64(file),
        })),
      );

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setIngredients(data.ingredients);
      setStage("review");
      track("extract_completed", {
        success: true,
        ingredient_count: data.ingredients?.length ?? 0,
        photo_count: photos.length,
        latency_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract ingredients");
      setStage("capture");
      track("extract_completed", {
        success: false,
        photo_count: photos.length,
        latency_ms: Math.round(performance.now() - startedAt),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  async function generateRecipe() {
    setError(null);
    setStage("cooking");
    const startedAt = performance.now();
    const isReroll = recipesThisScanRef.current > 0;
    if (isReroll) {
      track("recipe_rerolled", { previous_count: recipesThisScanRef.current });
    }

    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients,
          cuisine,
          timeBucket,
          mood,
          dietary,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRecipe(data.recipe);
      setStage("recipe");
      recipesThisScanRef.current += 1;
      setCurrentEntryId(null);
      track("recipe_generated", {
        success: true,
        cuisine,
        time_bucket: timeBucket,
        mood,
        has_dietary: dietary.trim().length > 0,
        ingredient_count: ingredients.length,
        is_reroll: isReroll,
        latency_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recipe");
      setStage("review");
      track("recipe_generated", {
        success: false,
        cuisine,
        time_bucket: timeBucket,
        mood,
        is_reroll: isReroll,
        latency_ms: Math.round(performance.now() - startedAt),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  function reset() {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setIngredients([]);
    setRecipe(null);
    setError(null);
    setStage("capture");
    recipesThisScanRef.current = 0;
    setCurrentEntryId(null);
  }

  function updateIngredient(idx: number, value: string) {
    setIngredients((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, name: value } : it)),
    );
    track("ingredient_edited", { action: "rename" });
  }

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
    track("ingredient_edited", { action: "remove" });
  }

  function addIngredient() {
    const name = newIngredient.trim();
    if (!name) return;
    setIngredients((prev) => [...prev, { name }]);
    setNewIngredient("");
    track("ingredient_edited", { action: "add" });
  }

  function commitToCook() {
    if (!recipe || committed) return;
    track("recipe_committed", {
      cuisine,
      time_bucket: timeBucket,
      recipe_title: recipe.title,
      recipes_seen_this_scan: recipesThisScanRef.current,
    });
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      recipe,
      committedAt: new Date().toISOString(),
      cookedAt: null,
    };
    const next = [entry, ...history];
    setHistory(next);
    setCurrentEntryId(entry.id);
    try {
      saveHistory(next);
    } catch (err) {
      console.error("saveHistory failed", err);
    }
  }

  function markCooked() {
    if (!currentEntryId || cookedMarked) return;
    track("recipe_marked_cooked", {
      cuisine,
      time_bucket: timeBucket,
      recipe_title: recipe?.title,
      recipes_seen_this_scan: recipesThisScanRef.current,
    });
    const next = history.map((h) =>
      h.id === currentEntryId ? { ...h, cookedAt: new Date().toISOString() } : h,
    );
    setHistory(next);
    try {
      saveHistory(next);
    } catch (err) {
      console.error("saveHistory failed", err);
    }
  }

  function clearHistory() {
    if (!confirm("Clear all past cooks?")) return;
    setHistory([]);
    saveHistory([]);
    setCurrentEntryId(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Fridge Feast</h1>
        {stage !== "capture" && (
          <button
            onClick={reset}
            className="text-sm text-zinc-500 underline-offset-4 hover:underline"
          >
            Start over
          </button>
        )}
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {stage === "capture" && (
        <section className="flex flex-col gap-4">
          <p className="text-zinc-600">
            Add photos of what&apos;s in your fridge.
          </p>

          <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-100">
            <span className="text-3xl">📷</span>
            <span className="text-sm font-medium">
              {photos.length === 0 ? "Add photos" : `Add more (${photos.length}/${PHOTO_LIMIT})`}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleFiles}
              disabled={photos.length >= PHOTO_LIMIT}
            />
          </label>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.preview}
                    alt={`fridge ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={extractIngredients}
            disabled={photos.length === 0}
            className="rounded-full bg-zinc-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Identify ingredients
          </button>

          {history.length > 0 && (
            <section className="mt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Past cooks
                </h2>
                <button
                  onClick={clearHistory}
                  className="text-xs text-zinc-400 hover:text-zinc-700"
                >
                  Clear
                </button>
              </div>
              <ul className="flex flex-col gap-2">
                {history.slice(0, 10).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {entry.recipe.title}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {entry.recipe.cuisine} ·{" "}
                        {entry.cookedAt
                          ? `cooked ${formatRelative(entry.cookedAt)}`
                          : `committed ${formatRelative(entry.committedAt)}`}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.cookedAt
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {entry.cookedAt ? "Cooked" : "Cooking…"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      )}

      {stage === "extracting" && (
        <LoadingPanel label="Looking through your fridge…" />
      )}

      {stage === "review" && (
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold">What we saw</h2>
            <p className="text-sm text-zinc-500">
              Edit anything that&apos;s wrong, then tell us what kind of meal you want.
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {ingredients.map((ing, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, e.target.value)}
                  className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                />
                {ing.quantity && (
                  <span className="text-xs text-zinc-500">{ing.quantity}</span>
                )}
                <button
                  onClick={() => removeIngredient(i)}
                  className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  ✕
                </button>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <input
                value={newIngredient}
                onChange={(e) => setNewIngredient(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addIngredient()}
                placeholder="Add an ingredient…"
                className="flex-1 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
              <button
                onClick={addIngredient}
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Add
              </button>
            </li>
          </ul>

          <div className="flex flex-col gap-4 rounded-lg bg-zinc-50 p-4">
            <Chips label="Cuisine" value={cuisine} options={CUISINES} onChange={setCuisine} />
            <Chips label="Time" value={timeBucket} options={TIME_BUCKETS} onChange={setTimeBucket} />
            <Chips label="Mood" value={mood} options={MOODS} onChange={setMood} />
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Anything to avoid?
              </label>
              <input
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
                placeholder="e.g. no pork, gluten-free, kid-friendly"
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={generateRecipe}
            disabled={ingredients.length === 0}
            className="rounded-full bg-zinc-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Get a recipe
          </button>
        </section>
      )}

      {stage === "cooking" && <LoadingPanel label="Cooking something up…" />}

      {stage === "recipe" && recipe && (
        <article className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold leading-tight">{recipe.title}</h2>
            <p className="text-sm text-zinc-500">
              {recipe.cuisine} · {recipe.time_minutes} min · serves {recipe.serves}
            </p>
          </header>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              From your fridge
            </h3>
            <ul className="flex flex-wrap gap-2">
              {recipe.ingredients_used.map((i, idx) => (
                <li key={idx} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                  {i}
                </li>
              ))}
            </ul>
          </section>

          {recipe.extra_ingredients_needed.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                You&apos;ll also need
              </h3>
              <ul className="flex flex-wrap gap-2">
                {recipe.extra_ingredients_needed.map((i, idx) => (
                  <li key={idx} className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">
                    {i}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Steps
            </h3>
            <ol className="flex flex-col gap-3">
              {recipe.steps.map((s, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white">
                    {idx + 1}
                  </span>
                  <span className="text-sm leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </section>

          {recipe.notes && (
            <p className="rounded-md bg-zinc-50 px-4 py-3 text-sm italic text-zinc-700">
              {recipe.notes}
            </p>
          )}

          {!committed && (
            <button
              onClick={commitToCook}
              className="rounded-full bg-emerald-600 px-5 py-3 font-medium text-white"
            >
              I&apos;ll cook this
            </button>
          )}

          {committed && !cookedMarked && (
            <button
              onClick={markCooked}
              className="rounded-full bg-emerald-600 px-5 py-3 font-medium text-white"
            >
              Mark as cooked
            </button>
          )}

          {cookedMarked && (
            <div className="rounded-full bg-emerald-100 px-5 py-3 text-center font-medium text-emerald-800">
              Cooked ✓
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStage("review")}
              className="flex-1 rounded-full border border-zinc-300 px-5 py-3 font-medium hover:bg-zinc-50"
            >
              Try another
            </button>
            <button
              onClick={reset}
              className="flex-1 rounded-full bg-zinc-900 px-5 py-3 font-medium text-white"
            >
              New scan
            </button>
          </div>
        </article>
      )}
    </main>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-zinc-500">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function Chips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
