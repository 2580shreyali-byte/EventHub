import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address format').toLowerCase().max(150),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  studentId: z.string().trim().min(3, 'Student ID must be at least 3 characters').max(50),
  department: z.string().trim().min(2, 'Department must be at least 2 characters').max(100)
}).strict(); // Disallow unlisted keys such as 'role'

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  password: z.string().min(1, 'Password is required')
});
