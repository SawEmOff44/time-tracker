import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuditLogs } from '@/lib/auditLog';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('adminId')?.value;
  
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  
  const entity = searchParams.get('entity') || undefined;
  const action = searchParams.get('action') as any || undefined;
  const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
  const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const result = await getAuditLogs({
      entity,
      action,
      startDate,
      endDate,
      limit,
      offset
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
