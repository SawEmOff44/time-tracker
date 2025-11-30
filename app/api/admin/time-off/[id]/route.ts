import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/auditLog';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('adminId')?.value;
  
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { status, reviewNotes } = body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Get the request first to check if approval is allowed
    const existingRequest = await prisma.timeOffRequest.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (existingRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request already reviewed' }, { status: 400 });
    }

    // If approving, check if user has enough PTO balance
    if (status === 'APPROVED' && existingRequest.type === 'PTO') {
      if (existingRequest.user.ptoBalance < existingRequest.daysRequested) {
        return NextResponse.json({ 
          error: 'Insufficient PTO balance' 
        }, { status: 400 });
      }
    }

    // Update the request
    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    // If approved and PTO, deduct from balance
    if (status === 'APPROVED' && existingRequest.type === 'PTO') {
      await prisma.user.update({
        where: { id: existingRequest.userId },
        data: {
          ptoBalance: {
            decrement: existingRequest.daysRequested
          }
        }
      });
    }

    // Create notification for employee
    await createNotification({
      userId: existingRequest.userId,
      type: 'pto_reviewed',
      title: `Time-Off Request ${status}`,
      message: `Your ${existingRequest.type} request for ${existingRequest.daysRequested} day(s) has been ${status.toLowerCase()}.${reviewNotes ? ` Note: ${reviewNotes}` : ''}`,
      relatedId: id
    });

    // Audit log
    await createAuditLog({
      userId: adminId,
      userName: 'Admin',
      action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
      entity: 'time-off',
      entityId: id,
      details: {
        description: `${status} time-off request for ${existingRequest.user.name}`,
        type: existingRequest.type,
        days: existingRequest.daysRequested,
        reviewNotes
      },
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating time-off request:', error);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('adminId')?.value;
  
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.timeOffRequest.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting time-off request:', error);
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}
