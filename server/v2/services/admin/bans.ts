import { userRepository } from '../../repositories/userRepository.js';
import { NotFoundError } from '../../utils/errors.js';

export class AdminBansService {
  async banUser(targetUserId: number, reason?: string) {
    const user = await userRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundError(`User ID ${targetUserId} not found`);
    }

    const updated = await userRepository.update(targetUserId, { role: 'BANNED' });
    return {
      userId: targetUserId,
      status: 'banned',
      reason: reason || 'Violation of terms of service'
    };
  }

  async unbanUser(targetUserId: number) {
    const user = await userRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundError(`User ID ${targetUserId} not found`);
    }

    const updated = await userRepository.update(targetUserId, { role: 'USER' });
    return {
      userId: targetUserId,
      status: 'active'
    };
  }
}

export const adminBansService = new AdminBansService();
