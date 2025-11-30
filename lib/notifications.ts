// lib/notifications.ts
import { prisma } from "./prisma";

export type NotificationType =
  | "flagged_shift"
  | "correction_request"
  | "clock_reminder"
  | "document_added"
  | "shift_assigned";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: string
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        relatedId,
        read: false,
      },
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

export async function notifyAdminsOfFlaggedShift(shiftId: string, employeeName: string, distance: number) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", active: true, notifyEmail: true },
    });

    const notifications = admins.map((admin) =>
      prisma.notification.create({
        data: {
          userId: admin.id,
          type: "flagged_shift",
          title: "Shift Flagged for Review",
          message: `${employeeName} clocked in ${distance.toFixed(0)}m from location`,
          relatedId: shiftId,
        },
      })
    );

    await Promise.all(notifications);
  } catch (err) {
    console.error("Failed to notify admins:", err);
  }
}

export async function notifyAdminsOfCorrectionRequest(requestId: string, employeeName: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", active: true, notifyEmail: true },
    });

    const notifications = admins.map((admin) =>
      prisma.notification.create({
        data: {
          userId: admin.id,
          type: "correction_request",
          title: "New Shift Correction Request",
          message: `${employeeName} submitted a correction request`,
          relatedId: requestId,
        },
      })
    );

    await Promise.all(notifications);
  } catch (err) {
    console.error("Failed to notify admins:", err);
  }
}
