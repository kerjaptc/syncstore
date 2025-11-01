'use client';

/**
 * Customizable Dashboard Component
 * Provides drag-and-drop widgets for dashboard customization
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Plus, 
  Grip, 
  Eye, 
  EyeOff,
  BarChart3,
  PieChart,
  LineChart,
  Activity
} from 'lucide-react';

interface Widget {
  id: string;
  type: 'chart' | 'metric' | 'table';
  title: string;
  description: string;
  size: 'small' | 'medium' | 'large';
  visible: boolean;
  position: { x: number; y: number };
}

export function CustomizableDashboard() {
  const [widgets, setWidgets] = useState<Widget[]>([
    {
      id: '1',
      type: 'chart',
      title: 'Revenue Trend',
      description: 'Daily revenue over time',
      size: 'large',
      visible: true,
      position: { x: 0, y: 0 },
    },
    {
      id: '2',
      type: 'metric',
      title: 'Total Orders',
      description: 'Order count for selected period',
      size: 'small',
      visible: true,
      position: { x: 1, y: 0 },
    },
    {
      id: '3',
      type: 'chart',
      title: 'Platform Comparison',
      description: 'Revenue by platform',
      size: 'medium',
      visible: true,
      position: { x: 0, y: 1 },
    },
    {
      id: '4',
      type: 'table',
      title: 'Top Products',
      description: 'Best selling products',
      size: 'medium',
      visible: false,
      position: { x: 1, y: 1 },
    },
  ]);

  const [isEditMode, setIsEditMode] = useState(false);

  const availableWidgets = [
    { type: 'chart', icon: BarChart3, title: 'Bar Chart', description: 'Compare values across categories' },
    { type: 'chart', icon: LineChart, title: 'Line Chart', description: 'Show trends over time' },
    { type: 'chart', icon: PieChart, title: 'Pie Chart', description: 'Show proportions and percentages' },
    { type: 'metric', icon: Activity, title: 'Metric Card', description: 'Display key performance indicators' },
  ];

  const toggleWidgetVisibility = (widgetId: string) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { ...widget, visible: !widget.visible }
        : widget
    ));
  };

  const addWidget = (type: string) => {
    const newWidget: Widget = {
      id: Date.now().toString(),
      type: type as 'chart' | 'metric' | 'table',
      title: `New ${type}`,
      description: 'Configure this widget',
      size: 'medium',
      visible: true,
      position: { x: 0, y: widgets.length },
    };

    setWidgets(prev => [...prev, newWidget]);
  };

  const visibleWidgets = widgets.filter(widget => widget.visible);

  return (
    <div className="space-y-6">
      {/* Dashboard Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Dashboard Layout</h3>
          <p className="text-sm text-muted-foreground">
            Customize your dashboard with drag-and-drop widgets
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
          >
            <Settings className="h-4 w-4 mr-2" />
            {isEditMode ? 'Done' : 'Edit Layout'}
          </Button>
        </div>
      </div>

      {/* Edit Mode Panel */}
      {isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Widget Configuration</CardTitle>
            <CardDescription>
              Add new widgets or configure existing ones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Widgets */}
            <div>
              <h4 className="font-medium mb-3">Add Widgets</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {availableWidgets.map((widget, index) => {
                  const Icon = widget.icon;
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      className="h-auto p-3 flex flex-col items-center gap-2"
                      onClick={() => addWidget(widget.type)}
                    >
                      <Icon className="h-6 w-6" />
                      <div className="text-center">
                        <div className="text-xs font-medium">{widget.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {widget.description}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Manage Existing Widgets */}
            <div>
              <h4 className="font-medium mb-3">Manage Widgets</h4>
              <div className="space-y-2">
                {widgets.map((widget) => (
                  <div
                    key={widget.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Grip className="h-4 w-4 text-muted-foreground cursor-move" />
                      <div>
                        <div className="font-medium text-sm">{widget.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {widget.description}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {widget.size}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleWidgetVisibility(widget.id)}
                      >
                        {widget.visible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleWidgets.map((widget) => (
          <Card 
            key={widget.id}
            className={`${
              widget.size === 'large' ? 'md:col-span-2 lg:col-span-3' :
              widget.size === 'medium' ? 'md:col-span-1 lg:col-span-2' :
              'md:col-span-1 lg:col-span-1'
            } ${isEditMode ? 'border-dashed border-2' : ''}`}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{widget.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {widget.description}
                  </CardDescription>
                </div>
                {isEditMode && (
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Widget Content Placeholder */}
              <div className="h-32 bg-gray-50 rounded flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="text-sm font-medium">{widget.type.toUpperCase()}</div>
                  <div className="text-xs">Widget content here</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {visibleWidgets.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-4">No widgets are currently visible</p>
              <Button onClick={() => setIsEditMode(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Widgets
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}