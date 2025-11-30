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
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  try {
    // Get all shifts in date range with employee and location data
    const shifts = await prisma.shift.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        },
        clockInTime: { not: null },
        clockOutTime: { not: null }
      },
      include: {
        employee: {
          select: {
            name: true,
            hourlyRate: true,
            salary: true
          }
        },
        location: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Calculate hours worked and labor cost for each shift
    const shiftsWithCost = shifts.map(shift => {
      const clockIn = new Date(shift.clockInTime!);
      const clockOut = new Date(shift.clockOutTime!);
      const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      
      // Calculate cost based on hourly rate or salary
      let cost = 0;
      if (shift.employee.hourlyRate) {
        const regularHours = Math.min(hoursWorked, 40);
        const overtimeHours = Math.max(hoursWorked - 40, 0);
        cost = (regularHours * shift.employee.hourlyRate) + (overtimeHours * shift.employee.hourlyRate * 1.5);
      } else if (shift.employee.salary) {
        // Estimate hourly from annual salary (2080 work hours/year)
        const estimatedHourly = shift.employee.salary / 2080;
        cost = hoursWorked * estimatedHourly;
      }

      return {
        ...shift,
        hoursWorked,
        cost,
        regularHours: Math.min(hoursWorked, 40),
        overtimeHours: Math.max(hoursWorked - 40, 0)
      };
    });

    // Aggregate labor cost by employee
    const byEmployee = shiftsWithCost.reduce((acc, shift) => {
      const name = shift.employee.name;
      if (!acc[name]) {
        acc[name] = { employeeName: name, hours: 0, cost: 0 };
      }
      acc[name].hours += shift.hoursWorked;
      acc[name].cost += shift.cost;
      return acc;
    }, {} as Record<string, { employeeName: string; hours: number; cost: number }>);

    // Aggregate labor cost by location
    const byLocation = shiftsWithCost.reduce((acc, shift) => {
      const name = shift.location?.name || 'Unknown';
      if (!acc[name]) {
        acc[name] = { locationName: name, hours: 0, cost: 0 };
      }
      acc[name].hours += shift.hoursWorked;
      acc[name].cost += shift.cost;
      return acc;
    }, {} as Record<string, { locationName: string; hours: number; cost: number }>);

    // Calculate overtime
    const overtimeByEmployee = shiftsWithCost.reduce((acc, shift) => {
      if (shift.overtimeHours > 0) {
        const name = shift.employee.name;
        if (!acc[name]) {
          acc[name] = { employeeName: name, overtimeHours: 0, overtimeCost: 0 };
        }
        acc[name].overtimeHours += shift.overtimeHours;
        const otRate = (shift.employee.hourlyRate || (shift.employee.salary || 0) / 2080) * 1.5;
        acc[name].overtimeCost += shift.overtimeHours * otRate;
      }
      return acc;
    }, {} as Record<string, { employeeName: string; overtimeHours: number; overtimeCost: number }>);

    // Location profitability
    const locationStats = shiftsWithCost.reduce((acc, shift) => {
      const name = shift.location?.name || 'Unknown';
      if (!acc[name]) {
        acc[name] = { locationName: name, totalHours: 0, totalCost: 0, shiftCount: 0 };
      }
      acc[name].totalHours += shift.hoursWorked;
      acc[name].totalCost += shift.cost;
      acc[name].shiftCount += 1;
      return acc;
    }, {} as Record<string, { locationName: string; totalHours: number; totalCost: number; shiftCount: number }>);

    const totalLaborCost = shiftsWithCost.reduce((sum, s) => sum + s.cost, 0);
    const totalOvertimeHours = Object.values(overtimeByEmployee).reduce((sum, e) => sum + e.overtimeHours, 0);
    const totalOvertimeCost = Object.values(overtimeByEmployee).reduce((sum, e) => sum + e.overtimeCost, 0);

    return NextResponse.json({
      laborCost: {
        total: totalLaborCost,
        byEmployee: Object.values(byEmployee).sort((a, b) => b.cost - a.cost),
        byLocation: Object.values(byLocation).sort((a, b) => b.cost - a.cost)
      },
      overtime: {
        totalOvertimeHours,
        totalOvertimeCost,
        byEmployee: Object.values(overtimeByEmployee).sort((a, b) => b.overtimeCost - a.overtimeCost)
      },
      locationProfitability: Object.values(locationStats).sort((a, b) => b.totalCost - a.totalCost)
    });

  } catch (error: any) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
