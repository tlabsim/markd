import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkEmoji from 'remark-emoji';
import remarkFrontmatter from 'remark-frontmatter';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { useStore } from '../store';

// Standard HTML5 elements — anything not in this set is converted to <span> to avoid React warnings
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

// Rehype plugin: convert unknown HTML elements to <span> to suppress React 18 dev warnings
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
import TableOfContents from './TableOfContents';

interface MarkdownViewerProps {
  showToc?: boolean;
  onToggleToc?: () => void;
  syncScroll?: 'off' | 'position' | 'content';
  onScrollRef?: (el: HTMLElement | null) => void;
  onViewerScroll?: () => void;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ showToc, onToggleToc, syncScroll, onScrollRef, onViewerScroll }) => {
  const { fileContent, currentFilePath, fontFamily, zoomLevel, previewPalette, zoomIn, zoomOut } = useStore();
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to top when file changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [currentFilePath]);

  // Ctrl+scroll zoom
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn(); else zoomOut();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomIn, zoomOut]);

  // Register scroll container for sync
  useEffect(() => {
    const el = contentRef.current;
    if (el && onScrollRef) onScrollRef(el);
    return () => { if (onScrollRef) onScrollRef(null); };
  }, [onScrollRef]);

  // Sync scroll: listen to viewer scroll
  useEffect(() => {
    const el = contentRef.current;
    if (!el || syncScroll === 'off' || !onViewerScroll) return;
    el.addEventListener('scroll', onViewerScroll, { passive: true });
    return () => el.removeEventListener('scroll', onViewerScroll);
  }, [syncScroll, onViewerScroll]);

// Async image resolver component (handles async data URL loading)
const AsyncImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [resolved, setResolved] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const currentPath = useStore((s) => s.currentFilePath);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setResolved(null);
    (async () => {
      if (!currentPath) {
        if (!cancelled) setResolved(src);
        return;
      }
      const result = await window.markd?.resolveImagePath(src, currentPath);
      if (!cancelled) {
        if (result && result !== src) {
          setResolved(result);
        } else {
          setResolved(src);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [src, currentPath]);

  if (error || !resolved) {
    return resolved === null ? (
      <span className="block my-4 h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
    ) : null;
  }

  return (
    <span className="block my-4">
      <img
        src={resolved}
        alt={alt || ''}
        loading="lazy"
        className={className || 'max-w-full h-auto rounded-lg shadow-sm'}
        onError={() => setError(true)}
      />
      {alt && (
        <span className="block text-xs text-gray-500 text-center mt-1">{alt}</span>
      )}
    </span>
  );
};

  // Get computed font family
  const computedFont = useMemo(() => {
    if (fontFamily === 'system') return undefined;
    return fontFamily;
  }, [fontFamily]);

  // Slugify heading text for ID matching with TOC
  const slugify = useCallback((text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }, []);

  // Custom components for ReactMarkdown
  const components = useMemo(() => ({
    h1: ({ children, ...props }: any) => {
      const text = String(children).replace(/<[^>]*>/g, '');
      return <h1 id={slugify(text)} {...props}>{children}</h1>;
    },
    h2: ({ children, ...props }: any) => {
      const text = String(children).replace(/<[^>]*>/g, '');
      return <h2 id={slugify(text)} {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }: any) => {
      const text = String(children).replace(/<[^>]*>/g, '');
      return <h3 id={slugify(text)} {...props}>{children}</h3>;
    },
    h4: ({ children, ...props }: any) => {
      const text = String(children).replace(/<[^>]*>/g, '');
      return <h4 id={slugify(text)} {...props}>{children}</h4>;
    },
    h5: ({ children, ...props }: any) => {
      const text = String(children).replace(/<[^>]*>/g, '');
      return <h5 id={slugify(text)} {...props}>{children}</h5>;
    },
    h6: ({ children, ...props }: any) => {
      const text = String(children).replace(/<[^>]*>/g, '');
      return <h6 id={slugify(text)} {...props}>{children}</h6>;
    },
    a: ({ href, children, ...props }: any) => (
      <a
        href={href}
        onClick={(e) => {
          if (href?.startsWith('http://') || href?.startsWith('https://')) {
            e.preventDefault();
            window.markd?.openExternal(href);
          }
        }}
        {...props}
      >
        {children}
      </a>
    ),
    img: ({ src, alt, ...props }: any) => (
      <AsyncImage src={src} alt={alt} />
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto">
        <table className="min-w-full">{children}</table>
      </div>
    ),
    input: ({ type, checked, disabled: _disabled, ...props }: any) => {
      if (type !== 'checkbox') {
        return <input type={type} checked={checked} disabled={_disabled} {...props} />;
      }
      const handleToggle = (e: React.MouseEvent) => {
        const wrapper = (e.currentTarget as HTMLElement).closest('.task-check-wrapper');
        const li = wrapper?.closest('li');
        if (!li) return;
        const taskText = li.textContent?.trim() || '';
        const content = useStore.getState().fileContent;
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].replace(/^\s*[-*+]\s+\[([ x])\]\s*/, '').trim();
          if (trimmed === taskText) {
            if (lines[i].includes('[ ]')) {
              lines[i] = lines[i].replace('[ ]', '[x]');
            } else if (lines[i].includes('[x]')) {
              lines[i] = lines[i].replace('[x]', '[ ]');
            }
            useStore.getState().setFileContent(lines.join('\n'));
            break;
          }
        }
      };
      return (
        <span
          className="task-check-wrapper inline-flex items-center justify-center cursor-pointer select-none"
          onClick={handleToggle}
        >
          <span className={`
            inline-flex items-center justify-center w-[18px] h-[18px] rounded
            border-2 transition-all duration-150 ease-out
            ${checked
              ? 'bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400'
              : 'bg-transparent border-gray-300 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-400'
            }
          `}>
            <svg
              className={`w-3 h-3 text-white dark:text-[#1a222b] transition-all duration-150 ease-out ${checked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          {/* hidden native checkbox for accessibility */}
          <input type="checkbox" checked={checked} readOnly className="sr-only" />
        </span>
      );
    },
    pre: ({ children, ...props }: any) => (
      <pre className="my-4 p-3 bg-gray-50 dark:bg-[#181e26] rounded-lg overflow-x-auto border border-gray-200 dark:border-gray-700" {...props}>{children}</pre>
    ),
    code: ({ className, children, ...props }: any) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-gray-100 dark:bg-[#1e2733] px-1.5 py-0.5 rounded text-sm font-mono text-[#3d5a6b] dark:text-[#9cccd8]" {...props}>
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>{children}</code>
      );
    },
  }), []);

  return (
    <div className="h-full flex flex-col relative">
      {/* Content */}
      <div
        ref={contentRef}
        className={`flex-1 overflow-y-auto p-6 lg:p-8 xl:p-10 bg-white dark:bg-[#1a222b] ${previewPalette !== 'default' ? `preview-${previewPalette}` : ''}`}
      >
        <div
          className="max-w-4xl mx-auto markdown-body"
          data-palette={previewPalette !== 'default' ? previewPalette : undefined}
          style={{
            fontFamily: computedFont,
            zoom: `${zoomLevel}%`,
          }}
        >
          {fileContent ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkEmoji, remarkFrontmatter]}
              rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw, rehypeFilterCustomElements]}
              components={components}
            >
              {fileContent}
            </ReactMarkdown>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>No content</p>
            </div>
          )}
        </div>
      </div>

      {/* Table of Contents panel — always mounted to preserve scroll position */}
      <div className={`absolute top-3 right-3 bottom-3 w-64 z-10 transition-opacity ${showToc ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <TableOfContents content={fileContent} onClose={() => onToggleToc?.()} />
      </div>
    </div>
  );
};

export default MarkdownViewer;
