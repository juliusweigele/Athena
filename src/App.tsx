/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, FileText, Link as LinkIcon, MessageSquare } from 'lucide-react';
import { Document, Annotation, DocLink } from './types';
import DocumentViewer from './components/DocumentViewer';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ documentId: number; name: string }[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  useEffect(() => {
    handleSearch();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-neutral-200 flex flex-col">
        <div className="p-4 border-b border-neutral-200">
          <h1 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            DocAnnotator
          </h1>
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-100 border-transparent rounded-lg focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
            />
            <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-2.5" />
          </form>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {searchResults.map((doc) => (
            <button
              key={doc.documentId}
              onClick={() => setSelectedDocId(doc.documentId)}
              className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-colors ${
                selectedDocId === doc.documentId
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'hover:bg-neutral-100'
              }`}
            >
              {doc.name}
            </button>
          ))}
          {searchResults.length === 0 && searchQuery && (
            <div className="text-center text-neutral-500 p-4">No results found</div>
          )}
          {searchResults.length === 0 && !searchQuery && (
            <div className="text-center text-neutral-500 p-4">Search to find documents</div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDocId ? (
          <DocumentViewer 
            documentId={selectedDocId} 
            onSelectDocument={setSelectedDocId} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-400 flex-col gap-4">
            <FileText className="w-16 h-16 opacity-20" />
            <p className="text-lg">Select a document to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
