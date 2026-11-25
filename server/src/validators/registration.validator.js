import { z } from 'zod';

export const registerSchema = z.object({
  registrationType: z.enum(['individual', 'team']).default('individual'),
  teamName: z.string().trim().min(2, 'Team name must be at least 2 characters').max(100, 'Team name cannot exceed 100 characters').optional(),
  memberEmails: z.array(z.string().email('Invalid email address format').toLowerCase()).optional()
}).refine(data => {
  if (data.registrationType === 'team') {
    return Boolean(data.teamName && data.teamName.trim().length >= 2);
  }
  return true;
}, {
  message: 'Team registration requires a team name of at least 2 characters',
  path: ['teamName']
}).refine(data => {
  if (data.registrationType === 'team') {
    return Array.isArray(data.memberEmails) && data.memberEmails.length > 0;
  }
  return true;
}, {
  message: 'Team registration requires at least one invited team member email',
  path: ['memberEmails']
});
