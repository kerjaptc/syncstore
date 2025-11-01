'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Upload, 
  Download, 
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface BulkOperationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
}

export function BulkOperationsDialog({
  open,
  onOpenChange,
  onImportComplete,
}: BulkOperationsDialogProps) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  const handleFileImport = async (file: File) => {
    if (!file) return;

    try {
      setImporting(true);
      setImportProgress(0);
      setImportResult(null);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const formData = new FormData();
      formData.append('file', file);

      // Parse CSV/Excel file (simplified - in real implementation, you'd use a proper parser)
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const products = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const product: any = {};
        
        headers.forEach((header, index) => {
          const value = values[index];
          switch (header.toLowerCase()) {
            case 'name':
              product.name = value;
              break;
            case 'sku':
              product.sku = value;
              break;
            case 'description':
              product.description = value;
              break;
            case 'category':
              product.category = value;
              break;
            case 'brand':
              product.brand = value;
              break;
            case 'cost_price':
            case 'costprice':
              product.costPrice = value ? parseFloat(value) : undefined;
              break;
            case 'weight':
              product.weight = value ? parseFloat(value) : undefined;
              break;
          }
        });
        
        return product;
      }).filter(product => product.name); // Filter out empty rows

      clearInterval(progressInterval);
      setImportProgress(95);

      const response = await fetch('/api/products/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products }),
      });

      if (!response.ok) {
        throw new Error('Failed to import products');
      }

      const result = await response.json();
      setImportResult(result.data);
      setImportProgress(100);
      
      if (result.data.success > 0) {
        toast.success(`Successfully imported ${result.data.success} products`);
        onImportComplete();
      }
      
      if (result.data.failed > 0) {
        toast.warning(`${result.data.failed} products failed to import`);
      }
    } catch (error) {
      toast.error('Failed to import products');
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = [
      'name,sku,description,category,brand,cost_price,weight',
      'Sample Product,SAMPLE-001,A sample product description,Electronics,Sample Brand,10.99,0.5',
      'Another Product,SAMPLE-002,Another product description,Clothing,Another Brand,25.50,0.3'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Template downloaded');
  };

  const exportProducts = async () => {
    try {
      const response = await fetch('/api/products?limit=1000');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const result = await response.json();
      const products = result.data.data;

      const csvContent = [
        'name,sku,description,category,brand,cost_price,weight,status',
        ...products.map((product: any) => [
          product.name,
          product.sku,
          product.description || '',
          product.category || '',
          product.brand || '',
          product.costPrice || '',
          product.weight || '',
          product.isActive ? 'Active' : 'Inactive'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Products exported successfully');
    } catch (error) {
      toast.error('Failed to export products');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Operations</DialogTitle>
          <DialogDescription>
            Import, export, or perform bulk operations on your products.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import Products</TabsTrigger>
            <TabsTrigger value="export">Export Products</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import Products from CSV
                </CardTitle>
                <CardDescription>
                  Upload a CSV file to import multiple products at once.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={downloadTemplate}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Download Template
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Download a sample CSV template to get started
                  </span>
                </div>

                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">
                      Drop your CSV file here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Supports CSV files up to 10MB
                    </p>
                    <Button
                      variant="outline"
                      disabled={importing}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.csv,.xlsx,.xls';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            handleFileImport(file);
                          }
                        };
                        input.click();
                      }}
                    >
                      {importing ? 'Importing...' : 'Choose File'}
                    </Button>
                  </div>
                </div>

                {importing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Importing products...</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} />
                  </div>
                )}

                {importResult && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Import Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">
                            {importResult.success} products imported successfully
                          </span>
                        </div>
                        {importResult.failed > 0 && (
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm">
                              {importResult.failed} products failed
                            </span>
                          </div>
                        )}
                      </div>

                      {importResult.errors.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-red-600">Errors:</h4>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {importResult.errors.slice(0, 5).map((error, index) => (
                              <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                Row {error.index + 2}: {error.error}
                              </div>
                            ))}
                            {importResult.errors.length > 5 && (
                              <div className="text-xs text-muted-foreground">
                                ... and {importResult.errors.length - 5} more errors
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Export Products to CSV
                </CardTitle>
                <CardDescription>
                  Download all your products as a CSV file for backup or analysis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Export Information</p>
                    <p className="text-xs text-muted-foreground">
                      This will export all products including their basic information, 
                      variants, and current status.
                    </p>
                  </div>
                </div>

                <Button onClick={exportProducts} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export All Products
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}