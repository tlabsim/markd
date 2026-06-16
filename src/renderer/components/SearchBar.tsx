import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useStore } from '../store';

interface SearchBarProps {
  editorRef?: React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>;
  viewerRef?: React.RefObject<HTMLDivElement | null>;
  viewMode?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ editorRef, viewerRef, viewMode }) => {
  const { fileContent, searchQuery, setSearchQuery, isSearchOpen, setSearchOpen } = useStore();
  const [matchPositions, setMatchPositions] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) inputRef.current.focus();
  }, [isSearchOpen]);

  const buildMatches = useCallback((query: string) => {
    if (viewerRef?.current) clearHighlights(viewerRef.current);
    if (!query.trim()) { setMatchPositions([]); setCurrentIdx(0); return; }
    const positions: number[] = [];
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(fileContent)) !== null) positions.push(m.index);
    setMatchPositions(positions);
    const first = positions.length > 0 ? 0 : -1;
    setCurrentIdx(first);
  }, [fileContent, viewerRef]);

  const goToMatch = useCallback((idx: number) => {
    if (matchPositions.length === 0 || idx < 0) return;
    const pos = matchPositions[idx];
    if (viewMode !== 'view' && editorRef?.current instanceof HTMLTextAreaElement) {
      const ta = editorRef.current;
      ta.focus();
      ta.selectionStart = pos;
      ta.selectionEnd = pos + searchQuery.length;
      const before = fileContent.substring(0, pos);
      const lineNum = before.split('\n').length;
      ta.scrollTop = Math.max(0, (lineNum - 3) * 24);
    }
    if (viewMode === 'view' && viewerRef?.current) {
      highlightInViewer(viewerRef.current, searchQuery, idx);
    }
  }, [matchPositions, searchQuery, fileContent, viewMode, editorRef, viewerRef]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    buildMatches(e.target.value);
  }, [setSearchQuery, buildMatches]);

  const goNext = useCallback(() => {
    if (matchPositions.length === 0) return;
    const next = (currentIdx + 1) % matchPositions.length;
    setCurrentIdx(next);
    goToMatch(next);
  }, [matchPositions, currentIdx, goToMatch]);

  const goPrev = useCallback(() => {
    if (matchPositions.length === 0) return;
    const prev = (currentIdx - 1 + matchPositions.length) % matchPositions.length;
    setCurrentIdx(prev);
    goToMatch(prev);
  }, [matchPositions, currentIdx, goToMatch]);

  // Trigger highlighting when match list or current index changes
  useEffect(() => {
    if (currentIdx >= 0 && matchPositions.length > 0) {
      goToMatch(currentIdx);
    }
  }, [currentIdx, matchPositions, goToMatch]);

  const closeSearch = useCallback(() => {
    if (viewerRef?.current) clearHighlights(viewerRef.current);
    setSearchOpen(false);
    setSearchQuery('');
  }, [setSearchOpen, setSearchQuery, viewerRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { closeSearch(); }
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? goPrev() : goNext(); }
  }, [goNext, goPrev, closeSearch]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/95 dark:bg-[#1c2733]/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search in document..."
        className="flex-1 py-1 text-xs bg-transparent outline-none text-gray-800 dark:text-gray-200"
      />
      {searchQuery && (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
          {matchPositions.length > 0 ? `${currentIdx + 1}/${matchPositions.length}` : 'No results'}
        </span>
      )}
      <button className="btn-icon p-1" onClick={goPrev} disabled={matchPositions.length === 0} title="Previous (Shift+Enter)">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button className="btn-icon p-1" onClick={goNext} disabled={matchPositions.length === 0} title="Next (Enter)">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <button className="btn-icon p-1" onClick={closeSearch} title="Close (Esc)">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

function clearHighlights(viewer: HTMLElement) {
  Array.from(viewer.querySelectorAll('mark.search-match')).forEach(el => {
    const p = el.parentNode;
    if (p) { p.replaceChild(document.createTextNode(el.textContent || ''), el); p.normalize(); }
  });
}

function highlightInViewer(viewer: HTMLElement, query: string, currentIdx: number) {
  if (!query) return;
  // Remove previous highlights — convert to array to avoid live-collection issues
  const prevMarks = Array.from(viewer.querySelectorAll('mark.search-match'));
  prevMarks.forEach(el => {
    const p = el.parentNode;
    if (p) {
      p.replaceChild(document.createTextNode(el.textContent || ''), el);
      p.normalize();
    }
  });
  // Walk text nodes and wrap all matches
  const walker = document.createTreeWalker(viewer, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n: Text | null;
  while ((n = walker.nextNode() as Text | null)) {
    if (n.textContent && n.textContent.trim()) textNodes.push(n);
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'gi');
  let matchIdx = 0;
  for (const node of textNodes) {
    const text = node.textContent || '';
    re.lastIndex = 0;
    const fragments: string[] = [];
    let lastEnd = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastEnd) fragments.push(escapeHtml(text.substring(lastEnd, m.index)));
      const cls = matchIdx === currentIdx ? 'bg-amber-400 dark:bg-amber-500 text-black' : 'bg-amber-200 dark:bg-amber-700/40';
      fragments.push(`<mark class="search-match ${cls}" style="border-radius:2px">${escapeHtml(m[0])}</mark>`);
      lastEnd = m.index + m[0].length;
      matchIdx++;
    }
    if (lastEnd < text.length) fragments.push(escapeHtml(text.substring(lastEnd)));
    if (fragments.length > 1) {
      const span = document.createElement('span');
      span.innerHTML = fragments.join('');
      node.parentNode?.replaceChild(span, node);
    }
  }
  // Scroll current or first match into view
  const cm = viewer.querySelector('mark.search-match.bg-amber-400') || viewer.querySelector('mark.search-match');
  if (cm) cm.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default SearchBar;