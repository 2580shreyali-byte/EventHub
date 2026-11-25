import { authService } from '../services/auth.service.js';
import { COOKIE_OPTIONS } from '../middleware/auth.middleware.js';
import { successResponse } from '../utils/apiResponse.js';

export class AuthController {
  async register(req, res, next) {
    try {
      const { user, token } = await authService.registerUser(req.body);

      // Set HTTP-only cookie
      res.cookie('access_token', token, COOKIE_OPTIONS);

      return successResponse(
        res,
        { user },
        'Account registered successfully',
        201
      );
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { user, token } = await authService.loginUser(req.body);

      // Set HTTP-only cookie
      res.cookie('access_token', token, COOKIE_OPTIONS);

      return successResponse(
        res,
        { user },
        'Login successful',
        200
      );
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      // Clear cookie with identical options
      res.clearCookie('access_token', {
        ...COOKIE_OPTIONS,
        maxAge: 0
      });

      return successResponse(
        res,
        null,
        'Logged out successfully',
        200
      );
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      return successResponse(
        res,
        { user: req.user },
        'Profile retrieved successfully',
        200
      );
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
