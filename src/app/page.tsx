import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user-service';

// Force dynamic rendering to avoid build-time Clerk issues
export const dynamic = 'force-dynamic';

const userService = new UserService();

/**
 * Root page component
 * Handles authentication flow and onboarding
 */
export default async function HomePage() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    // User is not authenticated, redirect to sign-in
    redirect('/sign-in');
  }

  // Check if user exists in our database
  const dbUser = await userService.getUserWithOrganization(clerkUser.id);

  if (!dbUser) {
    // User is authenticated but not onboarded, redirect to onboarding
    redirect('/onboarding');
  }

  // User is authenticated and onboarded, redirect to dashboard
  redirect('/dashboard');
}
