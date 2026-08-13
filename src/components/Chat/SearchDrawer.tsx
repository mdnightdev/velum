import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchDrawerProps {
  showSearch: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any[];
  searchIndex: number;
  isSearching: boolean;
  onSearchSubmit: (e?: React.FormEvent) => void;
  onNavigateSearch: (direction: 'next' | 'prev') => void;
  onCloseSearch: () => void;
}

export function SearchDrawer({
  showSearch,
  searchQuery,
  setSearchQuery,
  searchResults,
  searchIndex,
  isSearching,
  onSearchSubmit,
  onNavigateSearch,
  onCloseSearch,
}: SearchDrawerProps) {
  if (!showSearch) return null;

  return (
    <div className="bg-bg-search-bar border-b border-white-5 p-3 px-4 flex flex-col md:flex-row items-center gap-3 backdrop-blur-[var(--blur-backdrop-md)] relative z-30 select-none">
      <form onSubmit={onSearchSubmit} className="flex items-center gap-2 flex-1 w-full">
        <Search className="w-4 h-4 text-text-secondary shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversation..."
          className="bg-transparent border-none text-[13px] text-white outline-none flex-1 font-sans placeholder-text-secondary"
          autoFocus
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
            }}
            className="text-text-secondary hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>
      {searchResults.length > 0 && (
        <div className="flex items-center gap-3 text-xs shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white-5 pt-2 md:pt-0">
          <span className="text-text-secondary font-mono">
            {searchIndex + 1} of {searchResults.length} matches
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNavigateSearch('prev')}
              className="p-1 px-2 rounded bg-velum-700 border border-white-10 hover:border-white-20 hover:bg-velum-600 transition text-white font-mono text-[10px] uppercase font-bold cursor-pointer"
              title="Previous match"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => onNavigateSearch('next')}
              className="p-1 px-2 rounded bg-velum-700 border border-white-10 hover:border-white-20 hover:bg-velum-600 transition text-white font-mono text-[10px] uppercase font-bold cursor-pointer"
              title="Next match"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {searchQuery && searchResults.length === 0 && !isSearching && (
        <span className="text-[11px] text-alert-error font-mono tracking-wide uppercase shrink-0">
          No matches found
        </span>
      )}
      {isSearching && (
        <span className="text-[11px] text-accent font-mono tracking-wide uppercase shrink-0 animate-pulse">
          Searching...
        </span>
      )}
      <button
        type="button"
        onClick={onCloseSearch}
        className="text-text-secondary hover:text-white p-1 ml-2 shrink-0 hidden md:block cursor-pointer"
        title="Close search"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
