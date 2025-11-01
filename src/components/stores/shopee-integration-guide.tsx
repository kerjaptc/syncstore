"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Eye, 
  EyeOff,
  ShoppingBag,
  Key,
  Zap,
  Shield,
  BarChart3,
  Package,
  Truck,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

interface ShopeeIntegrationGuideProps {
  onConnect?: () => void;
}

export function ShopeeIntegrationGuide({ onConnect }: ShopeeIntegrationGuideProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [showCredentials, setShowCredentials] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const markStepComplete = (step: number) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
  };

  const steps = [
    {
      id: 1,
      title: "Registrasi Shopee Partner",
      description: "Daftar dan verifikasi akun di Shopee Open Platform",
      icon: <ShoppingBag className="h-5 w-5" />,
      estimatedTime: "1-3 hari"
    },
    {
      id: 2,
      title: "Buat Aplikasi",
      description: "Setup aplikasi di Developer Console",
      icon: <Key className="h-5 w-5" />,
      estimatedTime: "15 menit"
    },
    {
      id: 3,
      title: "Konfigurasi Kredensial",
      description: "Input Partner ID dan Key ke StoreSync",
      icon: <Shield className="h-5 w-5" />,
      estimatedTime: "5 menit"
    },
    {
      id: 4,
      title: "Authorization",
      description: "Hubungkan toko Shopee Anda",
      icon: <Zap className="h-5 w-5" />,
      estimatedTime: "2 menit"
    }
  ];

  const features = [
    {
      icon: <Package className="h-5 w-5 text-blue-500" />,
      title: "Sinkronisasi Produk",
      description: "Import dan sync produk, variasi, dan gambar secara otomatis"
    },
    {
      icon: <BarChart3 className="h-5 w-5 text-green-500" />,
      title: "Manajemen Inventory",
      description: "Real-time stock sync dengan alert untuk low stock"
    },
    {
      icon: <Truck className="h-5 w-5 text-orange-500" />,
      title: "Manajemen Pesanan",
      description: "Import pesanan dan update status secara otomatis"
    },
    {
      icon: <DollarSign className="h-5 w-5 text-purple-500" />,
      title: "Analytics & Reporting",
      description: "Insights mendalam tentang performa penjualan"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <ShoppingBag className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Hubungkan Toko Shopee</h2>
            <p className="text-muted-foreground">
              Sinkronisasi produk, pesanan, dan inventory secara otomatis
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="guide" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="guide">Panduan Setup</TabsTrigger>
          <TabsTrigger value="features">Fitur</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="space-y-6">
          {/* Progress Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Langkah-langkah Integrasi
              </CardTitle>
              <CardDescription>
                Ikuti langkah berikut untuk menghubungkan toko Shopee Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      completedSteps.includes(step.id) 
                        ? 'bg-green-100 text-green-700 border-2 border-green-200' 
                        : activeStep === step.id
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-200'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {completedSteps.includes(step.id) ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {step.icon}
                        <h4 className="font-medium">{step.title}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {step.estimatedTime}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {step.description}
                      </p>
                      {activeStep === step.id && (
                        <Button 
                          size="sm" 
                          onClick={() => {
                            markStepComplete(step.id);
                            if (step.id < steps.length) {
                              setActiveStep(step.id + 1);
                            }
                          }}
                        >
                          {step.id === steps.length ? 'Selesai' : 'Lanjut ke Step Berikutnya'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step Details */}
          {activeStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Registrasi Shopee Partner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Penting!</AlertTitle>
                  <AlertDescription>
                    Proses approval bisa memakan waktu 1-3 hari kerja. Pastikan dokumen bisnis Anda lengkap.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Shopee Open Platform</p>
                      <p className="text-sm text-muted-foreground">Daftar sebagai Partner</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://open.shopee.com/" target="_blank" rel="noopener noreferrer">
                        Buka <ExternalLink className="h-4 w-4 ml-1" />
                      </a>
                    </Button>
                  </div>
                  
                  <div className="bg-muted p-4 rounded-lg">
                    <h5 className="font-medium mb-2">Dokumen yang Diperlukan:</h5>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Dokumen identitas perusahaan</li>
                      <li>• NPWP perusahaan</li>
                      <li>• Surat izin usaha</li>
                      <li>• Rekening bank perusahaan</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Buat Aplikasi di Developer Console</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="bg-muted p-4 rounded-lg">
                    <h5 className="font-medium mb-2">Konfigurasi Aplikasi:</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">App Name:</span>
                        <span className="font-mono">StoreSync Integration</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">App Type:</span>
                        <span className="font-mono">Public App</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Callback URL:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-background px-2 py-1 rounded">
                            http://localhost:3000/api/auth/shopee/callback
                          </span>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => copyToClipboard('http://localhost:3000/api/auth/shopee/callback', 'Callback URL')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h5 className="font-medium mb-2">Permissions yang Diperlukan:</h5>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>item.base</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>item.mtsku</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>order.base</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>shop.base</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 3: Konfigurasi Kredensial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Keamanan</AlertTitle>
                  <AlertDescription>
                    Jangan pernah share kredensial API Anda. Simpan dengan aman dan gunakan environment variables.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium">Environment Variables</h5>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowCredentials(!showCredentials)}
                      >
                        {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="font-mono text-sm bg-background p-3 rounded border">
                      <div>SHOPEE_PARTNER_ID={showCredentials ? 'your_partner_id_here' : '••••••••••••'}</div>
                      <div>SHOPEE_PARTNER_KEY={showCredentials ? 'your_partner_key_here' : '••••••••••••'}</div>
                      <div>SHOPEE_REDIRECT_URI=http://localhost:3000/api/auth/shopee/callback</div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h5 className="font-medium mb-2 text-blue-900">Cara Mendapatkan Kredensial:</h5>
                    <ol className="text-sm space-y-1 text-blue-800">
                      <li>1. Login ke Shopee Partner Console</li>
                      <li>2. Pilih aplikasi yang sudah dibuat</li>
                      <li>3. Copy Partner ID dan Partner Key</li>
                      <li>4. Tambahkan ke file .env.local</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 4: Hubungkan Toko</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <Zap className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Siap untuk Menghubungkan!</h3>
                    <p className="text-muted-foreground mb-4">
                      Klik tombol di bawah untuk memulai proses authorization dengan Shopee
                    </p>
                  </div>
                  <Button size="lg" onClick={onConnect} className="w-full max-w-sm">
                    <ShoppingBag className="h-5 w-5 mr-2" />
                    Hubungkan Toko Shopee
                  </Button>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Yang Akan Terjadi:</AlertTitle>
                  <AlertDescription>
                    Anda akan diarahkan ke halaman Shopee untuk login dan memberikan izin akses ke toko Anda.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fitur Integrasi Shopee</CardTitle>
              <CardDescription>
                Manfaatkan semua fitur powerful untuk mengelola toko Shopee Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      {feature.icon}
                      <h4 className="font-medium">{feature.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshooting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Troubleshooting</CardTitle>
              <CardDescription>
                Solusi untuk masalah umum yang mungkin Anda hadapi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-red-600 mb-2">Error: "Invalid Partner Credentials"</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>• Pastikan Partner ID dan Key benar</p>
                    <p>• Cek apakah aplikasi sudah diapprove</p>
                    <p>• Verifikasi callback URL sudah benar</p>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-red-600 mb-2">Error: "Shop Not Found"</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>• Pastikan Shop ID benar</p>
                    <p>• Cek apakah toko sudah aktif di Shopee</p>
                    <p>• Verifikasi akun seller memiliki akses ke toko</p>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-red-600 mb-2">Error: "Access Token Expired"</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>• Sistem akan otomatis refresh token</p>
                    <p>• Re-authorize jika diperlukan</p>
                    <p>• Cek koneksi internet</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}