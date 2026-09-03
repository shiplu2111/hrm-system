import { BadRequestException } from '@nestjs/common';

export const DOCUMENT_FILE_POLICY = {
  maxBytes: 10 * 1024 * 1024,
  allowedMimeTypes: new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
  ]),
  allowedExtensions: new Set(['.pdf', '.jpg', '.jpeg', '.png']),
} as const;

export function assertValidDocumentUpload(
  file: { mimetype: string; size: number; originalname: string },
): void {
  const ext = file.originalname.includes('.')
    ? `.${file.originalname.split('.').pop()!.toLowerCase()}`
    : '';

  if (!DOCUMENT_FILE_POLICY.allowedMimeTypes.has(file.mimetype)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Document file must be PDF, JPG, or PNG',
    });
  }

  if (ext && !DOCUMENT_FILE_POLICY.allowedExtensions.has(ext)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Document file extension must be .pdf, .jpg, .jpeg, or .png',
    });
  }

  if (file.size > DOCUMENT_FILE_POLICY.maxBytes) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Document file must be 10MB or smaller',
    });
  }
}
