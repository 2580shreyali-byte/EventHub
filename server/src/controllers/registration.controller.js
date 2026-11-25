import { registrationService } from '../services/registration.service.js';
import { successResponse } from '../utils/apiResponse.js';

export class RegistrationController {
  async register(req, res, next) {
    try {
      const eventId = parseInt(req.params.id, 10);
      const result = await registrationService.registerForEvent(eventId, req.user);

      return successResponse(
        res,
        result,
        'Registration confirmed. Your personal SmartPass has been issued.',
        201
      );
    } catch (err) {
      next(err);
    }
  }
}

export const registrationController = new RegistrationController();
