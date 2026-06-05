"use client";

import { useState, useRef } from "react";
import { renameDocument, updateDocumentContent, shareDocument, restoreVersion, deleteDocument } from "@/domains/document/services/documentActions";
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

  // NEW: DELETE DOCUMENT LOGIC
  const handleDeleteDocument = async () => {
    if (!confirm("Are you sure you want to PERMANENTLY delete this document? This action cannot be undone.")) return;
    setSaveStatus("Deleting...");
    const res = await deleteDocument(document.id);
    if (res && !res.success) {
      alert(res.error);
      setSaveStatus("Saved");
    }
  };

  const handleImportInline = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;

    setSaveStatus("Parsing Document...");
    const formData = new FormData();
    formData.append("file", file);

    const result = await parseDocumentForImport(formData);
    if (result.success && result.html) {
      if (editorRef.current) {
        editorRef.current.innerHTML += `<br><hr><br>${result.html}`;
        await handleSave(); 
      }
    } else {
      alert(result.error || "Failed to parse imported file.");
      setSaveStatus("Saved");
    }
    e.target.value = ""; 
  };

  const handleAttachAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;

    setSaveStatus("Uploading Asset...");
    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadDocumentAttachment(document.id, formData);
    if (!result.success) alert(result.error || "Failed to attach file.");
    setSaveStatus("Saved");
    e.target.value = ""; 
  };

  const exportHTML = () => {
    const blob = new Blob([editorRef.current?.innerHTML || ""], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url; a.download = `${title}.html`; a.click();
  };
  
  const exportPDF = () => window.print();

  const ToolbarButton = ({ onClick, children, className = "" }: { onClick: () => void, children: React.ReactNode, className?: string }) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`px-3 py-1 hover:bg-gray-100 rounded border text-sm ${className}`}>
      {children}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 flex gap-6 items-start">
      
      <div className="flex-1 space-y-6">
         
        <div className="bg-white p-6 border rounded-lg shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            
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

            <div className="flex flex-col items-end gap-2 shrink-0">
              {isOwner && (
                <form onSubmit={async (e) => { e.preventDefault(); await shareDocument(document.id, shareEmail, "EDITOR"); setShareEmail(""); }} className="flex gap-2">
                  <select className="border text-sm rounded bg-gray-50 px-2"><option>Editor</option><option>Viewer</option></select>
                  <input type="email" placeholder="Tenant Email..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} required className="border px-3 py-1.5 rounded text-sm w-48" />
                  <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700">Share</button>
                </form>
              )}
              <div className="flex gap-2">
                <button onClick={exportHTML} className="text-xs text-gray-500 border px-2 py-1 rounded hover:bg-gray-50">⬇ HTML</button>
                <button onClick={exportPDF} className="text-xs text-gray-500 border px-2 py-1 rounded hover:bg-gray-50">⬇ PDF</button>
                <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-gray-500 border px-2 py-1 rounded hover:bg-gray-50">⏱ History</button>
                
                {/* NEW: DELETE BUTTON (Owner Only) */}
                {isOwner && (
                  <button onClick={handleDeleteDocument} className="text-xs font-medium text-red-600 border border-red-200 bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors">
                    🗑️ Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

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
            <div className="w-px h-6 bg-gray-300 mx-1 self-center"></div>
            
            <label className="cursor-pointer px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 text-sm font-medium transition-colors">
              + Import (.docx)
              <input type="file" className="hidden" accept=".docx,.txt,.md" onChange={handleImportInline} />
            </label>

            <label className="cursor-pointer px-3 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded border border-green-200 text-sm font-medium transition-colors">
              📎 Attach Asset
              <input type="file" className="hidden" onChange={handleAttachAsset} />
            </label>

            <div className="flex-1"></div>
            <ToolbarButton onClick={handleSave} className="bg-black text-white hover:bg-gray-800">💾 Force Save</ToolbarButton>
          </div>
        )}

        <div className="bg-gray-200 p-4 rounded-lg">
          <div 
            ref={editorRef}
            contentEditable={canEdit}
            suppressContentEditableWarning={true}
            onBlur={handleSave}
            className="min-h-[800px] max-w-[816px] mx-auto bg-white border border-gray-300 shadow-md p-12 focus:outline-none text-gray-900 editor-canvas"
            dangerouslySetInnerHTML={{ __html: initialContent }}
          ></div>
        </div>

        {document.assets?.length > 0 && (
          <div className="bg-white p-6 border rounded-lg shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Document Assets</h3>
            <div className="flex flex-wrap gap-4">
              {document.assets.map((asset: any) => (
                <a key={asset.id} href={asset.fileUrl} download={asset.fileName} className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors text-sm shadow-sm">
                  <span className="truncate max-w-[200px] font-medium">{asset.fileName}</span>
                  <span className="text-xs text-gray-400 border-l pl-2">{(asset.fileSize / 1024).toFixed(1)} KB</span>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>

      {showHistory && (
        <div className="w-80 shrink-0 bg-white border rounded-lg shadow-sm p-4 h-[calc(100vh-6rem)] overflow-y-auto sticky top-4">
          <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Version History</h3>
          <div className="space-y-3">
            {document.versions?.map((v: any) => (
              <div key={v.id} className="p-3 bg-gray-50 border rounded text-sm hover:border-blue-300 transition-colors">
                <p className="font-medium text-gray-700">{new Date(v.createdAt).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mb-2 truncate">By: {v.savedBy.email}</p>
                {canEdit && (
                  <button onClick={() => handleRestore(v.id)} className="text-xs bg-white border text-blue-600 px-2 py-1 rounded w-full hover:bg-blue-50 transition-colors">
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