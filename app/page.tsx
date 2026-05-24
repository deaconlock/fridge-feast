"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { track } from "./providers";

type Stage = "inventory" | "capture" | "extracting" | "review";

type InventoryItem = {
  id: string;
  name: string;
  addedAt: string;
};

type ReviewRow = {
  name: string;
  state: "kept" | "new" | "removed";
  existing?: InventoryItem;
  include: boolean;
};

const INVENTORY_KEY = "fridgefeast.inventory";
const PHOTO_LIMIT = 10;
const AGED_THRESHOLD_DAYS = 5;

function loadInventory(): InventoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveInventory(items: InventoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
}

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function ageLabel(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("inventory");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("session_started");
    setInventory(loadInventory());
  }, []);

  const sortedInventory = useMemo(
    () =>
      [...inventory].sort(
        (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime(),
      ),
    [inventory],
  );

  const agedItems = useMemo(
    () => sortedInventory.filter((it) => ageDays(it.addedAt) >= AGED_THRESHOLD_DAYS),
    [sortedInventory],
  );

  useEffect(() => {
    if (stage === "inventory" && agedItems.length > 0) {
      track("aged_items_viewed", { count: agedItems.length });
    }
    // fire once per stage entry with aged items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

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

  function discardPhotos() {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
  }

  async function extractInventory() {
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
      const detected: string[] = (data.ingredients ?? [])
        .map((i: { name?: string }) => (i.name ?? "").trim())
        .filter(Boolean);

      const rows = buildReviewRows(inventory, detected);
      setReviewRows(rows);
      setStage("review");

      track("extract_completed", {
        success: true,
        ingredient_count: detected.length,
        photo_count: photos.length,
        latency_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read your fridge");
      setStage("capture");
      track("extract_completed", {
        success: false,
        photo_count: photos.length,
        latency_ms: Math.round(performance.now() - startedAt),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  function toggleReviewRow(idx: number) {
    setReviewRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, include: !row.include } : row)),
    );
  }

  function confirmScan() {
    const kept = reviewRows.filter((r) => r.state === "kept" && r.include).map((r) => r.existing!);
    const added: InventoryItem[] = reviewRows
      .filter((r) => r.state === "new" && r.include)
      .map((r) => ({ id: newId(), name: r.name, addedAt: new Date().toISOString() }));
    const keptOverride: InventoryItem[] = reviewRows
      .filter((r) => r.state === "removed" && !r.include)
      .map((r) => r.existing!);

    const next = [...kept, ...keptOverride, ...added];
    setInventory(next);
    saveInventory(next);

    const itemsRemovedCount = reviewRows.filter((r) => r.state === "removed" && r.include).length;
    const itemsNewCount = added.length;
    const itemsKeptCount = kept.length + keptOverride.length;
    const agedCount = next.filter((it) => ageDays(it.addedAt) >= AGED_THRESHOLD_DAYS).length;

    track("inventory_scanned", {
      photo_count: photos.length,
      items_detected: reviewRows.filter((r) => r.state !== "removed").length,
      items_new: itemsNewCount,
      items_kept: itemsKeptCount,
      items_removed: itemsRemovedCount,
      aged_count_after: agedCount,
    });

    discardPhotos();
    setReviewRows([]);
    setStage("inventory");
  }

  function cancelReview() {
    discardPhotos();
    setReviewRows([]);
    setStage("inventory");
  }

  function actionAgedItem(item: InventoryItem, action: "used" | "discarded") {
    const next = inventory.filter((it) => it.id !== item.id);
    setInventory(next);
    saveInventory(next);
    track("aged_item_actioned", {
      name: item.name,
      age_days: ageDays(item.addedAt),
      action,
    });
  }

  function removeItemManually(item: InventoryItem) {
    const next = inventory.filter((it) => it.id !== item.id);
    setInventory(next);
    saveInventory(next);
    track("item_removed_manually", {
      name: item.name,
      age_days: ageDays(item.addedAt),
    });
  }

  function clearAllInventory() {
    if (!confirm("Clear all tracked items? This cannot be undone.")) return;
    setInventory([]);
    saveInventory([]);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Fridge Feast</h1>
        {stage === "inventory" && inventory.length > 0 && (
          <button
            onClick={clearAllInventory}
            className="text-xs text-zinc-400 hover:text-zinc-700"
          >
            Clear all
          </button>
        )}
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {stage === "inventory" && (
        <InventoryView
          inventory={sortedInventory}
          agedItems={agedItems}
          onScanFridge={() => setStage("capture")}
          onActionAged={actionAgedItem}
          onRemoveItem={removeItemManually}
        />
      )}

      {stage === "capture" && (
        <CaptureView
          photos={photos}
          onFiles={handleFiles}
          onRemovePhoto={removePhoto}
          onSubmit={extractInventory}
          onCancel={() => {
            discardPhotos();
            setStage("inventory");
          }}
        />
      )}

      {stage === "extracting" && <LoadingPanel label="Reading your fridge…" />}

      {stage === "review" && (
        <ReviewView
          rows={reviewRows}
          onToggle={toggleReviewRow}
          onConfirm={confirmScan}
          onCancel={cancelReview}
        />
      )}
    </main>
  );
}

function buildReviewRows(existing: InventoryItem[], detected: string[]): ReviewRow[] {
  const existingByKey = new Map(existing.map((it) => [normalise(it.name), it]));
  const detectedKeys = new Set(detected.map(normalise));

  const seenInDetected = new Set<string>();
  const rows: ReviewRow[] = [];

  for (const name of detected) {
    const key = normalise(name);
    if (seenInDetected.has(key)) continue;
    seenInDetected.add(key);
    const match = existingByKey.get(key);
    if (match) {
      rows.push({ name: match.name, state: "kept", existing: match, include: true });
    } else {
      rows.push({ name, state: "new", include: true });
    }
  }

  for (const item of existing) {
    if (!detectedKeys.has(normalise(item.name))) {
      rows.push({ name: item.name, state: "removed", existing: item, include: true });
    }
  }

  return rows;
}

function InventoryView({
  inventory,
  agedItems,
  onScanFridge,
  onActionAged,
  onRemoveItem,
}: {
  inventory: InventoryItem[];
  agedItems: InventoryItem[];
  onScanFridge: () => void;
  onActionAged: (item: InventoryItem, action: "used" | "discarded") => void;
  onRemoveItem: (item: InventoryItem) => void;
}) {
  if (inventory.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-3xl">📷</p>
        <p className="max-w-sm text-zinc-600">
          No items tracked yet. Take a photo of your fridge to start tracking what&apos;s in there and what&apos;s about to go off.
        </p>
        <button
          onClick={onScanFridge}
          className="rounded-full bg-zinc-900 px-5 py-3 font-medium text-white"
        >
          Scan fridge
        </button>
        <a
          href="/scan-fridge.ics"
          download
          onClick={() => track("reminder_downloaded", { surface: "empty" })}
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          Add weekly Sunday reminder to your calendar
        </a>
      </section>
    );
  }

  const freshItems = inventory.filter(
    (it) => !agedItems.find((a) => a.id === it.id),
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <button
          onClick={onScanFridge}
          className="rounded-full bg-zinc-900 px-5 py-3 font-medium text-white"
        >
          Update from new photo
        </button>
        <a
          href="/scan-fridge.ics"
          download
          onClick={() => track("reminder_downloaded", { surface: "inventory" })}
          className="self-center text-xs text-zinc-400 underline-offset-4 hover:underline"
        >
          Add Sunday reminder
        </a>
      </div>

      {agedItems.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
            Use these soon · {agedItems.length}
          </h2>
          <ul className="flex flex-col gap-2">
            {agedItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-amber-800">
                    in your fridge for {ageLabel(ageDays(item.addedAt))}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onActionAged(item, "used")}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Used
                  </button>
                  <button
                    onClick={() => onActionAged(item, "discarded")}
                    className="rounded-md bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300"
                  >
                    Tossed
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {freshItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Tracked · {freshItems.length}
          </h2>
          <ul className="flex flex-col gap-1">
            {freshItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-zinc-500">
                    {ageLabel(ageDays(item.addedAt))}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveItem(item)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function CaptureView({
  photos,
  onFiles,
  onRemovePhoto,
  onSubmit,
  onCancel,
}: {
  photos: { file: File; preview: string }[];
  onFiles: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (idx: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Scan your fridge</h2>
        <button
          onClick={onCancel}
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          Cancel
        </button>
      </div>
      <p className="text-sm text-zinc-500">
        Take a clear photo of each shelf. We&apos;ll compare to what we already know and update what&apos;s tracked.
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
          onChange={onFiles}
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
                onClick={() => onRemovePhoto(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={photos.length === 0}
        className="rounded-full bg-zinc-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        Read fridge contents
      </button>
    </section>
  );
}

function ReviewView({
  rows,
  onToggle,
  onConfirm,
  onCancel,
}: {
  rows: ReviewRow[];
  onToggle: (idx: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const newCount = rows.filter((r) => r.state === "new" && r.include).length;
  const removedCount = rows.filter((r) => r.state === "removed" && r.include).length;
  const keptCount = rows.filter((r) => r.state === "kept" && r.include).length;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">Confirm the update</h2>
        <p className="text-sm text-zinc-500">
          Untick anything we got wrong. Items you remove keep their original date.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">+{newCount} new</span>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">{keptCount} kept</span>
        <span className="rounded-full bg-red-100 px-2 py-1 text-red-800">−{removedCount} gone</span>
      </div>

      {(["new", "kept", "removed"] as const).map((state) => {
        const sectionRows = rows
          .map((r, idx) => ({ row: r, idx }))
          .filter(({ row }) => row.state === state);
        if (sectionRows.length === 0) return null;
        const heading =
          state === "new" ? "New items" : state === "kept" ? "Still there" : "No longer detected";
        const colour =
          state === "new"
            ? "border-emerald-200 bg-emerald-50"
            : state === "kept"
              ? "border-zinc-200 bg-white"
              : "border-red-200 bg-red-50";
        return (
          <section key={state} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {heading}
            </h3>
            <ul className="flex flex-col gap-1">
              {sectionRows.map(({ row, idx }) => (
                <li
                  key={`${state}-${idx}`}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 ${colour}`}
                >
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={() => onToggle(idx)}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="flex-1 truncate text-sm">{row.name}</span>
                  {row.existing && (
                    <span className="shrink-0 text-xs text-zinc-500">
                      {ageLabel(ageDays(row.existing.addedAt))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-full border border-zinc-300 px-5 py-3 font-medium hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-full bg-zinc-900 px-5 py-3 font-medium text-white"
        >
          Save update
        </button>
      </div>
    </section>
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
