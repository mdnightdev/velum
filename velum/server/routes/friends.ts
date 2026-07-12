import { FriendRequest, PeerRelationship } from '../../src/types.js';
import express from 'express';
import { db, loadDb, saveDb, ensureVelumSystemDM, isUserBlocked } from '../db.js';
import { authenticateUser } from '../middleware.js';

export const friendsRouter = express.Router();

// Retrieve all pending and actioned friend requests for active user
friendsRouter.get('/friends/requests', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    loadDb();

    db.friend_requests = db.friend_requests || [];

    // Filter requests where current user is either sender or receiver AND no blocks exist
    const requests = db.friend_requests.filter(
      (r) => {
        if (!r) return false;
        const senderId = Number(r.sender_id);
        const receiverId = Number(r.receiver_id);
        const involved = senderId === Number(user.user_id) || receiverId === Number(user.user_id);
        if (!involved) return false;

        const otherId = senderId === Number(user.user_id) ? receiverId : senderId;
        return !isUserBlocked(user.user_id, otherId);
      }
    );

    const requestsWithDetails = requests.map((r) => {
      const senderUser = (db.users || []).find((u) => u && Number(u.user_id) === Number(r.sender_id));
      const receiverUser = (db.users || []).find((u) => u && Number(u.user_id) === Number(r.receiver_id));
      const senderProfile = (db.profiles || []).find((p) => p && Number(p.user_id) === Number(r.sender_id));
      const receiverProfile = (db.profiles || []).find((p) => p && Number(p.user_id) === Number(r.receiver_id));

      return {
        ...r,
        sender_id: Number(r.sender_id),
        receiver_id: Number(r.receiver_id),
        sender_name: senderUser ? senderUser.username : `User #${r.sender_id}`,
        sender_avatar: senderProfile ? senderProfile.avatar : '',
        receiver_name: receiverUser ? receiverUser.username : `User #${r.receiver_id}`,
        receiver_avatar: receiverProfile ? receiverProfile.avatar : ''
      };
    });

    res.json(requestsWithDetails);
  } catch (err: any) {
    console.error('Error fetching friend requests:', err);
    res.status(500).json({ error: 'Failed to load requests log.' });
  }
});

// File/dispatch a new peer link request
friendsRouter.post('/friends/requests', authenticateUser, (req, res) => {
  try {
    const { receiverUsername } = req.body;
    const user = (req as any).user;

    if (!receiverUsername) {
      return res.status(400).json({ error: 'Receiver username handle is required.' });
    }

    loadDb();
    
    // Check if receiver exists
    const target = (db.users || []).find(
      (u) => u && u.username.toLowerCase() === receiverUsername.trim().toLowerCase()
    );

    if (!target) {
      return res.status(404).json({ error: 'Target user signature not located or invalid.' });
    }

    const isSenderAdmin = (user.role as string) === 'SUPPORT_ADMIN' || (user.role as string) === 'SYSTEM_ADMIN' || (user.role as string) === 'LOGIN_ADMIN' || (user.role as string) === 'ADMIN' || (user.role && (user.role as string).includes('ADMIN'));
    const isTargetAdmin = (target.role as string) === 'SUPPORT_ADMIN' || (target.role as string) === 'SYSTEM_ADMIN' || (target.role as string) === 'LOGIN_ADMIN' || (target.role as string) === 'ADMIN' || (target.role && (target.role as string).includes('ADMIN'));

    if (isTargetAdmin && !isSenderAdmin) {
      return res.status(403).json({ error: 'Action Dev-Blocked: Establishments with administrative enclaves are prohibited.' });
    }

    if (Number(target.user_id) === Number(user.user_id)) {
      return res.status(400).json({ error: 'You cannot open an enclave link request to yourself.' });
    }

    // Check duplicate requests
    db.friend_requests = db.friend_requests || [];
    const duplicate = db.friend_requests.some(
      (r) =>
        r &&
        ((Number(r.sender_id) === Number(user.user_id) && Number(r.receiver_id) === Number(target.user_id)) ||
          (Number(r.sender_id) === Number(target.user_id) && Number(r.receiver_id) === Number(user.user_id))) &&
        r.status === 'pending'
    );

    if (duplicate) {
      return res.status(400).json({ error: 'A pending verification invite already exists between these headers.' });
    }

    const newRequest: FriendRequest = {
      request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sender_id: user.user_id,
      receiver_id: target.user_id,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    db.friend_requests.push(newRequest);
    saveDb();

    res.json(newRequest);
  } catch (err: any) {
    console.error('Error dispatching friend request:', err);
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

// Get peer relationships
friendsRouter.get('/friends/relationships', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    loadDb();
    
    db.peer_relationships = db.peer_relationships || [];
    const relationships = db.peer_relationships.filter((pr) => Number(pr.userId) === Number(user.user_id));
    
    const relationshipsWithDetails = relationships.map((pr) => {
      const friend = (db.users || []).find((u) => u && Number(u.user_id) === Number(pr.friendId));
      return {
        ...pr,
        username: friend ? friend.username : `User #${pr.friendId}`,
        last_seen_at: friend ? friend.last_seen_at : null
      };
    });
    
    res.json(relationshipsWithDetails);
  } catch (err: any) {
    console.error('Error fetching relationships:', err);
    res.status(500).json({ error: 'Failed to load relationships.' });
  }
});

// Unblock a user
friendsRouter.post('/friends/unblock', authenticateUser, (req, res) => {
  try {
    const user = (req as any).user;
    const { targetUserId } = req.body;
    
    loadDb();
    db.peer_relationships = db.peer_relationships || [];
    
    const idx = db.peer_relationships.findIndex(pr => Number(pr.userId) === Number(user.user_id) && Number(pr.friendId) === Number(targetUserId) && pr.status === 'blocked');
    if (idx !== -1) {
      db.peer_relationships.splice(idx, 1);
      saveDb();
    }
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unblock user.' });
  }
});

// Respond to friend/peer invitation request
friendsRouter.post('/friends/requests/:requestId/respond', authenticateUser, (req, res) => {
  try {
    const { requestId } = req.params;
    const { response } = req.body; // 'accepted' | 'declined'

    if (response !== 'accepted' && response !== 'declined') {
      return res.status(400).json({ error: 'Valid action response of accepted/declined is required.' });
    }

    loadDb();
    db.friend_requests = db.friend_requests || [];

    const requestIndex = db.friend_requests.findIndex((r) => r && r.request_id === requestId);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'Invitation ticket not located.' });
    }

    const inviteReq = db.friend_requests[requestIndex];

    if (inviteReq.status !== 'pending') {
      return res.status(400).json({ error: 'Request is already ' + inviteReq.status });
    }

    // Mark updated status
    if (response === 'accepted') {
      inviteReq.status = 'accepted';
      
      // Establish peer relationships (repopulate direct friend linkages)
      db.peer_relationships = db.peer_relationships || [];
      
      const newRelation1: PeerRelationship = {
        id: `rel_${Date.now()}_1`,
        userId: inviteReq.sender_id,
        friendId: inviteReq.receiver_id,
        status: 'accepted',
        created_at: new Date().toISOString()
      };
      const newRelation2: PeerRelationship = {
        id: `rel_${Date.now()}_2`,
        userId: inviteReq.receiver_id,
        friendId: inviteReq.sender_id,
        status: 'accepted',
        created_at: new Date().toISOString()
      };

      db.peer_relationships.push(newRelation1, newRelation2);

      // Auto ensure system direct message channel
      try {
        const senderUser = db.users.find(u => u.user_id === inviteReq.sender_id);
        const receiverUser = db.users.find(u => u.user_id === inviteReq.receiver_id);
        if (senderUser) {
          ensureVelumSystemDM(senderUser.user_id, senderUser.username);
        }
        if (receiverUser) {
          ensureVelumSystemDM(receiverUser.user_id, receiverUser.username);
        }
      } catch (dmErr) {
        console.warn('System DM seeding warning:', dmErr);
      }
    } else {
      inviteReq.status = 'rejected';
    }

    saveDb();
    res.json(inviteReq);
  } catch (err: any) {
    console.error('Error responding to request:', err);
    res.status(500).json({ error: 'Failed to log invite action response.' });
  }
});
