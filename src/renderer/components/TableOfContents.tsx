import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TocNode {
  item: TocItem;
  children: TocNode[];
}

interface TableOfContentsProps {
  content: string;
  onClose: () => void;
  matchPalette?: boolean;
  zoomLevel?: number;
}

// ---- Build tree from flat heading list ----
function buildTree(headings: TocItem[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: { node: TocNode; level: number }[] = [];

  for (const item of headings) {
    const node: TocNode = { item, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ node, level: item.level });
  }
  return roots;
}

// ---- Layout constants (from spec) ----
// Within each level: [1px border] [connector: leaf=20 / parent=8] [12px chevron if parent] [3px gap] [label]
// Total from border to label = 1+20+3=24 (leaf) = 1+8+12+3=24 (parent)
const CONNECTOR_LEAF = 20;
const CONNECTOR_PARENT = 8;
const CHEVRON_SIZE = 12;
const GAP = 3;
const BORDER_ADJUST = 13;   // per-level correction to align border with chevron tip

const TreeNode: React.FC<{
  node: TocNode;
  isRoot: boolean;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onScroll: (id: string) => void;
}> = ({ node, isRoot, collapsed, onToggle, onScroll }) => {
  const { item, children } = node;
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(item.id);

  // Children group border: at this item's chevron center
  const myChildrenBorderX = hasChildren
    ? isRoot ? 5.5 : BORDER_ADJUST
    : 0;

  const connectorW = hasChildren ? CONNECTOR_PARENT : CONNECTOR_LEAF;

  return (
    <div>
      {/* Item row */}
      <div className="flex items-center group relative">
        {/* Horizontal connector: touches the border */}
        {!isRoot && (
          <span
            className="absolute top-1/2 -translate-y-1/2 h-px bg-slate-300 dark:bg-slate-600"
            style={{ left: `${-1}px`, width: `${connectorW}px` }}
          />
        )}

        {/* Chevron (parents only) */}
        {hasChildren && (
          <button
            className="shrink-0 rounded hover:bg-gray-700/15 dark:hover:bg-white/10 transition-colors text-gray-400 dark:text-gray-500 flex items-center justify-center"
            style={{
              width: `${CHEVRON_SIZE}px`,
              height: `${CHEVRON_SIZE}px`,
              marginLeft: isRoot ? 0 : `${CONNECTOR_PARENT}px`,
              marginRight: `${GAP}px`,
            }}
            onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
            title={isCollapsed ? 'Expand section' : 'Collapse section'}
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Label */}
        <button
          className={`text-left truncate py-0.5 pr-2 rounded hover:bg-gray-700/10 dark:hover:bg-white/5 transition-colors flex-1
            ${item.level <= 2 ? 'font-semibold text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => onScroll(item.id)}
          style={{ marginLeft: isRoot ? 0 : hasChildren ? 0 : `${CONNECTOR_LEAF + GAP}px` }}
        >
          {item.text}
        </button>
      </div>

      {/* Children group: border at chevron center */}
      {hasChildren && !isCollapsed && (
        <div style={{ paddingLeft: `${myChildrenBorderX}px` }}>
          <div className="border-l border-slate-200 dark:border-slate-700">
            {children.map((child, i) => (
              <TreeNode
                key={child.item.id || i}
                node={child}
                isRoot={false}
                collapsed={collapsed}
                onToggle={onToggle}
                onScroll={onScroll}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TableOfContents: React.FC<TableOfContentsProps> = ({ content, onClose, matchPalette, zoomLevel = 100 }) => {
  // Scale TOC font: +0.25px per 10% zoom above 100%
  const tocFontSize = 12 + Math.max(0, (zoomLevel - 100) / 10) * 0.25;
  const tocRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const headings = useMemo(() => {
    const items: TocItem[] = [];
    const lines = content.split('\n');
    let inFence = false;
    for (const line of lines) {
      if (/^```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
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

  const tree = useMemo(() => buildTree(headings), [headings]);

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

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollToHeading = useCallback((id: string) => {
    const isLarge = content.length > 50000;
    const behavior = isLarge ? ('auto' as const) : ('smooth' as const);
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
  }, [content.length]);

  const collapseAll = useCallback(() => {
    const ids = new Set<string>();
    const collect = (nodes: TocNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) ids.add(n.item.id);
        collect(n.children);
      }
    };
    collect(tree);
    setCollapsed(ids);
  }, [tree]);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  if (headings.length === 0) return null;

  return (
    <div
      ref={tocRef}
      className="p-3 shadow-xl h-full overflow-y-auto rounded-lg border border-gray-200/50 dark:border-gray-700/50 bg-white/85 dark:bg-[#222c36]/85 backdrop-blur-md"
      style={{ fontSize: tocFontSize, ...(matchPalette ? { backgroundColor: 'color-mix(in srgb, var(--pal-panel-bg) 85%, transparent)', borderColor: 'var(--pal-border-soft)' } : {}) }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400" style={{ fontSize: `${tocFontSize * 0.833}px` }}>
          Contents
        </h3>
        <div className="flex items-center gap-0.5">
          {/* Collapse/Expand all */}
          <button
            className="btn-icon p-0.5"
            title={collapsed.size > 0 ? 'Expand all' : 'Collapse all'}
            onClick={() => collapsed.size > 0 ? expandAll() : collapseAll()}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed.size > 0 ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              )}
            </svg>
          </button>
          <button className="btn-icon p-0.5" onClick={onClose}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <nav>
        {tree.map((node, i) => (
          <TreeNode
            key={node.item.id || i}
            node={node}
            isRoot={true}
            collapsed={collapsed}
            onToggle={toggleCollapse}
            onScroll={scrollToHeading}
          />
        ))}
      </nav>
    </div>
  );
};

export default TableOfContents;
