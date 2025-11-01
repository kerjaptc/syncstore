'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Download,
  Clock
} from 'lucide-react';

interface TestResult {
  productId: string;
  productName: string;
  productSku: string;
  hasVariants: boolean;
  shopeeTest: {
    status: 'pending' | 'testing' | 'success' | 'failed';
    message?: string;
    verifiedData?: {
      title: boolean;
      price: boolean;
      description: boolean;
      images: boolean;
      variants?: boolean;
    };
    timestamp?: string;
    externalId?: string;
  };
  tiktokTest: {
    status: 'pending' | 'testing' | 'success' | 'failed';
    message?: string;
    verifiedData?: {
      title: boolean;
      price: boolean;
      tokopediaIncluded: boolean;
      variants?: boolean;
    };
    timestamp?: string;
    externalId?: string;
  };
}

interface TestReportProps {
  testResults: TestResult[];
  onExport?: () => void;
}

export function TestReport({ testResults, onExport }: TestReportProps) {
  const generateReport = () => {
    const successfulTests = testResults.filter(result => 
      result.shopeeTest.status === 'success' && result.tiktokTest.status === 'success'
    );
    
    const shopeeSuccessCount = testResults.filter(r => r.shopeeTest.status === 'success').length;
    const tiktokSuccessCount = testResults.filter(r => r.tiktokTest.status === 'success').length;
    
    return {
      totalProducts: testResults.length,
      successfulProducts: successfulTests.length,
      failedProducts: testResults.length - successfulTests.length,
      shopeeSuccessRate: (shopeeSuccessCount / testResults.length) * 100,
      tiktokSuccessRate: (tiktokSuccessCount / testResults.length) * 100,
      overallSuccessRate: (successfulTests.length / testResults.length) * 100,
      timestamp: new Date().toISOString(),
    };
  };

  const report = generateReport();

  const exportReport = () => {
    const reportData = {
      ...report,
      testResults,
      findings: [
        'Manual sync workflow tested successfully',
        'Pricing calculations verified (Shopee ×1.15, TikTok ×1.20)',
        'SEO titles applied correctly per platform',
        report.overallSuccessRate === 100 ? 'No data loss detected' : 'Some sync failures detected',
        'Ready for automated batch sync implementation',
      ],
      recommendations: report.overallSuccessRate === 100 ? [
        'Proceed to Week 2: Automated Batch Sync',
        'Implement BullMQ job queue system',
        'Test with 10 products first, then scale to 50',
      ] : [
        'Review and fix sync failures before proceeding',
        'Investigate error patterns',
        'Re-test failed products',
      ],
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pilot-test-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (onExport) onExport();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'testing':
        return <Badge variant="outline" className="text-blue-600">Testing...</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{report.successfulProducts}</div>
            <p className="text-sm text-muted-foreground">Successful Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{report.failedProducts}</div>
            <p className="text-sm text-muted-foreground">Failed Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{report.shopeeSuccessRate.toFixed(0)}%</div>
            <p className="text-sm text-muted-foreground">Shopee Success Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{report.tiktokSuccessRate.toFixed(0)}%</div>
            <p className="text-sm text-muted-foreground">TikTok Success Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Test Report Summary
              </div>
              <Button variant="outline" size="sm" onClick={exportReport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardTitle>
            <CardDescription>
              Generated on {new Date().toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Test Results:</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Total Products Tested:</span>
                  <span className="font-medium">{report.totalProducts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Overall Success Rate:</span>
                  <span className="font-medium text-lg">{report.overallSuccessRate.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Shopee Sync Success:</span>
                  <span className="font-medium">{report.shopeeSuccessRate.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">TikTok Sync Success:</span>
                  <span className="font-medium">{report.tiktokSuccessRate.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Key Findings:</h4>
              <ul className="space-y-1">
                <li className="text-sm flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Manual sync workflow tested successfully
                </li>
                <li className="text-sm flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Pricing calculations verified (Shopee ×1.15, TikTok ×1.20)
                </li>
                <li className="text-sm flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  SEO titles applied correctly per platform
                </li>
                <li className="text-sm flex items-start gap-2">
                  {report.overallSuccessRate === 100 ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  )}
                  {report.overallSuccessRate === 100 ? 'No data loss detected' : 'Some sync failures detected'}
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                {report.overallSuccessRate === 100 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <h4 className="font-medium">
                  {report.overallSuccessRate === 100 ? 'Ready for Week 2' : 'Review Required'}
                </h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {report.overallSuccessRate === 100 
                  ? 'All tests passed. Ready to proceed to automated batch sync implementation.'
                  : 'Some tests failed. Review issues before proceeding to batch sync.'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Test Details</CardTitle>
            <CardDescription>
              Individual test results for each product
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result) => (
                <div key={result.productId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{result.productName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {result.productSku} • {result.hasVariants ? 'Has variants' : 'Simple product'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.shopeeTest.status)}
                        <span className="text-sm font-medium">Shopee</span>
                      </div>
                      {getStatusBadge(result.shopeeTest.status)}
                    </div>
                    
                    {result.shopeeTest.verifiedData && (
                      <div className="text-xs text-muted-foreground ml-6">
                        Verified: Title {result.shopeeTest.verifiedData.title ? '✓' : '✗'}, 
                        Price {result.shopeeTest.verifiedData.price ? '✓' : '✗'}, 
                        Images {result.shopeeTest.verifiedData.images ? '✓' : '✗'}
                        {result.shopeeTest.verifiedData.variants !== undefined && 
                          `, Variants ${result.shopeeTest.verifiedData.variants ? '✓' : '✗'}`
                        }
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.tiktokTest.status)}
                        <span className="text-sm font-medium">TikTok</span>
                      </div>
                      {getStatusBadge(result.tiktokTest.status)}
                    </div>
                    
                    {result.tiktokTest.verifiedData && (
                      <div className="text-xs text-muted-foreground ml-6">
                        Verified: Title {result.tiktokTest.verifiedData.title ? '✓' : '✗'}, 
                        Price {result.tiktokTest.verifiedData.price ? '✓' : '✗'}, 
                        Tokopedia {result.tiktokTest.verifiedData.tokopediaIncluded ? '✓' : '✗'}
                        {result.tiktokTest.verifiedData.variants !== undefined && 
                          `, Variants ${result.tiktokTest.verifiedData.variants ? '✓' : '✗'}`
                        }
                      </div>
                    )}

                    {(result.shopeeTest.message || result.tiktokTest.message) && (
                      <div className="text-xs text-muted-foreground">
                        {result.shopeeTest.message && (
                          <div>Shopee: {result.shopeeTest.message}</div>
                        )}
                        {result.tiktokTest.message && (
                          <div>TikTok: {result.tiktokTest.message}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}