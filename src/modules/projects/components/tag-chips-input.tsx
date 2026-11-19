"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface TagChipsInputProps {
  id?: string;
  tags: string[];
  onChange: (nextTags: string[]) => void;
  placeholder?: string;
}

export function TagChipsInput({
  id,
  tags,
  onChange,
  placeholder = "Enter a tag name and press Enter or comma",
}: TagChipsInputProps) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const commitTags = (raw: string) => {
    const candidates = raw
      .split(",")
      .map((s) => s.trim().replace(/^#+/, ""))
      .filter(Boolean);
    if (candidates.length === 0) return;

    const existingLower = new Set(tags.map((t) => t.toLowerCase()));
    const next = [...tags];
    for (const candidate of candidates) {
      if (!existingLower.has(candidate.toLowerCase())) {
        existingLower.add(candidate.toLowerCase());
        next.push(candidate);
      }
    }
    onChange(next);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (draft.trim()) {
        commitTags(draft);
        setDraft("");
      }
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      event.preventDefault();
      onChange(tags.slice(0, -1));
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    if (val.includes(",")) {
      const parts = val.split(",");
      const remainder = parts.pop() ?? "";
      commitTags(parts.join(","));
      setDraft(remainder);
    } else {
      setDraft(val);
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
    >
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="gap-1 pr-1 text-xs font-medium"
        >
          <span>#{tag}</span>
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) {
            commitTags(draft);
            setDraft("");
          }
        }}
        placeholder={tags.length === 0 ? placeholder : "Add tag..."}
        className="min-w-28 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
