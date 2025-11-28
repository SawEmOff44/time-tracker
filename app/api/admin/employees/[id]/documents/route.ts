import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: { id: string } };

// GET all docs for an employee (admin)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: userId } = params;

  try {
    const docs = await prisma.employeeDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(docs);
  } catch (err) {
    console.error("Error loading employee docs", err);
    return NextResponse.json(
      { error: "Failed to load employee documents" },
      { status: 500 }
    );
  }
}

// POST – admin attaches a document (by URL)
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: userId } = params;

  try {
    const body = await req.json();
    const { name, fileUrl, visibleToWorker = true } = body as {
      name?: string;
      fileUrl?: string;
      visibleToWorker?: boolean;
    };

    if (!name || !fileUrl) {
      return NextResponse.json(
        { error: "name and fileUrl are required" },
        { status: 400 }
      );
    }

    const created = await prisma.employeeDocument.create({
      data: {
        userId,
        name: name.trim(),
        fileUrl: fileUrl.trim(),
        visibleToWorker: !!visibleToWorker,
        uploadedByAdmin: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("Error creating employee document", err);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}

// PATCH – toggle visibility
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id: userId } = params;

  try {
    const body = await req.json();
    const { docId, visibleToWorker } = body as {
      docId?: string;
      visibleToWorker?: boolean;
    };

    if (!docId) {
      return NextResponse.json(
        { error: "docId is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.employeeDocument.update({
      where: { id: docId },
      data: {
        visibleToWorker:
          typeof visibleToWorker === "boolean" ? visibleToWorker : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating document", err);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

// DELETE – remove doc
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id: userId } = params;

  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");
    if (!docId) {
      return NextResponse.json(
        { error: "docId is required" },
        { status: 400 }
      );
    }

    await prisma.employeeDocument.delete({
      where: { id: docId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting document", err);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}