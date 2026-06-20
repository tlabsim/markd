import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useStore } from '../store';

interface SearchBarProps {
  editorRef?: React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>;
  viewerRef?: React.RefObject<HTMLDivElement | null>;
  viewMode?: string;
  position?: 'viewer-center' | 'editor-top';
  showReplaceInitially?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ editorRef, viewerRef, viewMode, position, showReplaceInitially }) => {
  const { fileContent, searchQuery, setSearchQuery, isSearchOpen, setSearchOpen, matchToolbarPalette } = useStore();
  const [matchPositions, setMatchPositions] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(!!showReplaceInitially);
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isSearchOpen && inputRef.current) inputRef.current.focus(); }, [isSearchOpen]);
  useEffect(() => { setShowReplace(!!showReplaceInitially); }, [showReplaceInitially]);
  useEffect(() => { if (viewerRef?.current) clearHighlights(viewerRef.current); }, [fileContent, viewerRef]);
  useEffect(() => { if (searchQuery) buildMatches(searchQuery); }, [useRegex, caseSensitive]);

  const buildRegex = useCallback((query: string) => {
    try { const f = `g${caseSensitive ? '' : 'i'}`; return useRegex ? new RegExp(query, f) : new RegExp(escapeRegex(query), f); }
    catch { return null; }
  }, [useRegex, caseSensitive]);

  const buildMatches = useCallback((query: string) => {
    if (viewerRef?.current) clearHighlights(viewerRef.current);
    if (!query.trim()) { setMatchPositions([]); setCurrentIdx(0); return; }
    const re = buildRegex(query);
    if (!re) { setMatchPositions([]); setCurrentIdx(0); return; }
    const pos: number[] = []; let m: RegExpExecArray | null;
    while ((m = re.exec(fileContent)) !== null) pos.push(m.index);
    setMatchPositions(pos); setCurrentIdx(pos.length > 0 ? 0 : -1);
  }, [fileContent, viewerRef, buildRegex]);

  const goToMatch = useCallback((idx: number) => {
    if (matchPositions.length === 0 || idx < 0) return;
    const pos = matchPositions[idx];
    const re = buildRegex(searchQuery);
    const len = re ? (() => { re.lastIndex = pos; const m = re.exec(fileContent); return m ? m[0].length : searchQuery.length; })() : searchQuery.length;
    if (viewMode === 'edit' && editorRef?.current instanceof HTMLTextAreaElement) {
      const ta = editorRef.current; ta.focus(); ta.selectionStart = pos; ta.selectionEnd = pos + len;
      ta.scrollTop = Math.max(0, (fileContent.substring(0, pos).split('\n').length - 3) * 24);
    }
    if (viewMode !== 'edit' && viewerRef?.current) {
      requestAnimationFrame(() => { if (viewerRef?.current) highlightInViewer(viewerRef.current, searchQuery, idx, useRegex, caseSensitive); });
    }
  }, [matchPositions, searchQuery, fileContent, viewMode, editorRef, viewerRef, useRegex, caseSensitive, buildRegex]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value); buildMatches(e.target.value);
  }, [setSearchQuery, buildMatches]);

  const goNext = useCallback(() => { if (matchPositions.length === 0) return; setCurrentIdx((currentIdx + 1) % matchPositions.length); goToMatch((currentIdx + 1) % matchPositions.length); }, [matchPositions, currentIdx, goToMatch]);
  const goPrev = useCallback(() => { if (matchPositions.length === 0) return; const p = (currentIdx - 1 + matchPositions.length) % matchPositions.length; setCurrentIdx(p); goToMatch(p); }, [matchPositions, currentIdx, goToMatch]);
  useEffect(() => { if (currentIdx >= 0 && matchPositions.length > 0) goToMatch(currentIdx); }, [currentIdx, matchPositions, goToMatch]);

  const closeSearch = useCallback(() => {
    if (viewerRef?.current) clearHighlights(viewerRef.current);
    setSearchOpen(false); setSearchQuery(''); setShowReplace(false);
  }, [setSearchOpen, setSearchQuery, viewerRef]);

  const doReplace = useCallback((all: boolean) => {
    if (matchPositions.length === 0 || currentIdx < 0) return;
    const re = buildRegex(searchQuery); if (!re) return;
    const el = editorRef?.current; if (!el) return;
    if (all) {
      const nt = fileContent.replace(re, replaceQuery);
      if (el instanceof HTMLTextAreaElement) { el.value = nt; el.selectionStart = el.selectionEnd = 0; el.dispatchEvent(new Event('input', { bubbles: true })); }
      else if (el instanceof HTMLDivElement) { el.textContent = nt; }
      useStore.getState().setFileContent(nt); setMatchPositions([]); setCurrentIdx(-1);
      if (viewerRef?.current) clearHighlights(viewerRef.current);
    } else {
      const pos = matchPositions[currentIdx]; re.lastIndex = pos; const m = re.exec(fileContent); if (!m) return;
      const nt = fileContent.substring(0, m.index) + replaceQuery + fileContent.substring(m.index + m[0].length);
      if (el instanceof HTMLTextAreaElement) { el.value = nt; el.selectionStart = el.selectionEnd = m.index + replaceQuery.length; el.dispatchEvent(new Event('input', { bubbles: true })); }
      else if (el instanceof HTMLDivElement) { el.textContent = nt; }
      useStore.getState().setFileContent(nt);
      const diff = replaceQuery.length - m[0].length;
      const np = matchPositions.map((p, i) => i > currentIdx ? p + diff : p).filter((_, i) => i !== currentIdx);
      setMatchPositions(np); setCurrentIdx(np.length > 0 ? Math.min(currentIdx, np.length - 1) : -1);
    }
  }, [matchPositions, currentIdx, editorRef, searchQuery, replaceQuery, fileContent, buildRegex, viewerRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? goPrev() : goNext(); }
  }, [goNext, goPrev, closeSearch]);

  const palBg = matchToolbarPalette
    ? { backgroundColor: 'color-mix(in srgb, var(--pal-editor-toolbar-bg) 90%, black)', borderColor: 'var(--pal-border-soft)' }
    : undefined;
  const cMuted = matchToolbarPalette ? { color: 'var(--pal-muted)' } : undefined;
  const cText = matchToolbarPalette ? { color: 'var(--pal-text)' } : undefined;
  const inEditor = position === 'editor-top';

  return (
    <div className={`${inEditor ? 'w-full rounded-none border-l-0 border-r-0 border-t-0 bg-gray-100 dark:bg-[#141c24]' : 'rounded-lg bg-white/95 dark:bg-[#1c2733]/95'} backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-lg`} style={palBg}>
      <div className="flex items-center gap-1.5 px-3 py-2">
        <svg className="w-4 h-4 flex-shrink-0" style={cMuted} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input ref={inputRef} type="text" value={searchQuery} onChange={handleChange} onKeyDown={handleKeyDown}
          placeholder={inEditor ? 'Find' : 'Search in document...'}
          className="flex-1 py-1 text-sm font-semibold bg-transparent outline-none text-gray-800 dark:text-gray-200 min-w-0 border-0 placeholder:text-gray-800/70 dark:placeholder:text-gray-200/70" style={cText} />
        {searchQuery && <span className="text-sm whitespace-nowrap tabular-nums" style={cMuted}>{matchPositions.length > 0 ? `${currentIdx + 1}/${matchPositions.length}` : 'No results'}</span>}
        <button className={`p-1 rounded text-sm font-mono transition-colors ${useRegex ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`} onClick={() => setUseRegex(v => !v)} title="Use Regular Expression">.*</button>
        <button className={`p-1 rounded text-sm font-semibold transition-colors ${caseSensitive ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`} onClick={() => setCaseSensitive(v => !v)} title="Match Case">Aa</button>
        <button className="btn-icon p-1" onClick={goPrev} disabled={matchPositions.length === 0} title="Previous (Shift+Enter)"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
        <button className="btn-icon p-1" onClick={goNext} disabled={matchPositions.length === 0} title="Next (Enter)"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
        {inEditor && (
          <button className={`p-1 rounded transition-colors ${showReplace ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`} onClick={() => setShowReplace(v => !v)} title="Toggle Replace (Ctrl+H)">
            {/* <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" /></svg> */}
            <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M12 5.25q1.82 0 3.605.135a3.256 3.256 0 0 1 3.01 3.01q.066.875.1 1.759L17.03 8.47a.75.75 0 1 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l3-3a.75.75 0 0 0-1.06-1.06l-1.752 1.751q-.035-.975-.108-1.939a4.756 4.756 0 0 0-4.392-4.392a49.4 49.4 0 0 0-7.436 0A4.756 4.756 0 0 0 3.89 8.282q-.026.335-.046.672a.75.75 0 1 0 1.497.092q.02-.326.044-.651a3.256 3.256 0 0 1 3.01-3.01Q10.18 5.25 12 5.25m-6.97 6.22a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.752-1.751q.035.975.108 1.939a4.756 4.756 0 0 0 4.392 4.392a49.4 49.4 0 0 0 7.436 0a4.756 4.756 0 0 0 4.392-4.392q.025-.334.046-.672a.75.75 0 0 0-1.497-.092q-.02.325-.044.651a3.256 3.256 0 0 1-3.01 3.01a48 48 0 0 1-7.21 0a3.256 3.256 0 0 1-3.01-3.01a48 48 0 0 1-.1-1.759L6.97 15.53a.75.75 0 0 0 1.06-1.06z" clip-rule="evenodd"/></svg>
          </button>            
        )}
        <button className="btn-icon p-1" onClick={closeSearch} title="Close (Esc)"><svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      {inEditor && showReplace && (
        <div className="flex items-center gap-1.5 px-3 pb-2 border-t border-gray-200 dark:border-gray-700 pt-2">
          <input type="text" value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doReplace(false); } }} placeholder="Replace with..." style={cText}
            className="flex-1 py-1 text-sm font-semibold bg-transparent outline-none text-gray-800 dark:text-gray-200 min-w-0 border-0 placeholder:text-gray-800/70 dark:placeholder:text-gray-200/70" />
          <button className="px-2 py-1 text-sm rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors font-medium" onClick={() => doReplace(false)} disabled={matchPositions.length === 0}>Replace</button>
          <button className="px-2 py-1 text-sm rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors font-medium" onClick={() => doReplace(true)} disabled={matchPositions.length === 0}>All</button>
        </div>
      )}
    </div>
  );
};

function clearHighlights(viewer: HTMLElement) {
  Array.from(viewer.querySelectorAll('mark.search-match')).forEach(el => {
    const p = el.parentNode; if (p) { p.replaceChild(document.createTextNode(el.textContent || ''), el); p.normalize(); }
  });
}

function highlightInViewer(viewer: HTMLElement, query: string, currentIdx: number, useRegex: boolean, caseSensitive: boolean) {
  if (!query) return; clearHighlights(viewer);
  const walker = document.createTreeWalker(viewer, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = []; let n: Text | null;
  while ((n = walker.nextNode() as Text | null)) { if (n.textContent && n.textContent.trim()) textNodes.push(n); }
  let re: RegExp;
  try { re = useRegex ? new RegExp(query, `g${caseSensitive ? '' : 'i'}`) : new RegExp(escapeRegex(query), `g${caseSensitive ? '' : 'i'}`); }
  catch { return; }
  let midx = 0;
  for (const node of textNodes) {
    const text = node.textContent || ''; re.lastIndex = 0;
    const frags: string[] = []; let le = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > le) frags.push(escapeHtml(text.substring(le, m.index)));
      const cls = midx === currentIdx ? 'bg-amber-400 dark:bg-amber-500 text-black' : 'bg-amber-200 dark:bg-amber-700/40';
      frags.push(`<mark class="search-match ${cls}" style="border-radius:2px">${escapeHtml(m[0])}</mark>`);
      le = m.index + m[0].length; midx++;
    }
    if (le < text.length) frags.push(escapeHtml(text.substring(le)));
    if (frags.length > 1) { const span = document.createElement('span'); span.innerHTML = frags.join(''); node.parentNode?.replaceChild(span, node); }
  }
  const cm = viewer.querySelector('mark.search-match.bg-amber-400') || viewer.querySelector('mark.search-match');
  if (cm) cm.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function escapeHtml(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export default SearchBar;