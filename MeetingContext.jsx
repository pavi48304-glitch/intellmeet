import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth, API_URL } from './AuthContext';

const MeetingContext = createContext();

export const MeetingProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [activeMeeting, setActiveMeeting] = useState(null);
  const [meetingCode, setMeetingCode] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [sharedNotes, setSharedNotes] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [cursors, setCursors] = useState({});
  const [polls, setPolls] = useState([]);
  const [raisedHands, setRaisedHands] = useState({}); // socketId -> boolean

  // Media Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('en');

  // Media Streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream

  // WebRTC Peer Connections reference
  const peerConnections = useRef({}); // socketId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);

  // Clean meeting state when leaving
  const resetMeetingState = () => {
    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    localStreamRef.current = null;
    cameraVideoTrackRef.current = null;

    // Close peers
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};

    setActiveMeeting(null);
    setMeetingCode(null);
    setParticipants([]);
    setChatMessages([]);
    setSharedFiles([]);
    setSharedNotes('');
    setTranscript([]);
    setCursors({});
    setRemoteStreams({});
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setIsRecording(false);
    setPolls([]);
    setRaisedHands({});
  };

  // 1. GET INITIAL DATA ON JOIN
  const joinMeeting = async (code) => {
    if (!user) return;
    resetMeetingState();

    try {
      const res = await fetch(`${API_URL}/meetings/${code}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to retrieve meeting details');
      }

      setActiveMeeting(data);
      setMeetingCode(code);
      setSharedNotes(data.sharedNotes || '');
      setChatMessages(data.chatMessages || []);
      setSharedFiles(data.sharedFiles || []);
      setTranscript(data.transcript || []);
      setPolls(data.polls || []);

      // Get user media (webcam/mic)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
        if (stream.getVideoTracks().length > 0) {
          cameraVideoTrackRef.current = stream.getVideoTracks()[0];
        }
      } catch (err) {
        console.warn('⚠️ Camera/Mic access denied. Running in virtual media mode:', err.message);
        // Create a simulated canvas stream so there is still actual video in multiple tabs!
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        
        let angle = 0;
        const intervalId = setInterval(() => {
          if (!localStreamRef.current) {
            clearInterval(intervalId);
            return;
          }
          ctx.fillStyle = '#1e1b4b';
          ctx.fillRect(0, 0, 640, 480);
          
          // Draw pulsing visualizer circle
          ctx.beginPath();
          ctx.arc(320, 240, 80 + Math.sin(angle) * 10, 0, Math.PI * 2);
          ctx.fillStyle = '#a855f7';
          ctx.fill();
          
          // Draw text
          ctx.font = '24px Inter';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(user.name + ' (Virtual Cam)', 320, 246);
          angle += 0.1;
        }, 100);

        const canvasStream = canvas.captureStream(10);
        setLocalStream(canvasStream);
        localStreamRef.current = canvasStream;
        if (canvasStream.getVideoTracks().length > 0) {
          cameraVideoTrackRef.current = canvasStream.getVideoTracks()[0];
        }
      }

      // Connect Web Socket Join Event
      if (socket) {
        socket.emit('join-room', {
          meetingCode: code,
          token: user.token
        });
      }

      return data;
    } catch (err) {
      console.error('Error joining meeting:', err);
      throw err;
    }
  };

  // 2. SOCKET EVENT LISTENERS
  useEffect(() => {
    if (!socket || !meetingCode) return;

    // Get current active users list
    socket.on('room-users', (users) => {
      setParticipants(users);
      // Initiate WebRTC handshake for other users
      users.forEach(peer => {
        if (peer.socketId !== socket.id) {
          initiateCall(peer.socketId);
        }
      });
    });

    // New participant joined
    socket.on('user-connected', (peerInfo) => {
      setParticipants(prev => {
        const exists = prev.some(p => p.socketId === peerInfo.socketId);
        if (!exists) return [...prev, peerInfo];
        return prev;
      });
    });

    // Participant disconnected
    socket.on('user-disconnected', ({ socketId, name }) => {
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));
      
      // Close WebRTC connection
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      setRemoteStreams(prev => {
        const copy = { ...prev };
        delete copy[socketId];
        return copy;
      });
      setCursors(prev => {
        const copy = { ...prev };
        delete copy[socketId];
        return copy;
      });
    });

    // WebRTC Signaling listeners
    socket.on('webrtc-offer', async ({ senderSocketId, offer }) => {
      const pc = createPeerConnection(senderSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetSocketId: senderSocketId, answer });
    });

    socket.on('webrtc-answer', async ({ senderSocketId, answer }) => {
      const pc = peerConnections.current[senderSocketId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('webrtc-ice-candidate', async ({ senderSocketId, candidate }) => {
      const pc = peerConnections.current[senderSocketId];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // Cursors / mouse coordinates updates
    socket.on('cursor-update', ({ socketId, name, color, x, y }) => {
      setCursors(prev => ({
        ...prev,
        [socketId]: { name, color, x, y }
      }));
    });

    // Recieve collaborative notes updates
    socket.on('notes-sync', (notes) => {
      setSharedNotes(notes);
    });

    // Recieve real-time speech segments
    socket.on('receive-speech', (segment) => {
      setTranscript(prev => [...prev, segment]);
    });

    // Recieve chat messages
    socket.on('receive-message', (msg) => {
      setChatMessages(prev => {
        const exists = prev.some(m => m._id === msg._id);
        if (exists) return prev;
        return [...prev, msg];
      });
      // Automatically add files to files list if it is a file upload notice
      if (msg.fileUrl) {
        setSharedFiles(prev => [
          ...prev,
          {
            id: msg._id,
            name: msg.fileName,
            url: msg.fileUrl,
            size: msg.fileSize,
            uploaderName: msg.senderName,
            uploadedAt: msg.timestamp
          }
        ]);
      }
    });

    // Sync Emoji Reactions
    socket.on('reaction-updated', ({ messageId, emojis }) => {
      setChatMessages(prev =>
        prev.map(m => (m._id === messageId ? { ...m, emojis } : m))
      );
    });

    // Premium Reactions & Hand Raising
    socket.on('user-raised-hand', ({ socketId, isHandRaised }) => {
      setRaisedHands(prev => ({
        ...prev,
        [socketId]: isHandRaised
      }));
    });

    socket.on('user-emoji-reaction', ({ socketId, emoji }) => {
      window.dispatchEvent(new CustomEvent('meeting-emoji-reaction', {
        detail: { socketId, emoji }
      }));
    });

    // Premium Polls
    socket.on('poll-created', (newPoll) => {
      setPolls(prev => {
        const exists = prev.some(p => p.id === newPoll.id);
        if (exists) return prev;
        window.dispatchEvent(new CustomEvent('new-poll-toast', { detail: newPoll }));
        return [...prev, newPoll];
      });
    });

    socket.on('poll-updated', (updatedPoll) => {
      setPolls(prev => prev.map(p => (p.id === updatedPoll.id ? updatedPoll : p)));
    });

    return () => {
      socket.off('room-users');
      socket.off('user-connected');
      socket.off('user-disconnected');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('cursor-update');
      socket.off('notes-sync');
      socket.off('receive-speech');
      socket.off('receive-message');
      socket.off('reaction-updated');
      socket.off('user-raised-hand');
      socket.off('user-emoji-reaction');
      socket.off('poll-created');
      socket.off('poll-updated');
    };
  }, [socket, meetingCode]);

  // 3. WebRTC INTERNALS
  function createPeerConnection(peerSocketId) {
    if (peerConnections.current[peerSocketId]) {
      return peerConnections.current[peerSocketId];
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Add local tracks to peer
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming remote track stream
    pc.ontrack = (event) => {
      console.log(`🌐 Received remote track stream from socket: ${peerSocketId}`);
      setRemoteStreams(prev => ({
        ...prev,
        [peerSocketId]: event.streams[0]
      }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          targetSocketId: peerSocketId,
          candidate: event.candidate
        });
      }
    };

    peerConnections.current[peerSocketId] = pc;
    return pc;
  };

  async function initiateCall(peerSocketId) {
    const pc = createPeerConnection(peerSocketId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (socket) {
      socket.emit('webrtc-offer', { targetSocketId: peerSocketId, offer });
    }
  };

  // 4. WORKSPACE CONTROLS & API TRIGGERS

  // Update Mute Camera Toggle
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];

        // Swap track on all active WebRTC active peer connections
        Object.values(peerConnections.current).forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        // Swap track in local stream representation and trigger re-render
        const localVideoTrack = localStream.getVideoTracks()[0];
        if (localVideoTrack) {
          localStream.removeTrack(localVideoTrack);
        }
        localStream.addTrack(screenTrack);
        const newStream = new MediaStream(localStream.getTracks());
        setLocalStream(newStream);
        localStreamRef.current = newStream;

        // Listen for browser UI native "Stop Sharing" click
        screenTrack.onended = () => {
          stopScreenSharing();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error('Failed to start WebRTC screen share:', err);
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    const cameraTrack = cameraVideoTrackRef.current;
    if (cameraTrack) {
      // Swap track back on all WebRTC peer connections
      Object.values(peerConnections.current).forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
      });

      // Restore camera track to local state stream and trigger re-render
      const currentVideoTrack = localStream.getVideoTracks()[0];
      if (currentVideoTrack) {
        localStream.removeTrack(currentVideoTrack);
      }
      localStream.addTrack(cameraTrack);
      const restoredStream = new MediaStream(localStream.getTracks());
      setLocalStream(restoredStream);
      localStreamRef.current = restoredStream;
    }

    setIsScreenSharing(false);
  };

  // Broadcast Note changes
  const updateNotes = (newNotes) => {
    setSharedNotes(newNotes);
    if (socket) {
      socket.emit('notes-update', { meetingCode, notes: newNotes });
    }
  };

  // Save notes to database
  const saveNotesToDB = async () => {
    if (!meetingCode || !user) return;
    try {
      await fetch(`${API_URL}/meetings/${meetingCode}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ notes: sharedNotes })
      });
    } catch (err) {
      console.error('Error saving notes:', err);
    }
  };

  // Send real-time chat message
  const sendMessage = (text) => {
    if (socket && meetingCode) {
      socket.emit('send-message', { meetingCode, text });
    }
  };

  // Send reaction
  const addReaction = (messageId, emoji) => {
    if (socket && meetingCode && user) {
      socket.emit('add-reaction', { meetingCode, messageId, emoji });
    }
  };

  // Upload shared file
  const uploadSharedFile = async (fileObj) => {
    if (!meetingCode || !user) return;
    
    const formData = new FormData();
    formData.append('file', fileObj);
    formData.append('meetingCode', meetingCode);

    try {
      const res = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` },
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'File upload failed');
      }

      // Emit file notice over socket so it syncs for all immediately!
      if (socket) {
        socket.emit('send-message', {
          meetingCode,
          text: `Uploaded a file: ${data.file.name}`,
          fileUrl: data.file.url,
          fileName: data.file.name,
          fileSize: data.file.size
        });
      }

      return data.file;
    } catch (err) {
      console.error('File upload error:', err);
      throw err;
    }
  };

  // End meeting & trigger AI Summary
  const endMeeting = async () => {
    if (!meetingCode || !user) return;
    
    // Save final notes
    await saveNotesToDB();

    try {
      const res = await fetch(`${API_URL}/ai/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ meetingCode })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'AI summary generation failed');
      }

      if (socket) {
        socket.emit('leave-room', { meetingCode });
      }

      resetMeetingState();
      return data;
    } catch (err) {
      console.error('Error ending meeting:', err);
      throw err;
    }
  };

  // Send client mouse cursors coordinates
  const sendCursorPosition = (x, y) => {
    if (socket && meetingCode) {
      socket.emit('cursor-move', { meetingCode, x, y });
    }
  };

  // Simulate Speech Recognition segment (Industry grade AI trigger)
  const sendSpeechTranscript = async (text) => {
    if (!socket || !meetingCode || !user) return;

    // Generate translations in the background
    let translations = {};
    const languages = ['es', 'fr', 'de', 'hi', 'ja'];
    
    const translationPromises = languages.map(async (lang) => {
      try {
        const res = await fetch(`${API_URL}/ai/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify({ text, targetLang: lang })
        });
        const data = await res.json();
        if (res.ok) {
          return { lang, translatedText: data.translatedText };
        }
      } catch (err) {
        console.warn(`Failed translation for ${lang}:`, err.message);
      }
      return null;
    });

    const results = await Promise.all(translationPromises);
    results.forEach(res => {
      if (res) {
        translations[res.lang] = res.translatedText;
      }
    });

    // Send translated segments to sockets
    socket.emit('send-speech', {
      meetingCode,
      text,
      translations
    });
  };

  // Ask AI Agent Chatbot
  const askAIAgent = async (message) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ message, meetingCode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'AI Chat request failed');
      }
      return data.response;
    } catch (err) {
      console.error('AI Chat agent error:', err);
      throw err;
    }
  };

  // Premium Toggle Hand Raise
  const toggleHandRaise = () => {
    if (!socket || !meetingCode) return;
    const isLocalRaised = !raisedHands[socket.id];
    setRaisedHands(prev => ({
      ...prev,
      [socket.id]: isLocalRaised
    }));
    socket.emit('raise-hand', { meetingCode, isHandRaised: isLocalRaised });
  };

  // Premium Send Emoji Reaction
  const sendEmojiReaction = (emoji) => {
    if (!socket || !meetingCode) return;
    socket.emit('emoji-reaction', { meetingCode, emoji });
    window.dispatchEvent(new CustomEvent('meeting-emoji-reaction', {
      detail: { socketId: socket.id, emoji }
    }));
  };

  // Premium Create Poll
  const createPoll = (question, options) => {
    if (socket && meetingCode) {
      socket.emit('create-poll', { meetingCode, question, options });
    }
  };

  // Premium Vote Poll
  const votePoll = (pollId, optionIndex) => {
    if (socket && meetingCode && user) {
      socket.emit('vote-poll', { meetingCode, pollId, optionIndex });
    }
  };

  return (
    <MeetingContext.Provider
      value={{
        activeMeeting,
        meetingCode,
        participants,
        chatMessages,
        sharedFiles,
        sharedNotes,
        transcript,
        cursors,
        polls,
        raisedHands,
        isMuted,
        isVideoOff,
        isScreenSharing,
        isRecording,
        targetLanguage,
        localStream,
        remoteStreams,
        setTargetLanguage,
        joinMeeting,
        toggleMute,
        toggleVideo,
        updateNotes,
        sendMessage,
        addReaction,
        uploadSharedFile,
        endMeeting,
        sendCursorPosition,
        sendSpeechTranscript,
        askAIAgent,
        toggleScreenShare,
        resetMeetingState,
        toggleHandRaise,
        sendEmojiReaction,
        createPoll,
        votePoll
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
};

export const useMeeting = () => useContext(MeetingContext);
