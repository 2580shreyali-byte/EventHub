import { invitationService } from '../services/invitation.service.js';
import { successResponse } from '../utils/apiResponse.js';

export class InvitationController {
  async listInvitations(req, res, next) {
    try {
      const data = await invitationService.listInvitations(req.user.id);
      return successResponse(res, data, 'Invitations retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async acceptInvitation(req, res, next) {
    try {
      const invitationId = parseInt(req.params.id, 10);
      const result = await invitationService.acceptInvitation(invitationId, req.user);

      const message = result.teamRegistrationStatus === 'confirmed'
        ? 'Invitation accepted. Team registration is now confirmed and your individual SmartPass has been issued.'
        : 'Invitation accepted. Waiting for remaining team members to accept.';

      const responseData = {
        invitationId: result.invitationId,
        teamRegistrationStatus: result.teamRegistrationStatus
      };

      if (result.myPass) {
        responseData.myPass = result.myPass;
      }

      return successResponse(res, responseData, message, 200);
    } catch (err) {
      next(err);
    }
  }

  async declineInvitation(req, res, next) {
    try {
      const invitationId = parseInt(req.params.id, 10);
      await invitationService.declineInvitation(invitationId, req.user);
      return successResponse(res, null, 'Invitation declined.', 200);
    } catch (err) {
      next(err);
    }
  }
}

export const invitationController = new InvitationController();
