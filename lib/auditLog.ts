import { prisma } from '@/lib/prisma';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'EXPORT' | 'LOGIN' | 'LOGOUT';

interface CreateAuditLogParams {
  userId: string;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: CreateAuditLogParams) {
  const {
    userId,
    userName,
    action,
    entity,
    entityId,
    details,
    ipAddress,
    userAgent
  } = params;

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userName,
        action,
        entity,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null
      }
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging shouldn't break operations
  }
}

export async function getAuditLogs(options: {
  userId?: string;
  entity?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const {
    userId,
    entity,
    action,
    startDate,
    endDate,
    limit = 100,
    offset = 0
  } = options;

  const where: any = {};

  if (userId) where.userId = userId;
  if (entity) where.entity = entity;
  if (action) where.action = action;
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.auditLog.count({ where })
  ]);

  return { logs, total };
}
