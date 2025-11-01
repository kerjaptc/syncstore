/**
 * Sync Scheduler
 * Handles automated sync scheduling with cron-like expressions
 */

import { SyncService, SyncJobConfig } from '../services/sync-service';
import { SyncJobType } from '@/types';

export interface ScheduleConfig {
    id: string;
    name: string;
    organizationId: string;
    storeId?: string;
    jobType: SyncJobType;
    cronExpression: string;
    enabled: boolean;
    options?: {
        batchSize?: number;
        maxRetries?: number;
        priority?: 'low' | 'normal' | 'high';
        conflictResolution?: 'platform_wins' | 'local_wins' | 'manual_review';
    };
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    lastRunAt?: Date;
    nextRunAt?: Date;
}

export interface CronExpression {
    minute: string;
    hour: string;
    dayOfMonth: string;
    month: string;
    dayOfWeek: string;
}

export class SyncScheduler {
    private syncService: SyncService;
    private schedules: Map<string, ScheduleConfig> = new Map();
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private isRunning = false;

    constructor(syncService: SyncService) {
        this.syncService = syncService;
    }

    /**
     * Start the scheduler
     */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.scheduleAllJobs();
        console.log('Sync scheduler started');
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;

        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();

        console.log('Sync scheduler stopped');
    }

    /**
     * Add a new schedule
     */
    addSchedule(config: Omit<ScheduleConfig, 'id' | 'createdAt' | 'updatedAt' | 'nextRunAt'>): ScheduleConfig {
        const schedule: ScheduleConfig = {
            ...config,
            id: this.generateScheduleId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            nextRunAt: this.calculateNextRun(config.cronExpression),
        };

        this.schedules.set(schedule.id, schedule);

        if (this.isRunning && schedule.enabled) {
            this.scheduleJob(schedule);
        }

        return schedule;
    }

    /**
     * Update an existing schedule
     */
    updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>): ScheduleConfig | null {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) return null;

        // Clear existing timer
        const timer = this.timers.get(scheduleId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(scheduleId);
        }

        // Update schedule
        const updatedSchedule: ScheduleConfig = {
            ...schedule,
            ...updates,
            updatedAt: new Date(),
        };

        // Recalculate next run if cron expression changed
        if (updates.cronExpression) {
            updatedSchedule.nextRunAt = this.calculateNextRun(updates.cronExpression);
        }

        this.schedules.set(scheduleId, updatedSchedule);

        // Reschedule if running and enabled
        if (this.isRunning && updatedSchedule.enabled) {
            this.scheduleJob(updatedSchedule);
        }

        return updatedSchedule;
    }

    /**
     * Remove a schedule
     */
    removeSchedule(scheduleId: string): boolean {
        const timer = this.timers.get(scheduleId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(scheduleId);
        }

        return this.schedules.delete(scheduleId);
    }

    /**
     * Get a schedule by ID
     */
    getSchedule(scheduleId: string): ScheduleConfig | null {
        return this.schedules.get(scheduleId) || null;
    }

    /**
     * Get all schedules
     */
    getAllSchedules(): ScheduleConfig[] {
        return Array.from(this.schedules.values());
    }

    /**
     * Get schedules for an organization
     */
    getOrganizationSchedules(organizationId: string): ScheduleConfig[] {
        return Array.from(this.schedules.values())
            .filter(schedule => schedule.organizationId === organizationId);
    }

    /**
     * Enable a schedule
     */
    enableSchedule(scheduleId: string): boolean {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) return false;

        schedule.enabled = true;
        schedule.updatedAt = new Date();

        if (this.isRunning) {
            this.scheduleJob(schedule);
        }

        return true;
    }

    /**
     * Disable a schedule
     */
    disableSchedule(scheduleId: string): boolean {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) return false;

        schedule.enabled = false;
        schedule.updatedAt = new Date();

        const timer = this.timers.get(scheduleId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(scheduleId);
        }

        return true;
    }

    /**
     * Manually trigger a scheduled job
     */
    async triggerSchedule(scheduleId: string): Promise<void> {
        const schedule = this.schedules.get(scheduleId);
        if (!schedule) {
            throw new Error('Schedule not found');
        }

        await this.executeScheduledJob(schedule);
    }

    /**
     * Schedule all enabled jobs
     */
    private scheduleAllJobs(): void {
        for (const schedule of this.schedules.values()) {
            if (schedule.enabled) {
                this.scheduleJob(schedule);
            }
        }
    }

    /**
     * Schedule a single job
     */
    private scheduleJob(schedule: ScheduleConfig): void {
        // Clear existing timer
        const existingTimer = this.timers.get(schedule.id);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const nextRun = schedule.nextRunAt || this.calculateNextRun(schedule.cronExpression);
        const delay = nextRun.getTime() - Date.now();

        if (delay <= 0) {
            // Should run immediately
            this.executeScheduledJob(schedule);
            return;
        }

        const timer = setTimeout(() => {
            this.executeScheduledJob(schedule);
        }, delay);

        this.timers.set(schedule.id, timer);
    }

    /**
     * Execute a scheduled job
     */
    private async executeScheduledJob(schedule: ScheduleConfig): Promise<void> {
        try {
            console.log(`Executing scheduled job: ${schedule.name} (${schedule.id})`);

            // Update last run time
            schedule.lastRunAt = new Date();
            schedule.nextRunAt = this.calculateNextRun(schedule.cronExpression);
            schedule.updatedAt = new Date();

            // Create sync job
            const jobConfig: SyncJobConfig = {
                organizationId: schedule.organizationId,
                storeId: schedule.storeId,
                jobType: schedule.jobType,
                options: schedule.options,
                metadata: {
                    ...schedule.metadata,
                    scheduledJob: true,
                    scheduleId: schedule.id,
                    scheduleName: schedule.name,
                },
            };

            await this.syncService.createSyncJob(jobConfig);

            // Schedule next run
            if (this.isRunning && schedule.enabled) {
                this.scheduleJob(schedule);
            }

        } catch (error) {
            console.error(`Error executing scheduled job ${schedule.id}:`, error);

            // Still schedule next run even if this one failed
            if (this.isRunning && schedule.enabled) {
                this.scheduleJob(schedule);
            }
        }
    }

    /**
     * Calculate next run time based on cron expression
     */
    private calculateNextRun(cronExpression: string): Date {
        // This is a simplified cron parser
        // In production, use a proper library like 'node-cron' or 'cron-parser'

        const parts = cronExpression.trim().split(/\s+/);
        if (parts.length !== 5) {
            throw new Error('Invalid cron expression. Expected format: "minute hour dayOfMonth month dayOfWeek"');
        }

        const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
        const now = new Date();
        const next = new Date(now);

        // Simple implementation for common patterns
        if (cronExpression === '0 * * * *') {
            // Every hour
            next.setMinutes(0, 0, 0);
            next.setHours(next.getHours() + 1);
        } else if (cronExpression === '0 0 * * *') {
            // Daily at midnight
            next.setHours(0, 0, 0, 0);
            next.setDate(next.getDate() + 1);
        } else if (cronExpression === '0 0 * * 0') {
            // Weekly on Sunday at midnight
            next.setHours(0, 0, 0, 0);
            const daysUntilSunday = (7 - next.getDay()) % 7;
            next.setDate(next.getDate() + (daysUntilSunday || 7));
        } else if (cronExpression === '0 0 1 * *') {
            // Monthly on the 1st at midnight
            next.setHours(0, 0, 0, 0);
            next.setDate(1);
            next.setMonth(next.getMonth() + 1);
        } else {
            // For other patterns, default to 1 hour from now
            next.setTime(now.getTime() + 60 * 60 * 1000);
        }

        return next;
    }

    /**
     * Parse cron expression into components
     */
    private parseCronExpression(cronExpression: string): CronExpression {
        const parts = cronExpression.trim().split(/\s+/);
        if (parts.length !== 5) {
            throw new Error('Invalid cron expression');
        }

        return {
            minute: parts[0],
            hour: parts[1],
            dayOfMonth: parts[2],
            month: parts[3],
            dayOfWeek: parts[4],
        };
    }

    /**
     * Validate cron expression
     */
    validateCronExpression(cronExpression: string): { valid: boolean; error?: string } {
        try {
            const parts = cronExpression.trim().split(/\s+/);
            if (parts.length !== 5) {
                return { valid: false, error: 'Cron expression must have exactly 5 parts' };
            }

            const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

            // Basic validation
            if (!this.isValidCronField(minute, 0, 59)) {
                return { valid: false, error: 'Invalid minute field (0-59)' };
            }
            if (!this.isValidCronField(hour, 0, 23)) {
                return { valid: false, error: 'Invalid hour field (0-23)' };
            }
            if (!this.isValidCronField(dayOfMonth, 1, 31)) {
                return { valid: false, error: 'Invalid day of month field (1-31)' };
            }
            if (!this.isValidCronField(month, 1, 12)) {
                return { valid: false, error: 'Invalid month field (1-12)' };
            }
            if (!this.isValidCronField(dayOfWeek, 0, 7)) {
                return { valid: false, error: 'Invalid day of week field (0-7)' };
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Validate a single cron field
     */
    private isValidCronField(field: string, min: number, max: number): boolean {
        if (field === '*') return true;

        // Handle ranges (e.g., "1-5")
        if (field.includes('-')) {
            const [start, end] = field.split('-').map(Number);
            return start >= min && end <= max && start <= end;
        }

        // Handle lists (e.g., "1,3,5")
        if (field.includes(',')) {
            const values = field.split(',').map(Number);
            return values.every(val => val >= min && val <= max);
        }

        // Handle step values (e.g., "*/5")
        if (field.includes('/')) {
            const [range, step] = field.split('/');
            const stepNum = Number(step);
            if (isNaN(stepNum) || stepNum <= 0) return false;

            if (range === '*') return true;
            return this.isValidCronField(range, min, max);
        }

        // Handle single number
        const num = Number(field);
        return !isNaN(num) && num >= min && num <= max;
    }

    /**
     * Generate unique schedule ID
     */
    private generateScheduleId(): string {
        return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get schedule statistics
     */
    getStats(): {
        totalSchedules: number;
        enabledSchedules: number;
        disabledSchedules: number;
        activeTimers: number;
        nextRuns: Array<{ scheduleId: string; name: string; nextRunAt: Date }>;
    } {
        const schedules = Array.from(this.schedules.values());
        const enabled = schedules.filter(s => s.enabled);
        const nextRuns = enabled
            .filter(s => s.nextRunAt)
            .map(s => ({
                scheduleId: s.id,
                name: s.name,
                nextRunAt: s.nextRunAt!,
            }))
            .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime())
            .slice(0, 10); // Next 10 runs

        return {
            totalSchedules: schedules.length,
            enabledSchedules: enabled.length,
            disabledSchedules: schedules.length - enabled.length,
            activeTimers: this.timers.size,
            nextRuns,
        };
    }

    /**
     * Create common schedule presets
     */
    static createPresets(): Array<{
        name: string;
        cronExpression: string;
        description: string;
    }> {
        return [
            {
                name: 'Every 15 minutes',
                cronExpression: '*/15 * * * *',
                description: 'Runs every 15 minutes',
            },
            {
                name: 'Every 30 minutes',
                cronExpression: '*/30 * * * *',
                description: 'Runs every 30 minutes',
            },
            {
                name: 'Every hour',
                cronExpression: '0 * * * *',
                description: 'Runs at the start of every hour',
            },
            {
                name: 'Every 6 hours',
                cronExpression: '0 */6 * * *',
                description: 'Runs every 6 hours',
            },
            {
                name: 'Daily at midnight',
                cronExpression: '0 0 * * *',
                description: 'Runs daily at 12:00 AM',
            },
            {
                name: 'Daily at 9 AM',
                cronExpression: '0 9 * * *',
                description: 'Runs daily at 9:00 AM',
            },
            {
                name: 'Weekly on Monday',
                cronExpression: '0 0 * * 1',
                description: 'Runs every Monday at midnight',
            },
            {
                name: 'Monthly on 1st',
                cronExpression: '0 0 1 * *',
                description: 'Runs on the 1st of every month at midnight',
            },
        ];
    }
}

// Global scheduler instance
let globalScheduler: SyncScheduler | null = null;

export function getGlobalScheduler(syncService?: SyncService): SyncScheduler {
    if (!globalScheduler) {
        if (!syncService) {
            throw new Error('SyncService is required to initialize the global scheduler');
        }
        globalScheduler = new SyncScheduler(syncService);
    }
    return globalScheduler;
}