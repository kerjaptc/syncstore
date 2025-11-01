/**
 * Analytics Export API Route
 * Provides data export capabilities in multiple formats (CSV, Excel, PDF)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { analyticsService } from '@/lib/services/analytics-service';
import { z } from 'zod';

const exportSchema = z.object({
  type: z.enum(['sales', 'inventory', 'platform', 'orders']),
  format: z.enum(['csv', 'excel', 'pdf']),
  dateRange: z.object({
    start: z.string().transform(str => new Date(str)),
    end: z.string().transform(str => new Date(str)),
  }),
  storeIds: z.array(z.string()).optional(),
  includeDetails: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    const { type, format, dateRange, storeIds, includeDetails } = exportSchema.parse(body);

    // Get analytics data based on type
    let data;
    switch (type) {
      case 'sales':
        data = await analyticsService.getSalesAnalytics({
          organizationId: user.organizationId,
          dateRange,
          storeIds: storeIds || [],
          metrics: ['count', 'revenue', 'averageOrderValue'],
          groupBy: ['day'],
        });
        break;

      case 'platform':
        data = await analyticsService.getPlatformComparison(user.organizationId, dateRange);
        break;

      case 'inventory':
        data = await analyticsService.getInventoryAnalytics({
          organizationId: user.organizationId,
          dateRange,
          storeIds: storeIds || [],
          metrics: ['stockLevel', 'stockMovement'],
        });
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid export type' },
          { status: 400 }
        );
    }

    // Generate export based on format
    let exportData;
    let contentType;
    let filename;

    switch (format) {
      case 'csv':
        exportData = generateCSV(data, type);
        contentType = 'text/csv';
        filename = `${type}-analytics-${dateRange.start.toISOString().split('T')[0]}.csv`;
        break;

      case 'excel':
        exportData = generateExcel(data, type);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `${type}-analytics-${dateRange.start.toISOString().split('T')[0]}.xlsx`;
        break;

      case 'pdf':
        exportData = generatePDF(data, type);
        contentType = 'application/pdf';
        filename = `${type}-analytics-${dateRange.start.toISOString().split('T')[0]}.pdf`;
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid export format' },
          { status: 400 }
        );
    }

    // Return file as download
    return new NextResponse(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Analytics export error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid export parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to export analytics data' },
      { status: 500 }
    );
  }
}

/**
 * Generate CSV export
 */
function generateCSV(data: any, type: string): string {
  if (!data || !data.data || data.data.length === 0) {
    return 'No data available for export';
  }

  const rows = data.data;
  const headers = Object.keys(rows[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...rows.map((row: any) => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  return csvContent;
}

/**
 * Generate Excel export (simplified - in production, use a library like ExcelJS)
 */
function generateExcel(data: any, type: string): Buffer {
  // For now, return CSV content as Excel files can read CSV
  // In production, implement proper Excel generation with ExcelJS
  const csvContent = generateCSV(data, type);
  return Buffer.from(csvContent, 'utf-8');
}

/**
 * Generate PDF export (simplified - in production, use a library like PDFKit or Puppeteer)
 */
function generatePDF(data: any, type: string): Buffer {
  // Simplified PDF generation - in production, use proper PDF library
  const content = `
Analytics Report - ${type.toUpperCase()}
Generated: ${new Date().toLocaleString()}

Summary:
${JSON.stringify(data.summary, null, 2)}

Data Points: ${data.data?.length || 0}
  `;
  
  return Buffer.from(content, 'utf-8');
}