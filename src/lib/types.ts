/**
 * Re-export all types from main types file
 */

export * from '../types';

// Additional lib-specific types can be added here
export interface LibConfig {
  version: string;
  environment: string;
}
