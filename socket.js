import Meeting from '../models/Meeting.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export const handleSocketConnections = (io) => {
  // Store active rooms and their participants
  // roomCode -> Map of socketId -> userDetails
  const rooms = new Map();

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // 1. JOIN ROOM
    socket.on('join-room', async ({ meetingCode, token }) => {
      try {
        if (!token) throw new Error('Authentication token missing');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_local_secret');
        const user = await User.findById(decoded.id);

        if (!user) throw new Error('Authenticated user not found in database');

        const userId = user._id.toString();
        const name = user.name;
        const avatar = user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

        socket.join(meetingCode);
      
      if (!rooms.has(meetingCode)) {
        rooms.set(meetingCode, new Map());
      }
      
      const room = rooms.get(meetingCode);
      const participantInfo = {
        socketId: socket.id,
        userId: userId.toString(),
        name,
        avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}` // Assigned colored cursor
      };
      
      room.set(socket.id, participantInfo);
      
      console.log(`👤 User ${name} (${socket.id}) joined meeting: ${meetingCode}`);

      // Save participant to database/mock store
      try {
        const meeting = await Meeting.findOne({ code: meetingCode });
        if (meeting) {
          const alreadyExists = meeting.participants.some(p => p.userId === userId.toString());
          if (!alreadyExists) {
            meeting.participants.push({
              userId: userId.toString(),
              name,
              avatar: participantInfo.avatar,
              socketId: socket.id
            });
            await meeting.save();
          } else {
            await Meeting.updateOne(
              { code: meetingCode, 'participants.userId': userId.toString() },
              { $set: { 'participants.$.socketId': socket.id } }
            );
          }
        }
      } catch (err) {
        console.error('Error saving participant to DB:', err.message);
      }

      // Notify others in room
      const allParticipants = Array.from(room.values());
      
      // Send the current list of participants to the user who joined
      socket.emit('room-users', allParticipants);
      
      // Broadcast user-connected to others
      socket.to(meetingCode).emit('user-connected', participantInfo);
      
      // Let other tabs know to start WebRTC handshake
      socket.to(meetingCode).emit('peer-joined', { socketId: socket.id, name });
      } catch (err) {
        console.error(`Socket authentication failed: ${err.message}`);
        socket.emit('error', { message: 'Failed to join room: Invalid authentication' });
        socket.disconnect(true);
      }
    });

    // 2. WebRTC SIGNALING RELAY
    socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        offer
      });
    });

    socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        answer
      });
    });

    socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    });

    // 3. REAL-TIME CURSOR PRESENCE BROADCAST
    socket.on('cursor-move', ({ meetingCode, x, y }) => {
      const room = rooms.get(meetingCode);
      if (room && room.has(socket.id)) {
        const userInfo = room.get(socket.id);
        socket.to(meetingCode).emit('cursor-update', {
          socketId: socket.id,
          name: userInfo.name,
          color: userInfo.color,
          x,
          y
        });
      }
    });

    // 4. CHAT MESSAGES WITH EMOJIS & ATTACHMENTS
    socket.on('send-message', async ({ meetingCode, text, fileUrl, fileName, fileSize }) => {
      const room = rooms.get(meetingCode);
      if (room && room.has(socket.id)) {
        const userInfo = room.get(socket.id);
        
        const chatMsg = {
          _id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          senderId: userInfo.userId,
          senderName: userInfo.name,
          senderAvatar: userInfo.avatar,
          text: text || '',
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          emojis: [],
          timestamp: new Date()
        };

        // Save message to database
        try {
          await Meeting.findOneAndUpdate(
            { code: meetingCode },
            { $push: { chatMessages: chatMsg } }
          );
        } catch (err) {
          console.error('Error saving chat message:', err.message);
        }

        // Broadcast message to everyone in the meeting
        io.to(meetingCode).emit('receive-message', chatMsg);
      }
    });

    // 5. CHAT EMOJI REACTION SYNCER
    socket.on('add-reaction', async ({ meetingCode, messageId, emoji }) => {
      const room = rooms.get(meetingCode);
      if (!room || !room.has(socket.id)) return;
      const userId = room.get(socket.id).userId;

      try {
        let updatedMsg = null;
        
        // Find meeting, locate message, and add reaction
        const meeting = await Meeting.findOne({ code: meetingCode });
        if (meeting) {
          const msg = meeting.chatMessages.id(messageId);
          if (msg) {
            if (!msg.emojis) msg.emojis = [];
            const existReaction = msg.emojis.find(r => r.emoji === emoji);
            if (existReaction) {
              if (!existReaction.users.includes(userId)) {
                existReaction.users.push(userId);
                existReaction.count += 1;
              }
            } else {
              msg.emojis.push({ emoji, count: 1, users: [userId] });
            }
            await meeting.save();
            updatedMsg = msg;
          }
        }

        if (updatedMsg) {
          io.to(meetingCode).emit('reaction-updated', { messageId, emojis: updatedMsg.emojis });
        }
      } catch (err) {
        console.error('Error adding reaction:', err.message);
      }
    });

    // 6. REAL-TIME COLLABORATIVE NOTES
    socket.on('notes-update', async ({ meetingCode, notes }) => {
      // Sync note updates directly with participants in room
      socket.to(meetingCode).emit('notes-sync', notes);
    });

    // 7. REAL-TIME TRANSLATED SPEECH TRANSCRIPTIONS
    socket.on('send-speech', async ({ meetingCode, text, translations }) => {
      const room = rooms.get(meetingCode);
      if (room && room.has(socket.id)) {
        const userInfo = room.get(socket.id);
        
        const transcriptSegment = {
          _id: Date.now().toString(),
          userId: userInfo.userId,
          userName: userInfo.name,
          text,
          timestamp: new Date(),
          translations: translations || {}
        };

        // Save speech to DB
        try {
          await Meeting.findOneAndUpdate(
            { code: meetingCode },
            { $push: { transcript: transcriptSegment } }
          );
        } catch (err) {
          console.error('Error saving speech segment:', err.message);
        }

        // Broadcast to everyone in meeting room
        io.to(meetingCode).emit('receive-speech', transcriptSegment);
      }
    });

    // 9. COLLABORATIVE WHITEBOARD DRAW RELAY
    socket.on('draw-line', ({ meetingCode, line }) => {
      socket.to(meetingCode).emit('draw-line', line);
    });

    // 10. PREMIUM REACTION & HAND RAISINGS
    socket.on('raise-hand', ({ meetingCode, isHandRaised }) => {
      socket.to(meetingCode).emit('user-raised-hand', { socketId: socket.id, isHandRaised });
    });

    socket.on('emoji-reaction', ({ meetingCode, emoji }) => {
      socket.to(meetingCode).emit('user-emoji-reaction', { socketId: socket.id, emoji });
    });

    // 11. PREMIUM LIVE POLLS
    socket.on('create-poll', async ({ meetingCode, question, options }) => {
      const newPoll = {
        id: Math.random().toString(36).substring(2, 9),
        question,
        options: options.map(opt => ({ text: opt, votes: [] })),
        active: true,
        creatorName: 'Participant',
        createdAt: new Date()
      };

      const room = rooms.get(meetingCode);
      if (room && room.has(socket.id)) {
        newPoll.creatorName = room.get(socket.id).name;
      }

      try {
        await Meeting.findOneAndUpdate(
          { code: meetingCode },
          { $push: { polls: newPoll } }
        );
      } catch (err) {
        console.error('Error saving new poll:', err.message);
      }

      io.to(meetingCode).emit('poll-created', newPoll);
    });

    socket.on('vote-poll', async ({ meetingCode, pollId, optionIndex }) => {
      const room = rooms.get(meetingCode);
      if (!room || !room.has(socket.id)) return;
      const userId = room.get(socket.id).userId;

      let updatedPoll = null;

      try {
        const meeting = await Meeting.findOne({ code: meetingCode });
        if (meeting) {
          const poll = meeting.polls.find(p => p.id === pollId);
          if (poll) {
            poll.options.forEach(opt => {
              opt.votes = opt.votes.filter(v => v !== userId);
            });
            if (poll.options[optionIndex]) {
              poll.options[optionIndex].votes.push(userId);
            }
            await meeting.save();
            updatedPoll = poll;
          }
        }
      } catch (err) {
        console.error('Error saving vote:', err.message);
      }

      if (updatedPoll) {
        io.to(meetingCode).emit('poll-updated', updatedPoll);
      }
    });

    // 8. LEAVE / DISCONNECT ROOM
    socket.on('leave-room', ({ meetingCode }) => {
      handleUserLeaving(socket, meetingCode);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      // Find room user was in and remove them
      rooms.forEach((participants, meetingCode) => {
        if (participants.has(socket.id)) {
          handleUserLeaving(socket, meetingCode);
        }
      });
    });
  });

  const handleUserLeaving = async (socket, meetingCode) => {
    const room = rooms.get(meetingCode);
    if (room && room.has(socket.id)) {
      const userInfo = room.get(socket.id);
      room.delete(socket.id);
      
      console.log(`👤 User ${userInfo.name} left meeting: ${meetingCode}`);

      // Broadcast update to others
      socket.to(meetingCode).emit('user-disconnected', { socketId: socket.id, userId: userInfo.userId, name: userInfo.name });
      
      // Update database/mock store to remove socket reference
      try {
        await Meeting.findOneAndUpdate(
          { code: meetingCode },
          { $pull: { participants: { socketId: socket.id } } }
        );
      } catch (err) {
        console.error('Error removing participant from DB:', err.message);
      }

      // If room is empty, delete room mapping
      if (room.size === 0) {
        rooms.delete(meetingCode);
      }
    }
  };
};
