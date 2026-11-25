import { passService } from '../services/pass.service.js';
import { successResponse } from '../utils/apiResponse.js';

export class PassController {
  async getMyPasses(req, res, next) {
    try {
      const passes = await passService.getMyPasses(req.user.id);
      return successResponse(res, passes, 'Passes retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getPassById(req, res, next) {
    try {
      const passId = parseInt(req.params.id, 10);
      const pass = await passService.getPassById(passId, req.user);

      if (!pass) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PASS_NOT_FOUND',
            message: 'Pass not found'
          }
        });
      }

      return successResponse(res, pass, 'Pass retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async reissuePass(req, res, next) {
    try {
      const passId = parseInt(req.params.id, 10);
      const result = await passService.reissuePass(passId, req.user.id);

      return successResponse(
        res,
        result,
        'Pass reissued successfully. Previous QR token is immediately invalidated.'
      );
    } catch (err) {
      next(err);
    }
  }
}

export const passController = new PassController();
