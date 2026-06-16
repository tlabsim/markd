import React, { useMemo, useRef, useEffect } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  onClose: () => void;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content, onClose }) => {
  const tocRef = useRef<HTMLDivElement>(null);

  const headings = useMemo(() => {
    const items: TocItem[] = [];
    const lines = content.split('\n');
    let inFence = false;
    for (const line of lines) {
      // Skip fenced code blocks
      if (/^```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        // Strip markdown formatting so ID matches the viewer's rendered heading
        let text = match[2].trim();
        text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
        text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
        text = text.replace(/[*_`~]/g, '');
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        items.push({ id, text: match[2].trim(), level });
      }
    }
    return items;
  }, [content]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tocRef.current && !tocRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const scrollToHeading = (id: string) => {
    const isLarge = content.length > 50000;
    const behavior = isLarge ? 'auto' as const : 'smooth' as const;
    const previewContainer = document.querySelector('.markdown-body')?.parentElement;
    if (!previewContainer) {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior, block: 'start' });
      return;
    }
    const heading = previewContainer.querySelector(`[id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (heading) {
      previewContainer.scrollTo({ top: heading.offsetTop - 16, behavior });
    }
  };

  if (headings.length === 0) return null;

  return (
    <div
      ref={tocRef}
      className="p-3 shadow-xl h-full overflow-y-auto rounded-lg border border-gray-200/50 dark:border-gray-700/50 bg-white/85 dark:bg-[#222c36]/85 backdrop-blur-md"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Contents
        </h3>
        <button
          className="btn-icon p-0.5"
          onClick={onClose}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav>
        {headings.map((heading, index) => {
          const borderColor = heading.level <= 2
            ? 'border-l-slate-300 dark:border-l-slate-600'
            : heading.level === 3
            ? 'border-l-slate-200 dark:border-l-slate-700'
            : 'border-l-slate-100 dark:border-l-slate-800';
          return (
          <button
            key={index}
            className={`block w-full text-left text-xs py-1 pr-2 rounded-r hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors truncate border-l-2 ${borderColor}
              ${heading.level === 1 ? 'font-semibold pl-2' : ''}
              ${heading.level === 2 ? 'pl-4' : ''}
              ${heading.level === 3 ? 'pl-6' : ''}
              ${heading.level === 4 ? 'pl-8' : ''}
              ${heading.level >= 5 ? 'pl-10' : ''}
            `}
            onClick={() => scrollToHeading(heading.id)}
          >
            {heading.text}
          </button>
        )})}
      </nav>
    </div>
  );
};

export default TableOfContents;
