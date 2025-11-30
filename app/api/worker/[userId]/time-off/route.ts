import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  
  const cookieStore = await cookies();
  const workerCookie = cookieStore.get('workerId')?.value;
  
  if (workerCookie !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requests = await prisma.timeOffRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error('Error fetching worker time-off requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  
  const cookieStore = await cookies();
  const workerCookie = cookieStore.get('workerId')?.value;
  
  if (workerCookie !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, startDate, endDate, daysRequested, reason } = body;

    if (!type || !startDate || !endDate || daysRequested == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // If PTO, check balance
    if (type === 'PTO') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { ptoBalance: true }
      });

      if (!user || user.ptoBalance < daysRequested) {
        return NextResponse.json({ 
          error: 'Insufficient PTO balance' 
        }, { status: 400 });
      }
    }

    const request = await prisma.timeOffRequest.create({
      data: {
        userId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysRequested: parseFloat(daysRequested),
        reason: reason || null,
        status: 'PENDING'
      }
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { 
        role: 'ADMIN',
        notifyEmail: true
      },
      select: { id: true }
    });

    await prisma.notification.createMany({
      data: admins.map(admin => ({
        userId: admin.id,
        type: 'pto_request',
        title: 'New Time-Off Request',
        message: `A new ${type} request has been submitted for ${daysRequested} day(s).`,
        relatedId: request.id
      }))
    });

    return NextResponse.json(request);
  } catch (error: any) {
    console.error('Error creating worker time-off request:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
