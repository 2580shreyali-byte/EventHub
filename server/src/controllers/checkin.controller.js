import { checkinService } from '../services/checkin.service.js';
import { successResponse } from '../utils/apiResponse.js';

export class CheckinController {
  async scan(req, res, next) {
    try {
      const { eventId, gateId, scanUuid, qrPayload } = req.body;
      const result = await checkinService.scanAndCheckIn({
        eventId,
        gateId,
        scanUuid,
        qrPayload,
        scannedByUserId: req.user.id
      });

      return successResponse(res, result, 'Entry Approved', 200);
    } catch (err) {
      next(err);
    }
  }

  async getQueueLess(req, res, next) {
    try {
      const result = await checkinService.getQueueLessMetrics(req.params.id);
      return successResponse(res, result, 'QueueLess gate metrics retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const checkinController = new CheckinController();
