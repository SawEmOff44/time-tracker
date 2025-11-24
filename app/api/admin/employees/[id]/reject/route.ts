// app/api/admin/employees/[id]/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = params;

  try {
    // Pending workers should have no shifts; if they do, this will throw.
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reject user error:", err);
    return NextResponse.json(
      { error: "Failed to reject/remove worker." },
      { status: 500 }
    );
  }
}