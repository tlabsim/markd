import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
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

// ---- Remark plugin: footnotes ([^id] / [^id]: definition) ----
function remarkFootnotes() {
  return (tree: any) => {
    const defs = new Map<string, any[]>();
    for (let i = tree.children.length - 1; i >= 0; i--) {
      const node = tree.children[i];
      if (node.type === 'paragraph' && node.children?.[0]?.type === 'footnoteDefinition') {
        defs.set(node.children[0].identifier, node.children[0].children || []);
      } else { break; }
    }
    if (defs.size === 0) return;
    tree.children = tree.children.filter((n: any) =>
      !(n.type === 'paragraph' && n.children?.[0]?.type === 'footnoteDefinition'));
    const seen = new Map<string, number>();
    let counter = 1;
    function scanRefs(node: any) {
      if (node.type === 'footnoteReference') {
        if (!seen.has(node.identifier)) { seen.set(node.identifier, counter++); }
      }
      if (node.children) for (const c of node.children) scanRefs(c);
    }
    scanRefs(tree);
    const sectionChildren: any[] = [{ type: 'html', value: '<hr class="footnotes-sep" />' }];
    for (const [id, children] of defs) {
      const num = seen.get(id);
      if (!num) continue;
      sectionChildren.push({
        type: 'paragraph',
        data: { hProperties: { className: 'footnote-item', id: `fn-${id}` } },
        children: [
          { type: 'html', value: `<a href="#fnref-${id}" class="footnote-backref">↩</a>&#160;` },
          { type: 'html', value: `<span class="footnote-num">${num}.</span>&#160;` },
          ...children,
        ],
      });
    }
    tree.children.push({ type: 'section', data: { hName: 'section', hProperties: { className: 'footnotes' } }, children: sectionChildren });
    function assignNums(node: any) {
      if (node.type === 'footnoteReference') {
        const n = seen.get(node.identifier) || 0;
        node.type = 'html';
        node.value = `<sup class="footnote-ref"><a href="#fn-${node.identifier}" id="fnref-${node.identifier}">${n}</a></sup>`;
      }
      if (node.children) for (const c of node.children) assignNums(c);
    }
    assignNums(tree);
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
          // Superscript: ^text^
          if (node.value[i] === '^') {
            const end = node.value.indexOf('^', i + 1);
            if (end > i + 1) {
              const inner = node.value.slice(i + 1, end);
              parts.push({ type: 'html', value: `<sup>${inner}</sup>` });
              i = end + 1;
              continue;
            }
          }
          // Subscript: ~text~
          if (node.value[i] === '~') {
            const end = node.value.indexOf('~', i + 1);
            if (end > i + 1) {
              const inner = node.value.slice(i + 1, end);
              parts.push({ type: 'html', value: `<sub>${inner}</sub>` });
              i = end + 1;
              continue;
            }
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

// ---- Remark plugin: definition lists (term followed by : definition) ----
function remarkDeflist() {
  return (tree: any) => {
    const newChildren: any[] = [];
    let i = 0;
    while (i < tree.children.length) {
      const node = tree.children[i];
      if (node.type === 'paragraph' && node.children?.length > 0 &&
          node.children[node.children.length - 1].type === 'text') {
        const lastText = node.children[node.children.length - 1].value;
        if (lastText.endsWith('\n')) {
          const termText = lastText.slice(0, -1);
          const termChildren = [...node.children.slice(0, -1), { type: 'text', value: termText }];
          const dlParts: string[] = [];
          dlParts.push(`<dt>${reconstructText(termChildren)}</dt>`);
          i++;
          while (i < tree.children.length) {
            const next = tree.children[i];
            if (next.type === 'paragraph' && next.children?.[0]?.type === 'text') {
              const m = next.children[0].value.match(/^:\s+(.*)/);
              if (m) {
                dlParts.push(`<dd>${m[1]}${next.children.slice(1).map((c: any) => c.value || '').join('')}</dd>`);
                i++; continue;
              }
            }
            break;
          }
          newChildren.push({ type: 'html', value: `<dl>${dlParts.join('')}</dl>` });
          continue;
        }
      }
      newChildren.push(node);
      i++;
    }
    tree.children = newChildren;
  };
}

function reconstructText(children: any[]): string {
  return children.map((c: any) => {
    if (c.type === 'text') return c.value;
    if (c.type === 'inlineCode') return `<code>${c.value}</code>`;
    if (c.type === 'strong') return `**${reconstructText(c.children)}**`;
    if (c.type === 'emphasis') return `*${reconstructText(c.children)}*`;
    return c.value || '';
  }).join('');
}

import TableOfContents from './TableOfContents';

interface MarkdownViewerProps {
  showToc?: boolean;
  onToggleToc?: () => void;
  syncScroll?: 'off' | 'position' | 'content';
  onScrollRef?: (el: HTMLElement | null) => void;
  onViewerScroll?: () => void;
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
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > 400);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef]);
  if (!visible) return null;
  return (
    <button
      className="fixed bottom-6 right-6 z-20 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all flex items-center justify-center"
      onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Back to top"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m18 15l-6-6-6 6" /></svg>
    </button>
  );
};

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ showToc, onToggleToc, syncScroll, onScrollRef, onViewerScroll }) => {
  const { fileContent, currentFilePath, fontFamily, zoomLevel, previewPalette, zoomIn, zoomOut, matchToolbarPalette } = useStore();
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
  const makeHeading = useCallback((Tag: 'h1'|'h2'|'h3'|'h4'|'h5'|'h6') =>
    ({ children, ...props }: any) => {
      const text = String(children).replace(/<[^>]*>/g, '');
      const id = slugify(text);
      return (
        <Tag id={id} className="group/heading relative" {...props}>
          {children}
          <a href={`#${id}`}
            className="heading-anchor absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/heading:opacity-100 transition-opacity text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 no-underline"
            aria-label={`Link to ${text}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </a>
        </Tag>
      );
    }, [slugify]);

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
      const codeText = typeof codeChild?.props?.children === 'string' ? codeChild.props.children : (codeChild?.props?.children?.[0] || '');
      if (lang === 'mermaid') return <MermaidBlock code={codeText} />;
      const isDiff = lang === 'diff';
      const [copied, setCopied] = useState(false);
      const copyCode = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(codeText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }, [codeText]);
      return (
        <div className={`code-block my-6 rounded-lg border p-0 relative group/cb ${isDiff ? 'diff-block' : ''}`}>
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
              remarkPlugins={[remarkGfm, remarkMath, remarkEmoji, remarkFrontmatter, remarkSmartypants, remarkWikiLink, remarkDirective, remarkFootnotes, remarkSubSuper, remarkHighlight, remarkDeflist]}
              rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw, rehypeFilterCustomElements]}
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
        <TableOfContents content={fileContent} onClose={() => onToggleToc?.()} matchPalette={matchToolbarPalette} />
      </div>
    </div>
  );
};


export default MarkdownViewer;
