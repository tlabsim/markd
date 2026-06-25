import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkEmoji from 'remark-emoji';
import remarkFrontmatter from 'remark-frontmatter';
import remarkSmartypants from 'remark-smartypants';
import remarkWikiLink from 'remark-wiki-link';
import remarkDirective from 'remark-directive';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { useStore } from '../store';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

function reactNodeToText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return reactNodeToText(node.props.children);
  }
  return '';
}

const KNOWN_HTML_TAGS = new Set([
  'a','abbr','address','area','article','aside','audio',
  'b','base','bdi','bdo','blockquote','body','br','button',
  'canvas','caption','cite','code','col','colgroup',
  'data','datalist','dd','del','details','dfn','dialog','div','dl','dt',
  'em','embed',
  'fieldset','figcaption','figure','footer','form',
  'h1','h2','h3','h4','h5','h6','head','header','hr','html',
  'i','iframe','img','input','ins',
  'kbd',
  'label','legend','li','link',
  'main','map','mark','meta','meter',
  'nav','noscript',
  'object','ol','optgroup','option','output',
  'p','picture','pre','progress',
  'q',
  'rp','rt','ruby',
  's','samp','script','section','select','slot','small','source','span','strong','style','sub','summary','sup',
  'table','tbody','td','template','textarea','tfoot','th','thead','time','title','tr','track',
  'u','ul',
  'var','video',
  'wbr',
]);

function rehypeFilterCustomElements() {
  return (tree: any) => {
    function visit(node: any) {
      if (node.type === 'element' && !KNOWN_HTML_TAGS.has(node.tagName)) {
        node.tagName = 'span';
      }
      if (node.children) {
        for (const child of node.children) visit(child);
      }
    }
    visit(tree);
  };
}

// ---- Remark plugin: subscript ~text~ and superscript ^text^ ----
function remarkSubSuper() {
  return (tree: any) => {
    function visit(node: any, parent: any, idx: number) {
      if (node.type === 'text') {
        const parts: Array<{ type: 'text' | 'html'; value: string }> = [];
        let i = 0;
        while (i < node.value.length) {
          // Superscript: ^text^ (needs closing ^)
          if (node.value[i] === '^') {
            const end = node.value.indexOf('^', i + 1);
            if (end > i + 1) {
              const inner = node.value.slice(i + 1, end);
              parts.push({ type: 'html', value: `<sup>${inner}</sup>` });
              i = end + 1;
              continue;
            }
            // Unmatched ^ — treat as literal
            parts.push({ type: 'text', value: '^' });
            i++;
            continue;
          }
          // Subscript: ~text~ (needs closing ~)
          if (node.value[i] === '~') {
            const end = node.value.indexOf('~', i + 1);
            if (end > i + 1) {
              const inner = node.value.slice(i + 1, end);
              parts.push({ type: 'html', value: `<sub>${inner}</sub>` });
              i = end + 1;
              continue;
            }
            // Unmatched ~ — treat as literal
            parts.push({ type: 'text', value: '~' });
            i++;
            continue;
          }
          // Collect plain text until next marker
          let j = i;
          while (j < node.value.length && node.value[j] !== '^' && node.value[j] !== '~') j++;
          if (j > i) {
            parts.push({ type: 'text', value: node.value.slice(i, j) });
          }
          i = j;
        }
        if (parts.length > 1) {
          const newChildren = parts.map(p =>
            p.type === 'html' ? { type: 'html', value: p.value } : { type: 'text', value: p.value }
          );
          if (parent && Array.isArray(parent.children)) {
            parent.children.splice(idx, 1, ...newChildren);
          }
        }
      }
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) visit(node.children[i], node, i);
      }
    }
    if (tree.children) {
      for (let i = 0; i < tree.children.length; i++) visit(tree.children[i], tree, i);
    }
  };
}

// ---- Remark plugin: ==highlight== syntax ----
function remarkHighlight() {
  return (tree: any) => {
    function visit(node: any, parent: any, idx: number) {
      if (node.type === 'text' && node.value.includes('==')) {
        const parts = node.value.split(/(==)/g);
        if (parts.length < 3) return;
        const newChildren: any[] = [];
        let inMark = false, buf = '';
        for (const part of parts) {
          if (part === '==') {
            if (buf) { newChildren.push(inMark ? { type: 'html', value: `<mark>${buf}</mark>` } : { type: 'text', value: buf }); buf = ''; }
            inMark = !inMark;
          } else { buf += part; }
        }
        if (buf) newChildren.push({ type: 'text', value: buf });
        if (parent && Array.isArray(parent.children)) {
          parent.children.splice(idx, 1, ...newChildren);
        }
      }
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) visit(node.children[i], node, i);
      }
    }
    if (tree.children) {
      for (let i = 0; i < tree.children.length; i++) visit(tree.children[i], tree, i);
    }
  };
}

// ---- Remark plugin: callouts (:::type ... :::) ----
function remarkCallouts() {
  return (tree: any) => {
    const icons: Record<string, string> = {
      note: 'ℹ️', tip: '💡', info: 'ℹ️', warning: '⚠️',
      caution: '⚠️', danger: '🚨', important: '❗',
    };

    const preserveSoftBreaks = (node: any) => {
      if (!Array.isArray(node.children)) return;
      const children: any[] = [];
      for (const child of node.children) {
        if (child.type === 'text' && child.value.includes('\n')) {
          const parts = child.value.split('\n');
          parts.forEach((part: string, index: number) => {
            if (index > 0) children.push({ type: 'break' });
            if (part) children.push({ ...child, value: part });
          });
        } else {
          preserveSoftBreaks(child);
          children.push(child);
        }
      }
      node.children = children;
    };

    const convertCallout = (node: any, type: string, bodyChildren: any[]) => {
      const body = {
        type: 'blockquote',
        data: { hName: 'div', hProperties: { className: ['admonition-body'] } },
        children: bodyChildren,
      };
      preserveSoftBreaks(body);

      node.type = 'blockquote';
      node.data = {
        hName: 'div',
        hProperties: { className: ['admonition', `admonition-${type}`] },
      };
      node.children = [
        {
          type: 'paragraph',
          data: { hName: 'div', hProperties: { className: ['admonition-header'] } },
          children: [
            {
              type: 'emphasis',
              data: { hName: 'span', hProperties: { className: ['admonition-icon'] } },
              children: [{ type: 'text', value: icons[type] || '📝' }],
            },
            {
              type: 'strong',
              data: { hName: 'span', hProperties: { className: ['admonition-type'] } },
              children: [{ type: 'text', value: type }],
            },
          ],
        },
        body,
      ];
    };

    const visit = (node: any) => {
      if (!Array.isArray(node.children)) return;
      for (const child of node.children) {
        visit(child);
        if (child.type === 'containerDirective') {
          const type = String(child.name || 'note').toLowerCase();
          convertCallout(child, type, child.children);
          continue;
        }

        // Preserve the original compact form: :::note content :::
        if (child.type === 'paragraph' && child.children?.length === 1 && child.children[0].type === 'text') {
          const match = child.children[0].value.match(/^:::(\w+)\s+(.+?)\s*:::\s*$/);
          if (match) {
            convertCallout(child, match[1].toLowerCase(), [
              { type: 'paragraph', children: [{ type: 'text', value: match[2] }] },
            ]);
          }
        }
      }
    };

    visit(tree);
  };
}

// ---- Remark plugin: definition lists (term\n: definition within paragraphs) ----
function remarkDeflist() {
  return (tree: any) => {
    const newChildren: any[] = [];
    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i];
      if (node.type === 'paragraph' && node.children?.length > 0) {
        // Collect all text from paragraph
        const fullText = node.children.map((c: any) => c.value || '').join('');
        // Check for definition list pattern: Term\n: Def (and subsequent \n: Def)
        const parts = fullText.split(/\n(?=:\s+)/);
        if (parts.length > 1 && parts[1].startsWith(': ')) {
          const dt = parts[0].trim();
          const dds = parts.slice(1).map((p: string) => p.replace(/^:\s+/, '').trim());
          const html = `<dl><dt>${dt}</dt>${dds.map((d: string) => `<dd>${d}</dd>`).join('')}</dl>`;
          newChildren.push({ type: 'html', value: html });
          continue;
        }
      }
      newChildren.push(node);
    }
    tree.children = newChildren;
  };
}

import TableOfContents from './TableOfContents';

interface MarkdownViewerProps {
  showToc?: boolean;
  onToggleToc?: () => void;
  syncScroll?: 'off' | 'position' | 'content';
  onScrollRef?: (el: HTMLElement | null) => void;
  onViewerScroll?: () => void;
}

function escapeSearchRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rehypeSearchHighlight(options: {
  enabled: boolean;
  query: string;
  currentIndex: number;
  useRegex: boolean;
  caseSensitive: boolean;
}) {
  return (tree: any) => {
    if (!options.enabled || !options.query.trim()) return;
    let re: RegExp;
    try {
      re = options.useRegex
        ? new RegExp(options.query, `g${options.caseSensitive ? '' : 'i'}`)
        : new RegExp(escapeSearchRegex(options.query), `g${options.caseSensitive ? '' : 'i'}`);
    } catch {
      return;
    }

    let matchIndex = 0;
    const visit = (node: any) => {
      if (!node || !node.children || node.tagName === 'script' || node.tagName === 'style') return;
      const nextChildren: any[] = [];
      for (const child of node.children) {
        if (child.type !== 'text' || !child.value) {
          visit(child);
          nextChildren.push(child);
          continue;
        }

        const text = child.value;
        const pieces: any[] = [];
        let last = 0;
        let match: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((match = re.exec(text)) !== null) {
          if (match[0].length === 0) {
            re.lastIndex = match.index + 1;
            continue;
          }
          if (match.index > last) pieces.push({ type: 'text', value: text.slice(last, match.index) });
          const current = matchIndex === options.currentIndex;
          pieces.push({
            type: 'element',
            tagName: 'mark',
            properties: {
              className: current
                ? ['search-match', 'bg-amber-400', 'dark:bg-amber-500', 'text-black']
                : ['search-match', 'bg-amber-200', 'dark:bg-amber-700/40'],
              dataSearchCurrent: current ? 'true' : undefined,
              style: 'border-radius:2px',
            },
            children: [{ type: 'text', value: match[0] }],
          });
          last = match.index + match[0].length;
          matchIndex++;
        }
        if (last < text.length) pieces.push({ type: 'text', value: text.slice(last) });
        nextChildren.push(...(pieces.length ? pieces : [child]));
      }
      node.children = nextChildren;
    };

    visit(tree);
  };
}

// ---- Mermaid diagram renderer ----
const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const idRef = useRef(`m-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;
    setError(false); setSvg(null);
    (async () => {
      try {
        const { svg: rendered } = await mermaid.render(`${idRef.current}-svg`, code);
        if (!cancelled) setSvg(rendered);
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) return (
    <div className="my-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-2">Mermaid — render error</div>
      <pre className="text-xs text-red-700 dark:text-red-300 overflow-x-auto">{code}</pre>
    </div>
  );

  return (
    <div className="my-6 rounded-lg border p-4 overflow-x-auto bg-white dark:bg-[#0d1117]">
      <div className="flex -mt-2 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">mermaid</span>
      </div>
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} className="flex justify-center" /> :
       <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}
    </div>
  );
};

// ---- Back to top button ----
const BackToTop: React.FC<{ containerRef: React.RefObject<HTMLDivElement | null> }> = ({ containerRef }) => {
  const [phase, setPhase] = useState<'idle' | 'entering' | 'visible' | 'exiting'>('idle');
  const timerRef = useRef<number>(0);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onScroll = () => {
      const over = el.scrollTop > 400;
      setPhase(prev => {
        if (over && (prev === 'idle' || prev === 'exiting')) return 'entering';
        if (!over && (prev === 'visible' || prev === 'entering')) return 'exiting';
        return prev;
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef]);

  useEffect(() => {
    if (phase === 'entering') {
      timerRef.current = window.setTimeout(() => setPhase('visible'), 250);
    } else if (phase === 'exiting') {
      timerRef.current = window.setTimeout(() => setPhase('idle'), 250);
    }
    return () => clearTimeout(timerRef.current);
  }, [phase]);

  if (phase === 'idle') return null;

  return (
    <button
      className={`absolute bottom-4 right-4 z-20 w-6 h-6 rounded-md flex items-center justify-center hover:scale-110 ${
        phase === 'entering' ? 'animate-btt-in' : phase === 'exiting' ? 'animate-btt-out' : ''
      }`}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--pal-editor-toolbar-bg) 85%, transparent)',
        color: 'var(--pal-muted)',
        backdropFilter: 'blur(4px)',
        filter: 'brightness(1.05)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
      onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Back to top"
      aria-label="Back to top"
    >
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21V3m0 0l8.5 8.5M12 3l-8.5 8.5" />
      </svg>
    </button>
  );
};

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ showToc, onToggleToc, syncScroll, onScrollRef, onViewerScroll }) => {
  const {
    fileContent,
    currentFilePath,
    fontFamily,
    zoomLevel,
    previewPalette,
    zoomIn,
    zoomOut,
    matchToolbarPalette,
    showHeadingAnchors,
    viewMode,
    isSearchOpen,
    searchQuery,
    searchCurrentIndex,
    searchUseRegex,
    searchCaseSensitive
  } = useStore(useShallow((state) => ({
    fileContent: state.fileContent,
    currentFilePath: state.currentFilePath,
    fontFamily: state.fontFamily,
    zoomLevel: state.zoomLevel,
    previewPalette: state.previewPalette,
    zoomIn: state.zoomIn,
    zoomOut: state.zoomOut,
    matchToolbarPalette: state.matchToolbarPalette,
    showHeadingAnchors: state.showHeadingAnchors,
    viewMode: state.viewMode,
    isSearchOpen: state.isSearchOpen,
    searchQuery: state.searchQuery,
    searchCurrentIndex: state.searchCurrentIndex,
    searchUseRegex: state.searchUseRegex,
    searchCaseSensitive: state.searchCaseSensitive,
  })));
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollbarWideRef = useRef(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = contentRef.current; if (!el) return;
    const near = e.clientX > el.getBoundingClientRect().right - 30;
    if (near !== scrollbarWideRef.current) { scrollbarWideRef.current = near; el.classList.toggle('scrollbar-hover', near); }
  }, []);

  const handleMouseLeave = useCallback(() => {
    scrollbarWideRef.current = false;
    contentRef.current?.classList.remove('scrollbar-hover');
  }, []);

  useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [currentFilePath]);

  useEffect(() => {
    if (viewMode !== 'view' || !isSearchOpen || !searchQuery.trim()) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const current = contentRef.current?.querySelector('[data-search-current="true"]') as HTMLElement | null;
        current?.scrollIntoView({ block: 'center', behavior: 'auto' });
      });
    });
  }, [viewMode, isSearchOpen, searchQuery, searchCurrentIndex]);

  // Intercept footnote link clicks — prevent full page navigation
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const a = target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href?.startsWith('#user-content-fn')) return;
      e.preventDefault();
      e.stopPropagation();
      const el = contentRef.current;
      if (!el) return;
      const targetEl = el.querySelector(`[id="${CSS.escape(href.slice(1))}"]`) as HTMLElement | null;
      if (targetEl) {
        el.scrollTo({ top: targetEl.offsetTop - 16, behavior: 'smooth' });
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  useEffect(() => {
    const el = contentRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (e.deltaY < 0) zoomIn(); else zoomOut(); }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomIn, zoomOut]);

  useEffect(() => {
    const el = contentRef.current;
    if (el && onScrollRef) onScrollRef(el);
    return () => { if (onScrollRef) onScrollRef(null); };
  }, [onScrollRef]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || syncScroll === 'off' || !onViewerScroll) return;
    el.addEventListener('scroll', onViewerScroll, { passive: true });
    return () => el.removeEventListener('scroll', onViewerScroll);
  }, [syncScroll, onViewerScroll]);


  const AsyncImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) => {
    const [resolved, setResolved] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const currentPath = useStore((s) => s.currentFilePath);
    useEffect(() => {
      let cancelled = false; setError(false); setResolved(null);
      (async () => {
        if (!currentPath) { if (!cancelled) setResolved(src); return; }
        const result = await window.markd?.resolveImagePath(src, currentPath);
        if (!cancelled) setResolved((result && result !== src) ? result : src);
      })();
      return () => { cancelled = true; };
    }, [src, currentPath]);
    if (error || !resolved) return resolved === null ? <span className="block my-4 h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /> : null;
    return (
      <span className="block my-4">
        <img src={resolved} alt={alt || ''} loading="lazy" className={className || 'max-w-full h-auto rounded-lg shadow-sm'} onError={() => setError(true)} />
        {alt && <span className="block text-xs text-gray-500 text-center mt-1">{alt}</span>}
      </span>
    );
  };

  const computedFont = useMemo(() => fontFamily === 'system' ? undefined : fontFamily, [fontFamily]);

  const slugify = useCallback((text: string) =>
    text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim(), []);

  // Build heading with anchor link
  const makeHeading = useCallback((Tag: 'h1'|'h2'|'h3'|'h4'|'h5'|'h6') => {
    const HeadingAnchor: React.FC<{ id: string; text: string }> = ({ id, text }) => {
      const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(`#${id}`);
      }, [id]);
      const topOffset = Tag === 'h1' ? 8 : Tag === 'h2' ? 7 : Tag === 'h3' ? 4.5 : 4;
      return (
        <a href={`#${id}`}
          onClick={handleClick}
          className="heading-anchor absolute -left-6 flex items-center opacity-0 group-hover/heading:opacity-100 transition-opacity text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 no-underline"
          style={{ top: `${topOffset}px` }}
          aria-label={`Copy link to ${text}`}>
          <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.621 7.5H7.25a4.5 4.5 0 0 0-4.5 4.5v0a4.5 4.5 0 0 0 4.5 4.5h2.371m4.758-9h2.371a4.5 4.5 0 0 1 4.5 4.5v0a4.5 4.5 0 0 1-4.5 4.5h-2.371M7.243 12h9.514" />
          </svg>
        </a>
      );
    };
    return ({ children, ...props }: any) => {
      const text = String(children).replace(/<[^>]*>/g, '');
      const id = slugify(text);
      return (
        <Tag id={id} className="group/heading relative" {...props}>
          {children}
          {showHeadingAnchors && <HeadingAnchor id={id} text={text} />}
        </Tag>
      );
    };
  }, [slugify, showHeadingAnchors]);

  const components = useMemo(() => ({
    h1: makeHeading('h1'), h2: makeHeading('h2'), h3: makeHeading('h3'),
    h4: makeHeading('h4'), h5: makeHeading('h5'), h6: makeHeading('h6'),
    a: ({ href, children, ...props }: any) => (
      <a href={href} onClick={(e) => { if (href?.startsWith('http://') || href?.startsWith('https://')) { e.preventDefault(); window.markd?.openExternal(href); } }} {...props}>{children}</a>
    ),
    img: ({ src, alt }: any) => <AsyncImage src={src} alt={alt} />,
    table: ({ children }: any) => <div className="overflow-x-auto"><table className="min-w-full">{children}</table></div>,
    input: ({ type, checked, ...props }: any) => {
      if (type !== 'checkbox') return <input type={type} checked={checked} {...props} />;
      const handleToggle = (e: React.MouseEvent) => {
        const li = (e.currentTarget as HTMLElement).closest('.task-check-wrapper')?.closest('li');
        if (!li) return;
        const taskText = li.textContent?.trim() || '';
        const content = useStore.getState().fileContent;
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].replace(/^\s*[-*+]\s+\[([ x])\]\s*/, '').trim() === taskText) {
            lines[i] = lines[i].includes('[ ]') ? lines[i].replace('[ ]', '[x]') : lines[i].replace('[x]', '[ ]');
            useStore.getState().setFileContent(lines.join('\n'));
            break;
          }
        }
      };
      return (
        <span className="task-check-wrapper inline-flex items-center justify-center cursor-pointer select-none" onClick={handleToggle}>
          <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded border-2 transition-all duration-150 ease-out ${checked ? 'bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400' : 'bg-transparent border-gray-300 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-400'}`}>
            <svg className={`w-3 h-3 text-white dark:text-[#1a222b] transition-all duration-150 ease-out ${checked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <input type="checkbox" checked={checked} readOnly className="sr-only" />
        </span>
      );
    },
    pre: ({ children, ...props }: any) => {
      const codeChild = React.Children.toArray(children).find((c: any) => c?.props?.className) as any;
      const langClass = codeChild?.props?.className || '';
      const langMatch = langClass.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : null;
      const codeText = reactNodeToText(codeChild?.props?.children);
      if (lang === 'mermaid') return <MermaidBlock code={codeText} />;
      const isDiff = lang === 'diff';
      const [copied, setCopied] = useState(false);
      const copyCode = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(codeText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }, [codeText]);
      return (
        <div className={`code-block ${lang ? 'mt-4' : 'mt-2'} rounded-lg border p-0 relative group/cb ${isDiff ? 'diff-block' : ''}`}>
          {lang && <div className="flex px-4 -mt-2.5"><span className="code-block-lang text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono">{lang}</span></div>}
          <button className="code-block-btn absolute top-2 right-2 opacity-0 group-hover/cb:opacity-100 transition-opacity p-1.5 rounded-md z-10" onClick={copyCode} title="Copy code">
            {copied
              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 9h.6c1.33 0 2.4 1.07 2.4 2.4v7.2c0 1.33-1.07 2.4-2.4 2.4h-7.2C10.07 21 9 19.93 9 18.6V18M5.4 3h7.2A2.4 2.4 0 0 1 15 5.4v7.2a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 12.6V5.4A2.4 2.4 0 0 1 5.4 3" /></svg>
            }
          </button>
          <pre className="overflow-x-auto m-0 px-4 py-4 !bg-transparent" {...props}>{children}</pre>
        </div>
      );
    },
    code: ({ className, children, ...props }: any) => {
      if (!className) return <code className="bg-gray-100 dark:bg-[#1e2733] px-1.5 py-0.5 rounded text-sm font-mono text-[#3d5a6b] dark:text-[#9cccd8]" {...props}>{children}</code>;
      return <code className={className} {...props}>{children}</code>;
    },
  }), [makeHeading]);

  const searchHighlightPlugin = useMemo(() => [rehypeSearchHighlight, {
    enabled: viewMode === 'view' && isSearchOpen,
    query: searchQuery,
    currentIndex: searchCurrentIndex,
    useRegex: searchUseRegex,
    caseSensitive: searchCaseSensitive,
  }] as any, [viewMode, isSearchOpen, searchQuery, searchCurrentIndex, searchUseRegex, searchCaseSensitive]);

  return (
    <div className="h-full flex flex-col relative">
      <div ref={contentRef}
        className={`flex-1 overflow-y-auto p-6 lg:p-8 xl:p-10 scrollbar-expand ${previewPalette !== 'default' ? `preview-${previewPalette}` : ''}`}
        style={{ background: 'var(--pal-viewer-bg)' }}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <div className="max-w-4xl mx-auto markdown-body"
          data-palette={previewPalette !== 'default' ? previewPalette : undefined}
          style={{ fontFamily: computedFont, zoom: `${zoomLevel}%` }}>
          {fileContent ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkEmoji, remarkFrontmatter, remarkSmartypants, remarkWikiLink, remarkDirective, remarkCallouts, remarkSubSuper, remarkHighlight, remarkDeflist]}
              rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw, rehypeFilterCustomElements, searchHighlightPlugin]}
              components={components}>
              {fileContent}
            </ReactMarkdown>
          ) : currentFilePath ? null : (
            <div className="flex items-center justify-center h-64 text-gray-500"><p>No content</p></div>
          )}
        </div>
      </div>
      <BackToTop containerRef={contentRef} />
      <div className={`absolute top-3 right-3 bottom-3 w-64 z-10 transition-opacity ${showToc ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <TableOfContents content={fileContent} onClose={() => onToggleToc?.()} matchPalette={matchToolbarPalette} zoomLevel={zoomLevel} />
      </div>
    </div>
  );
};


export default MarkdownViewer;
