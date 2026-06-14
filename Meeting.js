import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  hostId: {
    type: String,
    required: true
  },
  hostName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  participants: [
    {
      userId: String,
      name: String,
      avatar: String,
      socketId: String,
      joinTime: {
        type: Date,
        default: Date.now
      }
    }
  ],
  transcript: [
    {
      userId: String,
      userName: String,
      text: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      translations: {
        type: Map,
        of: String,
        default: {}
      }
    }
  ],
  summary: {
    overview: { type: String, default: '' },
    topics: [{ type: String }],
    decisions: [{ type: String }],
    tone: { type: String, default: 'Neutral' }
  },
  actionItems: [
    {
      text: String,
      assignee: String,
      status: {
        type: String,
        enum: ['todo', 'in_progress', 'review', 'completed'],
        default: 'todo'
      },
      dueDate: Date
    }
  ],
  sharedFiles: [
    {
      id: String,
      name: String,
      url: String,
      size: Number,
      uploaderName: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  sharedNotes: {
    type: String,
    default: ''
  },
  chatMessages: [
    {
      senderId: String,
      senderName: String,
      senderAvatar: String,
      text: String,
      fileUrl: String,
      fileName: String,
      fileSize: Number,
      emojis: [
        {
          emoji: String,
          count: Number,
          users: [String]
        }
      ],
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  polls: [
    {
      id: { type: String, required: true },
      question: { type: String, required: true },
      options: [
        {
          text: { type: String, required: true },
          votes: [{ type: String }] // Array of user IDs
        }
      ],
      active: { type: Boolean, default: true },
      creatorName: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  }
});

const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);
export default Meeting;
