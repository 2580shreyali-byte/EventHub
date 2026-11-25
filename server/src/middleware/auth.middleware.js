import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { authService } from '../services/auth.service.js';
import { errorResponse } from '../utils/apiResponse.js';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: (parseInt(env.JWT_EXPIRES_IN, 10) || 86400) * 1000,
  path: '/'
};

/**
 * Authentication middleware that verifies JWT from HTTP-only cookie or Bearer header.
 */
export async function authenticate(req, res, next) {
  try {
    let token = req.cookies?.access_token;

    // Fallback to Authorization header if cookie not provided (useful for automated testing)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return errorResponse(res, 'Authentication required. Please log in.', 401, 'UNAUTHORIZED');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Session has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
      }
      return errorResponse(res, 'Invalid authentication token.', 401, 'INVALID_TOKEN');
    }

    // Verify user exists in database
    const user = await authService.getUserById(decoded.id);
    if (!user) {
      return errorResponse(res, 'User account no longer exists.', 401, 'USER_NOT_FOUND');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Authorization middleware ensuring the user has one of the required roles.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        'Access denied. You do not have permission to perform this action.',
        403,
        'FORBIDDEN'
      );
    }

    next();
  };
}

/**
 * Optional authentication middleware: if token exists and valid, populates req.user.
 * Does not block if unauthenticated.
 */
export async function optionalAuth(req, res, next) {
  try {
    let token = req.cookies?.access_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        const user = await authService.getUserById(decoded.id);
        if (user) {
          req.user = user;
        }
      } catch (err) {
        // Silently continue without req.user for optional auth
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
