'use client';

/**
 * Reports Panel Component
 * Provides report generation and scheduling functionality
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Download, 
  Calendar, 
  Clock, 
  Mail,
  Settings,
  BarChart3,
  Package,
  ShoppingCart,
  Store
} from 'lucide-react';

interface ReportsPanelProps {
  dateRange: { start: Date; end: Date };
  selectedStores: string[];
}

export function ReportsPanel({ dateRange, selectedStores }: ReportsPanelProps) {
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [reportFormat, setReportFormat] = useState('pdf');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [emailRecipients, setEmailRecipients] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const availableReports = [
    {
      id: 'sales-summary',
      name: 'Sales Summary Report',
      description: 'Overview of sales performance, revenue, and order metrics',
      icon: BarChart3,
      category: 'Sales',
    },
    {
      id: 'platform-performance',
      name: 'Platform Performance Report',
      description: 'Detailed comparison of performance across all platforms',
      icon: Store,
      category: 'Sales',
    },
    {
      id: 'inventory-analysis',
      name: 'Inventory Analysis Report',
      description: 'Stock levels, turnover rates, and inventory insights',
      icon: Package,
      category: 'Inventory',
    },
    {
      id: 'order-details',
      name: 'Order Details Report',
      description: 'Comprehensive order data with customer information',
      icon: ShoppingCart,
      category: 'Orders',
    },
    {
      id: 'financial-summary',
      name: 'Financial Summary Report',
      description: 'Revenue breakdown, costs, and profit analysis',
      icon: FileText,
      category: 'Financial',
    },
  ];

  const scheduledReports = [
    {
      id: '1',
      name: 'Weekly Sales Report',
      frequency: 'Weekly',
      nextRun: '2024-01-15 09:00',
      recipients: 'admin@company.com',
      status: 'active',
    },
    {
      id: '2',
      name: 'Monthly Inventory Report',
      frequency: 'Monthly',
      nextRun: '2024-02-01 08:00',
      recipients: 'inventory@company.com',
      status: 'active',
    },
  ];

  const handleReportToggle = (reportId: string) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleGenerateReports = async () => {
    if (selectedReports.length === 0) return;

    setIsGenerating(true);
    try {
      // TODO: Implement actual report generation
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      console.log('Generating reports:', {
        reports: selectedReports,
        format: reportFormat,
        dateRange,
        stores: selectedStores,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScheduleReport = () => {
    // TODO: Implement report scheduling
    console.log('Scheduling report:', {
      reports: selectedReports,
      frequency: scheduleFrequency,
      recipients: emailRecipients,
    });
  };

  const categories = [...new Set(availableReports.map(report => report.category))];

  return (
    <div className="space-y-6">
      {/* Report Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Reports
          </CardTitle>
          <CardDescription>
            Create custom reports for the selected date range and stores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Select Reports</Label>
            {categories.map(category => (
              <div key={category} className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  {category}
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableReports
                    .filter(report => report.category === category)
                    .map(report => {
                      const Icon = report.icon;
                      const isSelected = selectedReports.includes(report.id);
                      
                      return (
                        <div
                          key={report.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleReportToggle(report.id)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox 
                              checked={isSelected}
                              onChange={() => handleReportToggle(report.id)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className="h-4 w-4" />
                                <span className="font-medium text-sm">{report.name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {report.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Report Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Report Format</Label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel (XLSX)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="text-sm text-muted-foreground p-2 border rounded">
                {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {selectedReports.length} report{selectedReports.length !== 1 ? 's' : ''} selected
            </div>
            <Button 
              onClick={handleGenerateReports}
              disabled={selectedReports.length === 0 || isGenerating}
            >
              <Download className="h-4 w-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Generate Reports'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Reports
          </CardTitle>
          <CardDescription>
            Set up automatic report generation and delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Schedule Configuration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="schedule-enabled"
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
              />
              <Label htmlFor="schedule-enabled">Enable automatic report scheduling</Label>
            </div>

            {scheduleEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Email Recipients</Label>
                  <Input
                    placeholder="email1@company.com, email2@company.com"
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {scheduleEnabled && (
            <Button onClick={handleScheduleReport} variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Schedule Selected Reports
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Reports
          </CardTitle>
          <CardDescription>
            Manage your automated report schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scheduledReports.map(report => (
              <div key={report.id} className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <div className="font-medium text-sm">{report.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {report.frequency} • Next: {report.nextRun} • To: {report.recipients}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={report.status === 'active' ? 'default' : 'secondary'}>
                    {report.status}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}