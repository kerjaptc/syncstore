/**
 * Clerk Webhook Handler
 * Synchronizes Clerk user events with our database
 */

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user-service';
import { env } from '@/env';
import { UserRole } from '@/types';

const userService = new UserService();

/**
 * Handle Clerk webhook events
 */
export async function POST(req: NextRequest) {
  // Verify webhook signature
  if (!env.CLERK_WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // Check for required headers
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing required headers' },
      { status: 400 }
    );
  }

  // Get request body
  const payload = await req.text();

  // Create webhook instance
  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify webhook
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    );
  }

  // Handle different event types
  try {
    switch (evt.type) {
      case 'user.created':
        await handleUserCreated(evt);
        break;
      
      case 'user.updated':
        await handleUserUpdated(evt);
        break;
      
      case 'user.deleted':
        await handleUserDeleted(evt);
        break;
      
      case 'organization.created':
        await handleOrganizationCreated(evt);
        break;
      
      case 'organizationMembership.created':
        await handleOrganizationMembershipCreated(evt);
        break;
      
      case 'organizationMembership.updated':
        await handleOrganizationMembershipUpdated(evt);
        break;
      
      case 'organizationMembership.deleted':
        await handleOrganizationMembershipDeleted(evt);
        break;
      
      default:
        console.log(`Unhandled webhook event type: ${evt.type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle user created event
 */
async function handleUserCreated(evt: WebhookEvent) {
  if (evt.type !== 'user.created') return;

  const { id, email_addresses, first_name, last_name } = evt.data;
  
  const primaryEmail = email_addresses.find(email => email.id === evt.data.primary_email_address_id);
  if (!primaryEmail) {
    console.error('No primary email found for user:', id);
    return;
  }

  const fullName = [first_name, last_name].filter(Boolean).join(' ') || undefined;

  console.log(`User created: ${id} (${primaryEmail.email_address})`);

  // Note: We don't create the user in our database here because we don't know
  // which organization they belong to yet. This will be handled during the
  // onboarding process or when they join an organization.
}

/**
 * Handle user updated event
 */
async function handleUserUpdated(evt: WebhookEvent) {
  if (evt.type !== 'user.updated') return;

  const { id, email_addresses, first_name, last_name } = evt.data;
  
  const primaryEmail = email_addresses.find(email => email.id === evt.data.primary_email_address_id);
  if (!primaryEmail) {
    console.error('No primary email found for user:', id);
    return;
  }

  const fullName = [first_name, last_name].filter(Boolean).join(' ') || undefined;

  console.log(`User updated: ${id} (${primaryEmail.email_address})`);

  // Update user in our database if they exist
  try {
    await userService.updateUser(id, {
      fullName,
    });
  } catch (error) {
    // User might not exist in our database yet, which is fine
    console.log(`User ${id} not found in database, skipping update`);
  }
}

/**
 * Handle user deleted event
 */
async function handleUserDeleted(evt: WebhookEvent) {
  if (evt.type !== 'user.deleted') return;

  const { id } = evt.data;
  
  if (!id) {
    console.error('No user ID found in delete event');
    return;
  }

  console.log(`User deleted: ${id}`);

  // Deactivate user in our database
  try {
    await userService.deactivateUser(id);
  } catch (error) {
    console.error(`Error deactivating user ${id}:`, error);
  }
}

/**
 * Handle organization created event
 */
async function handleOrganizationCreated(evt: WebhookEvent) {
  if (evt.type !== 'organization.created') return;

  const { id, name, created_by } = evt.data;

  console.log(`Organization created: ${id} (${name}) by ${created_by}`);

  // Note: We handle organization creation in our application flow
  // rather than through webhooks to ensure proper setup
}

/**
 * Handle organization membership created event
 */
async function handleOrganizationMembershipCreated(evt: WebhookEvent) {
  if (evt.type !== 'organizationMembership.created') return;

  const { organization, public_user_data, role } = evt.data;

  console.log(`User ${public_user_data.user_id} joined organization ${organization.id} as ${role}`);

  // Note: We handle membership creation in our application flow
  // to ensure proper user setup and permissions
}

/**
 * Handle organization membership updated event
 */
async function handleOrganizationMembershipUpdated(evt: WebhookEvent) {
  if (evt.type !== 'organizationMembership.updated') return;

  const { organization, public_user_data, role } = evt.data;

  console.log(`User ${public_user_data.user_id} role updated to ${role} in organization ${organization.id}`);

  // Update user role in our database
  try {
    const userRole = mapClerkRoleToUserRole(role);
    await userService.updateUser(public_user_data.user_id, {
      role: userRole,
    });
  } catch (error) {
    console.error(`Error updating user role:`, error);
  }
}

/**
 * Handle organization membership deleted event
 */
async function handleOrganizationMembershipDeleted(evt: WebhookEvent) {
  if (evt.type !== 'organizationMembership.deleted') return;

  const { organization, public_user_data } = evt.data;

  console.log(`User ${public_user_data.user_id} left organization ${organization.id}`);

  // Deactivate user in our database
  try {
    await userService.deactivateUser(public_user_data.user_id);
  } catch (error) {
    console.error(`Error deactivating user:`, error);
  }
}

/**
 * Map Clerk roles to our user roles
 */
function mapClerkRoleToUserRole(clerkRole: string): UserRole {
  switch (clerkRole) {
    case 'org:admin':
      return UserRole.ADMIN;
    case 'org:member':
      return UserRole.MEMBER;
    default:
      return UserRole.MEMBER;
  }
}