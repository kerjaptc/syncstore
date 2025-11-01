'use client';

/**
 * Date Range Picker Component
 * Provides date range selection for analytics filtering
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { analyticsUtils } from '@/lib/analytics/utils';

interface DateRangePickerProps {
  value: { start: Date; end: Date };
  onChange: (range: { start: Date; end: Date }) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const presets = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 days', value: 'week' },
    { label: 'Last 30 days', value: 'month' },
    { label: 'Last 90 days', value: 'quarter' },
    { label: 'Last 365 days', value: 'year' },
  ];

  const handlePresetSelect = (preset: string) => {
    let range;
    
    switch (preset) {
      case 'today':
        range = analyticsUtils.getDateRange('today');
        break;
      case 'yesterday':
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        range = { start: yesterday, end: yesterdayEnd };
        break;
      case 'week':
        range = analyticsUtils.getDateRange('week');
        break;
      case 'month':
        range = analyticsUtils.getDateRange('month');
        break;
      case 'quarter':
        range = analyticsUtils.getDateRange('quarter');
        break;
      case 'year':
        range = analyticsUtils.getDateRange('year');
        break;
      default:
        return;
    }

    setSelectedPreset(preset);
    onChange(range);
    setIsOpen(false);
  };

  const handleCustomDateSelect = (date: Date | undefined, type: 'start' | 'end') => {
    if (!date) return;

    const newRange = { ...value };
    newRange[type] = date;

    // Ensure start is before end
    if (newRange.start > newRange.end) {
      if (type === 'start') {
        newRange.end = date;
      } else {
        newRange.start = date;
      }
    }

    setSelectedPreset(''); // Clear preset selection for custom range
    onChange(newRange);
  };

  const formatDateRange = () => {
    const start = format(value.start, 'MMM dd, yyyy');
    const end = format(value.end, 'MMM dd, yyyy');
    
    if (start === end) {
      return start;
    }
    
    return `${start} - ${end}`;
  };

  const getDaysDifference = () => {
    const diffTime = Math.abs(value.end.getTime() - value.start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span>{formatDateRange()}</span>
          <Badge variant="secondary" className="ml-2">
            {getDaysDifference()} days
          </Badge>
          <ChevronDown className="ml-auto h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets */}
          <div className="border-r p-3 space-y-1">
            <div className="text-sm font-medium mb-2">Quick Select</div>
            {presets.map((preset) => (
              <Button
                key={preset.value}
                variant={selectedPreset === preset.value ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start"
                onClick={() => handlePresetSelect(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom Date Selection */}
          <div className="p-3">
            <div className="text-sm font-medium mb-3">Custom Range</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Start Date</div>
                <Calendar
                  mode="single"
                  selected={value.start}
                  onSelect={(date) => handleCustomDateSelect(date, 'start')}
                  disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                  initialFocus
                />
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-1">End Date</div>
                <Calendar
                  mode="single"
                  selected={value.end}
                  onSelect={(date) => handleCustomDateSelect(date, 'end')}
                  disabled={(date) => date > new Date() || date < value.start}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex justify-between items-center text-xs text-muted-foreground">
          <span>Selected: {getDaysDifference()} days</span>
          <Button size="sm" onClick={() => setIsOpen(false)}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}