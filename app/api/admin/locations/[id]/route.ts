export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// Simple admin check via cookie
function requireAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session;
}

// DELETE /api/admin/locations/:id → delete a location
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { error: "Location id is required" },
      { status: 400 }
    );
  }

  try {
    // Optional: check if location has shifts
    const shiftCount = await prisma.shift.count({
      where: { locationId: id },
    });

    if (shiftCount > 0) {
      return NextResponse.json(
        {
          error:
            "This location has existing shifts and cannot be deleted. " +
            "Deactivate it instead or move those shifts first.",
        },
        { status: 400 }
      );
    }

    await prisma.location.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting location:", err);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 }
    );
  }
}