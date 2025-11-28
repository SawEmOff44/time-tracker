// app/api/admin/documents/[docId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const { docId } = params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { title, description, visibleToWorker } = body ?? {};
  const data: Record<string, any> = {};

  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (visibleToWorker !== undefined)
    data.visibleToWorker = Boolean(visibleToWorker);

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 }
    );
  }

  try {
    const doc = await prisma.employeeDocument.update({
      where: { id: docId },
      data,
    });

    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      url: doc.url,
      description: doc.description,
      visibleToWorker: doc.visibleToWorker,
      createdAt: doc.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Error updating document", err);
    return NextResponse.json(
      { error: "Failed to update document." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const { docId } = params;

  try {
    await prisma.employeeDocument.delete({
      where: { id: docId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting document", err);
    return NextResponse.json(
      { error: "Failed to delete document." },
      { status: 500 }
    );
  }
}