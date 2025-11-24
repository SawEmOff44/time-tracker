// app/api/admin/employees/[id]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = params;

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        active: true,
      },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("Approve user error:", err);
    return NextResponse.json(
      { error: "Failed to approve worker." },
      { status: 500 }
    );
  }
}