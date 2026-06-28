import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import type { MarkdownEditorSearchApi } from './MarkdownEditor';

interface SearchBarProps {
  editorRef?: React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>;
  editorSearchApiRef?: React.RefObject<MarkdownEditorSearchApi | null>;
  viewerRef?: React.RefObject<HTMLDivElement | null>;
  viewMode?: string;
  position?: 'viewer-center' | 'editor-top';
  showReplaceInitially?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ editorRef, editorSearchApiRef, viewerRef, viewMode, position, showReplaceInitially }) => {
  const {
    fileContent,
    searchQuery,
    searchCurrentIndex,
    searchUseRegex,
    searchCaseSensitive,
    setSearchQuery,
    setSearchCurrentIndex,
    setSearchUseRegex,
    setSearchCaseSensitive,
    isSearchOpen,
    setSearchOpen,
    matchToolbarPalette
  } = useStore(useShallow((state) => ({
    fileContent: state.fileContent,
    searchQuery: state.searchQuery,
    searchCurrentIndex: state.searchCurrentIndex,
    searchUseRegex: state.searchUseRegex,
    searchCaseSensitive: state.searchCaseSensitive,
    setSearchQuery: state.setSearchQuery,
    setSearchCurrentIndex: state.setSearchCurrentIndex,
    setSearchUseRegex: state.setSearchUseRegex,
    setSearchCaseSensitive: state.setSearchCaseSensitive,
    isSearchOpen: state.isSearchOpen,
    setSearchOpen: state.setSearchOpen,
    matchToolbarPalette: state.matchToolbarPalette,
  })));
  const [matchPositions, setMatchPositions] = useState<number[]>([]);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(!!showReplaceInitially);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSearchKeyRef = useRef('');
  const lastSourceRef = useRef('');
  const hasBuiltMatchesRef = useRef(false);
  const matchPositionsRef = useRef<number[]>([]);
  const searchAnchorRef = useRef<number | null>(null);
  const searchTarget = viewMode === 'view' ? 'viewer' : 'editor';

  useEffect(() => { if (isSearchOpen && inputRef.current) inputRef.current.focus(); }, [isSearchOpen]);
  useEffect(() => { setShowReplace(!!showReplaceInitially); }, [showReplaceInitially]);

  const buildRegex = useCallback((query: string) => {
    try { const f = `g${searchCaseSensitive ? '' : 'i'}`; return searchUseRegex ? new RegExp(query, f) : new RegExp(escapeRegex(query), f); }
    catch { return null; }
  }, [searchUseRegex, searchCaseSensitive]);

  const getSearchSource = useCallback(() => (
    searchTarget === 'viewer' && viewerRef?.current
      ? viewerRef.current.textContent || ''
      : editorSearchApiRef?.current?.getContent() ?? fileContent
  ), [editorSearchApiRef, fileContent, searchTarget, viewerRef]);

  const findMatches = useCallback((query: string, source: string) => {
    const re = buildRegex(query);
    const pos: number[] = []; let m: RegExpExecArray | null;
    if (!re) return pos;
    while ((m = re.exec(source)) !== null) {
      if (m[0].length > 0) pos.push(m.index);
      if (m[0].length === 0) re.lastIndex = m.index + 1;
    }
    return pos;
  }, [buildRegex]);

  const goToMatch = useCallback((idx: number, positions = matchPositions, query = searchQuery) => {
    if (positions.length === 0 || idx < 0) return;
    if (searchTarget === 'viewer') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const current = viewerRef?.current?.querySelector('[data-search-current="true"]') as HTMLElement | null;
          current?.scrollIntoView({ block: 'center', behavior: 'auto' });
        });
      });
      return;
    }
    const pos = positions[idx];
    searchAnchorRef.current = pos;
    const re = buildRegex(query);
    const source = getSearchSource();
    const len = re ? (() => { re.lastIndex = pos; const m = re.exec(source); return m ? m[0].length : query.length; })() : query.length;
    editorSearchApiRef?.current?.revealRange(pos, pos + len, { preserveFocus: true });
  }, [matchPositions, searchTarget, searchQuery, editorSearchApiRef, viewerRef, buildRegex, getSearchSource]);

  useEffect(() => {
    const searchKey = `${searchTarget}\u0000${searchQuery}\u0000${searchUseRegex ? '1' : '0'}\u0000${searchCaseSensitive ? '1' : '0'}`;
    const source = getSearchSource();
    const previousPositions = matchPositionsRef.current;
    const firstBuild = !hasBuiltMatchesRef.current;
    const searchChanged = searchKey !== lastSearchKeyRef.current;
    const sourceChanged = source !== lastSourceRef.current;
    const editorHasFocus = !!editorRef?.current && document.activeElement === editorRef.current;

    lastSearchKeyRef.current = searchKey;
    lastSourceRef.current = source;
    hasBuiltMatchesRef.current = true;

    if (!searchQuery.trim()) {
      matchPositionsRef.current = [];
      searchAnchorRef.current = null;
      setMatchPositions((prev) => prev.length === 0 ? prev : []);
      setSearchCurrentIndex(0);
      editorSearchApiRef?.current?.clearSearchHighlight();
      return;
    }

    const nextPositions = findMatches(searchQuery, source);
    matchPositionsRef.current = nextPositions;
    setMatchPositions((prev) => positionsEqual(prev, nextPositions) ? prev : nextPositions);

    if (nextPositions.length === 0) {
      searchAnchorRef.current = null;
      setSearchCurrentIndex(-1);
      return;
    }

    if (firstBuild || searchChanged || (sourceChanged && !editorHasFocus)) {
      setSearchCurrentIndex(0);
      goToMatch(0, nextPositions, searchQuery);
      return;
    }

    if (sourceChanged && editorHasFocus) {
      const currentStart = searchCurrentIndex >= 0 ? previousPositions[searchCurrentIndex] : -1;
      const sameMatchIndex = currentStart >= 0 ? nextPositions.indexOf(currentStart) : -1;
      if (sameMatchIndex === -1 && currentStart >= 0) {
        searchAnchorRef.current = currentStart;
      }
      setSearchCurrentIndex(sameMatchIndex);
    }
  }, [
    editorRef,
    editorSearchApiRef,
    findMatches,
    getSearchSource,
    goToMatch,
    searchCaseSensitive,
    searchCurrentIndex,
    searchQuery,
    searchTarget,
    searchUseRegex,
    setSearchCurrentIndex,
  ]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  const goNext = useCallback(() => {
    if (matchPositions.length === 0) return;
    const anchor = searchAnchorRef.current;
    const anchoredNext = searchCurrentIndex < 0 && anchor !== null
      ? matchPositions.findIndex((position) => position > anchor)
      : -1;
    const next = anchoredNext >= 0
      ? anchoredNext
      : (Math.max(searchCurrentIndex, -1) + 1) % matchPositions.length;
    setSearchCurrentIndex(next);
    goToMatch(next);
  }, [matchPositions, searchCurrentIndex, setSearchCurrentIndex, goToMatch]);

  const goPrev = useCallback(() => {
    if (matchPositions.length === 0) return;
    const anchor = searchAnchorRef.current;
    const anchoredPrev = searchCurrentIndex < 0 && anchor !== null
      ? findPreviousPositionIndex(matchPositions, anchor)
      : -1;
    const prev = anchoredPrev >= 0
      ? anchoredPrev
      : (searchCurrentIndex - 1 + matchPositions.length) % matchPositions.length;
    setSearchCurrentIndex(prev);
    goToMatch(prev);
  }, [matchPositions, searchCurrentIndex, setSearchCurrentIndex, goToMatch]);

  const closeSearch = useCallback(() => {
    editorSearchApiRef?.current?.clearSearchHighlight();
    setSearchOpen(false); setSearchQuery(''); setSearchCurrentIndex(0); setShowReplace(false);
  }, [editorSearchApiRef, setSearchOpen, setSearchQuery, setSearchCurrentIndex]);

  const doReplace = useCallback((all: boolean) => {
    if (searchTarget !== 'editor' || matchPositions.length === 0 || searchCurrentIndex < 0) return;
    const re = buildRegex(searchQuery); if (!re) return;
    const source = editorSearchApiRef?.current?.getContent() ?? fileContent;
    if (all) {
      const nt = source.replace(re, replaceQuery);
      editorSearchApiRef?.current?.replaceContent(nt, 0);
      setMatchPositions([]); setSearchCurrentIndex(-1);
    } else {
      const pos = matchPositions[searchCurrentIndex]; re.lastIndex = pos; const m = re.exec(source); if (!m) return;
      const nt = source.substring(0, m.index) + replaceQuery + source.substring(m.index + m[0].length);
      editorSearchApiRef?.current?.replaceContent(nt, m.index + replaceQuery.length);
      const diff = replaceQuery.length - m[0].length;
      const np = matchPositions.map((p, i) => i > searchCurrentIndex ? p + diff : p).filter((_, i) => i !== searchCurrentIndex);
      setMatchPositions(np); setSearchCurrentIndex(np.length > 0 ? Math.min(searchCurrentIndex, np.length - 1) : -1);
    }
  }, [searchTarget, matchPositions, searchCurrentIndex, searchQuery, replaceQuery, fileContent, buildRegex, editorSearchApiRef, setSearchCurrentIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? goPrev() : goNext(); }
  }, [goNext, goPrev, closeSearch]);

  const keepToolbarFocus = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  }, []);

  const palBg = matchToolbarPalette
    ? { backgroundColor: 'color-mix(in srgb, var(--pal-editor-toolbar-bg) 95%, var(--pal-text))', borderColor: 'var(--pal-border-soft)' }
    : undefined;
  const palBgFloating = matchToolbarPalette
    ? { backgroundColor: 'color-mix(in srgb, var(--pal-editor-toolbar-bg) 80%, transparent)', borderColor: 'var(--pal-border-soft)', backdropFilter: 'blur(10px)' }
    : undefined;
  const cMuted = matchToolbarPalette ? { color: 'var(--pal-muted)' } : undefined;
  const cText = matchToolbarPalette ? { color: 'var(--pal-text)' } : undefined;
  const inEditor = position === 'editor-top';

  return (
    <div className={`${inEditor ? 'w-full rounded-none border-l-0 border-r-0 border-t-0 bg-gray-100 dark:bg-[#141c24] shadow-none' : 'rounded-lg bg-white/95 dark:bg-[#1c2733]/95'} backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-lg`} style={inEditor ? palBg : palBgFloating}>
      <div className="flex items-center gap-1.5 px-3 py-2">
        <svg className="w-4 h-4 flex-shrink-0" style={cMuted} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input ref={inputRef} type="text" value={searchQuery} onChange={handleChange} onKeyDown={handleKeyDown}
          placeholder={inEditor ? 'Find' : 'Search in document...'}
          className="flex-1 py-1 text-sm font-semibold bg-transparent outline-none text-gray-800 dark:text-gray-200 min-w-0 border-0 placeholder:text-gray-800/70 dark:placeholder:text-gray-200/70" style={cText} />
        {searchQuery && <span className="text-sm whitespace-nowrap tabular-nums" style={cMuted}>{matchPositions.length > 0 ? `${searchCurrentIndex + 1}/${matchPositions.length}` : 'No results'}</span>}
        <button className={`h-6 w-6  rounded-md text-sm font-mono transition-colors ${searchUseRegex ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`} onMouseDown={keepToolbarFocus} onClick={() => setSearchUseRegex(!searchUseRegex)} title="Use Regular Expression">.*</button>
        <button className={`h-6 w-6  rounded-md text-sm font-semibold transition-colors ${searchCaseSensitive ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`} onMouseDown={keepToolbarFocus} onClick={() => setSearchCaseSensitive(!searchCaseSensitive)} title="Match Case">Aa</button>
        <button className="btn-icon h-6 w-6 p-1 rounded-md" onMouseDown={keepToolbarFocus} onClick={goPrev} disabled={matchPositions.length === 0} title="Previous (Shift+Enter)"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
        <button className="btn-icon h-6 w-6 p-1 rounded-md" onMouseDown={keepToolbarFocus} onClick={goNext} disabled={matchPositions.length === 0} title="Next (Enter)"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
        {inEditor && (
          <button className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors ${showReplace ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`} onMouseDown={keepToolbarFocus} onClick={() => setShowReplace(v => !v)} title="Toggle Replace (Ctrl+H)">
            <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m9.618 12.249l-3.814 3.814c-.293.293-.44.677-.44 1.06M9.619 22l-3.814-3.814a1.5 1.5 0 0 1-.44-1.061m13.395 0H5.365m-.124-9.751h13.394m-4.253-4.875l3.814 3.814c.293.293.44.677.44 1.06m-4.254 4.876l3.814-3.814c.293-.293.44-.677.44-1.061"/></svg>
          </button>
        )}
        <button className="btn-icon h-6 w-6 p-1 rounded-md" onMouseDown={keepToolbarFocus} onClick={closeSearch} title="Close (Esc)"><svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      {inEditor && showReplace && (
        <div className="flex items-center gap-1.5 px-3 pb-2 border-t border-gray-200 dark:border-gray-700 pt-2">
          <svg className="w-4 h-4 flex-shrink-0" style={cMuted} viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m9.618 12.249l-3.814 3.814c-.293.293-.44.677-.44 1.06M9.619 22l-3.814-3.814a1.5 1.5 0 0 1-.44-1.061m13.395 0H5.365m-.124-9.751h13.394m-4.253-4.875l3.814 3.814c.293.293.44.677.44 1.06m-4.254 4.876l3.814-3.814c.293-.293.44-.677.44-1.061"/></svg>
          <input type="text" value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doReplace(false); } }} placeholder="Replace with..." style={cText}
            className="flex-1 py-1 text-sm font-semibold bg-transparent outline-none text-gray-800 dark:text-gray-200 min-w-0 border-0 placeholder:text-gray-800/70 dark:placeholder:text-gray-200/70" />
          <button className="px-2 py-1 text-sm rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium" onMouseDown={keepToolbarFocus} onClick={() => doReplace(false)} disabled={searchTarget !== 'editor' || matchPositions.length === 0}>Replace</button>
          <button className="px-2 py-1 text-sm rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium" onMouseDown={keepToolbarFocus} onClick={() => doReplace(true)} disabled={searchTarget !== 'editor' || matchPositions.length === 0}>Replace All</button>
        </div>
      )}
    </div>
  );
};

function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function positionsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function findPreviousPositionIndex(positions: number[], anchor: number): number {
  for (let i = positions.length - 1; i >= 0; i -= 1) {
    if (positions[i] < anchor) return i;
  }
  return -1;
}

export default SearchBar;
