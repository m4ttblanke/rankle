"use client";

import { useId, useState, useTransition } from "react";
import { setTierlistItems } from "@/app/actions/admin/set-tierlist-items";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "@/components/game/icons";

type EditableItem = { key: string; label: string; imageUrl: string };

const ERROR_COPY: Record<string, string> = {
  forbidden: "Admin access required.",
  invalid: "Every item needs a label; image URLs must be https.",
  locked: "This Rankle already has official submissions and its items are locked.",
  not_found: "This Rankle no longer exists.",
  network: "Couldn't save — try again.",
};

/**
 * Item management (Milestone 8): add / remove / rename / reorder / image, all
 * client-side state until "Save items" replaces the full set atomically via
 * `set_tierlist_items`. Reorder is ▲/▼ buttons only — the same non-drag
 * pattern already established for the player-facing board's `MovePicker`
 * (docs/CLAUDE.md sec 8: a non-drag alternative is required, not merely
 * offered as a fallback to a drag implementation).
 */
export function ItemEditor({
  tierlistId,
  initialItems,
}: {
  tierlistId: string;
  initialItems: { id: string; label: string; imageUrl: string | null }[];
}) {
  const [items, setItems] = useState<EditableItem[]>(() =>
    initialItems.map((it) => ({ key: it.id, label: it.label, imageUrl: it.imageUrl ?? "" })),
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const feedbackId = useId();

  function addItem() {
    setItems((prev) => [...prev, { key: crypto.randomUUID(), label: "", imageUrl: "" }]);
    setStatus("idle");
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
    setStatus("idle");
  }

  function moveItem(key: string, direction: -1 | 1) {
    setItems((prev) => {
      const index = prev.findIndex((it) => it.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setStatus("idle");
  }

  function updateItem(key: string, patch: Partial<Pick<EditableItem, "label" | "imageUrl">>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
    setStatus("idle");
  }

  function save() {
    setStatus("saving");
    startTransition(async () => {
      const result = await setTierlistItems({
        id: tierlistId,
        items: items.map((it, index) => ({
          label: it.label.trim(),
          imageUrl: it.imageUrl.trim() || undefined,
          sortOrder: index,
        })),
      });
      if (result.ok) {
        setStatus("saved");
        setError(null);
      } else {
        setStatus("error");
        setError(ERROR_COPY[result.reason] ?? ERROR_COPY.network);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li
            key={item.key}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center"
          >
            <div className="flex shrink-0 flex-row gap-1 sm:flex-col">
              <button
                type="button"
                onClick={() => moveItem(item.key, -1)}
                disabled={index === 0}
                aria-label={`Move item ${index + 1} up`}
                className="grid size-8 place-items-center rounded-md border border-border text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
              >
                <ChevronUpIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => moveItem(item.key, 1)}
                disabled={index === items.length - 1}
                aria-label={`Move item ${index + 1} down`}
                className="grid size-8 place-items-center rounded-md border border-border text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
              >
                <ChevronDownIcon className="size-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Item {index + 1} label</span>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(item.key, { label: e.target.value })}
                  placeholder="Item label"
                  maxLength={120}
                  required
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
              <label className="flex-1">
                <span className="sr-only">Item {index + 1} image URL (optional)</span>
                <input
                  type="url"
                  value={item.imageUrl}
                  onChange={(e) => updateItem(item.key, { imageUrl: e.target.value })}
                  placeholder="https://… (optional image)"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => removeItem(item.key)}
              aria-label={`Remove item ${index + 1}`}
              className="grid size-8 shrink-0 place-items-center self-end rounded-md text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent sm:self-center"
            >
              <CloseIcon className="size-4" />
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm text-muted">No items yet — add at least one.</li> : null}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addItem}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          + Add item
        </button>
        <button
          type="button"
          onClick={save}
          disabled={status === "saving" || items.length === 0}
          aria-describedby={feedbackId}
          className="rounded-md bg-accent px-4 py-2 font-display text-sm font-extrabold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70"
        >
          {status === "saving" ? "Saving…" : "Save items"}
        </button>
        <p id={feedbackId} role="status" aria-live="polite" className="text-xs text-muted">
          {status === "saved" ? "Saved" : status === "error" ? error : ""}
        </p>
      </div>
    </div>
  );
}
