import React, { useState, useEffect } from 'react';
import { useStore, FONT_OPTIONS } from '../store';
import { PALETTE_OPTIONS } from '../palettes';
import { ThemeMode } from '../types';
import markdLogo from '../assets/markd.svg';

type Tab = 'settings' | 'shortcuts' | 'about';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
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
    className={`relative inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
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

// ----- Settings row -----
const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/10 dark:border-white/5">
    <span className="text-[13px] text-gray-700 dark:text-gray-200">{label}</span>
    {children}
  </div>
);

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
      className="flex border-b border-gray-700/10 dark:border-white/5 bg-gray-50 dark:bg-[#1a222b]"
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
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose, initialTab }) => {
  const [tab, setTab] = useState<Tab>(initialTab || 'settings');
  const [multiInstance, setMultiInstance] = useState(false);

  // Reset tab when modal opens
  useEffect(() => {
    if (open) setTab(initialTab || 'settings');
  }, [open, initialTab]);

  // Load multi-instance preference from main process on mount
  useEffect(() => {
    window.markd?.getSetting('multiInstance').then((v: unknown) => {
      if (typeof v === 'boolean') setMultiInstance(v);
    });
  }, [open]);

  const {
    theme,
    setTheme,
    fontFamily,
    setFontFamily,
    zoomLevel,
    setZoomLevel,
    previewPalette,
    setPreviewPalette,
    wordWrap,
    setWordWrap,
    tabSize,
    setTabSize,
    syntaxHighlight,
    setSyntaxHighlight,
    autoSave,
    setAutoSave,
    rememberScrollPosition,
    setRememberScrollPosition,
    matchToolbarPalette,
    setMatchToolbarPalette,
    showHeadingAnchors,
    setShowHeadingAnchors,
  } = useStore();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="relative w-[520px] max-w-[92vw] max-h-[85vh] bg-white dark:bg-[#252f3b] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        style={matchToolbarPalette ? { backgroundColor: 'var(--pal-panel-bg)', borderColor: 'var(--pal-border)' } : undefined}
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
          {tab === 'settings' && (
            <div className="divide-y divide-gray-700/10 dark:divide-white/5">
              {/* Appearance */}
              <div className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Appearance
              </div>

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

              <SettingRow label="Preview Palette">
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

              <SettingRow label="Titlebar & Panels Match Palette">
                <ToggleSwitch
                  checked={matchToolbarPalette}
                  onChange={() => setMatchToolbarPalette(!matchToolbarPalette)}
                />
              </SettingRow>

              {/* Editor */}
              <div className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Editor
              </div>

              <SettingRow label="Word Wrap">
                <ToggleSwitch
                  checked={wordWrap}
                  onChange={() => setWordWrap(!wordWrap)}
                />
              </SettingRow>

              <SettingRow label="Syntax Highlighting">
                <ToggleSwitch
                  checked={syntaxHighlight}
                  onChange={() => setSyntaxHighlight(!syntaxHighlight)}
                />
              </SettingRow>

              <SettingRow label="Heading Anchor Links">
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
              <div className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                General
              </div>

              <SettingRow label="Auto Save">
                <ToggleSwitch
                  checked={autoSave}
                  onChange={() => setAutoSave(!autoSave)}
                />
              </SettingRow>

              <SettingRow label="Remember Scroll Position">
                <ToggleSwitch
                  checked={rememberScrollPosition}
                  onChange={() => setRememberScrollPosition(!rememberScrollPosition)}
                />
              </SettingRow>

              <SettingRow label="Start with Sidebar Open">
                <ToggleSwitch
                  checked={useStore.getState().isSidebarOpen}
                  onChange={() => useStore.getState().toggleSidebar()}
                />
              </SettingRow>

              <SettingRow label="Allow Multiple Windows">
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
                  v1.0.0 — A beautiful, feature-rich desktop markdown viewer and editor
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
  );
};

export default SettingsModal;
