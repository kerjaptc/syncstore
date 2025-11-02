/**
 * SyncStore MVP Store Connection Wizard
 * 
 * This component provides a step-by-step wizard for connecting new stores
 * with OAuth authentication, validation, and error handling.
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ConnectionWizardProps {
  organizationId: string;
  onConnectionComplete?: (connection: any) => void;
  onCancel?: () => void;
}

type WizardStep = 'intro' | 'oauth' | 'callback' | 'verification' | 'complete';

interface WizardState {
  currentStep: WizardStep;
  authUrl?: string;
  state?: string;
  connection?: any;
  error?: string;
  isLoading: boolean;
}

// ============================================================================
// Store Connection Wizard Component
// ============================================================================

export function StoreConnectionWizard({
  organizationId,
  onConnectionComplete,
  onCancel,
}: ConnectionWizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 'intro',
    isLoading: false,
  });

  // Mock implementations (replace with actual tRPC when available)
  const initiateOAuth = {
    mutate: async (data: any) => {
      setWizardState(prev => ({ ...prev, isLoading: true }));
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setWizardState(prev => ({
          ...prev,
          currentStep: 'oauth',
          authUrl: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner',
          state: 'demo_state_' + Date.now(),
          isLoading: false,
        }));
      } catch (error) {
        setWizardState(prev => ({
          ...prev,
          error: 'Failed to initiate OAuth',
          isLoading: false,
        }));
        toast({
          title: 'OAuth Initiation Failed',
          description: 'Failed to initiate OAuth process',
          variant: 'destructive',
        });
      }
    }
  };

  const handleOAuthCallback = {
    mutate: async (data: any) => {
      setWizardState(prev => ({ ...prev, isLoading: true }));
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const mockConnection = {
          id: 'conn_' + Date.now(),
          storeId: 'store_demo_' + Date.now(),
          storeName: 'Demo Store',
          platform: 'shopee',
          status: 'active',
        };
        
        setWizardState(prev => ({
          ...prev,
          currentStep: 'verification',
          connection: mockConnection,
          isLoading: false,
        }));
      } catch (error) {
        setWizardState(prev => ({
          ...prev,
          error: 'OAuth callback failed',
          isLoading: false,
        }));
        toast({
          title: 'OAuth Callback Failed',
          description: 'Failed to process OAuth callback',
          variant: 'destructive',
        });
      }
    }
  };

  const verifyConnection = {
    mutate: async (data: any) => {
      setWizardState(prev => ({ ...prev, isLoading: true }));
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const connection = wizardState.connection || {
          id: 'conn_verified_' + Date.now(),
          storeId: 'store_verified_' + Date.now(),
          storeName: 'Verified Demo Store',
          platform: 'shopee',
          status: 'active',
        };
        
        setWizardState(prev => ({
          ...prev,
          currentStep: 'complete',
          connection,
          isLoading: false,
        }));
        
        // Call completion callback
        onConnectionComplete?.(connection);
      } catch (error) {
        setWizardState(prev => ({
          ...prev,
          error: 'Connection verification failed',
          isLoading: false,
        }));
        toast({
          title: 'Connection Verification Failed',
          description: 'Failed to verify connection',
          variant: 'destructive',
        });
      }
    }
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleStartOAuth = () => {
    initiateOAuth.mutate({
      organizationId,
      platform: 'shopee',
    });
  };

  const handleOpenAuthUrl = () => {
    if (wizardState.authUrl) {
      window.open(wizardState.authUrl, '_blank');
      // Simulate callback after user returns
      setTimeout(() => {
        handleOAuthCallback.mutate({
          code: 'demo_code',
          state: wizardState.state,
        });
      }, 3000);
    }
  };

  const handleVerifyConnection = () => {
    verifyConnection.mutate({
      connectionId: wizardState.connection?.id,
    });
  };

  const handleComplete = () => {
    onConnectionComplete?.(wizardState.connection);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleRetry = () => {
    setWizardState({
      currentStep: 'intro',
      isLoading: false,
    });
  };

  // ============================================================================
  // Step Progress
  // ============================================================================

  const getStepProgress = () => {
    const steps = ['intro', 'oauth', 'callback', 'verification', 'complete'];
    const currentIndex = steps.indexOf(wizardState.currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const getStepTitle = () => {
    switch (wizardState.currentStep) {
      case 'intro':
        return 'Connect Your Store';
      case 'oauth':
        return 'Authorize Access';
      case 'callback':
        return 'Processing Authorization';
      case 'verification':
        return 'Verifying Connection';
      case 'complete':
        return 'Connection Complete';
      default:
        return 'Store Connection';
    }
  };

  // ============================================================================
  // Render Steps
  // ============================================================================

  const renderIntroStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Connect Your Shopee Store</h3>
        <p className="text-muted-foreground">
          We'll guide you through connecting your Shopee store to enable product synchronization.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-medium text-blue-600">1</span>
          </div>
          <div>
            <h4 className="font-medium">Authorize Access</h4>
            <p className="text-sm text-muted-foreground">
              You'll be redirected to Shopee to authorize our application
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-medium text-blue-600">2</span>
          </div>
          <div>
            <h4 className="font-medium">Verify Connection</h4>
            <p className="text-sm text-muted-foreground">
              We'll verify the connection and fetch your store information
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-medium text-blue-600">3</span>
          </div>
          <div>
            <h4 className="font-medium">Start Syncing</h4>
            <p className="text-sm text-muted-foreground">
              Begin synchronizing your products and orders
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleStartOAuth} disabled={wizardState.isLoading} className="flex-1">
          {wizardState.isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Start Connection
        </Button>
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderOAuthStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Authorize Access</h3>
        <p className="text-muted-foreground">
          Click the button below to open Shopee authorization page
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You will be redirected to Shopee's website to authorize our application. 
          Please make sure you're logged into the correct Shopee seller account.
        </AlertDescription>
      </Alert>

      <div className="flex gap-3">
        <Button onClick={handleOpenAuthUrl} disabled={wizardState.isLoading} className="flex-1">
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Shopee Authorization
        </Button>
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderCallbackStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
        <h3 className="text-lg font-semibold mb-2">Processing Authorization</h3>
        <p className="text-muted-foreground">
          Please wait while we process your authorization...
        </p>
      </div>
    </div>
  );

  const renderVerificationStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Verify Connection</h3>
        <p className="text-muted-foreground">
          Authorization successful! Now let's verify your store connection.
        </p>
      </div>

      {wizardState.connection && (
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="font-medium text-green-800">Store Information</span>
          </div>
          <div className="space-y-1 text-sm">
            <p><strong>Store Name:</strong> {wizardState.connection.storeName}</p>
            <p><strong>Store ID:</strong> {wizardState.connection.storeId}</p>
            <p><strong>Platform:</strong> Shopee</p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleVerifyConnection} disabled={wizardState.isLoading} className="flex-1">
          {wizardState.isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Verify Connection
        </Button>
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-semibold mb-2">Connection Complete!</h3>
        <p className="text-muted-foreground">
          Your Shopee store has been successfully connected.
        </p>
      </div>

      {wizardState.connection && (
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Store Name:</span>
              <span>{wizardState.connection.storeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Store ID:</span>
              <span>{wizardState.connection.storeId}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Status:</span>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                Connected
              </Badge>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleComplete} className="flex-1">
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (wizardState.currentStep) {
      case 'intro':
        return renderIntroStep();
      case 'oauth':
        return renderOAuthStep();
      case 'callback':
        return renderCallbackStep();
      case 'verification':
        return renderVerificationStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderIntroStep();
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{getStepTitle()}</CardTitle>
              <CardDescription>
                Step {['intro', 'oauth', 'callback', 'verification', 'complete'].indexOf(wizardState.currentStep) + 1} of 5
              </CardDescription>
            </div>
            <Badge variant="outline">Shopee</Badge>
          </div>
          <Progress value={getStepProgress()} className="mt-4" />
        </CardHeader>

        <CardContent>
          {wizardState.error && (
            <Alert className="mb-6" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {wizardState.error}
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-2 p-0 h-auto"
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {renderCurrentStep()}
        </CardContent>
      </Card>
    </div>
  );
}

export default StoreConnectionWizard;