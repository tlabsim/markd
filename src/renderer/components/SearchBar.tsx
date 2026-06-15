import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useStore } from '../store';

const SearchBar: React.FC = () => {
  const { fileContent, setSearchQuery, searchQuery, isSearchOpen, setSearchOpen } = useStore();
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  const performSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    const matches = fileContent.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    setMatchCount(matches?.length || 0);
    setCurrentMatch(matches?.length ? 1 : 0);
  }, [fileContent, setSearchQuery]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    performSearch(e.target.value);
  }, [performSearch]);

  const navigateMatch = useCallback((direction: 'prev' | 'next') => {
    if (matchCount === 0) return;
    if (direction === 'next') {
      setCurrentMatch((prev) => (prev % matchCount) + 1);
    } else {
      setCurrentMatch((prev) => (prev - 2 + matchCount) % matchCount + 1);
    }
  }, [matchCount]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      setSearchQuery('');
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        navigateMatch('prev');
      } else {
        navigateMatch('next');
      }
    }
  }, [navigateMatch, setSearchOpen, setSearchQuery]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search in document..."
        className="input flex-1 py-1 text-xs"
      />
      {searchQuery && (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {matchCount > 0 ? `${currentMatch}/${matchCount}` : 'No results'}
        </span>
      )}
      <button
        className="btn-icon p-1"
        onClick={() => navigateMatch('prev')}
        disabled={matchCount === 0}
        title="Previous match (Shift+Enter)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        className="btn-icon p-1"
        onClick={() => navigateMatch('next')}
        disabled={matchCount === 0}
        title="Next match (Enter)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <button
        className="btn-icon p-1"
        onClick={() => {
          setSearchOpen(false);
          setSearchQuery('');
        }}
        title="Close (Esc)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default SearchBar;
