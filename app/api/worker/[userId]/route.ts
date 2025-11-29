// app/api/worker/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const employeeCode = decodeURIComponent(params.userId);

    const user = await prisma.user.findUnique({
      where: { employeeCode },
      include: {
        shifts: {
          orderBy: { clockIn: "desc" },
          take: 50,
          include: { location: true },
        },
        documents: {
          where: { visibleToWorker: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Worker not found or inactive." },
        { status: 404 }
      );
    }

    const shifts = user.shifts.map((s) => ({
      id: s.id,
      clockIn: s.clockIn.toISOString(),
      clockOut: s.clockOut ? s.clockOut.toISOString() : null,
      locationName: s.location?.name ?? "—",
      // infer adhoc from missing locationId
      adhoc: !s.locationId,
      hours:
        typeof (s as any).hours === "number"
          ? (s as any).hours
          : s.clockOut
          ? (s.clockOut.getTime() - s.clockIn.getTime()) / (1000 * 60 * 60)
          : 0,
      notes: s.notes,
    }));

    const documents = user.documents.map((d) => ({
      id: d.id,
      title: d.title,
      url: d.url,
      description: d.description,
      createdAt: d.createdAt.toISOString(),
    }));

    return NextResponse.json({
      worker: {
        id: user.id,
        name: user.name,
        employeeCode: user.employeeCode,
        email: user.email,
        phone: user.phone,
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        city: user.city,
        state: user.state,
        postalcode: user.postalcode,
      },
      shifts,
      documents,
    });
  } catch (err) {
    console.error("Error loading worker data", err);
    return NextResponse.json(
      { error: "Failed to load worker data." },
      { status: 500 }
    );
  }
}