import { Profile, Report } from '../../src/types.js';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { db, loadDb, saveDb, rebuildBlocksCache } from '../db.js';
import { authenticateUser } from '../middleware.js';
import { broadcastToRoom } from '../websocket.js';
import { generatePrefixedId, generateUlid } from '../utils/ulid.js';
import { uploadBufferToCloudStorage, isCloudStorageConfigured } from '../services/storageService.js';

export const profileRouter = express.Router();

// Retrieve profile for a particular userId header
profileRouter.get('/user/:userId/profile', authenticateUser, (req, res) => {
  try {
    const { userId } = req.params;
    const targetUserId = parseInt(userId, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Valid user identity required.' });
    }

    loadDb();
    db.profiles = db.profiles || [];

    let profile = db.profiles.find((p) => p && Number(p.user_id) === targetUserId);

    // Defensive default seeding to guarantee uptime and avoid empty screens
    if (!profile) {
      profile = {
        profile_id: `p_${targetUserId}`,
        user_id: targetUserId,
        bio: 'Secured Velum channel member.',
        avatar: '',
        updated_at: new Date().toISOString(),
        settings: {
          theme: 'dark',
          notificationsEnabled: true,
          burnDefaultSeconds: 0
        },
        location: 'Warsaw, Poland'
      };
      db.profiles.push(profile);
      saveDb();
    }

    const currentUserId =(req as any). user.user_id;
    const isBlocked = (db.user_blocks || []).some(b => b.blocker_id === currentUserId && b.blocked_id === targetUserId);
    const isMuted = (db.user_mutes || []).some(m => m.muter_id === currentUserId && m.muted_id === targetUserId);

    res.json({
      ...profile,
      isBlocked,
      isMuted
    });
  } catch (err: any) {
    console.error('Error in GET /user/:userId/profile:', err);
    res.status(500).json({ error: 'Failed to access profile record.' });
  }
});

profileRouter.post('/user/upload-avatar', authenticateUser, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'], limit: '5mb' }), async (req, res) => {
  try {
    const user = (req as any).user;
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer)) {
      return res.status(400).json({ error: 'Invalid image payload. Must be a binary blob.' });
    }

    const contentType = req.headers['content-type'] || 'image/jpeg';
    const filename = `avatars/avatar_${user.user_id}_${generateUlid()}.jpg`;

    if (isCloudStorageConfigured()) {
      try {
        const cloudUrl = await uploadBufferToCloudStorage(buffer, filename, contentType);
        return res.json({ success: true, url: cloudUrl });
      } catch (cloudErr) {
        console.warn('R2/S3 Avatar upload failed, using local disk fallback:', cloudErr);
      }
    }
    
    const publicDir = path.join(process.cwd(), 'public', 'avatars');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const localFilename = `avatar_${user.user_id}_${generateUlid()}.jpg`;
    const filepath = path.join(publicDir, localFilename);
    fs.writeFileSync(filepath, buffer);
    
    const mockCloudUrl = `/avatars/${localFilename}`;
    res.json({ success: true, url: mockCloudUrl });
  } catch (err: any) {
    console.error('Error uploading avatar:', err);
    res.status(500).json({ error: 'Failed to upload avatar.' });
  }
});

profileRouter.post('/user/upload-media', authenticateUser, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'application/octet-stream'], limit: '15mb' }), async (req, res) => {
  try {
    const user = (req as any).user;
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer)) {
      return res.status(400).json({ error: 'Invalid payload. Must be a binary blob.' });
    }
    
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    let ext = '.bin';
    if (contentType.includes('image/jpeg')) ext = '.jpg';
    else if (contentType.includes('image/png')) ext = '.png';
    else if (contentType.includes('image/webp')) ext = '.webp';
    else if (contentType.includes('audio/webm')) ext = '.webm';
    else if (contentType.includes('audio/mp4')) ext = '.mp4';
    else if (contentType.includes('audio/ogg')) ext = '.ogg';
    else if (contentType.includes('audio/mpeg')) ext = '.mp3';
    else if (contentType.includes('audio/wav')) ext = '.wav';

    const fileKey = `media/media_${user.user_id}_${generateUlid()}${ext}`;

    if (isCloudStorageConfigured()) {
      try {
        const cloudUrl = await uploadBufferToCloudStorage(buffer, fileKey, contentType);
        return res.json({ success: true, url: cloudUrl });
      } catch (cloudErr) {
        console.warn('R2/S3 Media upload failed, using local disk fallback:', cloudErr);
      }
    }
    
    const mediaDir = path.join(process.cwd(), 'public', 'media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    
    const localFilename = `media_${user.user_id}_${generateUlid()}${ext}`;
    const filepath = path.join(mediaDir, localFilename);
    fs.writeFileSync(filepath, buffer);
    
    const mediaUrl = `/media/${localFilename}`;
    res.json({ success: true, url: mediaUrl });
  } catch (err: any) {
    console.error('Error uploading media:', err);
    res.status(500).json({ error: 'Failed to upload media.' });
  }
});


// Update current log payload profile parameters
profileRouter.post('/user/profile', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const { displayName, bio, avatar, location, theme, notificationsEnabled, burnDefaultSeconds } = req.body;

    loadDb();
    db.profiles = db.profiles || [];

    let profileIndex = db.profiles.findIndex((p) => p && Number(p.user_id) === Number(user.user_id));

    let profile: Profile;

    if (profileIndex === -1) {
      profile = {
        profile_id: `p_${user.user_id}`,
        user_id: Number(user.user_id),
        displayName: displayName || '',
        bio: bio || '',
        avatar: avatar || '',
        updated_at: new Date().toISOString(),
        settings: {
          theme: theme || 'dark',
          notificationsEnabled: notificationsEnabled !== undefined ? !!notificationsEnabled : true,
          burnDefaultSeconds: burnDefaultSeconds !== undefined ? parseInt(burnDefaultSeconds, 10) : 0
        },
        location: location || ''
      };
      db.profiles.push(profile);
    } else {
      profile = db.profiles[profileIndex];
      if (displayName !== undefined) profile.displayName = displayName;
      if (bio !== undefined) profile.bio = bio;
      if (avatar !== undefined) profile.avatar = avatar;
      if (location !== undefined) profile.location = location;
      
      profile.settings = profile.settings || { theme: 'dark', notificationsEnabled: true, burnDefaultSeconds: 0 };
      if (theme !== undefined) profile.settings.theme = theme;
      if (notificationsEnabled !== undefined) profile.settings.notificationsEnabled = !!notificationsEnabled;
      if (burnDefaultSeconds !== undefined) profile.settings.burnDefaultSeconds = parseInt(burnDefaultSeconds, 10);
      
      profile.updated_at = new Date().toISOString();
      db.profiles[profileIndex] = profile;
    }

    saveDb();
    res.json({ success: true, profile });
  } catch (err: any) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to record changes on profile node.' });
  }
});

// Block a user (toggles block state)
profileRouter.post('/user/:targetId/block', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const targetId = parseInt(req.params.targetId, 10);
    if (isNaN(targetId)) return res.status(400).json({ error: 'Invalid target' });
    if (targetId === user.user_id) return res.status(400).json({ error: 'Cannot block yourself' });
    
    loadDb();
    db.user_blocks = db.user_blocks || [];
    const existingIndex = db.user_blocks.findIndex(b => b.blocker_id === user.user_id && b.blocked_id === targetId);
    if (existingIndex !== -1) {
      // Unblock
      db.user_blocks.splice(existingIndex, 1);
    } else {
      // Block
      db.user_blocks.push({
        block_id: generatePrefixedId('blk'),
        blocker_id: user.user_id,
        blocked_id: targetId,
        created_at: new Date().toISOString()
      });
      
      // Also remove any existing peer relationships and requests
      db.peer_relationships = (db.peer_relationships || []).filter(
        r => !(r.userId === user.user_id && r.friendId === targetId) && !(r.userId === targetId && r.friendId === user.user_id)
      );
      db.friend_requests = (db.friend_requests || []).filter(
        r => !(r.sender_id === user.user_id && r.receiver_id === targetId) && !(r.sender_id === targetId && r.receiver_id === user.user_id)
      );
    }
    saveDb();
    rebuildBlocksCache();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock a user
profileRouter.post('/user/:targetId/unblock', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const targetId = parseInt(req.params.targetId, 10);
    if (isNaN(targetId)) return res.status(400).json({ error: 'Invalid target' });
    
    loadDb();
    db.user_blocks = db.user_blocks || [];
    db.user_blocks = db.user_blocks.filter(b => !(b.blocker_id === user.user_id && b.blocked_id === targetId));
    saveDb();
    rebuildBlocksCache();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Delete a DM chat (absolute purge)
profileRouter.delete('/user/:targetId/chat', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const targetId = parseInt(req.params.targetId, 10);
    if (isNaN(targetId)) return res.status(400).json({ error: 'Invalid target' });
    
    const roomId = targetId === 999 
      ? `dm_velum_${user.user_id}`
      : `dm_${[user.user_id, targetId].sort((a,b) => a-b).join('_')}`;
      
    loadDb();
    
    // Completely purge messages for this DM chat room
    db.messages = (db.messages || []).filter(m => m.room_id !== roomId);
    saveDb();
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Mute a user (toggles mute state)
profileRouter.post('/user/:targetId/mute', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const targetId = parseInt(req.params.targetId, 10);
    if (isNaN(targetId)) return res.status(400).json({ error: 'Invalid target' });
    
    loadDb();
    db.user_mutes = db.user_mutes || [];
    const existingIndex = db.user_mutes.findIndex(m => m.muter_id === user.user_id && m.muted_id === targetId);
    if (existingIndex !== -1) {
      // Unmute
      db.user_mutes.splice(existingIndex, 1);
    } else {
      // Mute
      db.user_mutes.push({
        mute_id: generatePrefixedId('mute'),
        muter_id: user.user_id,
        muted_id: targetId,
        created_at: new Date().toISOString()
      });
    }
    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mute user' });
  }
});

// Unmute a user
profileRouter.post('/user/:targetId/unmute', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const targetId = parseInt(req.params.targetId, 10);
    if (isNaN(targetId)) return res.status(400).json({ error: 'Invalid target' });
    
    loadDb();
    db.user_mutes = db.user_mutes || [];
    db.user_mutes = db.user_mutes.filter(m => !(m.muter_id === user.user_id && m.muted_id === targetId));
    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unmute user' });
  }
});

profileRouter.post('/user/:targetId/report', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const { targetId } = req.params;
    const { reason, messageId } = req.body;

    loadDb();
    db.reports = db.reports || [];

    const isHigh = reason?.toLowerCase().includes('scam') || reason?.toLowerCase().includes('fraud');

    const newReport: Report = {
      report_id: generatePrefixedId('rep'),
      reporter_id: user.user_id,
      reporter_name: user.username,
      target_user_id: targetId ? parseInt(targetId, 10) : null,
      target_username: targetId ? db.users.find(u => u.user_id === parseInt(targetId, 10))?.username || null : null,
      target_message_id: messageId || null,
      type: 'user_misconduct',
      priority: isHigh ? 'HIGH' : 'LOW',
      reason: reason || 'User misconduct reported.',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    db.reports.push(newReport);
    saveDb();
    broadcastToRoom('admin_channel', { type: 'admin_update', subType: 'reports' });

    res.json({ success: true, report: newReport });
  } catch (err: any) {
    console.error('Error submitting user report:', err);
    res.status(500).json({ error: 'Failed to report user' });
  }
});

profileRouter.post('/reports', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const { type, reason } = req.body;

    if (!type || !reason) {
      return res.status(400).json({ error: 'Type and reason are required.' });
    }

    loadDb();
    db.reports = db.reports || [];

    const isHigh = reason?.toLowerCase().includes('scam') || reason?.toLowerCase().includes('fraud');

    const newReport: Report = {
      report_id: generatePrefixedId('rep'),
      reporter_id: user.user_id,
      reporter_name: user.username,
      type: type === 'bug' || type === 'bug_report' ? 'bug_report' : 'suggestion',
      priority: isHigh ? 'HIGH' : 'LOW',
      reason: reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    db.reports.push(newReport);
    saveDb();
    broadcastToRoom('admin_channel', { type: 'admin_update', subType: 'reports' });

    res.json({ success: true, report: newReport });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});
