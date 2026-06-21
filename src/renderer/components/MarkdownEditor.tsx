import React, { useRef, useEffect, useLayoutEffect, useCallback, useState, startTransition } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

// ---- Regex-based Markdown syntax highlighter ----
// Returns HTML string with colored spans. Operates line-by-line.
// The output MUST preserve all original characters — only wraps in <span>s.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightMarkdown(raw: string): string {
  const lines = raw.split('\n');
  let inFence = false;
  return lines.map((line) => {
    if (/^```/.test(line)) { inFence = !inFence; return `<span class="text-purple-500 dark:text-purple-400">${esc(line)}</span>`; }
    if (inFence) return `<span class="text-emerald-600 dark:text-emerald-400">${esc(line)}</span>`;
    let h = esc(line);
    if (/^#{1,6}\s/.test(line)) return `<span class="text-blue-600 dark:text-blue-400 font-bold">${h}</span>`;
    if (/^&gt;/.test(h)) return `<span class="text-orange-500 dark:text-orange-400">${h}</span>`;
    h = h.replace(/`([^`]+)`/g, '<span class="text-emerald-600 dark:text-emerald-400 bg-gray-100 dark:bg-white/10 rounded px-px">`$1`</span>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-gray-900 dark:text-gray-100">**$1**</strong>');
    h = h.replace(/\*([^*]+)\*/g, '<em class="text-gray-700 dark:text-gray-300">*$1*</em>');
    h = h.replace(/~~([^~]+)~~/g, '<span class="line-through text-gray-400 dark:text-gray-500">~~$1~~</span>');
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="text-blue-500 dark:text-blue-400">[$1]($2)</span>');
    if (/^(\s*)[-*+]\s/.test(line)) h = h.replace(/^(\s*)([-*+]\s)/, '$1<span class="text-amber-500 dark:text-amber-400">$2</span>');
    return h;
  }).join('\n');
}

// ---- Cursor save/restore for contentEditable ----

function editorText(el: HTMLElement): string { return el.textContent || ''; }

function saveCursor(editor: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return 0;
  // Fast path: single text node (plain-text mode) — O(1)
  if (editor.childNodes.length === 1 && editor.firstChild?.nodeType === Node.TEXT_NODE) {
    return sel.anchorOffset;
  }
  // Slow path: highlighted content with many spans
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(editor);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}

function restoreCursor(editor: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  // Fast path: single text node (plain-text mode) — O(1)
  if (editor.childNodes.length === 1 && editor.firstChild?.nodeType === Node.TEXT_NODE) {
    const len = editor.firstChild.textContent?.length || 0;
    const r = document.createRange();
    r.setStart(editor.firstChild, Math.min(offset, len));
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    return;
  }
  // Slow path: highlighted content — TreeWalker
  let cur = 0;
  const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let n: Text | null;
  while ((n = w.nextNode() as Text | null)) {
    if (cur + n.length >= offset) {
      const r = document.createRange();
      r.setStart(n, offset - cur);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      return;
    }
    cur += n.length;
  }
  const r = document.createRange();
  r.selectNodeContents(editor); r.collapse(false);
  sel.removeAllRanges(); sel.addRange(r);
}

function getSelectionRange(editor: HTMLElement): { start: number; end: number; text: string } {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return { start: 0, end: 0, text: '' };
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(editor);
  pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  pre.setEnd(r.endContainer, r.endOffset);
  const end = pre.toString().length;
  return { start, end, text: sel.toString() };
}

function setSelectionRange(editor: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  let cur = 0; let startNode: Text | null = null; let startOff = 0; let endNode: Text | null = null; let endOff = 0;
  const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let n: Text | null;
  while ((n = w.nextNode() as Text | null)) {
    if (!startNode && cur + n.length >= start) { startNode = n; startOff = start - cur; }
    if (cur + n.length >= end) { endNode = n; endOff = end - cur; break; }
    cur += n.length;
  }
  if (!startNode || !endNode) return;
  const r = document.createRange();
  r.setStart(startNode, startOff);
  r.setEnd(endNode, endOff);
  sel.removeAllRanges();
  sel.addRange(r);
}

// ---- Unified helpers (work with both <textarea> and contentEditable <div>) ----

type EditorEl = HTMLTextAreaElement | HTMLDivElement;

function getText(el: EditorEl): string {
  return el instanceof HTMLTextAreaElement ? el.value : (el.textContent || '');
}

function getSel(el: EditorEl): { start: number; end: number; text: string } {
  if (el instanceof HTMLTextAreaElement) {
    return { start: el.selectionStart, end: el.selectionEnd, text: el.value.substring(el.selectionStart, el.selectionEnd) };
  }
  return getSelectionRange(el as HTMLDivElement);
}

function setSel(el: EditorEl, start: number, end: number) {
  if (el instanceof HTMLTextAreaElement) {
    const len = el.value.length;
    el.selectionStart = Math.max(0, Math.min(start, len));
    el.selectionEnd = Math.max(0, Math.min(end, len));
  } else {
    setSelectionRange(el as HTMLDivElement, start, end);
  }
}

function focusEl(el: EditorEl) { el.focus(); }

// Get plain text cursor offset (works for both element types)
function getCursorOffset(el: EditorEl): number {
  if (el instanceof HTMLTextAreaElement) return el.selectionStart;
  return saveCursor(el as HTMLDivElement);
}

// Get line/col from EditorEl
function getLineCol(el: EditorEl): { line: number; col: number; total: number } {
  const text = getText(el);
  const offset = getCursorOffset(el);
  const lines = text.substring(0, offset).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1, total: text.split('\n').length };
}

interface MarkdownEditorProps {
  syncScroll?: 'off' | 'position' | 'content';
  onScrollRef?: (el: HTMLElement | null) => void;
  onEditorScroll?: () => void;
  onToggleSync?: () => void;
  wordWrap?: boolean;
  onToggleWordWrap?: () => void;
  onFlushRef?: (fn: () => void) => void;
  onSave?: () => void;
  matchPalette?: boolean;
  paletteBg?: string;
  paletteBgDark?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ syncScroll, onScrollRef, onEditorScroll, onToggleSync, wordWrap, onToggleWordWrap, onFlushRef, onSave, matchPalette, paletteBg, paletteBgDark }) => {
  const { fileContent, setFileContent, theme } = useStore(useShallow((state) => ({
    fileContent: state.fileContent,
    setFileContent: state.setFileContent,
    theme: state.theme,
  })));
  const editorRef = useRef<EditorEl>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const scrollbarWideRef = useRef(false);

  // Wider scrollbar on hover near right edge — direct DOM, no re-renders
  const handleEditorMouseMove = useCallback((e: React.MouseEvent) => {
    const el = editorRef.current;
    if (!el) return;
    const near = e.clientX > el.getBoundingClientRect().right - 30;
    if (near !== scrollbarWideRef.current) {
      scrollbarWideRef.current = near;
      el.classList.toggle('scrollbar-hover', near);
    }
  }, []);

  const handleEditorMouseLeave = useCallback(() => {
    scrollbarWideRef.current = false;
    editorRef.current?.classList.remove('scrollbar-hover');
  }, []);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
  const [lineCount, setLineCount] = useState(1);
  const [taWidth, setTaWidth] = useState(0);
  const [syntaxHighlight, setSyntaxHighlight] = useState(false);
  const savedScrollRef = useRef(0);
  const savedCursorRef = useRef(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarMode, setToolbarMode] = useState<'compact' | 'medium'>('compact');

  // Preserve scroll/cursor when toggling syntax highlight
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (el) {
      if (el instanceof HTMLTextAreaElement) {
        el.selectionStart = el.selectionEnd = savedCursorRef.current;
      } else if (el instanceof HTMLDivElement) {
        // Fill content first so cursor can land, then scroll
        el.innerHTML = highlightMarkdown(fileContent) || '<br>';
        setSel(el, savedCursorRef.current, savedCursorRef.current);
      }
      el.scrollTop = savedScrollRef.current;
      focusEl(el);
      // Re-apply scroll after focus — browser may auto-scroll focused element
      el.scrollTop = savedScrollRef.current;
    }
  }, [syntaxHighlight]); // eslint-disable-line react-hooks/exhaustive-deps
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);

  // Close heading dropdown on click outside
  useEffect(() => {
    if (!headingOpen) return;
    const handler = (e: MouseEvent) => {
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) setHeadingOpen(false);
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [headingOpen]);

  // Close "More tools" dropdown on click outside
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  // ResizeObserver: compact ↔ medium with hysteresis (~3 tool widths)
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setToolbarMode(prev => w >= 750 ? 'medium' : w < 680 ? 'compact' : prev);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  interface Snap { text: string; cursor: number }
  const undoStack = useRef<Snap[]>([]);
  const redoStack = useRef<Snap[]>([]);
  const isHighlighting = useRef(false);
  const highlightTimer = useRef<number>(0);
  const storeTimer = useRef<number>(0);
  const lastTypedRef = useRef(fileContent);
  const syncGuard = useRef(false); // prevents effect from overwriting textarea during programmatic changes

  // Push text to store (debounced for both modes to prevent effect from destroying undo)
  const pushToStore = useCallback((text: string) => {
    clearTimeout(storeTimer.current);
    storeTimer.current = window.setTimeout(() => setFileContent(text), 300);
  }, [setFileContent]);

  // Flush pending store update immediately (called before save)
  const flushStore = useCallback(() => {
    clearTimeout(storeTimer.current);
    const el = editorRef.current;
    if (!el) return;
    const text = getText(el);
    setFileContent(text);
  }, [setFileContent]);

  // Debounced async highlighting — contentEditable only
  const applyHighlight = useCallback(() => {
    if (!syntaxHighlight) return;
    clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => {
      const el = editorRef.current;
      if (!el || el instanceof HTMLTextAreaElement) return;
      const cursor = saveCursor(el);
      el.innerHTML = highlightMarkdown(getText(el)) || '<br>';
      restoreCursor(el, cursor);
      isHighlighting.current = false;
    }, 300);
  }, [syntaxHighlight]);

  const pushUndo = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const text = getText(el);
    const cursor = getCursorOffset(el);
    const last = undoStack.current[undoStack.current.length - 1];
    const lastText = last ? (typeof last === 'string' ? last : last.text) : null;
    if (lastText === text) return;
    undoStack.current.push({ text, cursor });
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  // Smart toggle: wrap/unwrap selection with prefix/suffix
  const toggleWrap = useCallback((prefix: string, suffix: string, placeholder: string) => {
    const el = editorRef.current; if (!el) return;
    pushUndo();
    const { start, end, text } = getSel(el);
    const full = getText(el);
    const pLen = prefix.length, sLen = suffix.length;
    const selected = text || placeholder;
    // Check multiple unwrap conditions
    const boundaryMatch = full.substring(start - pLen, start) === prefix && full.substring(end, end + sLen) === suffix;
    const innerMatch = selected.startsWith(prefix) && selected.endsWith(suffix) && selected.length > pLen + sLen;
    let newText: string; let selStart: number; let selEnd: number;
    if (boundaryMatch) {
      // Selection is exactly inside wrapped text — unwrap
      newText = full.substring(0, start - pLen) + selected + full.substring(end + sLen);
      selStart = start - pLen;
      selEnd = selStart + selected.length;
    } else if (innerMatch) {
      // Selected text itself is wrapped — unwrap inner
      const inner = selected.substring(pLen, selected.length - sLen);
      newText = full.substring(0, start) + inner + full.substring(end);
      selStart = start;
      selEnd = selStart + inner.length;
    } else {
      // Wrap
      newText = full.substring(0, start) + prefix + selected + suffix + full.substring(end);
      selStart = start + pLen;
      selEnd = selStart + selected.length;
    }
    if (el instanceof HTMLTextAreaElement) { el.value = newText; lastTypedRef.current = newText; }
    setFileContent(newText);
    setTimeout(() => {
      const el2 = editorRef.current; if (!el2) return;
      setSel(el2, selStart, selEnd);
      focusEl(el2);
    }, 0);
  }, [setFileContent, pushUndo]);

  // Smart toggle: add/remove/replace line prefix (heading, quote, list)
  const toggleLinePrefix = useCallback((pfx: string, placeholder: string) => {
    const el = editorRef.current; if (!el) return;
    pushUndo();
    const full = getText(el);
    const { start } = getSel(el);
    const lineStart = full.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = full.indexOf('\n', start) === -1 ? full.length : full.indexOf('\n', start);
    const currentLine = full.substring(lineStart, lineEnd);
    let newLine: string; let cursorDelta: number;
    // Check if line already starts with this prefix
    if (currentLine.startsWith(pfx)) {
      // Remove prefix
      newLine = currentLine.substring(pfx.length);
      cursorDelta = -pfx.length;
    } else {
      // Add prefix
      newLine = pfx + currentLine;
      cursorDelta = pfx.length;
    }
    const newText = full.substring(0, lineStart) + newLine + full.substring(lineEnd);
    if (el instanceof HTMLTextAreaElement) { el.value = newText; lastTypedRef.current = newText; }
    setFileContent(newText);
    setTimeout(() => {
      const el2 = editorRef.current; if (!el2) return;
      setSel(el2, start + cursorDelta, start + cursorDelta);
      focusEl(el2);
    }, 0);
  }, [setFileContent, pushUndo]);

  // Smart heading toggle
  const toggleHeading = useCallback((level: number) => {
    const el = editorRef.current; if (!el) return;
    pushUndo();
    const full = getText(el);
    const { start } = getSel(el);
    const lineStart = full.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = full.indexOf('\n', start) === -1 ? full.length : full.indexOf('\n', start);
    const currentLine = full.substring(lineStart, lineEnd);
    const hMatch = currentLine.match(/^(#{1,6})\s/);
    const pfx = '#'.repeat(level) + ' ';
    let newLine: string; let cursorDelta: number;
    if (hMatch) {
      const currentLevel = hMatch[1].length;
      if (currentLevel === level) {
        // Same level → remove heading
        newLine = currentLine.substring(hMatch[0].length);
        cursorDelta = -hMatch[0].length;
      } else {
        // Different level → replace
        newLine = pfx + currentLine.substring(hMatch[0].length);
        cursorDelta = pfx.length - hMatch[0].length;
      }
    } else {
      // No heading → add
      newLine = pfx + currentLine;
      cursorDelta = pfx.length;
    }
    const newText = full.substring(0, lineStart) + newLine + full.substring(lineEnd);
    if (el instanceof HTMLTextAreaElement) { el.value = newText; lastTypedRef.current = newText; }
    setFileContent(newText);
    setTimeout(() => {
      const el2 = editorRef.current; if (!el2) return;
      setSel(el2, start + cursorDelta, start + cursorDelta);
      focusEl(el2);
    }, 0);
  }, [setFileContent, pushUndo]);

  // ---- Block inserters for the More tools dropdown ----
  const insertBlock = useCallback((template: string, cursorOffset?: number) => {
    const el = editorRef.current; if (!el) return;
    pushUndo();
    const { start } = getSel(el);
    const t = getText(el);
    const nt = t.substring(0, start) + template + t.substring(start);
    const cursor = start + (cursorOffset ?? template.length);
    setFileContent(nt);
    setTimeout(() => {
      const el2 = editorRef.current; if (!el2) return;
      if (!(el2 instanceof HTMLTextAreaElement) && syntaxHighlight) el2.innerHTML = highlightMarkdown(nt) || '<br>';
      setSel(el2, cursor, cursor);
      focusEl(el2);
    }, 0);
  }, [setFileContent, pushUndo, syntaxHighlight]);

  const insertFootnote = useCallback(() => {
    const el = editorRef.current; if (!el) return;
    pushUndo();
    const { start } = getSel(el);
    const t = getText(el);
    let n = 1;
    const re = /\[\^(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const num = parseInt(m[1]);
      if (num >= n) n = num + 1;
    }
    const ref = `[^${n}]`;
    const def = `\n[^${n}]: `;
    const nt = t.substring(0, start) + ref + t.substring(start) + def;
    setFileContent(nt);
    setTimeout(() => {
      const el2 = editorRef.current; if (!el2) return;
      if (!(el2 instanceof HTMLTextAreaElement) && syntaxHighlight) el2.innerHTML = highlightMarkdown(nt) || '<br>';
      setSel(el2, start + ref.length, start + ref.length);
      focusEl(el2);
    }, 0);
  }, [pushUndo, setFileContent, syntaxHighlight]);

  const insertCallout = useCallback((type: string) => {
    insertBlock(`\n:::${type}\n\n:::\n`, 8);
  }, [insertBlock]);

  const insertMermaid = useCallback(() => {
    insertBlock('\n```mermaid\n\n```\n', 13);
  }, [insertBlock]);

  const insertHR = useCallback(() => {
    insertBlock('\n---\n');
  }, [insertBlock]);

  const insertComment = useCallback(() => {
    const el = editorRef.current; if (!el) return;
    pushUndo();
    const { start, end } = getSel(el);
    const t = getText(el);
    const nt = t.substring(0, start) + '<!-- ' + t.substring(start, end) + ' -->' + t.substring(end);
    const cursor = start + 5;
    setFileContent(nt);
    setTimeout(() => {
      const el2 = editorRef.current; if (!el2) return;
      if (!(el2 instanceof HTMLTextAreaElement) && syntaxHighlight) el2.innerHTML = highlightMarkdown(nt) || '<br>';
      setSel(el2, cursor, cursor);
      focusEl(el2);
    }, 0);
  }, [pushUndo, setFileContent, syntaxHighlight]);

  const insertDeflist = useCallback(() => {
    insertBlock('\nTerm\n: Definition\n');
  }, [insertBlock]);

  const handleUndo = useCallback(() => {
    const el = editorRef.current;
    if (!el || undoStack.current.length === 0) return;
    const curText = getText(el);
    const curCursor = getCursorOffset(el);
    // Normalize entry (old code stored strings; new code stores {text,cursor})
    const norm = (s: Snap | string): Snap =>
      typeof s === 'string' ? { text: s, cursor: s.length } : s;
    // If top of stack equals current state, skip it (it was pushed after the edit)
    let prev: Snap | undefined;
    while (undoStack.current.length > 0) {
      prev = norm(undoStack.current.pop()!);
      if (prev.text !== curText) break;
      // Same text — this is a post-edit snapshot, discard and try next
    }
    if (!prev || prev.text === curText) return; // nothing to undo
    redoStack.current.push({ text: curText, cursor: curCursor });
    syncGuard.current = true;
    if (el instanceof HTMLDivElement && syntaxHighlight) {
      el.innerHTML = highlightMarkdown(prev.text) || '<br>';
      setSel(el, prev.cursor, prev.cursor);
    } else if (el instanceof HTMLTextAreaElement) {
      el.value = prev.text;
      lastTypedRef.current = prev.text;
      el.selectionStart = el.selectionEnd = Math.min(prev.cursor, prev.text.length);
    }
    setFileContent(prev.text);
    setTimeout(() => { syncGuard.current = false; }, 100);
  }, [setFileContent, syntaxHighlight]);

  const handleRedo = useCallback(() => {
    const el = editorRef.current;
    if (!el || redoStack.current.length === 0) return;
    const curText = getText(el);
    const curCursor = getCursorOffset(el);
    undoStack.current.push({ text: curText, cursor: curCursor });
    const norm = (s: Snap | string): Snap =>
      typeof s === 'string' ? { text: s, cursor: s.length } : s;
    const next = norm(redoStack.current.pop()!);
    syncGuard.current = true;
    if (el instanceof HTMLDivElement && syntaxHighlight) {
      el.innerHTML = highlightMarkdown(next.text) || '<br>';
      setSel(el, next.cursor, next.cursor);
    } else if (el instanceof HTMLTextAreaElement) {
      el.value = next.text;
      lastTypedRef.current = next.text;
      el.selectionStart = el.selectionEnd = Math.min(next.cursor, next.text.length);
    }
    setFileContent(next.text);
    setTimeout(() => { syncGuard.current = false; }, 100);
  }, [setFileContent, syntaxHighlight]);

  // Pass flushStore to parent so App can flush pending text before saving
  useEffect(() => {
    if (onFlushRef) onFlushRef(flushStore);
  }, [onFlushRef, flushStore]);

  // Track editor width for word-wrap line calc
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || !wordWrap) return;
    setTaWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => { setTaWidth(entry.contentRect.width); });
    observer.observe(el);
    return () => observer.disconnect();
  }, [wordWrap]);

  // Auto-focus on mount
  useEffect(() => { editorRef.current?.focus(); }, []);

  // Register scroll container for sync
  useEffect(() => {
    const el = editorRef.current;
    if (el && onScrollRef) onScrollRef(el);
    return () => { if (onScrollRef) onScrollRef(null); };
  }, [onScrollRef]);

  // Sync scroll: listen to editor scroll
  useEffect(() => {
    const el = editorRef.current;
    if (!el || syncScroll === 'off' || !onEditorScroll) return;
    el.addEventListener('scroll', onEditorScroll, { passive: true });
    return () => el.removeEventListener('scroll', onEditorScroll);
  }, [syncScroll, onEditorScroll]);

  const updateCursorPosition = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const { line, col, total } = getLineCol(el);
    setCursorPosition({ line, col });
    setLineCount(total);
  }, []);

  // Sync editor from store for external changes (file open, checkbox toggle in viewer)
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || isHighlighting.current || syncGuard.current) return;
    // Sync textarea when store changes externally (e.g., checkbox toggle in viewer)
    if (el instanceof HTMLTextAreaElement) {
      if (el.value !== fileContent && document.activeElement !== el) {
        el.value = fileContent;
        lastTypedRef.current = fileContent;
      }
      return;
    }
    // contentEditable: set initial content when file opens or mode switches
    if (el instanceof HTMLDivElement && syntaxHighlight) {
      const cursor = saveCursor(el);
      const st = el.scrollTop;
      syncGuard.current = true;
      el.innerHTML = highlightMarkdown(fileContent) || '<br>';
      restoreCursor(el, cursor);
      el.scrollTop = st;
      setTimeout(() => { syncGuard.current = false; }, 100);
    }
  }, [fileContent, syntaxHighlight]);

  // Input handler: push undo, debounce store, schedule highlighting
  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el || syncGuard.current) return;
    const text = getText(el);
    pushUndo(); // per-keystroke undo for contentEditable
    pushToStore(text);
    applyHighlight();
    requestAnimationFrame(updateCursorPosition);
  }, [pushToStore, applyHighlight, updateCursorPosition, pushUndo]);

  // textarea onChange — short debounce (150ms) + startTransition for interruptible preview
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    pushUndo();
    lastTypedRef.current = text;
    clearTimeout(storeTimer.current);
    storeTimer.current = window.setTimeout(() => {
      if (text === lastTypedRef.current) {
        startTransition(() => { setFileContent(text); });
      }
    }, 150);
  }, [setFileContent, pushUndo]);

  const handleScroll = useCallback(() => {
    if (editorRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = editorRef.current.scrollTop;
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const el = editorRef.current; if (!el) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault(); toolbarUndo(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault(); toolbarRedo(); return;
    }
    const isTa = el instanceof HTMLTextAreaElement;
    // Tab — insert 2 spaces natively, debounce store
    if (e.key === 'Tab') {
      e.preventDefault();
      pushUndo();
      const { start, end } = getSel(el);
      const value = getText(el);
      if (!e.shiftKey) {
        const nv = value.substring(0, start) + '  ' + value.substring(end);
        if (isTa) {
          el.value = nv; lastTypedRef.current = nv;
          el.selectionStart = el.selectionEnd = start + 2;
          pushUndo(); // snapshot post-Tab state for undo granularity
          clearTimeout(storeTimer.current);
          storeTimer.current = window.setTimeout(() => { startTransition(() => { lastTypedRef.current = nv; setFileContent(nv); }); }, 150);
        } else {
          syncGuard.current = true;
          setFileContent(nv);
          setTimeout(() => { const el2 = editorRef.current; if (el2 && !(el2 instanceof HTMLTextAreaElement) && syntaxHighlight) el2.innerHTML = highlightMarkdown(nv) || '<br>'; setSel(el2!, start + 2, start + 2); }, 0);
          setTimeout(() => { syncGuard.current = false; }, 50);
        }
        updateCursorPosition();
      } else {
        const ls = value.lastIndexOf('\n', start - 1) + 1;
        const bl = value.substring(ls, start);
        if (bl.startsWith('  ')) {
          const nv = value.substring(0, ls) + bl.substring(2) + value.substring(start);
          if (isTa) {
            el.value = nv; lastTypedRef.current = nv;
            el.selectionStart = el.selectionEnd = start - 2;
            clearTimeout(storeTimer.current);
            storeTimer.current = window.setTimeout(() => { startTransition(() => { lastTypedRef.current = nv; setFileContent(nv); }); }, 150);
          } else {
            syncGuard.current = true;
            setFileContent(nv);
            setTimeout(() => { const el2 = editorRef.current; if (el2 && !(el2 instanceof HTMLTextAreaElement) && syntaxHighlight) el2.innerHTML = highlightMarkdown(nv) || '<br>'; setSel(el2!, start - 2, start - 2); }, 0);
            setTimeout(() => { syncGuard.current = false; }, 50);
          }
          updateCursorPosition();
        }
      }
      return;
    }
    // Enter — smart newline with list continuation for both modes
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isTa) syncGuard.current = true;
      pushUndo();
      const value = getText(el);
      const { start } = getSel(el);
      const ls = value.lastIndexOf('\n', start - 1) + 1;
      const cl = value.substring(ls, start);
      const indent = cl.match(/^\s*/)?.[0] || '';
      const doApply = (nv: string, cursor: number) => {
        if (isTa) {
          el.value = nv; lastTypedRef.current = nv;
          el.selectionStart = el.selectionEnd = cursor;
          pushUndo(); // snapshot post-Enter state for undo granularity
          clearTimeout(storeTimer.current);
          storeTimer.current = window.setTimeout(() => { startTransition(() => { lastTypedRef.current = nv; setFileContent(nv); }); }, 150);
        } else {
          syncGuard.current = true;
          setFileContent(nv);
          requestAnimationFrame(() => {
            const el2 = editorRef.current;
            if (el2 && !(el2 instanceof HTMLTextAreaElement) && syntaxHighlight) el2.innerHTML = highlightMarkdown(nv) || '<br>';
            setSel(el2 || el, cursor, cursor);
            requestAnimationFrame(() => { syncGuard.current = false; });
          });
        }
        updateCursorPosition();
      };
      const tm = cl.match(/^(\s*)[-*+]\s+\[([ x])\]\s*(.*)/);
      if (tm) { const ti = tm[1]; const tt = tm[3]; if (!tt) doApply(value.substring(0, ls) + '\n' + ti + value.substring(start), ls + 1 + ti.length); else { const ins = '\n' + ti + '- [ ] '; doApply(value.substring(0, start) + ins + value.substring(start), start + ins.length); } return; }
      // Footnote definition continuation: [^1]: text → [^2]: 
      const fn = cl.match(/^\[\^(\d+)\]:\s*(.*)/);
      if (fn) { const nextNum = parseInt(fn[1]) + 1; const ins = fn[2] ? `\n[^${nextNum}]: ` : '\n'; doApply(value.substring(0, start) + ins + value.substring(start), start + ins.length); return; }
      const lm = cl.match(/^(\s*)([-*+]\s+|(\d+\.)\s+)/);
      if (lm) { const ins = '\n' + indent + (lm[3] ? `${parseInt(lm[3]) + 1}. ` : '- '); doApply(value.substring(0, start) + ins + value.substring(start), start + ins.length); return; }
      const ins = indent ? '\n' + indent : '\n';
      doApply(value.substring(0, start) + ins + value.substring(start), start + ins.length);
    }
  }, [setFileContent, updateCursorPosition, handleUndo, handleRedo, syntaxHighlight, pushUndo]);

  const handleCursorUpdate = useCallback(() => {
    updateCursorPosition();
  }, [updateCursorPosition]);

  const lines = useCallback(() => {
    const logicalLines = fileContent.split('\n');
    if (!wordWrap) {
      return Array.from({ length: logicalLines.length || 1 }, (_, i) => i + 1);
    }
    const ta = editorRef.current;
    if (!ta) return Array.from({ length: logicalLines.length || 1 }, (_, i) => i + 1);

    const cs = getComputedStyle(ta);
    const padH = parseInt(cs.paddingLeft) + parseInt(cs.paddingRight);
    const textWidth = ta.clientWidth - padH;
    if (textWidth <= 0) {
      return Array.from({ length: logicalLines.length || 1 }, (_, i) => i + 1);
    }

    // Monospace font: measure avg char width using a longer string for accuracy
    const measurer = document.createElement('span');
    measurer.style.fontFamily = cs.fontFamily;
    measurer.style.fontSize = cs.fontSize;
    measurer.style.fontWeight = cs.fontWeight;
    measurer.style.letterSpacing = cs.letterSpacing;
    measurer.style.position = 'absolute';
    measurer.style.visibility = 'hidden';
    measurer.style.whiteSpace = 'pre';
    measurer.textContent = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // 50 chars
    document.body.appendChild(measurer);
    const charWidth = measurer.getBoundingClientRect().width / 50;
    document.body.removeChild(measurer);

    if (charWidth <= 0) {
      return Array.from({ length: logicalLines.length || 1 }, (_, i) => i + 1);
    }

    // Use floor and subtract 1px safety margin for sub-pixel rounding
    const charsPerLine = Math.max(1, Math.floor((textWidth - 1) / charWidth));
    const tabSize = 2;

    const visualLines: number[] = [];
    let lineNum = 1;
    for (const line of logicalLines) {
      const expandedLen = line.replace(/\t/g, ' '.repeat(tabSize)).length;
      const wrapped = Math.max(1, Math.ceil(expandedLen / charsPerLine));
      visualLines.push(lineNum);
      for (let w = 1; w < wrapped; w++) {
        visualLines.push(0);
      }
      lineNum++;
    }

    return visualLines;
  }, [fileContent, wordWrap, taWidth]);

  const toolbarUndo = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    handleUndo();
  }, [handleUndo]);

  const toolbarRedo = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    handleRedo();
  }, [handleRedo]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1c2733]" style={matchPalette ? { background: 'var(--pal-editor-bg)' } : undefined}>
      {/* Editor toolbar — darker than editor area */}
      <div
        ref={toolbarRef}
        className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200/60 dark:border-gray-700/50 bg-gray-50/85 dark:bg-[#181e26]/85 backdrop-blur-md flex-wrap"
        style={matchPalette ? {
          backgroundColor: 'var(--pal-editor-toolbar-bg)',
        } : undefined}
      >
        {/* Undo */}
        <button className="btn-icon" onClick={toolbarUndo} title="Undo (Ctrl+Z)">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="m4 10l-.707.707L2.586 10l.707-.707zm17 8a1 1 0 1 1-2 0zM8.293 15.707l-5-5l1.414-1.414l5 5zm-5-6.414l5-5l1.414 1.414l-5 5zM4 9h10v2H4zm17 7v2h-2v-2zm-7-7a7 7 0 0 1 7 7h-2a5 5 0 0 0-5-5z"/></svg>
        </button>
        {/* Redo */}
        <button className="btn-icon" onClick={toolbarRedo} title="Redo (Ctrl+Y)">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="m20 10l.707.707l.707-.707l-.707-.707zM3 18a1 1 0 1 0 2 0zm12.707-2.293l5-5l-1.414-1.414l-5 5zm5-6.414l-5-5l-1.414 1.414l5 5zM20 9H10v2h10zM3 16v2h2v-2zm7-7a7 7 0 0 0-7 7h2a5 5 0 0 1 5-5z"/></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* Save */}
        {onSave && (
          <button className="btn-icon" onClick={onSave} title="Save (Ctrl+S)">
            {/* <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg> */}
            <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.25 21v-4.765a1.59 1.59 0 0 0-1.594-1.588H9.344a1.59 1.59 0 0 0-1.594 1.588V21m8.5-17.715v2.362a1.59 1.59 0 0 1-1.594 1.588H9.344A1.59 1.59 0 0 1 7.75 5.647V3m8.5.285A3.2 3.2 0 0 0 14.93 3H7.75m8.5.285c.344.156.661.374.934.645l2.382 2.375A3.17 3.17 0 0 1 20.5 8.55v9.272A3.18 3.18 0 0 1 17.313 21H6.688A3.18 3.18 0 0 1 3.5 17.823V6.176A3.18 3.18 0 0 1 6.688 3H7.75"/></svg>
          </button>
        )}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* Bold */}
        <button className="btn-icon" onClick={() => toggleWrap('**', '**', 'bold')} title="Bold (Ctrl+B)">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M8.193 13H4V3h4.151c1.816 0 2.987.977 2.987 2.495c0 1.074-.797 2.01-1.823 2.176v.055c1.359.132 2.308 1.11 2.308 2.433c0 1.76-1.296 2.841-3.43 2.841M5.788 4.393v2.82h1.635c1.248 0 1.948-.526 1.948-1.455c0-.873-.603-1.365-1.67-1.365zm0 7.214h1.996c1.316 0 2.016-.547 2.016-1.573c0-1.019-.72-1.552-2.092-1.552h-1.92z"/></svg>
        </button>
        {/* Italic */}
        <button className="btn-icon" onClick={() => toggleWrap('*', '*', 'italic')} title="Italic (Ctrl+I)">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M8.16 12H9.5a.5.5 0 1 1 0 1h-4a.5.5 0 1 1 0-1h1.639l1.7-8H7.5a.5.5 0 0 1 0-1h4a.5.5 0 1 1 0 1H9.861z"/></svg>
        </button>
        {/* Strikethrough */}
        <button className="btn-icon" onClick={() => toggleWrap('~~', '~~', 'strikethrough')} title="Strikethrough">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M6.333 5.686c0 .31.083.581.27.814H5.166a2.8 2.8 0 0 1-.099-.76c0-1.627 1.436-2.768 3.48-2.768c1.969 0 3.39 1.175 3.445 2.85h-1.23c-.11-1.08-.964-1.743-2.25-1.743c-1.23 0-2.18.602-2.18 1.607zm2.194 7.478c-2.153 0-3.589-1.107-3.705-2.81h1.23c.144 1.06 1.129 1.703 2.544 1.703c1.34 0 2.31-.705 2.31-1.675c0-.827-.547-1.374-1.914-1.675L8.046 8.5H1v-1h14v1h-3.504c.468.437.675.994.675 1.697c0 1.826-1.436 2.967-3.644 2.967"/></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        <div className="relative" ref={headingRef}>
          <button className="btn-icon" onClick={() => setHeadingOpen(v => !v)} title="Heading">
            <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M6 11a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2V5a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2v2h4V5a1 1 0 1 1 0-2h2a1 1 0 0 1 0 2v6a1 1 0 0 1 0 2h-2a1 1 0 0 1 0-2V9H6z"/></svg>
          </button>
          {headingOpen && (() => {
            const el = editorRef.current;
            const full = el ? getText(el) : '';
            const sel = el ? getSel(el) : { start: 0, end: 0 };
            const ls = full.lastIndexOf('\n', sel.start - 1) + 1;
            const cl = full.substring(ls, full.indexOf('\n', sel.start) === -1 ? full.length : full.indexOf('\n', sel.start));
            const hMatch = cl.match(/^(#{1,6})\s/);
            return (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-[#28323e] border border-gray-200 dark:border-gray-600 rounded-md shadow-xl z-40 py-0.5 w-36 editor-popup"
              data-palette={matchPalette ? '' : undefined}
              style={matchPalette ? { backgroundColor: 'var(--pal-panel-bg)', borderColor: 'var(--pal-border)', ['--popup-bg' as any]: 'var(--pal-panel-bg)', ['--popup-border' as any]: 'var(--pal-border)' } : undefined}
            >
              {[1,2,3,4,5,6].map(n => (
                <button key={n} className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-white/10 font-mono" onClick={() => { setHeadingOpen(false); toggleHeading(n); }}>
                  <span className="text-gray-400">{'#'.repeat(n)}</span> <span className="font-medium">H{n}</span>
                </button>
              ))}
              {hMatch && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-600" />
                  <button className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 flex items-center gap-1.5" onClick={() => { setHeadingOpen(false); toggleHeading(hMatch[1].length); }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    Clear heading
                  </button>
                </>
              )}
            </div>
            );
          })()}
        </div>
        {/* Link */}
        <button className="btn-icon" onClick={() => toggleWrap('[', '](url)', 'link text')} title="Insert link">
          <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></svg>
        </button>
        {/* Image */}
        <button className="btn-icon" onClick={() => toggleWrap('![', '](image-url)', 'alt text')} title="Insert image">
          {/* <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 256 256"><g><path d="M224 56v122.06l-39.72-39.72a8 8 0 0 0-11.31 0L147.31 164l-49.65-49.66a8 8 0 0 0-11.32 0L32 168.69V56a8 8 0 0 1 8-8h176a8 8 0 0 1 8 8" opacity=".2"/><path d="M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16m0 16v102.75l-26.07-26.06a16 16 0 0 0-22.63 0l-20 20l-44-44a16 16 0 0 0-22.62 0L40 149.37V56ZM40 172l52-52l80 80H40Zm176 28h-21.37l-36-36l20-20L216 181.38zm-72-100a12 12 0 1 1 12 12a12 12 0 0 1-12-12"/></g></svg> */}
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M15 8h.01M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="m3 16l5-5c.928-.893 2.072-.893 3 0l5 5"/><path d="m14 14l1-1c.928-.893 2.072-.893 3 0l3 3"/></g></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* Inline code */}
        <button className="btn-icon" onClick={() => toggleWrap('`', '`', 'code')} title="Inline code">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M2.414 8.036L4.89 10.51a.5.5 0 0 1-.707.708L1.354 8.389a.5.5 0 0 1 0-.707l2.828-2.828a.5.5 0 1 1 .707.707zm8.768 2.474l2.475-2.474l-2.475-2.475a.5.5 0 0 1 .707-.707l2.829 2.828a.5.5 0 0 1 0 .707l-2.829 2.829a.5.5 0 1 1-.707-.708M8.559 2.506a.5.5 0 0 1 .981.19L7.441 13.494a.5.5 0 0 1-.981-.19z"/></svg>
        </button>
        {/* Code block */}
        <button className="btn-icon" onClick={() => {
          const el = editorRef.current; if (!el) return;
          pushUndo();
          const { start, end } = getSel(el);
          const t = getText(el);
          const sel = t.substring(start, end);
          const ins = sel ? `\`\`\`\n${sel}\n\`\`\`` : '```\ncode block\n```';
          const nt = t.substring(0, start) + ins + t.substring(end);
          setFileContent(nt);
          setTimeout(() => {
            const el2 = editorRef.current; if (!el2) return;
            if (!(el2 instanceof HTMLTextAreaElement) && syntaxHighlight) el2.innerHTML = highlightMarkdown(nt) || '<br>';
            setSel(el2, start + ins.length, start + ins.length);
            focusEl(el2);
            updateCursorPosition();
          }, 0);
        }} title="Code block">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 256 256"><path d="m58.34 101.66l-32-32a8 8 0 0 1 0-11.32l32-32a8 8 0 0 1 11.32 11.32L43.31 64l26.35 26.34a8 8 0 0 1-11.32 11.32m40 0a8 8 0 0 0 11.32 0l32-32a8 8 0 0 0 0-11.32l-32-32a8 8 0 0 0-11.32 11.32L124.69 64L98.34 90.34a8 8 0 0 0 0 11.32M200 40h-24a8 8 0 0 0 0 16h24v144H56v-64a8 8 0 0 0-16 0v64a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16"/></svg>
        </button>
        {/* Blockquote */}
        <button className="btn-icon" onClick={() => toggleLinePrefix('> ', 'blockquote')} title="Blockquote">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M6.848 2.47a1 1 0 0 1-.318 1.378A7.3 7.3 0 0 0 3.75 7.01A3 3 0 1 1 1 10v-.027a4 4 0 0 1 .01-.232c.009-.15.027-.36.062-.618c.07-.513.207-1.22.484-2.014c.552-1.59 1.67-3.555 3.914-4.957a1 1 0 0 1 1.378.318m7 0a1 1 0 0 1-.318 1.378a7.3 7.3 0 0 0-2.78 3.162A3 3 0 1 1 8 10v-.027a4 4 0 0 1 .01-.232c.009-.15.027-.36.062-.618c.07-.513.207-1.22.484-2.014c.552-1.59 1.67-3.555 3.914-4.957a1 1 0 0 1 1.378.318"/></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* List */}
        <button className="btn-icon" onClick={() => toggleLinePrefix('- ', 'list item')} title="Unordered list">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 4h8a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1m0 4h8a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1m0 4h8a.5.5 0 1 1 0 1h-8a.5.5 0 1 1 0-1m-3-7a.5.5 0 1 1 0-1a.5.5 0 0 1 0 1m0 4a.5.5 0 1 1 0-1a.5.5 0 0 1 0 1m0 4a.5.5 0 1 1 0-1a.5.5 0 0 1 0 1"/></svg>
        </button>
        {/* Checkbox */}
        <button className="btn-icon" onClick={() => toggleLinePrefix('- [ ] ', 'task')} title="Task list">
          <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.25 4.5h11m-14-1.446L4.357 5.946L2.75 4.34m7.5 7.66h11m-14-1.446l-2.893 2.892L2.75 11.84m7.5 7.66h11m-14-1.446l-2.893 2.892L2.75 19.34"/></svg>
        </button>
        {/* Table */}
        <button className="btn-icon" onClick={() => {
          const el = editorRef.current; if (!el) return;
          pushUndo();
          const { start } = getSel(el);
          const t = getText(el);
          const ins = '\n| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n';
          const nt = t.substring(0, start) + ins + t.substring(start);
          setFileContent(nt);
          setTimeout(() => {
            const el2 = editorRef.current; if (!el2) return;
            if (!(el2 instanceof HTMLTextAreaElement) && syntaxHighlight) el2.innerHTML = highlightMarkdown(nt) || '<br>';
            setSel(el2, start + ins.length, start + ins.length);
            focusEl(el2);
            updateCursorPosition();
          }, 0);
        }} title="Insert table">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5.616 20q-.691 0-1.153-.462T4 18.384V5.616q0-.691.463-1.153T5.616 4h12.769q.69 0 1.153.463T20 5.616v12.769q0 .69-.462 1.153T18.384 20zm5.884-5.596H5v3.98q0 .27.173.443t.443.173H11.5zm1 0V19h5.885q.269 0 .442-.173t.173-.442v-3.981zm-1-1V8.769H5v4.635zm1 0H19V8.769h-6.5zM5 7.769h14V5.615q0-.269-.173-.442T18.385 5H5.615q-.269 0-.442.173T5 5.616z"/></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* Adaptive toolbar: compact (all in dropdown) / medium (HR + footnote inline) */}
        {toolbarMode === 'medium' && (
          <>
            <button className="btn-icon" title="Horizontal separator" onClick={insertHR}>
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14"/></svg>
            </button>
            <button className="btn-icon" title="Insert footnote" onClick={insertFootnote}>
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m2.75 17.248l1.44-3.384m0 0h5.188m-5.187 0l2.208-5.186a.412.412 0 0 1 .771 0l2.208 5.186m0 0l1.441 3.384m2.398-8.838v8.838m5.833-2.916a2.916 2.916 0 1 1-5.833 0a2.916 2.916 0 0 1 5.833 0m0-7.707l2.2-1.375v5.5"/></svg>
            </button>
          </>
        )}
        {/* Chevron dropdown for remaining tools */}
        <div className="relative" ref={moreRef}>
          <button className="btn-icon" title="More tools" onClick={() => setMoreOpen(v => !v)}>
            <svg className="w-[18px] h-[18px] shrink-0 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ transform: moreOpen ? 'rotate(180deg)' : '' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9l6 6 6-6" />
            </svg>
          </button>
          {moreOpen && (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-[#28323e] border border-gray-200 dark:border-gray-600 rounded-md shadow-xl z-40 py-1 w-44 editor-popup"
              data-palette={matchPalette ? '' : undefined}
              style={{ maxWidth: 'calc(100vw - 1rem)', ...(matchPalette ? { backgroundColor: 'var(--pal-panel-bg)', borderColor: 'var(--pal-border)', ['--popup-bg' as any]: 'var(--pal-panel-bg)', ['--popup-border' as any]: 'var(--pal-border)' } : {}) }}
            >
              {toolbarMode === 'compact' && (
                <>
                  <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2 text-gray-600 dark:text-gray-300" onClick={() => { setMoreOpen(false); insertHR(); }}>
                    <svg className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14"/></svg>
                    Horizontal Rule
                  </button>
                  <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2 text-gray-600 dark:text-gray-300" onClick={() => { setMoreOpen(false); insertFootnote(); }}>
                    <svg className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m2.75 17.248l1.44-3.384m0 0h5.188m-5.187 0l2.208-5.186a.412.412 0 0 1 .771 0l2.208 5.186m0 0l1.441 3.384m2.398-8.838v8.838m5.833-2.916a2.916 2.916 0 1 1-5.833 0a2.916 2.916 0 0 1 5.833 0m0-7.707l2.2-1.375v5.5"/></svg>
                    Footnote
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-600 my-0.5" />
                </>
              )}
              <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2 text-gray-600 dark:text-gray-300" onClick={() => { setMoreOpen(false); toggleWrap('==', '==', 'highlight'); }}>
                <svg className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 256 256"><path d="M253.66 106.34a8 8 0 0 0-11.32 0L192 156.69L107.31 72l50.35-50.34a8 8 0 1 0-11.32-11.32L96 60.69a16 16 0 0 0-2.82 18.81L72 100.69a16 16 0 0 0 0 22.62l4.69 4.69l-58.35 58.34a8 8 0 0 0 3.13 13.25l72 24A7.9 7.9 0 0 0 96 224a8 8 0 0 0 5.66-2.34L136 187.31l4.69 4.69a16 16 0 0 0 22.62 0l21.19-21.18a16 16 0 0 0 18.81-2.82l50.35-50.34a8 8 0 0 0 0-11.32M93.84 206.85l-55-18.35L88 139.31L124.69 176ZM152 180.69L83.31 112L104 91.31L172.69 160Z"/></svg>
                Highlight ==text==
              </button>
              <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2 text-gray-600 dark:text-gray-300" onClick={() => { setMoreOpen(false); insertComment(); }}>
                <svg className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 64 64"><path d="M44.4 19.5H18.6c-1.2 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3h25.9c1.2 0 2.3-1 2.3-2.3s-1.1-2.3-2.4-2.3m-5.2 12.2H18.6c-1.2 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3h20.6c1.2 0 2.3-1 2.3-2.3s-1.1-2.3-2.3-2.3"/><path d="M56 7.9H8c-3.4 0-6.3 2.8-6.3 6.3v37.7c0 1.6.9 3.1 2.4 3.8c.6.3 1.2.4 1.8.4c1 0 1.9-.3 2.7-1l8.5-7H56c3.4 0 6.3-2.8 6.3-6.3V14.2c0-3.5-2.9-6.3-6.3-6.3m1.8 33.9c0 1-.8 1.8-1.8 1.8H16.3c-.5 0-1 .2-1.4.5l-8.6 7.1v-37c0-1 .8-1.8 1.8-1.8h48c1 0 1.8.8 1.8 1.8v27.6z"/></svg>
                Comment &lt;!-- --&gt;
              </button>
              <div className="border-t border-gray-200 dark:border-gray-600 my-0.5" />
              <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2 text-gray-600 dark:text-gray-300" onClick={() => { setMoreOpen(false); insertMermaid(); }}>
                <svg className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 32 32"><path d="M3 6a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9v5.266a2 2 0 0 1 .416.32l4.003 4.002a2 2 0 0 1 .317.412H19v-1a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-1h-5.262q-.128.225-.32.416L9.417 29.42a2 2 0 0 1-2.828 0l-4.002-4.003a2 2 0 0 1 0-2.828l4.002-4.002q.19-.19.412-.317V13H6a3 3 0 0 1-3-3zm5.002 14L4 24.002l4.002 4.002L12 24.007v-.01zM6 5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zm16 16a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1z"/></svg>
                Mermaid Diagram
              </button>
              <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/10 flex items-center gap-2 text-gray-600 dark:text-gray-300" onClick={() => { setMoreOpen(false); insertDeflist(); }}>
                <svg className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path d="M8.72 17.073H2.019v-15.4h7.414A2.567 2.567 0 0 1 12 4.24v5.83m9.981 1.725V1.673h-7.414A2.567 2.567 0 0 0 12 4.24m-.447 11.974a4.315 4.315 0 1 0 8.63 0a4.315 4.315 0 1 0-8.63 0m10.428 6.113l-2.877-2.877"/></svg>
                Definition List
              </button>
              <div className="border-t border-gray-200 dark:border-gray-600 my-0.5" />
              <span className="px-3 py-1 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Callout</span>
              {['note','tip','warning','danger'].map(type => (
                <button key={type} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/10 capitalize flex items-center gap-2 text-gray-600 dark:text-gray-300" onClick={() => { setMoreOpen(false); insertCallout(type); }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: type === 'note' ? '#3b82f6' : type === 'tip' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#ef4444' }} />
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Spacer */}
        {/* Word wrap toggle */}
        {onToggleWordWrap && (
          <button
            className={`btn-icon ${wordWrap ? 'selected' : ''}`}
            onClick={onToggleWordWrap}
            title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
          >
            <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 18h5m-5-6h13a3 3 0 0 1 0 6h-4l2-2m0 4l-2-2"/>
            </svg>
          </button>
        )}
        {/* Syntax highlight toggle */}
        <button
          className={`btn-icon ${syntaxHighlight ? 'selected' : ''}`}
          onClick={() => {
            const el = editorRef.current;
            if (el) {
              savedScrollRef.current = el.scrollTop;
              savedCursorRef.current = getSel(el).start;
            }
            setSyntaxHighlight(v => !v);
          }}
          title={syntaxHighlight ? 'Disable syntax highlighting' : 'Enable syntax highlighting'}
        >
          <svg className="w-[18px] h-[18px] shrink-0 " fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128a2.25 2.25 0 0 1-2.4 2.245a4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128m0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
          </svg>
        </button>
        <div className="flex-1" />
        {/* Sync scroll toggle */}
        {syncScroll !== undefined && (
          <button
            className={`btn-icon flex items-center gap-1 ${syncScroll !== 'off' ? 'selected' : ''}`}
            onClick={onToggleSync}
            title={`Sync scroll: ${syncScroll === 'off' ? 'Off' : syncScroll === 'content' ? 'Content (H)' : 'Position (P)'}`}
          >
            <svg className="w-[24px] h-[20px] shrink-0" fill="currentColor" viewBox="0 0 30 24">
              <path fill="currentColor" d="m 11.557955,2 c 1.242641,0 2.25,1.0073593 2.25,2.25 v 15.5 c 0,1.242641 -1.007359,2.25 -2.25,2.25 H 3.1522946 C 1.9096539,22 0.90229465,20.992641 0.90229465,19.75 V 4.25 C 0.90229465,3.0073593 1.9096539,2 3.1522946,2 Z m 0,1.5 H 3.1522946 c -0.4142136,0 -0.75,0.3357864 -0.75,0.75 v 15.5 c 0,0.414 0.336,0.75 0.75,0.75 h 8.4056604 c 0.414214,0 0.75,-0.335786 0.75,-0.75 V 4.25 c 0,-0.4142136 -0.335786,-0.75 -0.75,-0.75 m -1.397641,9.964 c 0.265315,0.26011 0.300195,0.675267 0.082,0.976 l -0.071,0.085 -2.2500005,2.296 c -0.2637141,0.269069 -0.6861129,0.300739 -0.987,0.074 l -0.084,-0.074 -2.253,-2.296 c -0.6499436,-0.662627 0.2459247,-1.682846 0.987,-1.124 l 0.083,0.074 1.718,1.75 1.714,-1.75 c 0.2901616,-0.295899 0.7653131,-0.300377 1.0610005,-0.01 M 7.9203135,7.226 10.170314,9.522 c 0.749316,0.713375 -0.3708894,1.812641 -1.0700005,1.05 l -1.715,-1.752 -1.718,1.75 c -0.7000468,0.66647 -1.7231439,-0.337504 -1.07,-1.05 l 2.253,-2.296 c 0.293929,-0.2991751 0.776071,-0.2991751 1.07,0 M 26.934795,2 c 1.242641,0 2.25,1.0073593 2.25,2.25 v 15.499999 c 0,1.242641 -1.007359,2.25 -2.25,2.25 h -8.40566 c -1.24264,0 -2.25,-1.007359 -2.25,-2.25 V 4.25 c 0,-1.2426407 1.00736,-2.25 2.25,-2.25 z m 0,1.5 h -8.40566 c -0.414214,0 -0.75,0.3357864 -0.75,0.75 v 15.499999 c 0,0.414 0.336,0.75 0.75,0.75 h 8.40566 c 0.414214,0 0.75,-0.335786 0.75,-0.75 V 4.25 c 0,-0.4142136 -0.335786,-0.75 -0.75,-0.75 m -1.397641,9.964 c 0.265315,0.26011 0.300195,0.675267 0.082,0.976 l -0.071,0.085 -2.25,2.296 c -0.263714,0.269069 -0.686113,0.300739 -0.987,0.074 l -0.084,-0.074 -2.253,-2.296 c -0.649944,-0.662626 0.245925,-1.682845 0.987,-1.123999 l 0.083,0.074 1.718,1.749999 1.714,-1.749999 c 0.290161,-0.295899 0.765313,-0.300377 1.061,-0.01 m -2.24,-6.2390001 2.25,2.2959999 c 0.749316,0.7133752 -0.370889,1.8126412 -1.07,1.0500002 l -1.715,-1.7520002 -1.718,1.7500002 c -0.700047,0.66647 -1.723144,-0.337504 -1.07,-1.0500002 l 2.253,-2.2959999 c 0.293929,-0.2991751 0.776071,-0.2991751 1.07,0"/>
            </svg>
            {syncScroll !== 'off' && (
              <span className="text-[11px] font-medium">{syncScroll === 'content' ? 'H' : 'P'}</span>
            )}
          </button>
        )}
      </div>



      {/* Textarea with line numbers */}
      <div className="flex-1 flex overflow-hidden bg-transparent">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="select-none text-right px-3 py-3 text-sm leading-6 font-mono text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-[#141c24] border-r border-gray-200 dark:border-gray-700/50 overflow-hidden"
          style={{
            minWidth: '3.5rem',
            scrollbarWidth: 'none',
            ...(matchPalette ? {
              backgroundColor: 'var(--pal-editor-toolbar-bg)',
              color: 'var(--pal-muted)',
            } : {}),
          }}
        >
          {lines().map((num, idx) => (
            <div key={idx} style={{ height: '1.5rem', lineHeight: '1.5rem' }}>{num > 0 ? num : '\u00A0'}</div>
          ))}
        </div>

        {/* Editor: textarea (fast, no highlight) or contentEditable div (syntax colored) */}
        {!syntaxHighlight ? (
          <textarea
            ref={editorRef as React.RefObject<HTMLTextAreaElement>}
            defaultValue={fileContent}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onClick={handleCursorUpdate}
            onScroll={handleScroll}
            spellCheck={false}
            className={`flex-1 bg-transparent text-sm leading-6 font-mono p-3 resize-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 scrollbar-expand ${wordWrap ? 'wrap' : 'no-wrap'}`}
            placeholder="Start writing markdown..."
            style={{ tabSize: 2, whiteSpace: wordWrap ? 'pre-wrap' : 'pre', background: 'transparent' }}
            onMouseMove={handleEditorMouseMove}
            onMouseLeave={handleEditorMouseLeave}
          />
        ) : (
          <div
            ref={editorRef as React.RefObject<HTMLDivElement>}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onClick={handleCursorUpdate}
            onScroll={handleScroll}
            spellCheck={false}
            className={`flex-1 text-sm leading-6 font-mono p-3 outline-none whitespace-pre-wrap break-words overflow-y-auto overflow-x-auto text-gray-800 dark:text-gray-200 bg-transparent scrollbar-expand ${wordWrap ? '' : 'whitespace-pre'}`}
            style={{ tabSize: 2, whiteSpace: wordWrap ? 'pre-wrap' : 'pre', background: 'transparent' }}
            onMouseMove={handleEditorMouseMove}
            onMouseLeave={handleEditorMouseLeave}
          />
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor;
