/**
 * File Upload Service
 * Handles file uploads for product images and other assets
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export class FileUploadService {
  private uploadDir: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];

  constructor() {
    this.uploadDir = join(process.cwd(), 'public', 'uploads');
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
  }

  /**
   * Upload a single file
   */
  async uploadFile(file: File, folder: string = 'products'): Promise<UploadResult> {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // Validate file type
    if (!this.allowedMimeTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || '';
    const filename = `${randomUUID()}.${fileExtension}`;
    const folderPath = join(this.uploadDir, folder);
    const filePath = join(folderPath, filename);

    try {
      // Ensure upload directory exists
      await mkdir(folderPath, { recursive: true });

      // Convert file to buffer and save
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      // Return upload result
      return {
        url: `/uploads/${folder}/${filename}`,
        filename,
        size: file.size,
        mimeType: file.type,
      };
    } catch (error) {
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(files: File[], folder: string = 'products'): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await this.uploadFile(files[i], folder);
        results.push(result);
      } catch (error) {
        errors.push(`File ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Some files failed to upload: ${errors.join(', ')}`);
    }

    return results;
  }

  /**
   * Delete uploaded file
   */
  async deleteFile(url: string): Promise<void> {
    try {
      const { unlink } = await import('fs/promises');
      const filePath = join(process.cwd(), 'public', url);
      await unlink(filePath);
    } catch (error) {
      // File might not exist, which is okay
      console.warn(`Failed to delete file ${url}:`, error);
    }
  }

  /**
   * Validate image dimensions (for future use with image processing)
   */
  async validateImageDimensions(file: File, maxWidth: number = 2048, maxHeight: number = 2048): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve(img.width <= maxWidth && img.height <= maxHeight);
      };
      img.onerror = () => resolve(false);
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get file info from URL
   */
  getFileInfo(url: string): { folder: string; filename: string } {
    const parts = url.split('/');
    const filename = parts.pop() || '';
    const folder = parts[parts.length - 1] || '';
    return { folder, filename };
  }
}