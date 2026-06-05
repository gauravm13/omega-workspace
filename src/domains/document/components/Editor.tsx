"use client";

import { useState, useRef } from "react";
import { renameDocument, updateDocumentContent, shareDocument, restoreVersion } from "@/domains/document/services/documentActions";
import { parseDocumentForImport, uploadDocumentAttachment } from "@/domains/storage/services/uploadActions";

export function Editor({ document, isOwner, canEdit, roleBadge }: { document: any; isOwner: boolean; canEdit: boolean; roleBadge: string }) {
  const [title, setTitle] = useState(document.title);
  const [shareEmail, setShareEmail] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [showHistory, setShowHistory] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const initialContent = document.content?.startsWith('{') ? "<p><br></p>" : document.content || "<p><br></p>";

  const handleFormat = (command: string, value?: string) => {
    if (!canEdit) return;
    window.document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaveStatus("Saving snapshot...");
    const html = editorRef.current?.innerHTML || "";
    await updateDocumentContent(document.id, html);
    setSaveStatus("Saved");
  };

  const handleRestore = async (versionId: string) => {
    if (!confirm("Restore this version? Unsaved changes will be lost.")) return;
    setSaveStatus("Restoring...");
    await restoreVersion(document.id, versionId);
    setShowHistory(false);
  };

  // EXPORT UTILITIES
  const exportHTML = () => {
    const blob = new Blob([editorRef.current?.innerHTML || ""], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url; a.download = `${title}.html`; a.click();
  };
  const exportPDF = () => window.print(); // Native browser PDF print is the most robust stateless approach

  const ToolbarButton = ({ onClick, children, className = "" }: { onClick: () => void, children: React.ReactNode, className?: string }) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`px-3 py-1 hover:bg-gray-100 rounded border text-sm ${className}`}>
      {children}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 flex gap-6 items-start">
      
      {/* MAIN EDITOR COLUMN */}
      <div className="flex-1 space-y-6">
        
        {/* FIX: Re-architected Header to prevent squishing */}
        <div className="bg-white p-6 border rounded-lg shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            
            {/* Title & Badge Area */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={(e) => renameDocument(document.id, e.target.value)}
                  disabled={!canEdit}
                  className="text-3xl font-bold bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-gray-300 w-full truncate"
                />
                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white rounded shrink-0 ${isOwner ? 'bg-blue-600' : (canEdit ? 'bg-orange-500' : 'bg-gray-500')}`}>
                  {roleBadge}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">Status: {saveStatus} {!canEdit && "(Read Only)"}</p>
            </div>

            {/* Actions Area (Share & Exports) */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              {isOwner && (
                <form onSubmit={async (e) => { e.preventDefault(); await shareDocument(document.id, shareEmail, "EDITOR"); setShareEmail(""); }} className="flex gap-2">
                  <select className="border text-sm rounded bg-gray-50 px-2"><option>Editor</option><option>Viewer</option></select>
                  <input type="email" placeholder="Tenant Email..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} required className="border px-3 py-1.5 rounded text-sm w-48" />
                  <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Share</button>
                </form>
              )}
              <div className="flex gap-2">
                <button onClick={exportHTML} className="text-xs text-gray-500 border px-2 py-1 rounded hover:bg-gray-50">↓ HTML</button>
                <button onClick={exportPDF} className="text-xs text-gray-500 border px-2 py-1 rounded hover:bg-gray-50">🖨️ PDF</button>
                <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-gray-500 border px-2 py-1 rounded hover:bg-gray-50">🕒 History</button>
              </div>
            </div>
          </div>
        </div>

        {/* TOOLBAR */}
        {canEdit && (
          <div className="flex flex-wrap gap-2 bg-white p-2 border rounded-md shadow-sm sticky top-4 z-10">
            <ToolbarButton onClick={() => handleFormat("bold")} className="font-bold">B</ToolbarButton>
            <ToolbarButton onClick={() => handleFormat("italic")} className="italic">I</ToolbarButton>
            <ToolbarButton onClick={() => handleFormat("underline")} className="underline">U</ToolbarButton>
            <div className="w-px h-6 bg-gray-300 mx-1 self-center"></div>
            <ToolbarButton onClick={() => handleFormat("formatBlock", "H1")} className="font-bold">H1</ToolbarButton>
            <ToolbarButton onClick={() => handleFormat("formatBlock", "H2")} className="font-bold">H2</ToolbarButton>
            <div className="w-px h-6 bg-gray-300 mx-1 self-center"></div>
            <ToolbarButton onClick={() => handleFormat("insertUnorderedList")}>• List</ToolbarButton>
            <ToolbarButton onClick={() => handleFormat("insertOrderedList")}>1. List</ToolbarButton>
            <div className="flex-1"></div>
            <ToolbarButton onClick={handleSave} className="bg-black text-white hover:bg-gray-800">💾 Force Save</ToolbarButton>
          </div>
        )}

        {/* PAPER SURFACE */}
        <div className="bg-gray-200 p-4 rounded-lg">
          {/* Editable Surface Container Element */}
<div 
  ref={editorRef}
  contentEditable={canEdit}
  suppressContentEditableWarning={true}
  onBlur={handleSave}
  className="min-h-[800px] max-w-[816px] mx-auto bg-white border border-gray-300 shadow-md p-12 focus:outline-none text-gray-900 editor-canvas"
  dangerouslySetInnerHTML={{ __html: initialContent }}
/>
        </div>
      </div>

      {/* VERSION HISTORY SIDEBAR */}
      {showHistory && (
        <div className="w-80 shrink-0 bg-white border rounded-lg shadow-sm p-4 h-[calc(100vh-6rem)] overflow-y-auto sticky top-4">
          <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Version History</h3>
          <div className="space-y-3">
            {document.versions?.map((v: any) => (
              <div key={v.id} className="p-3 bg-gray-50 border rounded text-sm hover:border-blue-300 transition-colors">
                <p className="font-medium text-gray-700">{new Date(v.createdAt).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mb-2 truncate">By: {v.savedBy.email}</p>
                {canEdit && (
                  <button onClick={() => handleRestore(v.id)} className="text-xs bg-white border text-blue-600 px-2 py-1 rounded w-full hover:bg-blue-50">
                    Restore This Version
                  </button>
                )}
              </div>
            ))}
            {document.versions?.length === 0 && <p className="text-sm text-gray-400">No saves recorded yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}