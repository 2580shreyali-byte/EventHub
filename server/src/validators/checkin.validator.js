import { z } from 'zod';

export const scanCheckInSchema = z.object({
  eventId: z.coerce.number().int().positive('eventId must be a positive integer'),
  gateId: z.coerce.number().int().positive('gateId must be a positive integer'),
  scanUuid: z.string().uuid('scanUuid must be a valid UUIDv4 format'),
  qrPayload: z.string().trim().min(1, 'qrPayload is required')
});

export const createGateSchema = z.object({
  gateName: z.string().trim().min(2, 'gateName must be at least 2 characters').max(100),
  locationDescription: z.string().trim().max(255).optional().nullable()
});

export const updateGateSchema = z.object({
  gateName: z.string().trim().min(2).max(100).optional(),
  locationDescription: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean().optional()
});
