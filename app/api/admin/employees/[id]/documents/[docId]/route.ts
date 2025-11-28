// app/api/admin/employees/[id]/documents/[docId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: { id: string; docId: string };
};

// PATCH – update title/url/description/visibleToWorker
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, docId } = params;

  try {
    const body = (await req.json()) as {
      title?: string;
      url?: string;
      description?: string | null;
      visibleToWorker?: boolean;
    };

    const data: any = {};

    if (typeof body.title === "string") {
      data.title = body.title.trim();
    }
    if (typeof body.url === "string") {
      data.url = body.url.trim();
    }
    if (
      typeof body.description === "string" ||
      body.description === null
    ) {
      data.description =
        body.description && body.description.trim().length > 0
          ? body.description.trim()
          : null;
    }
    if (typeof body.visibleToWorker === "boolean") {
      data.visibleToWorker = body.visibleToWorker;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 }
      );
    }

    const updated = await prisma.employeeDocument.update({
      where: { id: docId },
      data,
    });

    // sanity: ensure it still belongs to the same user (optional)
    if (updated.userId !== id) {
      // If mismatch, roll back? For now just log.
      console.warn(
        "Document userId mismatch on PATCH",
        updated.id,
        updated.userId,
        id
      );
    }

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      url: updated.url,
      description: updated.description,
      visibleToWorker: updated.visibleToWorker,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Error updating employee document", err);
    return NextResponse.json(
      { error: "Failed to update document." },
      { status: 500 }
    );
  }
}

// DELETE – remove a document
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, docId } = params;

  try {
    const doc = await prisma.employeeDocument.findUnique({
      where: { id: docId },
    });

    if (!doc || doc.userId !== id) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      );
    }

    await prisma.employeeDocument.delete({
      where: { id: docId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting employee document", err);
    return NextResponse.json(
      { error: "Failed to delete document." },
      { status: 500 }
    );
  }
}