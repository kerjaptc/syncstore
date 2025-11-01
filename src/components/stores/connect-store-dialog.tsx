"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  ShoppingBag, 
  Store, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  TestTube
} from "lucide-react";
import { toast } from "sonner";
import { ShopeeIntegrationGuide } from "./shopee-integration-guide";
import { SandboxCredentials } from "./sandbox-credentials";

interface ConnectStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StoreCredentials {
  platform: string;
  partnerId: string;
  partnerKey: string;
  shopId: string;
  storeName: string;
  isSandbox: boolean;
}

const platforms = [
  {
    id: "shopee",
    name: "Shopee",
    icon: <ShoppingBag className="h-5 w-5" />,
    color: "bg-orange-500",
    description: "Marketplace terbesar di Asia Tenggara",
    status: "available"
  },
  {
    id: "tokopedia",
    name: "Tokopedia",
    icon: <Store className="h-5 w-5" />,
    color: "bg-green-500",
    description: "Marketplace terbesar di Indonesia",
    status: "coming_soon"
  },
  {
    id: "lazada",
    name: "Lazada",
    icon: <Store className="h-5 w-5" />,
    color: "bg-blue-500",
    description: "E-commerce platform regional",
    status: "coming_soon"
  }
];

export function ConnectStoreDialog({ open, onOpenChange }: ConnectStoreDialogProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [credentials, setCredentials] = useState<StoreCredentials>({
    platform: "",
    partnerId: "",
    partnerKey: "",
    shopId: "",
    storeName: "",
    isSandbox: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [activeTab, setActiveTab] = useState("select");

  const handlePlatformSelect = (platformId: string) => {
    setSelectedPlatform(platformId);
    setCredentials({ ...credentials, platform: platformId });
    if (platformId === "shopee") {
      setActiveTab("guide");
    }
  };

  const handleOAuthConnect = async () => {
    setIsConnecting(true);
    
    try {
      const env = credentials.isSandbox ? 'sandbox' : 'production';
      const oauthUrl = `/api/platforms/shopee/oauth/start?env=${env}`;
      
      // Redirect to OAuth flow
      window.location.href = oauthUrl;
      
    } catch (error) {
      toast.error("Gagal memulai proses OAuth. Silakan coba lagi.");
      console.error("OAuth start error:", error);
      setIsConnecting(false);
    }
  };

  const handleShopeeConnect = () => {
    setActiveTab("connect");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hubungkan Toko Baru</DialogTitle>
          <DialogDescription>
            Pilih platform dan ikuti panduan untuk menghubungkan toko Anda
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="select">Pilih Platform</TabsTrigger>
            <TabsTrigger value="guide" disabled={!selectedPlatform}>
              Panduan Setup
            </TabsTrigger>
            <TabsTrigger value="connect" disabled={!selectedPlatform}>
              Hubungkan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {platforms.map((platform) => (
                <Card 
                  key={platform.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPlatform === platform.id ? 'ring-2 ring-primary' : ''
                  } ${platform.status === 'coming_soon' ? 'opacity-60' : ''}`}
                  onClick={() => platform.status === 'available' && handlePlatformSelect(platform.id)}
                >
                  <CardHeader className="text-center">
                    <div className={`w-12 h-12 ${platform.color} rounded-lg flex items-center justify-center mx-auto text-white`}>
                      {platform.icon}
                    </div>
                    <CardTitle className="flex items-center justify-center gap-2">
                      {platform.name}
                      {platform.status === 'coming_soon' && (
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{platform.description}</CardDescription>
                  </CardHeader>
                  {selectedPlatform === platform.id && (
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-center text-green-600">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span className="text-sm font-medium">Terpilih</span>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {selectedPlatform && (
              <div className="flex justify-end">
                <Button onClick={() => setActiveTab("guide")}>
                  Lanjut ke Panduan
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="guide" className="space-y-4">
            {selectedPlatform === "shopee" && (
              <div className="space-y-6">
                <SandboxCredentials />
                <ShopeeIntegrationGuide onConnect={handleShopeeConnect} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="connect" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {selectedPlatform === "shopee" && <ShoppingBag className="h-5 w-5" />}
                  Hubungkan Toko {platforms.find(p => p.id === selectedPlatform)?.name}
                </CardTitle>
                <CardDescription>
                  Gunakan OAuth untuk menghubungkan toko Anda dengan aman
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Environment Selection */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <TestTube className="h-5 w-5 text-blue-500" />
                    <div>
                      <Label htmlFor="sandbox-mode" className="text-sm font-medium">
                        Sandbox Mode
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Gunakan untuk testing dengan akun sandbox Shopee
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="sandbox-mode"
                    checked={credentials.isSandbox}
                    onCheckedChange={(checked) => setCredentials({ ...credentials, isSandbox: checked })}
                  />
                </div>

                {credentials.isSandbox && (
                  <Alert>
                    <TestTube className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Sandbox Mode:</strong> Anda akan diarahkan ke halaman login sandbox Shopee. 
                      Gunakan akun sandbox: SANDBOX.dc7b96d53f3729fee***
                    </AlertDescription>
                  </Alert>
                )}

                {/* Shop ID Display (Read-only, filled after OAuth) */}
                <div className="space-y-2">
                  <Label htmlFor="shopId">Shop ID</Label>
                  <Input
                    id="shopId"
                    placeholder="Akan terisi otomatis setelah OAuth"
                    value={credentials.shopId}
                    readOnly
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shop ID akan terisi otomatis setelah proses OAuth berhasil
                  </p>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {credentials.isSandbox 
                      ? "Mode Sandbox: Anda akan login menggunakan akun sandbox Shopee untuk testing."
                      : "Mode Production: Anda akan login menggunakan akun Shopee seller yang sebenarnya."
                    }
                  </AlertDescription>
                </Alert>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 text-blue-900">Proses OAuth:</h4>
                  <ol className="text-sm space-y-1 text-blue-800">
                    <li>1. Klik "Hubungkan Toko" di bawah</li>
                    <li>2. Anda akan diarahkan ke halaman login Shopee</li>
                    <li>3. Login dengan akun {credentials.isSandbox ? 'sandbox' : 'seller'} Anda</li>
                    <li>4. Berikan izin akses ke aplikasi</li>
                    <li>5. Anda akan kembali ke dashboard dengan toko terhubung</li>
                  </ol>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Button variant="outline" asChild>
                    <a 
                      href="https://open.shopee.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Butuh Bantuan?
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setActiveTab("guide")}>
                      Kembali ke Panduan
                    </Button>
                    <Button 
                      onClick={handleOAuthConnect} 
                      disabled={isConnecting}
                      size="lg"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Menghubungkan...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Hubungkan Toko ({credentials.isSandbox ? 'Sandbox' : 'Production'})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}