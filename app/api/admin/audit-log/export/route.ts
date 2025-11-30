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

  try {
    const result = await getAuditLogs({
      entity,
      action,
      startDate,
      endDate,
      limit: 10000 // Get all for export
    });

    const { logs } = result;

    // Generate CSV
    const header = ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Details', 'IP Address'];
    const lines: string[] = [];
    lines.push(header.join(','));

    for (const log of logs) {
      const values = [
        new Date(log.createdAt).toISOString(),
        log.userName,
        log.action,
        log.entity,
        log.entityId || '',
        log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '',
        log.ipAddress || ''
      ];

      const escaped = values.map((v) => {
        const str = String(v);
        const needsQuotes = str.includes(',') || str.includes('"') || str.includes('\n');
        const safe = str.replace(/"/g, '""');
        return needsQuotes ? `"${safe}"` : safe;
      });

      lines.push(escaped.join(','));
    }

    const csvContent = lines.join('\n');
    const buffer = Buffer.from(csvContent, 'utf-8');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error: any) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json({ error: 'Failed to export audit logs' }, { status: 500 });
  }
}
