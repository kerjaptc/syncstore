/**
 * GDPR Privacy Policy API
 * Provides privacy policy information and data processing details
 */

import { NextRequest } from 'next/server';
import { GDPRComplianceService } from '@/lib/security/gdpr-compliance';
import { SecurityHeadersService } from '@/lib/security/headers';
import { AuditLoggerService, AuditEventType } from '@/lib/security/audit-logger';

export async function GET(request: NextRequest) {
  try {
    // Get privacy policy and data processing information
    const privacyPolicy = GDPRComplianceService.generatePrivacyPolicy();
    const dataProcessingInfo = GDPRComplianceService.getDataProcessingInfo();

    // Log privacy policy access
    await AuditLoggerService.logEvent(AuditEventType.DATA_READ, {
      action: 'privacy_policy_accessed',
      outcome: 'success',
      resource: 'gdpr_privacy_policy',
      details: {
        policyVersion: privacyPolicy.version,
        accessedSections: privacyPolicy.sections.length,
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse({
      privacyPolicy,
      dataProcessing: {
        purposes: dataProcessingInfo.map(record => ({
          dataType: record.dataType,
          purpose: record.purpose,
          legalBasis: record.legalBasis,
          retentionPeriod: record.retentionPeriod === -1 ? 'Indefinite' : `${record.retentionPeriod} days`,
          thirdParties: record.thirdParties || [],
          description: record.description,
        })),
      },
      userRights: {
        access: {
          title: 'Right of Access',
          description: 'You have the right to request copies of your personal data.',
          howToExercise: 'Use the data export feature in your account settings.',
        },
        rectification: {
          title: 'Right to Rectification',
          description: 'You have the right to request correction of inaccurate personal data.',
          howToExercise: 'Update your information in your account settings or contact support.',
        },
        erasure: {
          title: 'Right to Erasure (Right to be Forgotten)',
          description: 'You have the right to request deletion of your personal data.',
          howToExercise: 'Use the data deletion feature in your account settings.',
        },
        portability: {
          title: 'Right to Data Portability',
          description: 'You have the right to receive your data in a structured, machine-readable format.',
          howToExercise: 'Use the data export feature to download your data.',
        },
        objection: {
          title: 'Right to Object',
          description: 'You have the right to object to processing of your personal data.',
          howToExercise: 'Manage your consent preferences in your account settings.',
        },
        restriction: {
          title: 'Right to Restriction of Processing',
          description: 'You have the right to request restriction of processing your personal data.',
          howToExercise: 'Contact our support team to request processing restrictions.',
        },
      },
      contact: {
        dataProtectionOfficer: {
          email: 'dpo@storesync.com',
          address: 'StoreSync Data Protection Officer, [Company Address]',
        },
        supervisoryAuthority: {
          name: 'Information Commissioner\'s Office (ICO)',
          website: 'https://ico.org.uk',
          phone: '+44 303 123 1113',
        },
      },
    });

  } catch (error) {
    console.error('Privacy policy retrieval failed:', error);

    await AuditLoggerService.logEvent(AuditEventType.SYSTEM_ERROR, {
      action: 'privacy_policy_retrieval_failed',
      outcome: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
    });

    return SecurityHeadersService.createSecureResponse(
      { error: 'Failed to retrieve privacy policy' },
      { status: 500 }
    );
  }
}