import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET ?userId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const docs = await prisma.employeeDocument.findMany({
      where: { userId, visibleToWorker: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(docs);
  } catch (err) {
    console.error("Error loading worker documents", err);
    return NextResponse.json(
      { error: "Failed to load documents" },
      { status: 500 }
    );
  }
}

// POST – worker “uploads” a doc by URL (we just store metadata here)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      name,
      fileUrl,
    } = body as { userId?: string; name?: string; fileUrl?: string };

    if (!userId || !name || !fileUrl) {
      return NextResponse.json(
        { error: "userId, name, and fileUrl are required" },
        { status: 400 }
      );
    }

    const created = await prisma.employeeDocument.create({
      data: {
        userId,
        name: name.trim(),
        fileUrl: fileUrl.trim(),
        visibleToWorker: true,
        uploadedByAdmin: false,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("Error creating worker document", err);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}