"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation"; // Added import
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/infrastructure/auth/authOptions";
import { prisma } from "@/infrastructure/database/prisma";
import { AccessRole } from "@prisma/client";

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  return session.user.id;
}

export async function createDocument(title: string = "Untitled Document") {
  const userId = await getAuthenticatedUser();
  try {
    const document = await prisma.document.create({
      data: { title, ownerId: userId, content: "<p><br></p>" },
    });
    revalidatePath("/dashboard");
    return { success: true, data: document };
  } catch (error) {
    return { success: false, error: "Failed to initialize document asset." };
  }
}

export async function renameDocument(documentId: string, newTitle: string) {
  const userId = await getAuthenticatedUser();
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { accessList: { where: { userId } } },
    });
    if (!document) return { success: false, error: "Document not found." };
    const isOwner = document.ownerId === userId;
    const isEditor = document.accessList[0]?.role === AccessRole.EDITOR;

    if (!isOwner && !isEditor) return { success: false, error: "UNAUTHORIZED." };

    const updatedDoc = await prisma.document.update({
      where: { id: documentId },
      data: { title: newTitle },
    });
    revalidatePath(`/document/${documentId}`);
    return { success: true, data: updatedDoc };
  } catch (error) {
    return { success: false, error: "Failed to modify document identity." };
  }
}

export async function updateDocumentContent(documentId: string, richTextContent: string) {
  const userId = await getAuthenticatedUser();
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { accessList: { where: { userId } } },
    });
    if (!document) return { success: false, error: "Document not found." };
    const isOwner = document.ownerId === userId;
    const isEditor = document.accessList[0]?.role === AccessRole.EDITOR;

    if (!isOwner && !isEditor) return { success: false, error: "UNAUTHORIZED." };

    const updatedDoc = await prisma.$transaction([
      prisma.document.update({
        where: { id: documentId },
        data: { content: richTextContent },
      }),
      prisma.documentVersion.create({
        data: { documentId, content: richTextContent, savedById: userId }
      })
    ]);

    revalidatePath(`/document/${documentId}`);
    return { success: true, data: updatedDoc[0] };
  } catch (error) {
    return { success: false, error: "Failed to save serialized state." };
  }
}

export async function restoreVersion(documentId: string, versionId: string) {
  const userId = await getAuthenticatedUser();
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { accessList: { where: { userId } } },
    });
    const isOwner = document?.ownerId === userId;
    const isEditor = document?.accessList[0]?.role === AccessRole.EDITOR;
    if (!isOwner && !isEditor) return { success: false, error: "UNAUTHORIZED." };

    const version = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    if (!version) return { success: false, error: "Version not found." };

    await prisma.document.update({
      where: { id: documentId },
      data: { content: version.content },
    });

    revalidatePath(`/document/${documentId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to restore version." };
  }
}

export async function shareDocument(documentId: string, targetEmail: string, role: AccessRole) {
  const userId = await getAuthenticatedUser();
  try {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.ownerId !== userId) return { success: false, error: "UNAUTHORIZED." };

    let targetUser = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (!targetUser) {
      targetUser = await prisma.user.create({ data: { email: targetEmail, name: targetEmail.split('@')[0] } });
    }
    if (targetUser.id === userId) return { success: false, error: "Cannot share with self." };

    await prisma.documentAccess.upsert({
      where: { documentId_userId: { documentId, userId: targetUser.id } },
      update: { role },
      create: { documentId, userId: targetUser.id, role },
    });

    revalidatePath(`/document/${documentId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to propagate ACL settings." };
  }
}

export async function getDocumentCatalog() {
  const userId = await getAuthenticatedUser();
  try {
    const owned = await prisma.document.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" } });
    const shared = await prisma.document.findMany({
      where: { accessList: { some: { userId } } },
      include: { owner: true, accessList: { where: { userId } } },
      orderBy: { updatedAt: "desc" },
    });
    return {
      success: true,
      data: { owned, shared: shared.map(doc => ({ ...doc, userRole: doc.accessList[0]?.role })) }
    };
  } catch (error) {
    return { success: false, error: "Failed to compile registry." };
  }
}

// ==========================================
// NEW: ASSET DESTRUCTION PIPELINE
// ==========================================
export async function deleteDocument(documentId: string) {
  const userId = await getAuthenticatedUser();
  let wasSuccessful = false;
  
  try {
    // 1. Verify exact ownership
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.ownerId !== userId) {
      return { success: false, error: "UNAUTHORIZED: Only the owner can destroy this asset." };
    }

    // 2. Execute cascade delete
    await prisma.document.delete({ where: { id: documentId } });
    wasSuccessful = true;
  } catch (error) {
    return { success: false, error: "Failed to execute destruction pipeline." };
  }

  // 3. Purge cache and route back to workspace safely
  if (wasSuccessful) {
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }
}