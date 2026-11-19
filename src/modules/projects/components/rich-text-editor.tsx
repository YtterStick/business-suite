"use client";

import * as React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Strikethrough,
  Underline,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MentionReferenceItem } from "@/modules/projects/projects.types";

export interface RichTextMemberOption {
  id: string;
  name: string;
  email: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  members: RichTextMemberOption[];
  mentionItems: MentionReferenceItem[];
}

interface ActiveMentionState {
  trigger: "@" | "#";
  query: string;
  range: Range;
}

const FONT_FAMILIES = [
  { label: "Puvi / Sans", value: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" },
  { label: "Inter", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Georgia Serif", value: "Georgia, Cambria, serif" },
  { label: "Monospace", value: "var(--font-geist-mono), ui-monospace, monospace" },
];

const FONT_SIZES = [
  { label: "12", execSize: "2" },
  { label: "13", execSize: "2" },
  { label: "14", execSize: "3" },
  { label: "16", execSize: "4" },
  { label: "18", execSize: "5" },
  { label: "24", execSize: "6" },
];

function detectMentionTrigger(): ActiveMentionState | null {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) return null;

  const anchorNode = selection.anchorNode;
  if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) return null;

  const text = anchorNode.textContent ?? "";
  const caretOffset = selection.anchorOffset;
  const beforeCaret = text.slice(0, caretOffset);

  const match = beforeCaret.match(/(?:^|\s)([@#])([^\s@#]{0,30})$/);
  if (!match) return null;

  const trigger = match[1] as "@" | "#";
  const query = match[2] ?? "";
  const triggerIndex = beforeCaret.lastIndexOf(trigger);
  if (triggerIndex < 0) return null;

  const range = document.createRange();
  range.setStart(anchorNode, triggerIndex);
  range.setEnd(anchorNode, caretOffset);

  return { trigger, query, range };
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Type @ to mention users. Type # to mention Task or Issues.",
  members,
  mentionItems,
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const lastHtmlRef = React.useRef<string>(value);
  const [fontFamily, setFontFamily] = React.useState(FONT_FAMILIES[0]!.value);
  const [fontSize, setFontSize] = React.useState("13");
  const [textColor, setTextColor] = React.useState("#18181b");
  const [highlightColor, setHighlightColor] = React.useState("#fef08a");
  const [linkPopoverOpen, setLinkPopoverOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("https://");
  const savedSelectionRef = React.useRef<Range | null>(null);

  const [mentionState, setMentionState] = React.useState<ActiveMentionState | null>(null);
  const [mentionIndex, setMentionIndex] = React.useState(0);

  React.useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastHtmlRef.current && el.innerHTML !== value) {
      el.innerHTML = value;
      lastHtmlRef.current = value;
    }
  }, [value]);

  const emitChange = React.useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML === "<br>" ? "" : el.innerHTML;
    lastHtmlRef.current = html;
    onChange(html);
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  };

  const handleFontFamilyChange = (nextFont: string) => {
    setFontFamily(nextFont);
    exec("fontName", nextFont);
  };

  const handleFontSizeChange = (nextSize: string) => {
    setFontSize(nextSize);
    const mapped = FONT_SIZES.find((s) => s.label === nextSize)?.execSize ?? "3";
    exec("fontSize", mapped);
  };

  const openLinkPrompt = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
    setLinkUrl("https://");
    setLinkPopoverOpen((prev) => !prev);
  };

  const applyLink = () => {
    const trimmed = linkUrl.trim();
    if (!/^https?:\/\/|^mailto:/i.test(trimmed)) {
      setLinkPopoverOpen(false);
      return;
    }
    editorRef.current?.focus();
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelectionRef.current);
    }
    document.execCommand("createLink", false, trimmed);
    setLinkPopoverOpen(false);
    emitChange();
  };

  const filteredMentions = React.useMemo(() => {
    if (!mentionState) return [];
    const q = mentionState.query.trim().toLowerCase();
    if (mentionState.trigger === "@") {
      return members
        .filter(
          (m) =>
            !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
        )
        .slice(0, 6)
        .map((m) => ({
          id: m.id,
          label: `@${m.name}`,
          subtitle: m.email,
          badge: "User",
          chipClass:
            "inline-flex items-center rounded bg-blue-500/15 px-1.5 py-0.5 text-xs font-medium text-blue-700",
        }));
    }

    return mentionItems
      .filter(
        (item) =>
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.projectName.toLowerCase().includes(q),
      )
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        label: `#${item.code} ${item.title}`,
        subtitle: item.projectName,
        badge: item.kind === "task" ? "Task" : "Issue",
        chipClass:
          item.kind === "task"
            ? "inline-flex items-center rounded bg-violet-500/15 px-1.5 py-0.5 text-xs font-medium text-violet-700"
            : "inline-flex items-center rounded bg-rose-500/15 px-1.5 py-0.5 text-xs font-medium text-rose-700",
      }));
  }, [mentionState, members, mentionItems]);

  const insertMention = (item: { label: string; chipClass: string }) => {
    if (!mentionState) return;
    const sel = window.getSelection();
    if (!sel) return;

    const range = mentionState.range;
    range.deleteContents();

    const span = document.createElement("span");
    span.contentEditable = "false";
    span.className = item.chipClass;
    span.textContent = item.label;

    const space = document.createTextNode("\u00A0");
    range.insertNode(space);
    range.insertNode(span);

    const nextRange = document.createRange();
    nextRange.setStartAfter(space);
    nextRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nextRange);

    setMentionState(null);
    setMentionIndex(0);
    emitChange();
  };

  const refreshMentionState = () => {
    const detected = detectMentionTrigger();
    setMentionState(detected);
    setMentionIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionState && filteredMentions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const chosen = filteredMentions[mentionIndex];
        if (chosen) insertMention(chosen);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionState(null);
        return;
      }
    }
  };

  return (
    <div className="relative rounded-md border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
        <button
          type="button"
          title="Bold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          title="Italic"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("italic")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          title="Underline"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("underline")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Underline className="size-3.5" />
        </button>
        <button
          type="button"
          title="Strikethrough"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("strikeThrough")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Strikethrough className="size-3.5" />
        </button>

        <span className="mx-1 h-4 w-px bg-border" />

        <select
          aria-label="Font family"
          value={fontFamily}
          onChange={(e) => handleFontFamilyChange(e.target.value)}
          className="h-7 rounded border border-input bg-background px-1.5 text-xs outline-none"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Font size"
          value={fontSize}
          onChange={(e) => handleFontSizeChange(e.target.value)}
          className="h-7 w-14 rounded border border-input bg-background px-1 text-xs outline-none"
        >
          {FONT_SIZES.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label}
            </option>
          ))}
        </select>

        <span className="mx-1 h-4 w-px bg-border" />

        <label
          title="Text color"
          className="relative flex cursor-pointer items-center gap-0.5 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Palette className="size-3.5" />
          <span
            className="h-2 w-2 rounded-full border"
            style={{ backgroundColor: textColor }}
          />
          <input
            type="color"
            value={textColor}
            onChange={(e) => {
              setTextColor(e.target.value);
              exec("foreColor", e.target.value);
            }}
            className="sr-only"
          />
        </label>

        <label
          title="Background highlight"
          className="relative flex cursor-pointer items-center gap-0.5 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Highlighter className="size-3.5" />
          <span
            className="h-2 w-2 rounded-full border"
            style={{ backgroundColor: highlightColor }}
          />
          <input
            type="color"
            value={highlightColor}
            onChange={(e) => {
              setHighlightColor(e.target.value);
              exec("hiliteColor", e.target.value);
            }}
            className="sr-only"
          />
        </label>

        <span className="mx-1 h-4 w-px bg-border" />

        <button
          type="button"
          title="Align left"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("justifyLeft")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <AlignLeft className="size-3.5" />
        </button>
        <button
          type="button"
          title="Align center"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("justifyCenter")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <AlignCenter className="size-3.5" />
        </button>
        <button
          type="button"
          title="Align right"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("justifyRight")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <AlignRight className="size-3.5" />
        </button>

        <span className="mx-1 h-4 w-px bg-border" />

        <button
          type="button"
          title="Bullet list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertUnorderedList")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <List className="size-3.5" />
        </button>
        <button
          type="button"
          title="Numbered list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertOrderedList")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ListOrdered className="size-3.5" />
        </button>
        <button
          type="button"
          title="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openLinkPrompt}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LinkIcon className="size-3.5" />
        </button>
        <button
          type="button"
          title="Clear formatting"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("removeFormat")}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Eraser className="size-3.5" />
        </button>
      </div>

      {/* Inline Link Popover */}
      {linkPopoverOpen && (
        <div className="flex items-center gap-2 border-b bg-muted/20 px-2.5 py-2">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
          />
          <Button type="button" size="xs" onClick={applyLink}>
            Insert
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setLinkPopoverOpen(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Editable Content Area */}
      <div className="relative">
        {!value && (
          <p className="pointer-events-none absolute top-2.5 left-3 text-sm text-muted-foreground">
            {placeholder}
          </p>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Project description"
          onInput={() => {
            emitChange();
            refreshMentionState();
          }}
          onKeyUp={refreshMentionState}
          onClick={refreshMentionState}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            window.setTimeout(() => setMentionState(null), 150);
          }}
          className="min-h-28 max-h-56 overflow-y-auto px-3 py-2.5 text-sm outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>

      {/* @User / #Task & #Issue Mention Autocomplete */}
      {mentionState && (
        <div className="absolute right-2 left-2 z-50 mt-1 rounded-lg border bg-popover p-1 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {mentionState.trigger === "@"
              ? "Mention Team Member"
              : "Mention Task or Issue"}
          </p>
          {filteredMentions.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {mentionState.trigger === "@"
                ? "No matching team members."
                : "No existing tasks or issues yet."}
            </p>
          ) : (
            filteredMentions.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(item);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition",
                  idx === mentionIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{item.subtitle}</p>
                </div>
                <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {item.badge}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
