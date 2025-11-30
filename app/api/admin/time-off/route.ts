import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('adminId')?.value;
  
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  try {
    const requests = await prisma.timeOffRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        user: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error('Error fetching time-off requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('adminId')?.value;
  
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { userId, type, startDate, endDate, daysRequested, reason } = body;

    if (!userId || !type || !startDate || !endDate || daysRequested == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    return NextResponse.json(request);
  } catch (error: any) {
    console.error('Error creating time-off request:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
