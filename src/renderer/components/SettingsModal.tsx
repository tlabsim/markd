import React, { useState, useEffect } from 'react';
import { useStore, FONT_OPTIONS } from '../store';
import type {
  BlockquoteStyle,
  CalloutStyle,
  CodeBlockStyle,
  DefinitionListStyle,
  InlineCodeStyle,
  TableStyle,
  TaskListStyle,
} from '../store';
import { useShallow } from 'zustand/react/shallow';
import { PALETTE_OPTIONS } from '../palettes';
import { ThemeMode } from '../types';
import markdLogo from '../assets/markd.svg';

type Tab = 'settings' | 'shortcuts' | 'about';

const SHOW_SVG_BACKGROUND_SETTING = false;

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
  onSyntaxHighlightChange?: (enabled: boolean) => void;
}

// ----- Keyboard shortcuts list -----
const SHORTCUTS: { key: string; label: string }[] = [
  { key: 'Ctrl+N', label: 'New File' },
  { key: 'Ctrl+O', label: 'Open File…' },
  { key: 'Ctrl+Shift+O', label: 'Open Folder…' },
  { key: 'Ctrl+S', label: 'Save' },
  { key: 'Ctrl+Shift+S', label: 'Save As…' },
  { key: 'Ctrl+W', label: 'Close File' },
  { key: 'Ctrl+F', label: 'Search' },
  { key: 'Ctrl+T', label: 'Toggle Table of Contents' },
  { key: 'Ctrl+,', label: 'Open Settings' },
  { key: 'Ctrl+/', label: 'Show Keyboard Shortcuts' },
  { key: 'Ctrl+B', label: 'Toggle Sidebar' },
  { key: 'Ctrl+Shift+D', label: 'Toggle Theme (Dark/Light)' },
  { key: 'Ctrl+Shift+F', label: 'Distraction-Free Mode' },
  { key: 'Ctrl+−', label: 'Zoom Out' },
  { key: 'Ctrl+=', label: 'Zoom In' },
  { key: 'Ctrl+0', label: 'Reset Zoom' },
  { key: 'Ctrl+Scroll', label: 'Zoom In / Out' },
  { key: 'Esc', label: 'Close Search' },
];

// ----- Credits -----
const CREDITS: { name: string; url?: string; description: string }[] = [
  { name: 'Electron', url: 'https://electronjs.org', description: 'Desktop app framework' },
  { name: 'React', url: 'https://react.dev', description: 'UI library' },
  { name: 'Vite', url: 'https://vitejs.dev', description: 'Build tool' },
  { name: 'TypeScript', url: 'https://typescriptlang.org', description: 'Type-safe JavaScript' },
  { name: 'Tailwind CSS', url: 'https://tailwindcss.com', description: 'Utility-first CSS framework' },
  { name: 'Zustand', url: 'https://github.com/pmndrs/zustand', description: 'State management' },
  { name: 'react-markdown', url: 'https://github.com/remarkjs/react-markdown', description: 'Markdown rendering' },
  { name: 'remark-gfm', url: 'https://github.com/remarkjs/remark-gfm', description: 'GFM support (tables, task lists)' },
  { name: 'remark-math', url: 'https://github.com/remarkjs/remark-math', description: 'Math syntax' },
  { name: 'remark-emoji', url: 'https://github.com/rhysd/remark-emoji', description: 'Emoji rendering' },
  { name: 'remark-frontmatter', url: 'https://github.com/remarkjs/remark-frontmatter', description: 'Frontmatter support' },
  { name: 'rehype-katex', url: 'https://github.com/remarkjs/remark-math', description: 'KaTeX math rendering' },
  { name: 'rehype-highlight', url: 'https://github.com/rehypejs/rehype-highlight', description: 'Code syntax highlighting' },
  { name: 'rehype-raw', url: 'https://github.com/rehypejs/rehype-raw', description: 'Raw HTML pass-through' },
  { name: 'mermaid', url: 'https://mermaid.js.org', description: 'Diagram rendering' },
  { name: 'remark-smartypants', url: 'https://github.com/silvenon/remark-smartypants', description: 'Smart typography' },
  { name: 'remark-sub-super', url: 'https://github.com/syntax-tree/mdast-util-sub-super', description: 'Subscript / Superscript' },
  { name: 'remark-wiki-link', url: 'https://github.com/landakram/remark-wiki-link', description: 'Wiki-style links' },
  { name: 'remark-directive', url: 'https://github.com/remarkjs/remark-directive', description: 'Admonitions / Callouts' },
  { name: 'KaTeX', url: 'https://katex.org', description: 'Math typesetting' },
  { name: 'highlight.js', url: 'https://highlightjs.org', description: 'Code syntax highlighting' },
  { name: 'sharp', url: 'https://sharp.pixelplumbing.com', description: 'Image processing (icons)' },
  { name: 'to-ico', url: 'https://github.com/kevva/to-ico', description: 'ICO icon generation' },
  { name: 'electron-builder', url: 'https://electron.build', description: 'App packaging & distribution' },
];

// ----- iOS-style toggle -----
const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-block h-[26px] w-[44px] shrink-0 cursor-pointer rounded-full border border-transparent align-middle transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
    }`}
  >
    <span
      className={`pointer-events-none absolute left-px top-px block h-[22px] w-[22px] rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
        checked ? 'translate-x-[18px]' : 'translate-x-0'
      }`}
    />
  </button>
);

// ----- Segmented control (mini) -----
const SegmentedControl: React.FC<{
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-[11px] font-medium">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-2.5 py-1 transition-colors ${
          value === opt.value
            ? 'bg-blue-500 text-white'
            : 'bg-gray-700/5 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-700/10 dark:hover:bg-white/10'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

type MarkdownStyleKind = 'table' | 'code' | 'inline-code' | 'task-list' | 'blockquote' | 'callout' | 'definition-list';

const MarkdownStyleSample: React.FC<{ kind: MarkdownStyleKind; value: string }> = ({ kind, value }) => {
  if (kind === 'table') {
    return (
      <div className="markdown-body markdown-style-preview" data-table-style={value}>
        <div className="markdown-table-wrap overflow-hidden">
          <table>
            <thead><tr><th>Item</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Alpha</td><td>24</td></tr>
              <tr><td>Beta</td><td>42</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (kind === 'code') {
    return (
      <div className="markdown-body markdown-style-preview" data-code-style={value}>
        <div className="code-block relative h-full rounded-lg border">
          <div className="code-block-language-row flex px-2 -mt-1.5">
            <span className="code-block-lang rounded px-1 py-px font-mono font-semibold uppercase">JS</span>
          </div>
          <span className="code-block-btn markdown-style-preview-copy absolute right-1 top-1 rounded p-1" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
              <path d="M15 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </svg>
          </span>
          <pre><code><span className="markdown-style-preview-keyword">const</span> total = <span className="markdown-style-preview-number">42</span>;<br /><span className="markdown-style-preview-keyword">return</span> total;</code></pre>
        </div>
      </div>
    );
  }

  if (kind === 'inline-code') {
    return (
      <div className="markdown-body markdown-style-preview markdown-style-preview-centered markdown-style-preview-inline-code" data-inline-code-style={value}>
        <p>Run <code>npm build</code></p>
      </div>
    );
  }

  if (kind === 'task-list') {
    return (
      <div className="markdown-body markdown-style-preview" data-task-list-style={value}>
        <ul className="contains-task-list">
          <li className="task-list-item">
            <span className="task-check-wrapper"><span className="task-checkbox task-checkbox-checked markdown-style-preview-checkbox"><svg viewBox="0 0 12 12"><path d="m2 6 2.5 2.5L10 3" /></svg></span></span>
            Draft outline
          </li>
          <li className="task-list-item">
            <span className="task-check-wrapper"><span className="markdown-style-preview-checkbox" /></span>
            Review changes
          </li>
        </ul>
      </div>
    );
  }

  if (kind === 'callout') {
    return (
      <div className="markdown-body markdown-style-preview markdown-style-preview-centered" data-callout-style={value}>
        <div className="admonition admonition-note">
          <div className="admonition-header"><span className="admonition-icon">i</span><span className="admonition-type">Note</span></div>
          <div className="admonition-body"><p>Useful context for the reader.</p></div>
        </div>
      </div>
    );
  }

  if (kind === 'definition-list') {
    return (
      <div className="markdown-body markdown-style-preview markdown-style-preview-centered" data-definition-list-style={value}>
        <dl><dt>Term</dt><dd>A concise definition.</dd></dl>
      </div>
    );
  }

  return (
    <div className="markdown-body markdown-style-preview" data-blockquote-style={value}>
      <blockquote>
        <p>Clarity comes from removing what is not needed.</p>
      </blockquote>
    </div>
  );
};

const MarkdownStylePicker: React.FC<{
  label: string;
  tooltip: string;
  kind: MarkdownStyleKind;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}> = ({ label, tooltip, kind, options, value, onChange }) => {
  const tooltipId = React.useId();
  return (
    <div className="border-b border-gray-700/10 px-4 py-3 dark:border-white/5">
      <span
        className="group relative inline-block cursor-help text-[13px] text-gray-700 dark:text-gray-200"
        tabIndex={0}
        aria-describedby={tooltipId}
      >
        {label}
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-64 rounded-md border px-2.5 py-2 text-[11px] font-normal leading-relaxed opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
          style={{ backgroundColor: 'var(--pal-panel-bg)', borderColor: 'var(--pal-border)', color: 'var(--pal-text)' }}
        >
          {tooltip}
        </span>
      </span>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`${label} style`}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              title={option.label}
              onClick={() => onChange(option.value)}
              className={`markdown-style-option relative h-[76px] min-w-0 overflow-hidden rounded-lg border p-2 text-left transition-colors ${
                selected
                  ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                  : 'border-gray-300 bg-gray-700/[0.025] hover:border-gray-400 dark:border-gray-600 dark:bg-white/[0.025] dark:hover:border-gray-500'
              }`}
            >
              <MarkdownStyleSample kind={kind} value={option.value} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SettingsSectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="settings-section-header px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.11em]">
    {children}
  </div>
);

// ----- Settings row -----
const SettingRow: React.FC<{ label: React.ReactNode; tooltip?: string; children: React.ReactNode }> = ({ label, tooltip, children }) => {
  const tooltipId = React.useId();
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/10 dark:border-white/5">
      <span
        className={`group relative text-[13px] text-gray-700 dark:text-gray-200 ${tooltip ? 'cursor-help' : ''}`}
        tabIndex={tooltip ? 0 : undefined}
        aria-describedby={tooltip ? tooltipId : undefined}
      >
        {label}
        {tooltip && (
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-64 rounded-md border px-2.5 py-2 text-[11px] font-normal leading-relaxed opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
            style={{ backgroundColor: 'var(--pal-panel-bg)', borderColor: 'var(--pal-border)', color: 'var(--pal-text)' }}
          >
            {tooltip}
          </span>
        )}
      </span>
      {children}
    </div>
  );
};

// ----- iOS-style tab bar -----
const TabBar: React.FC<{ activeTab: Tab; onTab: (t: Tab) => void }> = ({ activeTab, onTab }) => {
  const matchToolbarPalette = useStore(s => s.matchToolbarPalette);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'settings', label: 'Settings' },
    { id: 'shortcuts', label: 'Keyboard Shortcuts' },
    { id: 'about', label: 'About' },
  ];
  return (
    <div
      className="relative flex border-b border-gray-700/10 dark:border-white/5 bg-gray-50 dark:bg-[#202329]"
      style={matchToolbarPalette ? { backgroundColor: 'var(--pal-editor-toolbar-bg)', borderColor: 'var(--pal-border)' } : undefined}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTab(tab.id)}
          className={`flex-1 text-[12px] font-medium py-2.5 transition-colors relative ${
            activeTab === tab.id
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
      <span
        className="settings-tab-indicator pointer-events-none absolute bottom-0 left-0 w-1/3 h-0.5"
        style={{ transform: `translateX(${tabs.findIndex(item => item.id === activeTab) * 100}%)` }}
        aria-hidden="true"
      >
        <span className="absolute inset-y-0 left-1/4 right-1/4 bg-blue-500 rounded-full" />
      </span>
    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose, initialTab, onSyntaxHighlightChange }) => {
  const [tab, setTab] = useState<Tab>(initialTab || 'settings');
  const [mounted, setMounted] = useState(open);
  const [multiInstance, setMultiInstance] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // Reset tab when modal opens
  useEffect(() => {
    if (open) setTab(initialTab || 'settings');
  }, [open, initialTab]);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Load multi-instance preference from main process on mount
  useEffect(() => {
    window.markd?.getSetting('multiInstance').then((v: unknown) => {
      if (typeof v === 'boolean') setMultiInstance(v);
    });
  }, [open]);

  useEffect(() => {
    const getAppVersion = window.markd?.getAppVersion;
    if (typeof getAppVersion !== 'function') return;

    getAppVersion().then((version) => {
      if (typeof version === 'string' && version.trim()) {
        setAppVersion(version);
      }
    }).catch(() => {
      // Older dev preload builds may not expose this yet; keep the static fallback.
    });
  }, []);

  const {
    theme,
    setTheme,
    fontFamily,
    setFontFamily,
    zoomLevel,
    setZoomLevel,
    previewPalette,
    setPreviewPalette,
    showSvgBackgroundToggle,
    setShowSvgBackgroundToggle,
    wordWrap,
    setWordWrap,
    tabSize,
    setTabSize,
    syntaxHighlight,
    setSyntaxHighlight,
    rememberScrollPosition,
    setRememberScrollPosition,
    startWithSidebarOpen,
    setStartWithSidebarOpen,
    matchToolbarPalette,
    showHeadingAnchors,
    setShowHeadingAnchors,
    tableStyle,
    setTableStyle,
    codeBlockStyle,
    setCodeBlockStyle,
    blockquoteStyle,
    setBlockquoteStyle,
    inlineCodeStyle,
    setInlineCodeStyle,
    taskListStyle,
    setTaskListStyle,
    definitionListStyle,
    setDefinitionListStyle,
    calloutStyle,
    setCalloutStyle,
  } = useStore(useShallow((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
    fontFamily: state.fontFamily,
    setFontFamily: state.setFontFamily,
    zoomLevel: state.zoomLevel,
    setZoomLevel: state.setZoomLevel,
    previewPalette: state.previewPalette,
    setPreviewPalette: state.setPreviewPalette,
    showSvgBackgroundToggle: state.showSvgBackgroundToggle,
    setShowSvgBackgroundToggle: state.setShowSvgBackgroundToggle,
    wordWrap: state.wordWrap,
    setWordWrap: state.setWordWrap,
    tabSize: state.tabSize,
    setTabSize: state.setTabSize,
    syntaxHighlight: state.syntaxHighlight,
    setSyntaxHighlight: state.setSyntaxHighlight,
    rememberScrollPosition: state.rememberScrollPosition,
    setRememberScrollPosition: state.setRememberScrollPosition,
    startWithSidebarOpen: state.startWithSidebarOpen,
    setStartWithSidebarOpen: state.setStartWithSidebarOpen,
    matchToolbarPalette: state.matchToolbarPalette,
    showHeadingAnchors: state.showHeadingAnchors,
    setShowHeadingAnchors: state.setShowHeadingAnchors,
    tableStyle: state.tableStyle,
    setTableStyle: state.setTableStyle,
    codeBlockStyle: state.codeBlockStyle,
    setCodeBlockStyle: state.setCodeBlockStyle,
    blockquoteStyle: state.blockquoteStyle,
    setBlockquoteStyle: state.setBlockquoteStyle,
    inlineCodeStyle: state.inlineCodeStyle,
    setInlineCodeStyle: state.setInlineCodeStyle,
    taskListStyle: state.taskListStyle,
    setTaskListStyle: state.setTaskListStyle,
    definitionListStyle: state.definitionListStyle,
    setDefinitionListStyle: state.setDefinitionListStyle,
    calloutStyle: state.calloutStyle,
    setCalloutStyle: state.setCalloutStyle,
  })));

  if (!mounted) return null;

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm ${open ? 'settings-backdrop--enter' : 'settings-backdrop--exit'}`}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className={`relative w-[520px] max-w-[92vw] max-h-[85vh] bg-white dark:bg-[#30353d] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 overflow-hidden flex flex-col ${open ? 'settings-modal--enter' : 'settings-modal--exit'}`}
        style={matchToolbarPalette ? { backgroundColor: 'var(--pal-panel-bg)', borderColor: 'var(--pal-border)' } : undefined}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && !open) setMounted(false);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/10 dark:border-white/5">
          <h2 className="text-[14px] font-semibold text-gray-800 dark:text-gray-100">Settings</h2>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-700/15 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            onClick={onClose}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* iOS Tabs */}
        <TabBar activeTab={tab} onTab={setTab} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto pt-1">
          <div key={tab} className="settings-tab-content">
          {tab === 'settings' && (
            <div className="settings-page divide-y divide-gray-700/10 dark:divide-white/5">
              {/* Appearance */}
              <SettingsSectionHeader>
                Appearance
              </SettingsSectionHeader>

              <SettingRow label="Theme">
                <SegmentedControl
                  options={[
                    { label: 'Dark', value: 'dark' },
                    { label: 'Light', value: 'light' },
                  ]}
                  value={theme}
                  onChange={(v) => setTheme(v as ThemeMode)}
                />
              </SettingRow>

              <SettingRow label="Color Palette">
                <select
                  className="text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-gray-700/5 dark:bg-white/5 text-gray-700 dark:text-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={previewPalette}
                  onChange={(e) => setPreviewPalette(e.target.value)}
                >
                  {PALETTE_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow label="Font Family">
                <select
                  className="text-[12px] rounded-md border border-gray-300 dark:border-gray-600 bg-gray-700/5 dark:bg-white/5 text-gray-700 dark:text-gray-200 px-2 py-1 max-w-[180px] truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow label="Zoom Level">
                <div className="flex items-center gap-1.5">
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded text-xs bg-gray-700/10 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-700/20 dark:hover:bg-white/15"
                    onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                  >−</button>
                  <span className="text-[12px] font-mono text-gray-600 dark:text-gray-300 w-10 text-center">{zoomLevel}%</span>
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded text-xs bg-gray-700/10 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-700/20 dark:hover:bg-white/15"
                    onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                  >+</button>
                  <button
                    className="ml-1 text-[10px] text-blue-500 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={() => setZoomLevel(100)}
                  >Reset</button>
                </div>
              </SettingRow>

              {SHOW_SVG_BACKGROUND_SETTING && (
                <SettingRow label={
                  <span className="inline-flex items-center gap-1.5">
                    SVG Background Toggle (Dark Mode)
                    <span
                      tabIndex={0}
                      role="img"
                      aria-label="In dark mode, hover over a transparent SVG containing text to show a button that toggles a white background. The SVG itself is unchanged."
                      title="In dark mode, hover over a transparent SVG containing text to show a button that toggles a white background. The SVG itself is unchanged."
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" d="M12 11v5m0-8h.01" />
                      </svg>
                    </span>
                  </span>
                }>
                  <ToggleSwitch
                    checked={showSvgBackgroundToggle}
                    onChange={() => setShowSvgBackgroundToggle(!showSvgBackgroundToggle)}
                  />
                </SettingRow>
              )}

              {/* Editor */}
              <SettingsSectionHeader>
                Editor
              </SettingsSectionHeader>

              <SettingRow label="Word Wrap">
                <ToggleSwitch
                  checked={wordWrap}
                  onChange={() => setWordWrap(!wordWrap)}
                />
              </SettingRow>

              <SettingRow
                label="Syntax Highlighting"
                tooltip="Colors Markdown syntax in the editor. This can use more resources with very large documents."
              >
                <ToggleSwitch
                  checked={syntaxHighlight}
                  onChange={() => (onSyntaxHighlightChange ?? setSyntaxHighlight)(!syntaxHighlight)}
                />
              </SettingRow>

              <SettingRow
                label="Heading Anchor Links"
                tooltip="Shows a copy-link control when you hover over headings in the preview."
              >
                <ToggleSwitch
                  checked={showHeadingAnchors}
                  onChange={() => setShowHeadingAnchors(!showHeadingAnchors)}
                />
              </SettingRow>

              <SettingRow label="Tab Size">
                <SegmentedControl
                  options={[
                    { label: '2', value: '2' },
                    { label: '4', value: '4' },
                    { label: '8', value: '8' },
                  ]}
                  value={String(tabSize)}
                  onChange={(v) => setTabSize(Number(v))}
                />
              </SettingRow>

              {/* General */}
              <SettingsSectionHeader>
                General
              </SettingsSectionHeader>

              <SettingRow
                label="Remember Scroll Position"
                tooltip="Restores the Preview panel's last position when you reopen a file."
              >
                <ToggleSwitch
                  checked={rememberScrollPosition}
                  onChange={() => setRememberScrollPosition(!rememberScrollPosition)}
                />
              </SettingRow>

              <SettingRow
                label="Start with Sidebar Open"
                tooltip="Controls whether the Explorer sidebar is open when Markd starts. You can still toggle it during a session."
              >
                <ToggleSwitch
                  checked={startWithSidebarOpen}
                  onChange={() => setStartWithSidebarOpen(!startWithSidebarOpen)}
                />
              </SettingRow>

              <SettingRow
                label="Allow Multiple Windows"
                tooltip="Allows subsequent launches of Markd to create separate windows instead of reusing the current one."
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">Restart required</span>
                  <ToggleSwitch
                    checked={multiInstance}
                    onChange={() => {
                      const next = !multiInstance;
                      setMultiInstance(next);
                      window.markd?.setSetting('multiInstance', next);
                    }}
                  />
                </div>
              </SettingRow>

              {/* Markdown component styles */}
              <SettingsSectionHeader>
                Markdown Styles
              </SettingsSectionHeader>

              <MarkdownStylePicker
                label="Code Blocks"
                tooltip="Changes fenced code blocks without affecting inline code."
                kind="code"
                options={[
                  { label: 'Default', value: 'default' },
                  { label: 'Flat', value: 'flat' },
                  { label: 'Terminal', value: 'terminal' },
                ]}
                value={codeBlockStyle}
                onChange={(value) => setCodeBlockStyle(value as CodeBlockStyle)}
              />

              <MarkdownStylePicker
                label="Inline Code"
                tooltip="Changes inline code spans without affecting fenced code blocks."
                kind="inline-code"
                options={[
                  { label: 'Default', value: 'default' },
                  { label: 'Subtle', value: 'subtle' },
                  { label: 'Outline', value: 'outline' },
                ]}
                value={inlineCodeStyle}
                onChange={(value) => setInlineCodeStyle(value as InlineCodeStyle)}
              />

              <MarkdownStylePicker
                label="Tables"
                tooltip="Changes the visual treatment of tables in the Preview panel."
                kind="table"
                options={[
                  { label: 'Default', value: 'default' },
                  { label: 'Minimal', value: 'minimal' },
                  { label: 'Banded', value: 'banded' },
                ]}
                value={tableStyle}
                onChange={(value) => setTableStyle(value as TableStyle)}
              />

              <MarkdownStylePicker
                label="Task Lists"
                tooltip="Changes the layout and checkbox treatment of task lists."
                kind="task-list"
                options={[
                  { label: 'Default', value: 'default' },
                  { label: 'Rounded', value: 'rounded' },
                  { label: 'Outline', value: 'outline' },
                ]}
                value={taskListStyle}
                onChange={(value) => setTaskListStyle(value as TaskListStyle)}
              />

              <MarkdownStylePicker
                label="Blockquotes"
                tooltip="Changes the visual emphasis used for Markdown blockquotes."
                kind="blockquote"
                options={[
                  { label: 'Default', value: 'default' },
                  { label: 'Quiet', value: 'quiet' },
                  { label: 'Card', value: 'card' },
                ]}
                value={blockquoteStyle}
                onChange={(value) => setBlockquoteStyle(value as BlockquoteStyle)}
              />

              <MarkdownStylePicker
                label="Callouts"
                tooltip="Changes note, tip, warning, and danger callout containers while retaining their semantic colors."
                kind="callout"
                options={[
                  { label: 'Default', value: 'default' },
                  { label: 'Minimal', value: 'minimal' },
                  { label: 'Solid', value: 'solid' },
                ]}
                value={calloutStyle}
                onChange={(value) => setCalloutStyle(value as CalloutStyle)}
              />

              <MarkdownStylePicker
                label="Definition Lists"
                tooltip="Changes the presentation of terms and their definitions."
                kind="definition-list"
                options={[
                  { label: 'Default', value: 'default' },
                  { label: 'Indented', value: 'indented' },
                  { label: 'Card', value: 'card' },
                ]}
                value={definitionListStyle}
                onChange={(value) => setDefinitionListStyle(value as DefinitionListStyle)}
              />

              <div className="h-4" />
            </div>
          )}

          {tab === 'shortcuts' && (
            <div className="divide-y divide-gray-700/10 dark:divide-white/5">
              <div className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                All Keyboard Shortcuts
              </div>
              {SHORTCUTS.map((sc) => (
                <div key={sc.key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[13px] text-gray-700 dark:text-gray-200">{sc.label}</span>
                  <kbd className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono font-medium text-gray-500 dark:text-gray-400 bg-gray-700/10 dark:bg-white/10 rounded-md border border-gray-200 dark:border-gray-600">
                    {sc.key}
                  </kbd>
                </div>
              ))}
              <div className="h-4" />
            </div>
          )}

          {tab === 'about' && (
            <div className="p-5 space-y-5">
              {/* App Info */}
              <div className="text-center space-y-1.5">
                <img src={markdLogo} alt="Markd" className="w-16 h-16 mx-auto" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100" style={{ fontFamily: 'Consolas, monospace' }}>
                  Markd
                </h3>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">
                  v{appVersion || '1.0.5'} — A beautiful, feature-rich desktop markdown viewer and editor
                </p>
              </div>

              {/* Author */}
              <div className="bg-gray-700/5 dark:bg-white/5 rounded-lg p-4">
                <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Author
                </div>
                <div className="flex flex-col gap-1">
                  <a
                    href="https://github.com/tlabsim"
                    onClick={(e) => { e.preventDefault(); window.markd?.openExternal('https://github.com/tlabsim'); }}
                    className="text-[13px] font-medium text-blue-500 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    github.com/tlabsim
                  </a>
                  <a
                    href="https://www.tlabsinc.com"
                    onClick={(e) => { e.preventDefault(); window.markd?.openExternal('https://www.tlabsinc.com'); }}
                    className="text-[13px] text-blue-500 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    www.tlabsinc.com
                  </a>
                </div>
              </div>

              {/* Credits */}
              <div>
                <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Credits — Open Source Packages
                </div>
                <div className="space-y-1">
                  {CREDITS.map((c) => (
                    <div key={c.name} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-gray-50 dark:hover:bg-[#1e2730] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-gray-700 dark:text-gray-200">
                          {c.url ? (
                            <a
                              href={c.url}
                              onClick={(e) => { e.preventDefault(); window.markd?.openExternal(c.url!); }}
                              className="hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer"
                            >
                              {c.name}
                            </a>
                          ) : c.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">{c.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-4" />
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
