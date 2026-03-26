import React, { useEffect, useState, useRef } from 'react';
import { Document, Annotation, DocLink, Comment } from '../types';
import { MessageSquare, Link as LinkIcon, Plus, Sparkles, X } from 'lucide-react';

const CommentThread = ({ comments, parentId, onReply }: { comments: Comment[], parentId: number | null, onReply: (id: number) => void }) => {
  const children = comments.filter(c => c.answerId === parentId || (parentId === null && c.answerId === -1));
  if (children.length === 0) return null;
  return (
    <div className={`flex flex-col gap-3 ${parentId !== null && parentId !== -1 ? 'mt-3 pl-4 border-l-2 border-neutral-200' : ''}`}>
      {children.map(c => (
        <div key={c.commentId} className="flex flex-col">
          <div className={`p-3 rounded-lg shadow-sm border ${parentId === null || parentId === -1 ? 'bg-indigo-50/50 border-indigo-100' : 'bg-white border-neutral-200'}`}>
            {(parentId === null || parentId === -1) && <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1 block">Diskussion</span>}
            <p className="text-sm text-neutral-800">{c.content}</p>
            <button 
              onClick={() => onReply(c.commentId)}
              className="text-xs text-neutral-500 hover:text-indigo-600 mt-2 font-medium flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3" /> Antworten
            </button>
          </div>
          <CommentThread comments={comments} parentId={c.commentId} onReply={onReply} />
        </div>
      ))}
    </div>
  );
};

export default function DocumentViewer({ documentId, onSelectDocument }: { documentId: number, onSelectDocument: (id: number) => void }) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [links, setLinks] = useState<DocLink[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [showAnnoModal, setShowAnnoModal] = useState(false);
  const [annoComment, setAnnoComment] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<{ documentId: number; name: string }[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<{ type: 'anno' | 'link', id: number } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleLinkSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(linkSearchQuery)}`);
      const data = await res.json();
      setLinkSearchResults(data.filter((d: any) => d.documentId !== documentId));
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleCreateLink = async () => {
    if (!selection || !selectedLinkId) return;
    
    await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        linkId: selectedLinkId,
        startInt: selection.start,
        endInt: selection.end,
        startlink: 0, // Simplified for demo
        endlink: 0    // Simplified for demo
      })
    });
    
    setShowLinkModal(false);
    setSelectedLinkId(null);
    setLinkSearchQuery('');
    setLinkSearchResults([]);
    setSelection(null);
    fetchLinks();
  };

  useEffect(() => {
    fetchDoc();
    fetchAnnotations();
    fetchLinks();
    setSelection(null);
    setActiveHighlight(null);
  }, [documentId]);

  const fetchDoc = async () => {
    const res = await fetch(`/api/documents/${documentId}`);
    if (res.ok) setDoc(await res.json());
  };

  const fetchAnnotations = async () => {
    const res = await fetch(`/api/documents/${documentId}/annotations`);
    if (res.ok) setAnnotations(await res.json());
  };

  const fetchLinks = async () => {
    const res = await fetch(`/api/documents/${documentId}/links`);
    if (res.ok) setLinks(await res.json());
  };

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) {
      setSelection(null);
      return;
    }

    // Calculate absolute start and end positions
    // This is a simplified approach. In a real app, we'd need robust text node traversal.
    const range = sel.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(contentRef.current);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + range.toString().length;

    setSelection({ start, end });
  };

  const handleCreateAnnotation = async () => {
    if (!selection) return;
    
    await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        startInt: selection.start,
        endInt: selection.end,
        comment: annoComment
      })
    });
    
    setShowAnnoModal(false);
    setAnnoComment('');
    setSelection(null);
    fetchAnnotations();
  };

  const handleAddReply = async (annotationId: number) => {
    if (!replyText.trim()) return;
    
    let targetAnswerId = replyingToId;
    if (!targetAnswerId) {
      const anno = annotations.find(a => a.annotationId === annotationId);
      const starter = anno?.comments?.find(c => c.answerId === null || c.answerId === -1);
      targetAnswerId = starter ? starter.commentId : null;
    }
    
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        annotationId,
        answerId: targetAnswerId,
        content: replyText
      })
    });
    
    setReplyText('');
    setReplyingToId(null);
    fetchAnnotations();
  };

  const generateSummary = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/summary`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDoc(prev => prev ? { ...prev, summary: data.summary } : null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!doc) return <div className="p-8 text-neutral-500">Loading document...</div>;

  const renderContent = () => {
    const boundaries = new Set<number>();
    boundaries.add(0);
    boundaries.add(doc.content.length);
    
    const highlights = [
      ...annotations.map(a => ({ ...a, type: 'anno' as const, id: a.annotationId })),
      ...links.map(l => ({ ...l, type: 'link' as const, id: l.docdocId }))
    ];

    highlights.forEach(h => {
      boundaries.add(h.startInt);
      boundaries.add(h.endInt);
    });

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const start = sortedBoundaries[i];
      const end = sortedBoundaries[i + 1];
      const text = doc.content.substring(start, end);
      
      if (!text) continue;

      const activeHighlightsForSegment = highlights.filter(h => h.startInt <= start && h.endInt >= end);

      if (activeHighlightsForSegment.length === 0) {
        elements.push(<span key={`text-${start}-${end}`}>{text}</span>);
      } else {
        const hasAnno = activeHighlightsForSegment.some(h => h.type === 'anno');
        const hasLink = activeHighlightsForSegment.some(h => h.type === 'link');
        const isSelected = activeHighlightsForSegment.some(h => activeHighlight?.type === h.type && activeHighlight?.id === h.id);

        let bgColorClass = 'bg-neutral-200';
        if (isSelected) {
          bgColorClass = hasAnno ? 'bg-yellow-400' : 'bg-blue-400';
        } else if (hasAnno && hasLink) {
          bgColorClass = 'bg-gradient-to-r from-yellow-200 to-blue-200 hover:from-yellow-300 hover:to-blue-300';
        } else if (hasAnno) {
          bgColorClass = 'bg-yellow-200 hover:bg-yellow-300';
        } else if (hasLink) {
          bgColorClass = 'bg-blue-200 hover:bg-blue-300';
        }

        const handleClick = () => {
          if (activeHighlightsForSegment.length === 1) {
            setActiveHighlight({ type: activeHighlightsForSegment[0].type, id: activeHighlightsForSegment[0].id });
          } else {
            const currentIndex = activeHighlightsForSegment.findIndex(h => h.type === activeHighlight?.type && h.id === activeHighlight?.id);
            const nextIndex = (currentIndex + 1) % activeHighlightsForSegment.length;
            setActiveHighlight({ type: activeHighlightsForSegment[nextIndex].type, id: activeHighlightsForSegment[nextIndex].id });
          }
        };

        elements.push(
          <mark 
            key={`mark-${start}-${end}`} 
            onClick={handleClick}
            className={`px-1 rounded cursor-pointer transition-all ${bgColorClass} ${activeHighlightsForSegment.length > 1 ? 'border-b-2 border-indigo-500' : ''}`}
            title={activeHighlightsForSegment.length > 1 ? 'Mehrere Markierungen (Klicken zum Durchschalten)' : ''}
          >
            {text}
          </mark>
        );
      }
    }
    
    return elements;
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Document Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-white relative">
        <h2 className="text-3xl font-serif font-bold mb-8 text-neutral-900">{doc.name}</h2>
        
        <div className="mb-8 bg-indigo-50 p-6 rounded-xl border border-indigo-100">
          <h3 className="text-lg font-semibold text-indigo-900 mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5"/> KI Zusammenfassung
          </h3>
          {doc.summary ? (
            <p className="text-indigo-800 leading-relaxed">{doc.summary}</p>
          ) : (
            <button 
              onClick={generateSummary} 
              disabled={isGenerating} 
              className="px-4 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {isGenerating ? 'Generiere...' : 'Zusammenfassung generieren'}
            </button>
          )}
        </div>
        
        {selection && (
          <div className="sticky top-4 z-10 bg-neutral-900 text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-4 mx-auto w-max mb-4 animate-in fade-in slide-in-from-top-4">
            <span className="text-sm font-medium">Selected {selection.end - selection.start} chars</span>
            <div className="h-4 w-px bg-neutral-700" />
            <button 
              onClick={() => setShowAnnoModal(true)}
              className="flex items-center gap-2 hover:text-yellow-300 transition-colors text-sm font-medium"
            >
              <MessageSquare className="w-4 h-4" /> Diskussion
            </button>
            <button 
              className="flex items-center gap-2 hover:text-blue-300 transition-colors text-sm font-medium"
              onClick={() => setShowLinkModal(true)}
            >
              <LinkIcon className="w-4 h-4" /> Verlinken
            </button>
          </div>
        )}

        <div 
          ref={contentRef}
          onMouseUp={handleMouseUp}
          className="prose prose-neutral max-w-3xl font-serif text-lg leading-relaxed whitespace-pre-wrap selection:bg-indigo-200 selection:text-indigo-900"
        >
          {renderContent()}
        </div>
      </div>

      {/* Right Sidebar: Annotations & Links */}
      <div className="w-80 bg-neutral-50 border-l border-neutral-200 overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-neutral-200 bg-white sticky top-0 z-10">
          <h3 className="font-semibold text-neutral-900">Diskussion & Details</h3>
        </div>
        
        {activeHighlight ? (
          <div className="p-4 flex flex-col gap-4 h-full">
            <button 
              onClick={() => setActiveHighlight(null)}
              className="text-sm text-neutral-500 hover:text-neutral-900 flex items-center gap-1 mb-2"
            >
              &larr; Zurück zur Übersicht
            </button>
            
            {activeHighlight.type === 'anno' && (() => {
              const anno = annotations.find(a => a.annotationId === activeHighlight.id);
              if (!anno) return null;
              return (
                <div className="flex flex-col h-full">
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4">
                    <p className="text-sm italic text-yellow-900">"{doc.content.substring(anno.startInt, anno.endInt)}"</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4">
                    <h4 className="font-semibold text-sm text-neutral-700 uppercase tracking-wider">Kommentare</h4>
                    {(!anno.comments || anno.comments.length === 0) ? (
                      <p className="text-sm text-neutral-500 italic">Noch keine Kommentare.</p>
                    ) : (
                      <CommentThread comments={anno.comments} parentId={null} onReply={(id) => setReplyingToId(id)} />
                    )}
                  </div>
                  
                  <div className="mt-auto bg-white p-3 rounded-xl border border-neutral-200 shadow-sm">
                    {replyingToId && (
                      <div className="flex items-center justify-between bg-indigo-50 px-3 py-2 rounded-md mb-2">
                        <span className="text-xs text-indigo-700 font-medium">
                          Antwort auf Kommentar #{replyingToId}
                        </span>
                        <button 
                          onClick={() => setReplyingToId(null)}
                          className="text-indigo-400 hover:text-indigo-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder={replyingToId ? "Antwort schreiben..." : "Neuen Kommentar hinzufügen..."}
                      className="w-full p-2 border border-neutral-200 rounded-lg text-sm mb-2 resize-none h-20 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <button 
                      onClick={() => handleAddReply(anno.annotationId)}
                      disabled={!replyText.trim()}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      Senden
                    </button>
                  </div>
                </div>
              );
            })()}

            {activeHighlight.type === 'link' && (() => {
              const link = links.find(l => l.docdocId === activeHighlight.id);
              if (!link) return null;
              return (
                <div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-4">
                    <p className="text-sm italic text-blue-900">"{doc.content.substring(link.startInt, link.endInt)}"</p>
                  </div>
                  <h4 className="font-semibold text-sm text-neutral-700 uppercase tracking-wider mb-2">Verlinktes Dokument</h4>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-neutral-100">
                    <p className="font-medium text-blue-700 mb-2">{link.linkName}</p>
                    <button 
                      onClick={() => onSelectDocument(link.linkId)}
                      className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-200 transition-colors w-full"
                    >
                      Dokument öffnen
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="p-8 text-center text-neutral-400 flex flex-col items-center justify-center h-full">
            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
            <p>Klicke auf eine Markierung im Text, um die Kommentare oder Verlinkungen zu sehen.</p>
          </div>
        )}
      </div>

      {/* Annotation Modal */}
      {showAnnoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                Diskussion starten
              </h3>
              <div className="bg-neutral-50 p-3 rounded-lg text-sm italic text-neutral-600 mb-4 border border-neutral-200">
                "{doc.content.substring(selection!.start, selection!.end)}"
              </div>
              <textarea
                value={annoComment}
                onChange={e => setAnnoComment(e.target.value)}
                placeholder="Stelle eine Frage oder teile deine Gedanken zu diesem Textabschnitt..."
                className="w-full h-32 p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                autoFocus
              />
            </div>
            <div className="bg-neutral-50 px-6 py-4 flex justify-end gap-3 border-t border-neutral-200">
              <button 
                onClick={() => {
                  setShowAnnoModal(false);
                  setAnnoComment('');
                  setSelection(null);
                }}
                className="px-4 py-2 text-neutral-600 font-medium hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button 
                onClick={handleCreateAnnotation}
                disabled={!annoComment.trim()}
                className="px-4 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                Posten
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Create Link</h3>
              <div className="bg-neutral-50 p-3 rounded-lg text-sm italic text-neutral-600 mb-4 border border-neutral-200">
                "{doc.content.substring(selection!.start, selection!.end)}"
              </div>
              <form onSubmit={handleLinkSearch} className="mb-4">
                <input
                  type="text"
                  value={linkSearchQuery}
                  onChange={(e) => setLinkSearchQuery(e.target.value)}
                  placeholder="Search target document..."
                  className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  autoFocus
                />
              </form>
              <div className="max-h-48 overflow-y-auto border border-neutral-200 rounded-lg">
                {linkSearchResults.map(result => (
                  <button
                    key={result.documentId}
                    onClick={() => setSelectedLinkId(result.documentId)}
                    className={`w-full text-left px-4 py-2 hover:bg-neutral-100 ${selectedLinkId === result.documentId ? 'bg-indigo-50 text-indigo-700 font-medium' : ''}`}
                  >
                    {result.name}
                  </button>
                ))}
                {linkSearchResults.length === 0 && linkSearchQuery && (
                  <div className="p-4 text-center text-neutral-500 text-sm">No documents found</div>
                )}
              </div>
            </div>
            <div className="bg-neutral-50 px-6 py-4 flex justify-end gap-3 border-t border-neutral-200">
              <button 
                onClick={() => {
                  setShowLinkModal(false);
                  setSelectedLinkId(null);
                  setLinkSearchQuery('');
                  setLinkSearchResults([]);
                }}
                className="px-4 py-2 text-neutral-600 font-medium hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateLink}
                disabled={!selectedLinkId}
                className="px-4 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
