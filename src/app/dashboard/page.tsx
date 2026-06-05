import { getServerSession } from "next-auth/next";
import { authOptions } from "@/infrastructure/auth/authOptions";
import { redirect } from "next/navigation";
import { getDocumentCatalog, createDocument } from "@/domains/document/services/documentActions";
import { uploadDocumentAsset } from "@/domains/storage/services/uploadActions";
import { SignOutButton } from "@/domains/identity/components/SignOutButton"; // <-- Imported Button
import Link from "next/link";

interface OwnedDocumentSummary {
  id: string;
  title: string;
  updatedAt: Date | string;
}

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  const catalogResponse = await getDocumentCatalog();
  const catalog = catalogResponse.success ? catalogResponse.data : { owned: [], shared: [] };

  const handleUploadForm = async (formData: FormData): Promise<void> => {
    "use server";
    const result = await uploadDocumentAsset(formData);
    if (!result.success) console.error(`[DASHBOARD_UPLOAD_MUTATION_FAILURE]: ${result.error}`);
  };

  const handleCreateForm = async (): Promise<void> => {
    "use server";
    await createDocument("Untitled Document");
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12">
      <header className="flex justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Omega Workspace</h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-gray-500">Authenticated as: {session.user.email}</p>
            <SignOutButton /> {/* <-- Added Sign Out Button */}
          </div>
        </div>
        <div className="flex gap-4">
          <form action={handleUploadForm} className="flex items-center gap-2 bg-white border px-3 py-2 rounded-md shadow-sm">
            <input 
              type="file" 
              name="file" 
              accept=".txt,.md,.docx" 
              required 
              className="text-sm text-gray-600 file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" 
            />
            <button type="submit" className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Upload (.docx/.txt)
            </button>
          </form>
          
          <form action={handleCreateForm}>
            <button type="submit" className="bg-black text-white px-5 py-3 rounded-md font-medium hover:bg-gray-800 transition-colors">
              + New Document
            </button>
          </form>
        </div>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">My Owned Assets</h2>
        {catalog?.owned.length === 0 ? (
          <p className="text-gray-400 text-sm">No documents found. Initialize a new asset.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(catalog?.owned as OwnedDocumentSummary[]).map((doc: OwnedDocumentSummary) => (
              <Link href={`/document/${doc.id}`} key={doc.id} className="block p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-lg truncate">{doc.title}</h3>
                <p className="text-xs text-gray-400 mt-2">Last updated: {new Date(doc.updatedAt).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Shared With Me</h2>
        {catalog?.shared.length === 0 ? (
          <p className="text-gray-400 text-sm">No active ACL grants.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {catalog?.shared.map((doc: any) => (
              <Link href={`/document/${doc.id}`} key={doc.id} className="block p-6 bg-white border border-blue-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-lg truncate">{doc.title}</h3>
                  <span className="text-[10px] uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-1 rounded">{doc.userRole}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Owner: {doc.owner.email}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}