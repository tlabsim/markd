import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../store';

const MarkdownEditor: React.FC = () => {
  const { fileContent, setFileContent } = useStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
  const [lineCount, setLineCount] = useState(1);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushUndo = useCallback(() => {
    const current = useStore.getState().fileContent;
    undoStack.current.push(current);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // Helper: wrap selection with prefix/suffix, also handles undo
  const wrapSelection = useCallback((prefix: string, suffix: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    pushUndo();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const insertion = prefix + (selected || placeholder) + suffix;
    const newText = text.substring(0, start) + insertion + text.substring(end);
    setFileContent(newText);
    setTimeout(() => {
      const selStart = start + prefix.length;
      const selEnd = selStart + (selected.length || placeholder.length);
      textarea.selectionStart = selStart;
      textarea.selectionEnd = selEnd;
      textarea.focus();
      updateCursorPosition();
    }, 0);
  }, [setFileContent, pushUndo]);

  // Helper: insert at start of line(s)
  const prefixLines = useCallback((prefix: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    pushUndo();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const selected = text.substring(start, end) || placeholder;
    const insertion = prefix + selected;
    const newText = text.substring(0, lineStart) + insertion + text.substring(end);
    setFileContent(newText);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = lineStart + insertion.length;
      textarea.focus();
      updateCursorPosition();
    }, 0);
  }, [setFileContent, pushUndo]);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const current = useStore.getState().fileContent;
    redoStack.current.push(current);
    const prev = undoStack.current.pop()!;
    setFileContent(prev);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = prev.length; updateCursorPosition(); }
    }, 0);
  }, [setFileContent]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const current = useStore.getState().fileContent;
    undoStack.current.push(current);
    const next = redoStack.current.pop()!;
    setFileContent(next);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = next.length; updateCursorPosition(); }
    }, 0);
  }, [setFileContent]);

  // Focus textarea when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFileContent(e.target.value);
  }, [setFileContent]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const updateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const text = textarea.value;
    const lines = text.substring(0, pos).split('\n');
    setCursorPosition({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
    setLineCount(text.split('\n').length);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }
    // Tab key support
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      if (!e.shiftKey) {
        // Insert tab (2 spaces)
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        setFileContent(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
          updateCursorPosition();
        }, 0);
      } else {
        // Remove tab (2 spaces) before cursor
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const beforeLine = value.substring(lineStart, start);
        if (beforeLine.startsWith('  ')) {
          const newValue = value.substring(0, lineStart) + beforeLine.substring(2) + value.substring(start);
          setFileContent(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start - 2;
            updateCursorPosition();
          }, 0);
        }
      }
    }

    // Handle auto-indent on Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const value = textarea.value;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.substring(lineStart, start);
      const indent = currentLine.match(/^\s*/)?.[0] || '';

      // Check for task list items: - [ ] or - [x]
      const taskMatch = currentLine.match(/^(\s*)[-*+]\s+\[([ x])\]\s*(.*)/);
      if (taskMatch) {
        const taskIndent = taskMatch[1];
        const taskText = taskMatch[3];
        if (!taskText) {
          // Empty task – remove the marker and just break the line
          setTimeout(() => {
            const newStart = textarea.selectionStart;
            const newValue = textarea.value;
            const beforeLine = newValue.substring(0, lineStart);
            const afterCursor = newValue.substring(newStart);
            const updated = beforeLine + '\n' + taskIndent + afterCursor;
            setFileContent(updated);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = lineStart + 1 + taskIndent.length;
              updateCursorPosition();
            }, 0);
          }, 0);
        } else {
          // Continue task list
          setTimeout(() => {
            const newStart = textarea.selectionStart;
            const newValue = textarea.value;
            const insertion = '\n' + taskIndent + '- [ ] ';
            const updated = newValue.substring(0, newStart) + insertion + newValue.substring(newStart);
            setFileContent(updated);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = newStart + insertion.length;
              updateCursorPosition();
            }, 0);
          }, 0);
        }
        return;
      }

      // Check if we're in a regular list
      const listMatch = currentLine.match(/^(\s*)([-*+]\s+|(\d+\.)\s+)/);
      if (listMatch) {
        setTimeout(() => {
          const newStart = textarea.selectionStart;
          const newValue = textarea.value;
          const insertion = '\n' + indent + (listMatch[3] ? `${parseInt(listMatch[3]) + 1}. ` : '- ');
          const updated = newValue.substring(0, newStart) + insertion + newValue.substring(newStart);
          setFileContent(updated);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newStart + insertion.length;
            updateCursorPosition();
          }, 0);
        }, 0);
        return;
      }

      // Regular indent
      if (indent) {
        setTimeout(() => {
          const newStart = textarea.selectionStart;
          const newValue = textarea.value;
          const updated = newValue.substring(0, newStart) + '\n' + indent + newValue.substring(newStart);
          setFileContent(updated);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newStart + 1 + indent.length;
            updateCursorPosition();
          }, 0);
        }, 0);
      } else {
        // No indent, no list – just do a normal newline
        setTimeout(() => {
          const newStart = textarea.selectionStart;
          const newValue = textarea.value;
          const updated = newValue.substring(0, newStart) + '\n' + newValue.substring(newStart);
          setFileContent(updated);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newStart + 1;
            updateCursorPosition();
          }, 0);
        }, 0);
      }
    }
  }, [setFileContent, updateCursorPosition, handleUndo, handleRedo]);

  const handleCursorUpdate = useCallback(() => {
    updateCursorPosition();
  }, [updateCursorPosition]);

  const lines = useCallback(() => {
    const count = fileContent.split('\n').length;
    return Array.from({ length: count || 1 }, (_, i) => i + 1);
  }, [fileContent]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1c2733]">
      {/* Editor toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200/60 dark:border-gray-700/50 bg-gray-50/85 dark:bg-[#181e26]/85 backdrop-blur-md flex-wrap">
        {/* Undo */}
        <button className="btn-icon" onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="m4 10l-.707.707L2.586 10l.707-.707zm17 8a1 1 0 1 1-2 0zM8.293 15.707l-5-5l1.414-1.414l5 5zm-5-6.414l5-5l1.414 1.414l-5 5zM4 9h10v2H4zm17 7v2h-2v-2zm-7-7a7 7 0 0 1 7 7h-2a5 5 0 0 0-5-5z"/></svg>
        </button>
        {/* Redo */}
        <button className="btn-icon" onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="m20 10l.707.707l.707-.707l-.707-.707zM3 18a1 1 0 1 0 2 0zm12.707-2.293l5-5l-1.414-1.414l-5 5zm5-6.414l-5-5l-1.414 1.414l5 5zM20 9H10v2h10zM3 16v2h2v-2zm7-7a7 7 0 0 0-7 7h2a5 5 0 0 1 5-5z"/></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* Bold */}
        <button className="btn-icon" onClick={() => wrapSelection('**', '**', 'bold')} title="Bold (Ctrl+B)">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M8.193 13H4V3h4.151c1.816 0 2.987.977 2.987 2.495c0 1.074-.797 2.01-1.823 2.176v.055c1.359.132 2.308 1.11 2.308 2.433c0 1.76-1.296 2.841-3.43 2.841M5.788 4.393v2.82h1.635c1.248 0 1.948-.526 1.948-1.455c0-.873-.603-1.365-1.67-1.365zm0 7.214h1.996c1.316 0 2.016-.547 2.016-1.573c0-1.019-.72-1.552-2.092-1.552h-1.92z"/></svg>
        </button>
        {/* Italic */}
        <button className="btn-icon" onClick={() => wrapSelection('*', '*', 'italic')} title="Italic (Ctrl+I)">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M8.16 12H9.5a.5.5 0 1 1 0 1h-4a.5.5 0 1 1 0-1h1.639l1.7-8H7.5a.5.5 0 0 1 0-1h4a.5.5 0 1 1 0 1H9.861z"/></svg>
        </button>
        {/* Strikethrough */}
        <button className="btn-icon" onClick={() => wrapSelection('~~', '~~', 'strikethrough')} title="Strikethrough">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M6.333 5.686c0 .31.083.581.27.814H5.166a2.8 2.8 0 0 1-.099-.76c0-1.627 1.436-2.768 3.48-2.768c1.969 0 3.39 1.175 3.445 2.85h-1.23c-.11-1.08-.964-1.743-2.25-1.743c-1.23 0-2.18.602-2.18 1.607zm2.194 7.478c-2.153 0-3.589-1.107-3.705-2.81h1.23c.144 1.06 1.129 1.703 2.544 1.703c1.34 0 2.31-.705 2.31-1.675c0-.827-.547-1.374-1.914-1.675L8.046 8.5H1v-1h14v1h-3.504c.468.437.675.994.675 1.697c0 1.826-1.436 2.967-3.644 2.967"/></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* Heading */}
        <button className="btn-icon" onClick={() => prefixLines('# ', 'Heading')} title="Heading">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M6 11a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2V5a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2v2h4V5a1 1 0 1 1 0-2h2a1 1 0 0 1 0 2v6a1 1 0 0 1 0 2h-2a1 1 0 0 1 0-2V9H6z"/></svg>
        </button>
        {/* Link */}
        <button className="btn-icon" onClick={() => wrapSelection('[', '](url)', 'link text')} title="Insert link">
          <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></svg>
        </button>
        {/* Image */}
        <button className="btn-icon" onClick={() => wrapSelection('![', '](image-url)', 'alt text')} title="Insert image">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 256 256"><g><path d="M224 56v122.06l-39.72-39.72a8 8 0 0 0-11.31 0L147.31 164l-49.65-49.66a8 8 0 0 0-11.32 0L32 168.69V56a8 8 0 0 1 8-8h176a8 8 0 0 1 8 8" opacity=".2"/><path d="M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16m0 16v102.75l-26.07-26.06a16 16 0 0 0-22.63 0l-20 20l-44-44a16 16 0 0 0-22.62 0L40 149.37V56ZM40 172l52-52l80 80H40Zm176 28h-21.37l-36-36l20-20L216 181.38zm-72-100a12 12 0 1 1 12 12a12 12 0 0 1-12-12"/></g></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* Inline code */}
        <button className="btn-icon" onClick={() => wrapSelection('`', '`', 'code')} title="Inline code">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M2.414 8.036L4.89 10.51a.5.5 0 0 1-.707.708L1.354 8.389a.5.5 0 0 1 0-.707l2.828-2.828a.5.5 0 1 1 .707.707zm8.768 2.474l2.475-2.474l-2.475-2.475a.5.5 0 0 1 .707-.707l2.829 2.828a.5.5 0 0 1 0 .707l-2.829 2.829a.5.5 0 1 1-.707-.708M8.559 2.506a.5.5 0 0 1 .981.19L7.441 13.494a.5.5 0 0 1-.981-.19z"/></svg>
        </button>
        {/* Code block */}
        <button className="btn-icon" onClick={() => {
          const ta = textareaRef.current; if (!ta) return;
          pushUndo();
          const s = ta.selectionStart, e = ta.selectionEnd, t = ta.value;
          const sel = t.substring(s, e);
          const ins = sel ? `\`\`\`\n${sel}\n\`\`\`` : '```\ncode block\n```';
          const nt = t.substring(0, s) + ins + t.substring(e);
          setFileContent(nt);
          setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length; updateCursorPosition(); }, 0);
        }} title="Code block">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 256 256"><path d="m58.34 101.66l-32-32a8 8 0 0 1 0-11.32l32-32a8 8 0 0 1 11.32 11.32L43.31 64l26.35 26.34a8 8 0 0 1-11.32 11.32m40 0a8 8 0 0 0 11.32 0l32-32a8 8 0 0 0 0-11.32l-32-32a8 8 0 0 0-11.32 11.32L124.69 64L98.34 90.34a8 8 0 0 0 0 11.32M200 40h-24a8 8 0 0 0 0 16h24v144H56v-64a8 8 0 0 0-16 0v64a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16"/></svg>
        </button>
        {/* Blockquote */}
        <button className="btn-icon" onClick={() => prefixLines('> ', 'blockquote')} title="Blockquote">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M6.848 2.47a1 1 0 0 1-.318 1.378A7.3 7.3 0 0 0 3.75 7.01A3 3 0 1 1 1 10v-.027a4 4 0 0 1 .01-.232c.009-.15.027-.36.062-.618c.07-.513.207-1.22.484-2.014c.552-1.59 1.67-3.555 3.914-4.957a1 1 0 0 1 1.378.318m7 0a1 1 0 0 1-.318 1.378a7.3 7.3 0 0 0-2.78 3.162A3 3 0 1 1 8 10v-.027a4 4 0 0 1 .01-.232c.009-.15.027-.36.062-.618c.07-.513.207-1.22.484-2.014c.552-1.59 1.67-3.555 3.914-4.957a1 1 0 0 1 1.378.318"/></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* List */}
        <button className="btn-icon" onClick={() => prefixLines('- ', 'list item')} title="Unordered list">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 4h8a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1m0 4h8a.5.5 0 1 1 0 1h-8a.5.5 0 0 1 0-1m0 4h8a.5.5 0 1 1 0 1h-8a.5.5 0 1 1 0-1m-3-7a.5.5 0 1 1 0-1a.5.5 0 0 1 0 1m0 4a.5.5 0 1 1 0-1a.5.5 0 0 1 0 1m0 4a.5.5 0 1 1 0-1a.5.5 0 0 1 0 1"/></svg>
        </button>
        {/* Checkbox */}
        <button className="btn-icon" onClick={() => prefixLines('- [ ] ', 'task')} title="Task list">
          <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.25 4.5h11m-14-1.446L4.357 5.946L2.75 4.34m7.5 7.66h11m-14-1.446l-2.893 2.892L2.75 11.84m7.5 7.66h11m-14-1.446l-2.893 2.892L2.75 19.34"/></svg>
        </button>
        {/* Table */}
        <button className="btn-icon" onClick={() => {
          const ta = textareaRef.current; if (!ta) return;
          pushUndo();
          const s = ta.selectionStart, t = ta.value;
          const ins = '\n| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n';
          const nt = t.substring(0, s) + ins + t.substring(s);
          setFileContent(nt);
          setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length; updateCursorPosition(); }, 0);
        }} title="Insert table">
          <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5.616 20q-.691 0-1.153-.462T4 18.384V5.616q0-.691.463-1.153T5.616 4h12.769q.69 0 1.153.463T20 5.616v12.769q0 .69-.462 1.153T18.384 20zm5.884-5.596H5v3.98q0 .27.173.443t.443.173H11.5zm1 0V19h5.885q.269 0 .442-.173t.173-.442v-3.981zm-1-1V8.769H5v4.635zm1 0H19V8.769h-6.5zM5 7.769h14V5.615q0-.269-.173-.442T18.385 5H5.615q-.269 0-.442.173T5 5.616z"/></svg>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        {/* Horizontal separator */}
        <button className="btn-icon" title="Horizontal separator" onClick={() => {
          const ta = textareaRef.current; if (!ta) return;
          pushUndo();
          const s = ta.selectionStart, t = ta.value;
          const ins = '\n---\n';
          const nt = t.substring(0, s) + ins + t.substring(s);
          setFileContent(nt);
          setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length; updateCursorPosition(); }, 0);
        }} >
          <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14"/></svg>
        </button>
      </div>

      {/* Textarea with line numbers */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="select-none text-right px-3 py-3 text-xs leading-6 font-mono text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-[#141c24] border-r border-gray-200 dark:border-gray-700/50 overflow-hidden"
          style={{ minWidth: '3.5rem', scrollbarWidth: 'none' }}
        >
          {lines().map((num) => (
            <div key={num}>{num}</div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={fileContent}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={handleCursorUpdate}
          onKeyUp={handleCursorUpdate}
          onScroll={handleScroll}
          spellCheck={false}
          className="flex-1 bg-transparent text-sm leading-6 font-mono p-3 resize-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600"
          placeholder="Start writing markdown..."
          style={{ tabSize: 2 }}
        />
      </div>
    </div>
  );
};

export default MarkdownEditor;
