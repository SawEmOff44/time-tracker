// app/api/admin/employees/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: { id: string } };

// DELETE /api/admin/employees/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = params;

  try {
    // Safety: don't nuke an employee that already has shifts
    const shiftCount = await prisma.shift.count({
      where: { userId: id },
    });

    if (shiftCount > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete an employee who already has recorded shifts. (Leave them active or set them inactive instead.)",
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin DELETE /employees/:id error:", err);
    return NextResponse.json(
      { error: "Failed to delete employee." },
      { status: 500 }
    );
  }
}