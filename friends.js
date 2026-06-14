import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to sanitize user objects before sending to frontend
const sanitizeUser = (user) => {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role
  };
};

// @desc    Search for users to add as friends
// @route   GET /api/friends/search?q=query
// @access  Private
router.get('/search', protect, async (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) {
    return res.json([]);
  }

  try {
    const searchRegex = new RegExp(query, 'i');
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ name: searchRegex }, { email: searchRegex }]
    }).select('-passwordHash -friends -friendRequests');

    res.json(users.map(sanitizeUser));
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error during user search' });
  }
});

// @desc    Get current user's friends
// @route   GET /api/friends
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friends', '-passwordHash -friends -friendRequests');
    const friends = user.friends;
    res.json(friends.map(sanitizeUser));
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Server error retrieving friends' });
  }
});

// @desc    Get pending incoming friend requests
// @route   GET /api/friends/requests
// @access  Private
router.get('/requests', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friendRequests', '-passwordHash -friends -friendRequests');
    const requests = user.friendRequests;
    
    res.json(requests.map(sanitizeUser));
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ message: 'Server error retrieving friend requests' });
  }
});

// @desc    Send a friend request
// @route   POST /api/friends/request/:id
// @access  Private
router.post('/request/:id', protect, async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = req.user._id.toString();

  if (targetUserId === currentUserId) {
    return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
  }

  try {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });
    
    if (targetUser.friends.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are already friends with this user' });
    }
    if (targetUser.friendRequests.includes(req.user._id)) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }
    
    targetUser.friendRequests.push(req.user._id);
    await targetUser.save();
    
    res.json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Server error sending friend request' });
  }
});

// @desc    Accept a friend request
// @route   POST /api/friends/accept/:id
// @access  Private
router.post('/accept/:id', protect, async (req, res) => {
  const requesterId = req.params.id;
  const currentUserId = req.user._id.toString();

  try {
    const currentUser = await User.findById(req.user._id);
    const requesterUser = await User.findById(requesterId);
    
    if (!currentUser || !requesterUser) return res.status(404).json({ message: 'User not found' });
    
    if (!currentUser.friendRequests.includes(requesterId)) {
      return res.status(400).json({ message: 'No friend request from this user' });
    }
    
    currentUser.friendRequests.pull(requesterId);
    if (!currentUser.friends.includes(requesterId)) currentUser.friends.push(requesterId);
    if (!requesterUser.friends.includes(req.user._id)) requesterUser.friends.push(req.user._id);
    
    await currentUser.save();
    await requesterUser.save();
    
    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ message: 'Server error accepting friend request' });
  }
});

// @desc    Reject a friend request
// @route   POST /api/friends/reject/:id
// @access  Private
router.post('/reject/:id', protect, async (req, res) => {
  const requesterId = req.params.id;
  const currentUserId = req.user._id.toString();

  try {
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });
    
    currentUser.friendRequests.pull(requesterId);
    await currentUser.save();
    
    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ message: 'Server error rejecting friend request' });
  }
});

// @desc    Remove a friend
// @route   DELETE /api/friends/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  const friendId = req.params.id;
  const currentUserId = req.user._id.toString();

  try {
    const currentUser = await User.findById(req.user._id);
    const friendUser = await User.findById(friendId);
    
    if (currentUser) {
      currentUser.friends.pull(friendId);
      await currentUser.save();
    }
    if (friendUser) {
      friendUser.friends.pull(req.user._id);
      await friendUser.save();
    }
    
    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Server error removing friend' });
  }
});

export default router;
