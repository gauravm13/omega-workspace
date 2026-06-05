"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/infrastructure/auth/authOptions";
import { prisma } from "@/infrastructure/database/prisma";
import mammoth from "mammoth";
import { Buffer } from "node:buffer";

// ==========================================
// 1. CREATE NEW DOCUMENT FROM FILE
// ==========================================
export async function uploadDocumentAsset(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "UNAUTHENTICATED: Session invalid." };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file payload detected." };

  const isText = file.name.endsWith(".txt") || file.name.endsWith(".md");
  const isDocx = file.name.endsWith(".docx");

  if (!isText && !isDocx) return { success: false, error: "Strict Policy: Only .txt, .md, and .docx files." };

  try {
    let formattedContent = "";
    if (isDocx) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.convertToHtml({ buffer });
      formattedContent = result.value;
    } else {
      const textContent = await file.text();
      formattedContent = textContent.split('\n').map(line => `<p>${line}</p>`).join('');
    }

    const document = await prisma.document.create({
      data: {
        title: file.name.replace(/\.[^/.]+$/, ""),
        ownerId: session.user.id,
        content: formattedContent || "<p><br></p>",
      },
    });

    revalidatePath("/dashboard");
    return { success: true, data: document };
  } catch (error) {
    return { success: false, error: "Failed to process file stream." };
  }
}

// ==========================================
// 2. PARSE FILE FOR IN-DRAFT IMPORT
// ==========================================
export async function parseDocumentForImport(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "UNAUTHENTICATED" };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file found." };

  const isText = file.name.endsWith(".txt") || file.name.endsWith(".md");
  const isDocx = file.name.endsWith(".docx");

  if (!isText && !isDocx) return { success: false, error: "Unsupported file type. Use .docx, .txt, .md" };

  try {
    let html = "";
    if (isDocx) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.convertToHtml({ buffer });
      html = result.value;
    } else {
      const textContent = await file.text();
      html = textContent.split('\n').map(line => `<p>${line}</p>`).join('');
    }
    return { success: true, html };
  } catch (e) {
    return { success: false, error: "Parse execution failed." };
  }
}

// ==========================================
// 3. UPLOAD DOCUMENT ATTACHMENT
// ==========================================
export async function uploadDocumentAttachment(documentId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "UNAUTHENTICATED" };
  
  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file attached." };

  // Hard limit: 2MB for Base64 Data URI storage to protect the Postgres heap
  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: "File too large. Enterprise limit is 2MB for attachments." };
  }

  try {
    // 1. Verify Access Control (Must be Owner or Editor)
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { accessList: { where: { userId: session.user.id } } }
    });
    
    if (!doc) return { success: false, error: "Document not found." };
    const isOwner = doc.ownerId === session.user.id;
    const isEditor = doc.accessList[0]?.role === "EDITOR";
    
    if (!isOwner && !isEditor) return { success: false, error: "UNAUTHORIZED: Write access denied." };

    // 2. Convert to Base64 Data URI for pure database portability
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUri = `data:${file.type || 'application/octet-stream'};base64,${base64}`;

    // 3. Commit to Assets Table
    await prisma.fileAsset.create({
      data: {
        fileName: file.name,
        fileType: file.type || "unknown",
        fileSize: file.size,
        fileUrl: dataUri,
        documentId: documentId
      }
    });

    revalidatePath(`/document/${documentId}`);
    return { success: true };
  } catch(e) {
    console.error(e);
    return { success: false, error: "Failed to link attachment to document." };
  }
}