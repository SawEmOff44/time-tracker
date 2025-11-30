import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    // Get all shifts in date range
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

    // Calculate labor metrics
    const shiftsWithCost = shifts.map(shift => {
      const clockIn = new Date(shift.clockInTime!);
      const clockOut = new Date(shift.clockOutTime!);
      const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      
      let cost = 0;
      if (shift.employee.hourlyRate) {
        const regularHours = Math.min(hoursWorked, 40);
        const overtimeHours = Math.max(hoursWorked - 40, 0);
        cost = (regularHours * shift.employee.hourlyRate) + (overtimeHours * shift.employee.hourlyRate * 1.5);
      } else if (shift.employee.salary) {
        const estimatedHourly = shift.employee.salary / 2080;
        cost = hoursWorked * estimatedHourly;
      }

      return {
        ...shift,
        hoursWorked,
        cost,
        overtimeHours: Math.max(hoursWorked - 40, 0)
      };
    });

    // Aggregate data
    const byEmployee = shiftsWithCost.reduce((acc, shift) => {
      const name = shift.employee.name;
      if (!acc[name]) {
        acc[name] = { employeeName: name, hours: 0, cost: 0 };
      }
      acc[name].hours += shift.hoursWorked;
      acc[name].cost += shift.cost;
      return acc;
    }, {} as Record<string, { employeeName: string; hours: number; cost: number }>);

    const byLocation = shiftsWithCost.reduce((acc, shift) => {
      const name = shift.location?.name || 'Unknown';
      if (!acc[name]) {
        acc[name] = { locationName: name, hours: 0, cost: 0, shiftCount: 0 };
      }
      acc[name].hours += shift.hoursWorked;
      acc[name].cost += shift.cost;
      acc[name].shiftCount += 1;
      return acc;
    }, {} as Record<string, { locationName: string; hours: number; cost: number; shiftCount: number }>);

    const totalLaborCost = shiftsWithCost.reduce((sum, s) => sum + s.cost, 0);
    const totalHours = shiftsWithCost.reduce((sum, s) => sum + s.hoursWorked, 0);
    const totalOvertimeHours = shiftsWithCost.reduce((sum, s) => sum + s.overtimeHours, 0);

    // Generate PDF
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Labor Report', 14, 20);
    
    // Date range
    doc.setFontSize(10);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 33);
    
    // Summary section
    doc.setFontSize(14);
    doc.text('Summary', 14, 45);
    doc.setFontSize(10);
    doc.text(`Total Labor Cost: $${totalLaborCost.toFixed(2)}`, 14, 52);
    doc.text(`Total Hours: ${totalHours.toFixed(2)}`, 14, 58);
    doc.text(`Total Overtime: ${totalOvertimeHours.toFixed(2)} hours`, 14, 64);
    doc.text(`Average Cost/Hour: $${(totalLaborCost / totalHours).toFixed(2)}`, 14, 70);

    // Labor cost by employee table
    doc.setFontSize(14);
    doc.text('Labor Cost by Employee', 14, 85);
    
    autoTable(doc, {
      startY: 90,
      head: [['Employee', 'Hours', 'Cost']],
      body: Object.values(byEmployee)
        .sort((a, b) => b.cost - a.cost)
        .map(emp => [
          emp.employeeName,
          emp.hours.toFixed(2),
          `$${emp.cost.toFixed(2)}`
        ]),
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    // Labor cost by location table
    const finalY = (doc as any).lastAutoTable.finalY || 90;
    doc.setFontSize(14);
    doc.text('Labor Cost by Location', 14, finalY + 15);
    
    autoTable(doc, {
      startY: finalY + 20,
      head: [['Location', 'Hours', 'Shifts', 'Cost', 'Avg $/hr']],
      body: Object.values(byLocation)
        .sort((a, b) => b.cost - a.cost)
        .map(loc => [
          loc.locationName,
          loc.hours.toFixed(2),
          loc.shiftCount.toString(),
          `$${loc.cost.toFixed(2)}`,
          `$${(loc.cost / loc.hours).toFixed(2)}`
        ]),
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${startDate}-to-${endDate}.pdf"`
      }
    });

  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
