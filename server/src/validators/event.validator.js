import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
  category: z.string().trim().min(2, 'Category must be at least 2 characters').max(50),
  venue: z.string().trim().min(2, 'Venue must be at least 2 characters').max(150),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start time format' }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end time format' }),
  registrationDeadline: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid registration deadline format' }),
  maxCapacity: z.number().int().positive('Max capacity must be greater than 0'),
  registrationType: z.enum(['individual', 'team']).default('individual'),
  minTeamSize: z.number().int().min(1, 'Min team size must be at least 1').default(1),
  maxTeamSize: z.number().int().min(1, 'Max team size must be at least 1').default(1),
  status: z.enum(['draft', 'published', 'ongoing', 'completed', 'cancelled']).default('published'),
  bannerUrl: z.string().url('Invalid banner URL format').nullable().optional()
}).refine(data => new Date(data.startTime) < new Date(data.endTime), {
  message: 'Event end time must be after start time',
  path: ['endTime']
}).refine(data => new Date(data.registrationDeadline) <= new Date(data.startTime), {
  message: 'Registration deadline must be before or equal to event start time',
  path: ['registrationDeadline']
}).refine(data => data.minTeamSize <= data.maxTeamSize, {
  message: 'Minimum team size cannot exceed maximum team size',
  path: ['maxTeamSize']
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(10).optional(),
  category: z.string().trim().min(2).max(50).optional(),
  venue: z.string().trim().min(2).max(150).optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start time' }).optional(),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end time' }).optional(),
  registrationDeadline: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid registration deadline' }).optional(),
  maxCapacity: z.number().int().positive().optional(),
  registrationType: z.enum(['individual', 'team']).optional(),
  minTeamSize: z.number().int().min(1).optional(),
  maxTeamSize: z.number().int().min(1).optional(),
  status: z.enum(['draft', 'published', 'ongoing', 'completed', 'cancelled']).optional(),
  bannerUrl: z.string().url().nullable().optional()
}).refine(data => {
  if (data.startTime && data.endTime) {
    return new Date(data.startTime) < new Date(data.endTime);
  }
  return true;
}, {
  message: 'Event end time must be after start time',
  path: ['endTime']
}).refine(data => {
  if (data.registrationDeadline && data.startTime) {
    return new Date(data.registrationDeadline) <= new Date(data.startTime);
  }
  return true;
}, {
  message: 'Registration deadline must be before or equal to event start time',
  path: ['registrationDeadline']
}).refine(data => {
  if (data.minTeamSize && data.maxTeamSize) {
    return data.minTeamSize <= data.maxTeamSize;
  }
  return true;
}, {
  message: 'Minimum team size cannot exceed maximum team size',
  path: ['maxTeamSize']
});

export const eventQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1, { message: 'Page must be at least 1' }).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 100, { message: 'Limit must be between 1 and 100' }).default('10'),
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  status: z.enum(['draft', 'published', 'ongoing', 'completed', 'cancelled']).optional()
});
