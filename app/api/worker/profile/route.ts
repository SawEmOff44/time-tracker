// app/api/worker/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      email?: string | null;
      phone?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      postalcode?: string | null;
    };

    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Worker not found or inactive." },
        { status: 404 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        email:
          typeof body.email === "string"
            ? body.email.trim() || null
            : undefined,
        phone:
          typeof body.phone === "string"
            ? body.phone.trim() || null
            : undefined,
        addressLine1:
          typeof body.addressLine1 === "string"
            ? body.addressLine1.trim() || null
            : undefined,
        addressLine2:
          typeof body.addressLine2 === "string"
            ? body.addressLine2.trim() || null
            : undefined,
        city:
          typeof body.city === "string"
            ? body.city.trim() || null
            : undefined,
        state:
          typeof body.state === "string"
            ? body.state.trim() || null
            : undefined,
        postalcode:
          typeof body.postalcode === "string"
            ? body.postalcode.trim() || null
            : undefined,
      },
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      phone: updated.phone,
      addressLine1: updated.addressLine1,
      addressLine2: updated.addressLine2,
      city: updated.city,
      state: updated.state,
      postalcode: updated.postalcode,
    });
  } catch (err) {
    console.error("Error updating worker profile", err);
    return NextResponse.json(
      { error: "Failed to update profile." },
      { status: 500 }
    );
  }
}