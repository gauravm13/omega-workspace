import { getServerSession } from "next-auth/next";
import { authOptions } from "@/infrastructure/auth/authOptions";
import { prisma } from "@/infrastructure/database/prisma";
import { redirect } from "next/navigation";
import { Editor } from "@/domains/document/components/Editor";
import Link from "next/link";
import { AccessRole } from "@prisma/client";

type PageProps = { params: Promise<{ id: string }> };

export default async function DocumentPage({ params }: PageProps) {
  const { id } = await params;
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  // Zero-Trust Fetch: Get document, verify ACL, and pull Attachments simultaneously
  const document = await prisma.document.findUnique({
    where: { id: id },
    include: { 
      accessList: { where: { userId: session.user.id } },
      assets: { orderBy: { createdAt: 'desc' } } // Pull all linked attachments
    },
  });

  if (!document) {
    return <div className="p-8 text-center text-red-500 font-bold">404: Document Asset Not Found.</div>;
  }

  const isOwner = document.ownerId === session.user.id;
  const isEditor = document.accessList[0]?.role === AccessRole.EDITOR;
  const hasAccess = isOwner || document.accessList.length > 0;

  if (!hasAccess) {
    return <div className="p-8 text-center text-red-500 font-bold">UNAUTHORIZED: Zero Trust Boundary Enforced.</div>;
  }

  // Calculate Explicit Role Distinction
  const roleBadge = isOwner ? "OWNER" : (document.accessList[0]?.role || "VIEWER");

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-5xl mx-auto p-4">
        <Link href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
          &larr; Return to Workspace Catalog
        </Link>
      </div>
      <Editor 
        document={document} 
        isOwner={isOwner} 
        canEdit={isOwner || isEditor} 
        roleBadge={roleBadge} 
      />
    </div>
  );
}