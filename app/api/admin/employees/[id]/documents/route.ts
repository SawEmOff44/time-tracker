// app/api/admin/employees/[id]/documents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const docs = await prisma.employeeDocument.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      docs.map((d) => ({
        id: d.id,
        title: d.title,
        url: d.url,
        description: d.description,
        visibleToWorker: d.visibleToWorker,
        createdAt: d.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("Error loading documents", err);
    return NextResponse.json(
      { error: "Failed to load documents." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { title, url, description, visibleToWorker } = body ?? {};

  if (!title || !url) {
    return NextResponse.json(
      { error: "Title and URL are required." },
      { status: 400 }
    );
  }

  try {
    const doc = await prisma.employeeDocument.create({
      data: {
        userId: id,
        title: title.trim(),
        url: url.trim(),
        description: description?.trim() || null,
        visibleToWorker: Boolean(visibleToWorker),
      },
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
    console.error("Error creating document", err);
    return NextResponse.json(
      { error: "Failed to create document." },
      { status: 500 }
    );
  }
}