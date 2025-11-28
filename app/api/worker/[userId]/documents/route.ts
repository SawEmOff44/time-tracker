// app/api/worker/[userId]/documents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: { userId: string }; // employeeCode
};

// GET – worker sees only docs where visibleToWorker = true
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = params;

  try {
    const worker = await prisma.user.findFirst({
      where: {
        employeeCode: userId,
        active: true,
      },
    });

    if (!worker) {
      return NextResponse.json(
        { error: "Worker not found or inactive." },
        { status: 404 }
      );
    }

    const docs = await prisma.employeeDocument.findMany({
      where: { userId: worker.id, visibleToWorker: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      docs.map((d) => ({
        id: d.id,
        title: d.title,
        url: d.url,
        description: d.description,
        createdAt: d.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("Error loading worker documents", err);
    return NextResponse.json(
      { error: "Failed to load documents." },
      { status: 500 }
    );
  }
}