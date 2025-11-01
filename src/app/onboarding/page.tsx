/**
 * Onboarding Page
 * Handles new user setup and organization creation
 */

import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { UserService } from '@/lib/services/user-service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const userService = new UserService();

export default async function OnboardingPage() {
  const clerkUser = await currentUser();
  
  if (!clerkUser) {
    redirect('/sign-in');
  }

  // Check if user already exists in our database
  const existingUser = await userService.getUserWithOrganization(clerkUser.id);
  
  if (existingUser) {
    // User already onboarded, redirect to dashboard
    redirect('/dashboard');
  }

  const userEmail = clerkUser.emailAddresses.find(
    email => email.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (!userEmail) {
    throw new Error('No email address found for user');
  }

  const userFullName = [clerkUser.firstName, clerkUser.lastName]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="w-full max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 bg-clip-text text-transparent">
            Welcome to SyncStore
          </h1>
          <p className="text-muted-foreground mt-2">
            Let's set up your organization to get started
          </p>
        </div>
        
        <OnboardingForm
          userId={clerkUser.id}
          userEmail={userEmail}
          userFullName={userFullName}
        />
      </div>
    </div>
  );
}