import React from 'react';
import markdLogo from '../assets/markd.svg';

interface WelcomeScreenProps {
  onOpen: () => void;
  onOpenFolder: () => void;
  onNew: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpen, onOpenFolder, onNew }) => {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#222c36] select-none transition-colors">
      <div className="text-center max-w-md px-8">
        {/* Logo */}
        <div className="mb-6">
          <img src={markdLogo} alt="Markd" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-1 tracking-tight transition-colors" style={{ fontFamily: 'Consolas, system-ui, sans-serif' }}>
            Markd
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">
            Markdown Viewer &amp; Editor
          </p>
        </div>

        {/* Quick action cards — VS Code style */}
        <div className="space-y-1">
          <button
            onClick={onNew}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left group"
          >
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="flex-1">New File</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-600">Ctrl+N</span>
          </button>

          <button
            onClick={onOpen}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left group"
          >
            {/* <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg> */}
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><path d="M12 16.5v-9M8.5 11L12 7.5l3.5 3.5"/><path d="M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z"/></g></svg>
            <span className="flex-1">Open File...</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-600">Ctrl+O</span>
          </button>

          <button
            onClick={onOpenFolder}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left group"
          >
            {/* <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M9.51 5.274c-.105-.02-.23-.024-.687-.024H6.2c-.572 0-.957 0-1.253.025c-.287.023-.424.065-.514.111a1.25 1.25 0 0 0-.547.547c-.046.09-.088.227-.111.514c-.024.296-.025.68-.025 1.253v8.6c0 .572 0 .957.025 1.252c.023.288.065.425.111.515c.12.236.311.427.547.547c.09.046.227.088.514.111c.296.024.68.025 1.253.025h11.6c.572 0 .957 0 1.252-.025c.288-.023.425-.065.515-.111a1.25 1.25 0 0 0 .547-.547c.046-.09.088-.227.111-.515c.024-.295.025-.68.025-1.252v-5.6c0-.572 0-.957-.025-1.253c-.023-.287-.065-.424-.111-.514a1.25 1.25 0 0 0-.547-.547c-.09-.046-.227-.088-.515-.111c-.295-.024-.68-.025-1.252-.025h-4.123c-.394 0-.696.003-.98-.053a2.75 2.75 0 0 1-1.631-1.008c-.498-.64-.641-1.731-1.557-1.915M8.886 3.75c.364 0 .648 0 .917.053a2.75 2.75 0 0 1 1.63 1.008c.179.23.31.5.487.854c.244.488.479.942 1.07 1.06c.104.022.228.025.686.025h4.153c.535 0 .98 0 1.345.03c.38.03.736.098 1.073.27a2.75 2.75 0 0 1 1.202 1.202c.172.337.24.693.27 1.073c.03.365.03.81.03 1.345v5.66c0 .535 0 .98-.03 1.345c-.03.38-.098.736-.27 1.073a2.75 2.75 0 0 1-1.201 1.202c-.338.172-.694.24-1.074.27c-.365.03-.81.03-1.344.03H6.17c-.535 0-.98 0-1.345-.03c-.38-.03-.736-.098-1.073-.27a2.75 2.75 0 0 1-1.202-1.2c-.172-.338-.24-.694-.27-1.074c-.03-.365-.03-.81-.03-1.345V7.67c0-.535 0-.98.03-1.345c.03-.38.098-.736.27-1.073A2.75 2.75 0 0 1 3.752 4.05c.337-.172.693-.24 1.073-.27c.365-.03.81-.03 1.345-.03z" clipRule="evenodd" />
            </svg> */}
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.661 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7m8.661 0a2 2 0 0 1-1.322-.5l-2.272-2A2 2 0 0 0 6.745 4H5a2 2 0 0 0-2 2v1m8.661 0H3"/></svg>
            <span className="flex-1">Open Folder...</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-600">Ctrl+Shift+O</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-10 text-[11px] text-gray-400 dark:text-gray-600 transition-colors">
          <p>Open a folder to browse and edit markdown files</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
