import express from 'express';
import Meeting from '../models/Meeting.js';
import { protect } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Helper to generate a meeting room code: 'abc-defg-hij'
const generateMeetingCode = () => {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const part1 = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const part3 = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `${part1}-${part2}-${part3}`;
};

// @desc    Create a new meeting room
// @route   POST /api/meetings
// @access  Private
router.post('/', protect, async (req, res) => {
  const { title } = req.body;

  try {
    if (!title) {
      return res.status(400).json({ message: 'Meeting title is required' });
    }

    const code = generateMeetingCode();
    
    const meeting = await Meeting.create({
      title,
      code,
      hostId: req.user._id.toString(),
      hostName: req.user.name,
      status: 'active'
    });

    res.status(201).json(meeting);
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Server error creating meeting' });
  }
});

// @desc    Get user meeting history
// @route   GET /api/meetings/history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const userIdStr = req.user._id.toString();
    // Find completed meetings where user is host or participant
    const history = await Meeting.find({
      status: 'completed',
      $or: [
        { hostId: userIdStr },
        { 'participants.userId': userIdStr }
      ]
    }).sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ message: 'Server error fetching history' });
  }
});

// @desc    Get meeting by code
// @route   GET /api/meetings/:code
// @access  Private
router.get('/:code', protect, async (req, res) => {
  const { code } = req.params;

  try {
    const meeting = await Meeting.findOne({ code });

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting room not found' });
    }

    res.json(meeting);
  } catch (error) {
    console.error('Fetch meeting error:', error);
    res.status(500).json({ message: 'Server error retrieving meeting' });
  }
});

// @desc    Update meeting notes
// @route   PUT /api/meetings/:code/notes
// @access  Private
router.put('/:code/notes', protect, async (req, res) => {
  const { code } = req.params;
  const { notes } = req.body;

  try {
    const meeting = await Meeting.findOneAndUpdate(
      { code },
      { sharedNotes: notes },
      { new: true }
    );

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json({ success: true, notes: meeting.sharedNotes });
  } catch (error) {
    console.error('Notes update error:', error);
    res.status(500).json({ message: 'Server error updating notes' });
  }
});

export default router;
