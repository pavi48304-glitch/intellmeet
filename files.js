import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect } from '../middleware/auth.js';
import Meeting from '../models/Meeting.js';

const router = express.Router();

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './public/uploads';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (accept images, docs, pdfs, sheets)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.png', '.jpg', '.jpeg', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: PDF, Word, Excel, PowerPoint, TXT, Images.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// @desc    Upload file to a meeting
// @route   POST /api/files/upload
// @access  Private
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  const { meetingCode } = req.body;

  try {
    if (!meetingCode) {
      return res.status(400).json({ message: 'Meeting code is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded or invalid file type' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    const sharedFile = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: req.file.originalname,
      url: fileUrl,
      size: req.file.size,
      uploaderName: req.user.name,
      uploadedAt: new Date()
    };

    const meeting = await Meeting.findOne({ code: meetingCode });
    if (meeting) {
      meeting.sharedFiles.push(sharedFile);
      
      meeting.chatMessages.push({
        senderId: req.user._id.toString(),
        senderName: req.user.name,
        senderAvatar: req.user.avatar,
        text: `Uploaded a file: ${sharedFile.name}`,
        fileUrl: sharedFile.url,
        fileName: sharedFile.name,
        fileSize: sharedFile.size
      });

      await meeting.save();
    }

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json({
      success: true,
      file: sharedFile,
      chatMessage: meeting.chatMessages[meeting.chatMessages.length - 1]
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: error.message || 'Server error uploading file' });
  }
});

export default router;
