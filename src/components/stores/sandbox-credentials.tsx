"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, TestTube, ExternalLink, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function SandboxCredentials() {
  const [showCredentials, setShowCredentials] = useState(false);

  const sandboxData = {
    shopId: "226131025",
    shopAccount: "SANDBOX.dc7b96d53f3729fee***",
    shopPassword: "b102712cd76a0***",
    area: "Local - ID",
    partnerId: "SANDBOX_PARTNER_ID", // User needs to get this from their sandbox app
    partnerKey: "SANDBOX_PARTNER_KEY", // User needs to get this from their sandbox app
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5 text-blue-500" />
          Shopee Sandbox Credentials
        </CardTitle>
        <CardDescription>
          Gunakan kredensial ini untuk testing integrasi Shopee
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <TestTube className="h-4 w-4" />
          <AlertTitle>Sandbox Environment</AlertTitle>
          <AlertDescription>
            Kredensial ini hanya untuk testing. Tidak akan mempengaruhi data production Anda.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Shop ID</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(sandboxData.shopId, 'Shop ID')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="font-mono text-sm bg-muted p-2 rounded">
                {sandboxData.shopId}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Area</span>
              </div>
              <div className="font-mono text-sm bg-muted p-2 rounded">
                {sandboxData.area}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Shop Account</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCredentials(!showCredentials)}
                  >
                    {showCredentials ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(sandboxData.shopAccount, 'Shop Account')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="font-mono text-sm bg-muted p-2 rounded">
                {showCredentials ? sandboxData.shopAccount : '••••••••••••••••••••••••'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Shop Password</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(sandboxData.shopPassword, 'Shop Password')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="font-mono text-sm bg-muted p-2 rounded">
                {showCredentials ? sandboxData.shopPassword : '••••••••••••••'}
              </div>
            </div>
          </div>

          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertDescription>
              <strong>Penting:</strong> Anda masih perlu Partner ID dan Partner Key dari aplikasi sandbox Anda di Shopee Developer Console.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-medium">Langkah untuk mendapatkan Partner ID & Key:</h4>
            <ol className="text-sm space-y-1 text-muted-foreground ml-4">
              <li>1. Login ke <a href="https://open.shopee.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Shopee Open Platform</a></li>
              <li>2. Buat aplikasi baru atau gunakan aplikasi existing</li>
              <li>3. Set environment ke "Sandbox"</li>
              <li>4. Copy Partner ID dan Partner Key dari console</li>
              <li>5. Gunakan Shop ID: <code className="bg-muted px-1 rounded">{sandboxData.shopId}</code></li>
            </ol>
          </div>

          <div className="flex justify-center">
            <Button variant="outline" asChild>
              <a 
                href="https://open.shopee.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                Buka Shopee Developer Console
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}