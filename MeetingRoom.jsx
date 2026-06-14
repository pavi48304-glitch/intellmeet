import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API_URL } from '../../context/AuthContext';
import { useMeeting } from '../../context/MeetingContext';
import { useSocket } from '../../context/SocketContext';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, Send, Paperclip, 
  FileText, Globe, Smile, Users, Download, HelpCircle, 
  Settings, Award, Sparkles, Languages, Check, Plus, Loader, Monitor, Palette,
  Hand, BarChart2, Link
} from 'lucide-react';
import { Whiteboard } from './Whiteboard';

// Custom Video Player component to bind streams safely in React 19
const VideoPlayer = ({ socketId, stream, isLocal = false, isMuted = false, name = "Participant", avatar = null, isHandRaised = false }) => {
  const videoRef = useRef(null);
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const handleEmojiReaction = (e) => {
      const { socketId: rxSocketId, emoji } = e.detail;
      if (rxSocketId === socketId) {
        const id = Math.random();
        setFloatingEmojis(prev => [...prev, { id, emoji }]);
        setTimeout(() => {
          setFloatingEmojis(prev => prev.filter(item => item.id !== id));
        }, 2200);
      }
    };
    window.addEventListener('meeting-emoji-reaction', handleEmojiReaction);
    return () => window.removeEventListener('meeting-emoji-reaction', handleEmojiReaction);
  }, [socketId]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;

  return (
    <div className={`relative aspect-video rounded-2xl bg-slate-950/60 border overflow-hidden group shadow-lg transition-all duration-300 ${
      isHandRaised ? 'border-amber-500/60 glow-amber' : 'border-white/5'
    }`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center min-h-[180px]">
          <div className="w-16 h-16 rounded-full bg-slate-800 p-2 border border-white/10 animate-pulse shadow-xl">
            <img src={avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`} alt="Avatar" className="w-full h-full" />
          </div>
          <span className="text-[10px] text-gray-500 mt-3 font-semibold uppercase tracking-wider">Video Disabled</span>
        </div>
      )}
      
      {/* Hand Raised badge */}
      {isHandRaised && (
        <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-lg shadow-amber-500/30 border border-amber-300/30 animate-pulse z-20">
          <Hand className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
          <span>HAND RAISED</span>
        </div>
      )}

      {/* Floating Emojis */}
      {floatingEmojis.map(fe => (
        <div
          key={fe.id}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-5xl pointer-events-none z-20 animate-float-emoji"
        >
          {fe.emoji}
        </div>
      ))}

      {/* Name label */}
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-semibold text-white border border-white/10 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isLocal ? 'bg-cyan-500 animate-pulse' : 'bg-purple-500'}`}></div>
        <span>{name} {isLocal && '(You)'}</span>
      </div>
    </div>
  );
};

export const MeetingRoom = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const {
    activeMeeting,
    meetingCode,
    participants,
    chatMessages,
    sharedFiles,
    sharedNotes,
    transcript,
    isMuted,
    isVideoOff,
    isRecording,
    targetLanguage,
    localStream,
    remoteStreams,
    setTargetLanguage,
    toggleMute,
    toggleVideo,
    updateNotes,
    sendMessage,
    addReaction,
    uploadSharedFile,
    endMeeting,
    askAIAgent,
    toggleScreenShare,
    isScreenSharing,
    polls,
    raisedHands,
    toggleHandRaise,
    sendEmojiReaction,
    createPoll,
    votePoll
  } = useMeeting();

  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'notes', 'captions', 'ai', 'polls'
  const [chatInput, setChatInput] = useState('');
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [pollToast, setPollToast] = useState(null);

  useEffect(() => {
    const handleNewPollToast = (e) => {
      setPollToast(e.detail);
      setTimeout(() => {
        setPollToast(null);
      }, 5000);
    };
    window.addEventListener('new-poll-toast', handleNewPollToast);
    return () => window.removeEventListener('new-poll-toast', handleNewPollToast);
  }, []);
  
  // AI Agent States
  const [aiMessages, setAiMessages] = useState([
    { sender: 'ai', text: 'Hello! I am your IntellMeet AI Assist copilot. Ask me to summarize what has been discussed, list your Action Board tasks, or draft email invites!', timestamp: new Date() }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleSendAIMessage = async (e, directText = null) => {
    if (e) e.preventDefault();
    const textToSend = directText || aiInput;
    if (!textToSend.trim()) return;

    const userMsg = { sender: 'user', text: textToSend, timestamp: new Date() };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);

    try {
      const response = await askAIAgent(textToSend);
      const aiMsg = { sender: 'ai', text: response, timestamp: new Date() };
      setAiMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg = { sender: 'ai', text: 'Sorry, I encountered an error communicating with the AI server.', timestamp: new Date() };
      setAiMessages(prev => [...prev, errorMsg]);
    } finally {
      setAiLoading(false);
    }
  };
  const [fileUploading, setFileUploading] = useState(false);
  const [speechSimulatorInput, setSpeechSimulatorInput] = useState('');
  
  // Quick Task Dispatcher States
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskAssignee, setQuickTaskAssignee] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState('medium');
  const [quickTaskMessage, setQuickTaskMessage] = useState('');
  const [quickTaskLoading, setQuickTaskLoading] = useState(false);

  const handleCreateQuickTask = async (e) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    setQuickTaskLoading(true);
    setQuickTaskMessage('');

    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          title: quickTaskTitle,
          description: `Created during meeting: ${activeMeeting?.title || meetingCode}`,
          assignedTo: quickTaskAssignee || 'Unassigned',
          priority: quickTaskPriority,
          meetingId: meetingCode,
          status: 'todo'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setQuickTaskTitle('');
        setQuickTaskAssignee('');
        setQuickTaskPriority('medium');
        setQuickTaskMessage('Task dispatched successfully!');
        
        // Broadcast the task creation announcement to chat
        sendMessage(`📢 [TASK CREATED] Title: "${data.title}" | Assigned to: ${data.assignedTo} | Priority: ${data.priority.toUpperCase()}`);
        
        setTimeout(() => {
          setQuickTaskMessage('');
        }, 4000);
      } else {
        setQuickTaskMessage(`Error: ${data.message || 'Failed'}`);
      }
    } catch (err) {
      console.error(err);
      setQuickTaskMessage('Error creating task.');
    } finally {
      setQuickTaskLoading(false);
    }
  };

  // Custom timer state
  const [meetingTimer, setMeetingTimer] = useState('00:00:00');
  
  // Recording state (simulated client-side recorder)
  const [clientRecording, setClientRecording] = useState(false);
  const [recorderInstance, setRecorderInstance] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  // Start Meeting Duration Timer on mount
  useEffect(() => {
    let seconds = 0;
    const interval = setInterval(() => {
      seconds++;
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      setMeetingTimer(
        `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setFileUploading(true);
    try {
      await uploadSharedFile(file);
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Client-Side Screen / Meeting Recording
  const handleToggleRecording = () => {
    if (clientRecording) {
      // Stop
      if (recorderInstance) {
        recorderInstance.stop();
      }
      setClientRecording(false);
    } else {
      // Start recording
      if (localStream) {
        const chunks = [];
        const recorder = new MediaRecorder(localStream);
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `intellmeet-session-${meetingCode}-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };

        recorder.start(1000);
        setRecorderInstance(recorder);
        setClientRecording(true);
      }
    }
  };

  const copyMeetingCode = () => {
    navigator.clipboard.writeText(meetingCode);
    alert('Meeting room code copied to clipboard!');
  };

  const copyMeetingLink = () => {
    const inviteLink = `${window.location.origin}/?room=${meetingCode}`;
    navigator.clipboard.writeText(inviteLink);
    alert('Meeting invite link copied to clipboard!');
  };

  // Simulate Speech / Subtitles Injection (for demo / testing translations)
  const { sendSpeechTranscript } = useMeeting();
  const handleSimulateSpeech = (e) => {
    e.preventDefault();
    if (!speechSimulatorInput.trim()) return;
    sendSpeechTranscript(speechSimulatorInput.trim());
    setSpeechSimulatorInput('');
  };

  return (
    <div className="min-h-screen bg-slate-900/60 text-slate-100 flex flex-col font-sans overflow-hidden h-screen backdrop-blur-sm">
      
      {/* 1. Header Navbar */}
      <header className="glass-panel border-b border-white/5 py-3 px-6 z-30 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white block">
              {activeMeeting?.title || 'Active Session'}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span className="uppercase font-bold tracking-wider text-cyan-400/80">Room Code:</span>
              <code 
                onClick={copyMeetingCode} 
                className="text-purple-400 font-bold bg-purple-950/20 px-1 py-0.5 rounded cursor-pointer hover:bg-purple-950/40 border border-purple-500/10"
                title="Click to copy code"
              >
                {meetingCode}
              </code>
              <button 
                onClick={copyMeetingLink}
                className="ml-1 text-cyan-400 bg-cyan-950/20 px-2 py-0.5 rounded cursor-pointer hover:bg-cyan-950/40 border border-cyan-500/20 flex items-center gap-1 transition-all"
                title="Copy Invite Link"
              >
                <Link className="w-3 h-3" />
                <span className="font-bold">Copy Link</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center: Live Timer and Speaker Status */}
        <div className="flex items-center gap-4 bg-black/25 border border-white/5 px-4 py-1.5 rounded-full">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="text-xs font-bold text-gray-300">{meetingTimer}</span>
          </div>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold">{participants.length + 1} Present</span>
          </div>
        </div>

        {/* Right: User details / Quit */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 p-1 border border-white/10 shrink-0">
              <img src={user?.avatar} alt="Avatar" className="w-full h-full" />
            </div>
            <span className="text-xs font-bold text-gray-300">{user?.name}</span>
          </div>
          <button 
            onClick={endMeeting}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-500/10 cursor-pointer transition-all hover:scale-105"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </button>
        </div>
      </header>

      {/* 2. Main Space Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* New Poll Toast Notification Banner */}
        {pollToast && (
          <div 
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-cyan-500/40 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl z-50 animate-bounce cursor-pointer"
            onClick={() => { setActiveTab('polls'); setPollToast(null); }}
          >
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <div className="text-xs text-left">
              <span className="font-extrabold text-cyan-400 block tracking-wider text-[9px] uppercase">NEW LIVE POLL LAUNCHED</span>
              <span className="text-gray-200 font-medium">{pollToast.question}</span>
            </div>
          </div>
        )}

        {/* Main Area: Videos and Controls (Left) */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto min-h-0 justify-between">
          
          {/* Main workspace container: Swaps between Whiteboard and Video Grid */}
          {showWhiteboard ? (
            <div className="flex-1 max-w-5xl mx-auto w-full my-auto h-[60vh] bg-slate-950/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
              <Whiteboard />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center justify-center flex-1 max-w-5xl mx-auto w-full my-auto">
              {/* Self Video Panel */}
              <VideoPlayer 
                socketId={socket?.id}
                stream={isVideoOff ? null : localStream} 
                isLocal={true} 
                isMuted={isMuted} 
                name={user?.name} 
                avatar={user?.avatar}
                isHandRaised={raisedHands[socket?.id]}
              />

              {/* Remote Videos */}
              {Object.entries(remoteStreams).map(([socketId, stream]) => {
                const participant = participants.find((p) => p.socketId === socketId);
                const pName = participant ? participant.name : 'Remote Participant';
                const pAvatar = participant ? participant.avatar : null;
                return (
                  <VideoPlayer
                    key={socketId}
                    socketId={socketId}
                    stream={stream}
                    isLocal={false}
                    name={pName}
                    avatar={pAvatar}
                    isHandRaised={raisedHands[socketId]}
                  />
                );
              })}

              {/* Empty State / Waiting Card */}
              {Object.keys(remoteStreams).length === 0 && (
                <div className="aspect-video rounded-2xl border border-dashed border-white/10 bg-black/20 flex flex-col items-center justify-center text-center p-6 min-h-[220px]">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Share Room Code to Invite Peers</h4>
                  <p className="text-xs text-gray-500 max-w-xs mt-1">Waiting for colleagues to join. Click on your room code to copy it for sharing.</p>
                </div>
              )}
            </div>
          )}

          {/* Lower Center Video Call Control Bar */}
          <div className="flex items-center justify-center gap-3 py-3 px-6 shrink-0 max-w-xl mx-auto w-full bg-slate-950/75 border border-white/10 shadow-2xl backdrop-blur-xl rounded-full mb-4">
            
            {/* Audio Toggle */}
            <button 
              onClick={toggleMute}
              className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                isMuted 
                  ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' 
                  : 'bg-slate-900 border-white/5 text-gray-300 hover:bg-slate-800'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Video Toggle */}
            <button 
              onClick={toggleVideo}
              className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                isVideoOff 
                  ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' 
                  : 'bg-slate-900 border-white/5 text-gray-300 hover:bg-slate-800'
              }`}
              title={isVideoOff ? 'Enable camera' : 'Disable camera'}
            >
              {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </button>

            {/* Screen Share Toggle */}
            <button 
              onClick={toggleScreenShare}
              className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                isScreenSharing 
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 glow-cyan' 
                  : 'bg-slate-900 border-white/5 text-gray-300 hover:bg-slate-800'
              }`}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              <Monitor className="w-4 h-4" />
            </button>

            {/* Reactions & Hand Raise Popover */}
            <div className="relative">
              <button 
                onClick={() => setShowReactions(!showReactions)}
                className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                  showReactions 
                    ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20' 
                    : 'bg-slate-900 border-white/5 text-gray-300 hover:bg-slate-800'
                }`}
                title="Send Reaction or Raise Hand"
              >
                <Smile className="w-4 h-4" />
              </button>

              {showReactions && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-white/10 backdrop-blur-md p-3 rounded-2xl flex items-center gap-2 shadow-2xl z-40 shrink-0">
                  {['👍', '❤️', '😂', '🎉', '😮', '😢'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        sendEmojiReaction(emoji);
                        setShowReactions(false);
                      }}
                      className="text-2xl hover:scale-125 transition-transform duration-150 p-1 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                  <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
                  <button
                    onClick={() => {
                      toggleHandRaise();
                      setShowReactions(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      raisedHands[socket?.id]
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    ✋ Raise Hand
                  </button>
                </div>
              )}
            </div>

            {/* Whiteboard Toggle */}
            <button 
              onClick={() => setShowWhiteboard(!showWhiteboard)}
              className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                showWhiteboard 
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 glow-cyan' 
                  : 'bg-slate-900 border-white/5 text-gray-300 hover:bg-slate-800'
              }`}
              title={showWhiteboard ? 'Minimize Whiteboard' : 'Open Whiteboard'}
            >
              <Palette className="w-4 h-4" />
            </button>

            {/* Screen Recording (Client Side WebM download) */}
            <button 
              onClick={handleToggleRecording}
              className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                clientRecording 
                  ? 'bg-red-600 border-red-500/20 text-white animate-pulse' 
                  : 'bg-slate-900 border-white/5 text-gray-300 hover:bg-slate-800'
              }`}
              title={clientRecording ? 'Stop Session Recording' : 'Record Video Session'}
            >
              <div className={`w-3 h-3 rounded-full ${clientRecording ? 'bg-white' : 'bg-red-500'}`}></div>
            </button>

            <button 
              onClick={endMeeting}
              className="w-12 h-11 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20 cursor-pointer transition-all hover:scale-105"
              title="Leave room"
            >
              <PhoneOff className="w-4.5 h-4.5" />
            </button>
          </div>

        </div>

        {/* Sidebar panels (Right) */}
        <aside className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-white/5 bg-slate-900/80 backdrop-blur-md flex flex-row shrink-0 overflow-hidden h-96 lg:h-auto">
          
          {/* 1. Vertical Navigation Rail */}
          <div className="w-16 border-r border-white/5 bg-black/25 flex flex-col items-center py-4 gap-4 shrink-0 justify-between">
            <div className="flex flex-col gap-3 w-full items-center">
              {/* Members Button */}
              <button
                onClick={() => setActiveTab('members')}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative group ${
                  activeTab === 'members' 
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 glow-cyan' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title="Members"
              >
                <Users className="w-4.5 h-4.5" />
                <span className="absolute right-[-80px] bg-slate-900 border border-white/10 px-2 py-1 rounded-md text-[10px] font-bold text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none shadow-xl">
                  Members
                </span>
              </button>

              {/* Chat Button */}
              <button
                onClick={() => setActiveTab('chat')}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative group ${
                  activeTab === 'chat' 
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 glow-cyan' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title="Chat"
              >
                <Smile className="w-4.5 h-4.5" />
                <span className="absolute right-[-65px] bg-slate-900 border border-white/10 px-2 py-1 rounded-md text-[10px] font-bold text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none shadow-xl">
                  Chat
                </span>
              </button>

              {/* Notes Button */}
              <button
                onClick={() => setActiveTab('notes')}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative group ${
                  activeTab === 'notes' 
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 glow-cyan' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title="Notes"
              >
                <FileText className="w-4.5 h-4.5" />
                <span className="absolute right-[-72px] bg-slate-900 border border-white/10 px-2 py-1 rounded-md text-[10px] font-bold text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none shadow-xl">
                  Notes
                </span>
              </button>

              {/* Captions Button */}
              <button
                onClick={() => setActiveTab('captions')}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative group ${
                  activeTab === 'captions' 
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 glow-cyan' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title="Captions"
              >
                <Globe className="w-4.5 h-4.5" />
                <span className="absolute right-[-90px] bg-slate-900 border border-white/10 px-2 py-1 rounded-md text-[10px] font-bold text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none shadow-xl">
                  Captions
                </span>
              </button>

              {/* AI Assist Button */}
              <button
                onClick={() => setActiveTab('ai')}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative group ${
                  activeTab === 'ai' 
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 glow-cyan' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title="AI Assist"
              >
                <Sparkles className="w-4.5 h-4.5 text-cyan-400" />
                <span className="absolute right-[-90px] bg-slate-900 border border-white/10 px-2 py-1 rounded-md text-[10px] font-bold text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none shadow-xl">
                  AI Copilot
                </span>
              </button>

              {/* Polls Button */}
              <button
                onClick={() => setActiveTab('polls')}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative group ${
                  activeTab === 'polls' 
                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 glow-cyan' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title="Polls"
              >
                <BarChart2 className="w-4.5 h-4.5" />
                <span className="absolute right-[-68px] bg-slate-900 border border-white/10 px-2 py-1 rounded-md text-[10px] font-bold text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none shadow-xl">
                  Polls
                </span>
              </button>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-800 p-0.5 border border-white/10 shrink-0">
                <img src={user?.avatar} alt="Avatar" className="w-full h-full" />
              </div>
            </div>
          </div>

          {/* Tab Body contents */}
          <div className="flex-1 overflow-hidden relative flex flex-col">

            {/* TAB: MEMBERS PANEL */}
            {activeTab === 'members' && (
              <div className="h-full flex flex-col p-4 space-y-3 overflow-y-auto">
                <div className="flex items-center justify-between shrink-0 mb-2">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Room Members</h4>
                  <span className="text-[10px] text-gray-500 bg-slate-900 px-2 py-0.5 rounded border border-white/5">{participants.length + 1} Present</span>
                </div>
                
                {/* Local user */}
                <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 p-0.5 shrink-0">
                    <img src={user?.avatar} alt={user?.name} className="w-full h-full" />
                  </div>
                  <div className="flex flex-col flex-1 truncate">
                    <span className="text-xs font-bold text-white truncate">{user?.name} (You)</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                  </div>
                  {raisedHands[socket?.id] && (
                    <div className="ml-auto flex items-center bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20" title="Hand Raised">
                      <span className="text-xs">✋</span>
                    </div>
                  )}
                </div>

                {/* Remote users */}
                {participants.map(p => (
                  <div key={p.socketId} className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 p-0.5 shrink-0">
                      <img src={p.avatar} alt={p.name} className="w-full h-full" />
                    </div>
                    <div className="flex flex-col flex-1 truncate">
                      <span className="text-xs font-bold text-gray-200 truncate">{p.name}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                    </div>
                    {raisedHands[p.socketId] && (
                      <div className="ml-auto flex items-center bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20" title="Hand Raised">
                        <span className="text-xs">✋</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB: CHAT PANEL */}
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col">
                {/* Message Timeline */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((msg) => {
                    const isSelf = msg.senderId === user?._id || msg.isSelf;
                    return (
                      <div key={msg._id || msg.id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                          <span className="font-bold text-gray-400">{msg.senderName}</span>
                          <span>•</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* File upload download block */}
                        {msg.fileUrl ? (
                          <div className={`p-3 rounded-2xl max-w-[85%] border text-xs flex flex-col gap-2 ${
                            isSelf 
                              ? 'bg-cyan-950/20 border-cyan-500/20 text-cyan-100 rounded-tr-none' 
                              : 'bg-[#161d30] border-white/5 text-gray-200 rounded-tl-none'
                          }`}>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded bg-black/30 flex items-center justify-center text-cyan-400 shrink-0">
                                <Paperclip className="w-4 h-4" />
                              </div>
                              <div className="overflow-hidden">
                                <span className="font-semibold block truncate max-w-[150px]">{msg.fileName}</span>
                                <span className="text-[10px] text-gray-500 block">Shared file</span>
                              </div>
                            </div>
                            <a 
                              href={msg.fileUrl} 
                              target="_blank"
                              rel="noreferrer"
                              className="py-1 bg-black/40 hover:bg-black/60 border border-white/10 rounded flex items-center justify-center gap-1 text-[10px] font-bold tracking-wide transition-all"
                            >
                              <Download className="w-3 h-3" />
                              Download File
                            </a>
                          </div>
                        ) : (
                          // Standard Text bubble
                          <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-xs border leading-relaxed ${
                            isSelf 
                              ? 'bg-gradient-to-tr from-cyan-600/20 to-purple-600/20 border-purple-500/20 text-gray-100 rounded-tr-none' 
                              : 'bg-[#161d30] border-white/5 text-gray-300 rounded-tl-none'
                          }`}>
                            <p>{msg.text}</p>
                          </div>
                        )}

                        {/* Reactions timeline indicator */}
                        {msg.emojis && msg.emojis.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {msg.emojis.map((react, i) => (
                              <span key={i} className="text-xs bg-slate-900/60 border border-white/5 px-1.5 py-0.5 rounded-full" title={react.name}>
                                {react.emoji}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Reaction popup action button */}
                        <div className={`opacity-0 hover:opacity-100 group-hover:opacity-100 flex gap-1 mt-0.5`}>
                          {['👍', '❤️', '😂', '🎉'].map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => addReaction(msg._id || msg.id, emoji)}
                              className="text-[10px] hover:scale-125 transition-transform cursor-pointer opacity-60 hover:opacity-100"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input text / Attachment controls */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 flex gap-2 items-center bg-black/20 shrink-0">
                  <button
                    type="button"
                    onClick={handleFileUploadClick}
                    disabled={fileUploading}
                    className="p-2.5 rounded-xl bg-slate-900 border border-white/5 text-gray-400 hover:text-white cursor-pointer shrink-0"
                    title="Upload file Attachment"
                  >
                    {fileUploading ? <Loader className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  </button>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  <input
                    type="text"
                    placeholder="Type message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 bg-[#121826] border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 transition-all text-white"
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl cursor-pointer transition-all shadow-md shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB: COLLABORATIVE NOTES EDITOR & QUICK TASK */}
            {activeTab === 'notes' && (
              <div className="h-full flex flex-col p-4 space-y-3 overflow-y-auto">
                <div className="flex flex-col flex-1 min-h-[220px] space-y-2">
                  <div className="flex items-center justify-between shrink-0">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Shared Session Notes</h4>
                    <span className="text-[10px] text-gray-500 bg-slate-900 px-2 py-0.5 rounded border border-white/5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-500" />
                      Websocket Synced
                    </span>
                  </div>
                  <textarea
                    value={sharedNotes}
                    onChange={(e) => updateNotes(e.target.value)}
                    placeholder="Collaborate on session minutes, roadmap items, or draft agenda..."
                    className="w-full flex-1 bg-[#121826] border border-white/5 rounded-2xl p-4 text-xs focus:outline-none focus:border-cyan-500 transition-all text-gray-200 resize-none font-mono leading-relaxed"
                  />
                </div>

                <div className="border-t border-white/5 my-1 pt-3 shrink-0">
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Quick Task Dispatcher
                  </h4>
                  
                  <form onSubmit={handleCreateQuickTask} className="space-y-2 text-left bg-black/20 p-3 rounded-xl border border-white/5">
                    <div>
                      <input 
                        type="text"
                        placeholder="Task Title (e.g. Audit API endpoints)"
                        value={quickTaskTitle}
                        onChange={(e) => setQuickTaskTitle(e.target.value)}
                        className="w-full bg-[#121826] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <select
                          value={quickTaskAssignee}
                          onChange={(e) => setQuickTaskAssignee(e.target.value)}
                          className="w-full bg-[#121826] border border-white/5 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                        >
                          <option value="">Unassigned</option>
                          {participants.map(p => (
                            <option key={p.socketId} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <select
                          value={quickTaskPriority}
                          onChange={(e) => setQuickTaskPriority(e.target.value)}
                          className="w-full bg-[#121826] border border-white/5 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={quickTaskLoading}
                      className="w-full py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md"
                    >
                      {quickTaskLoading ? 'Dispatching...' : 'Dispatch Action Task'}
                    </button>

                    {quickTaskMessage && (
                      <span className={`block text-[10px] text-center font-semibold ${quickTaskMessage.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                        {quickTaskMessage}
                      </span>
                    )}
                  </form>
                </div>
              </div>
            )}

            {/* TAB: AI SPEECH CAPTIONS & TRANSLATION */}
            {activeTab === 'captions' && (
              <div className="h-full flex flex-col p-4 justify-between">
                
                {/* Upper timeline timeline captions */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  
                  {/* Language Selector Dropdown */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
                    <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                      <Languages className="w-4 h-4 text-cyan-400" />
                      Subtitle Language
                    </span>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="bg-[#121826] border border-white/10 rounded-lg px-2 py-1 text-xs text-cyan-400 font-bold focus:outline-none"
                    >
                      <option value="en">English (Original)</option>
                      <option value="es">Español (Spanish)</option>
                      <option value="fr">Français (French)</option>
                      <option value="de">Deutsch (German)</option>
                      <option value="hi">हिन्दी (Hindi)</option>
                      <option value="ja">日本語 (Japanese)</option>
                    </select>
                  </div>

                  {/* Speech Log */}
                  <div className="space-y-3">
                    {transcript.map((seg, i) => {
                      // Check if translation exists, else default to text
                      const textToShow = targetLanguage === 'en' 
                        ? seg.text 
                        : (seg.translations?.[targetLanguage] || seg.text);
                      
                      return (
                        <div key={i} className="bg-[#161d30] border border-white/5 rounded-2xl p-3 text-xs space-y-1 relative">
                          <div className="flex items-center justify-between text-[10px] text-gray-500">
                            <span className="font-bold text-purple-400">{seg.userName}</span>
                            <span>{new Date(seg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                          <p className="text-gray-300 leading-relaxed italic">"{textToShow}"</p>
                        </div>
                      );
                    })}

                    {transcript.length === 0 && (
                      <div className="text-center py-12 text-gray-600 text-xs">
                        <Globe className="w-8 h-8 text-slate-800 mx-auto mb-2" />
                        No speech segments detected yet.<br/>Speech simulation can be tested below.
                      </div>
                    )}
                  </div>
                </div>

                {/* Subtitle simulation bar (allows demo speech subtitles injection) */}
                <form onSubmit={handleSimulateSpeech} className="border-t border-white/5 pt-3 mt-3 shrink-0 space-y-2 bg-[#0e1320]">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">Simulate Speech Input</span>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Type simulated dialogue segment..."
                      value={speechSimulatorInput}
                      onChange={(e) => setSpeechSimulatorInput(e.target.value)}
                      className="flex-1 bg-[#121826] border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-white"
                    />
                    <button
                      type="submit"
                      className="px-3 bg-slate-900 border border-white/5 text-cyan-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center shrink-0"
                    >
                      Speak
                    </button>
                  </div>
                </form>

              </div>
            )}

            {/* TAB: AI ASSIST COPILOT CHATBOT */}
            {activeTab === 'ai' && (
              <div className="h-full flex flex-col justify-between">
                {/* AI Messages timeline */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pr-1">
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                        <span className="font-bold text-gray-400">{msg.sender === 'user' ? user?.name : 'AI Copilot'}</span>
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-xs border leading-relaxed whitespace-pre-line ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-tr from-cyan-600/20 to-purple-600/20 border-purple-500/20 text-gray-100 rounded-tr-none'
                          : 'bg-[#161d30] border-white/5 text-gray-300 rounded-tl-none'
                      }`}>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  
                  {aiLoading && (
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                        <span className="font-bold text-gray-400">AI Copilot</span>
                        <span>•</span>
                        <span className="text-cyan-400 font-medium">typing...</span>
                      </div>
                      <div className="px-4 py-2.5 rounded-2xl bg-[#161d30] border border-white/5 text-gray-400 text-xs rounded-tl-none flex items-center gap-2">
                        <Loader className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Analyzing meeting context...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggestion Chips Panel */}
                <div className="p-3 border-t border-white/5 bg-black/10 shrink-0 space-y-2">
                  <span className="block text-[9px] uppercase font-bold text-gray-500 tracking-wider">Quick Suggestions</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Summarize Meeting', query: 'Summarize the meeting so far' },
                      { label: 'Show My Tasks', query: 'List my tasks' },
                      { label: 'Invite Email Template', query: 'Draft an email template invite' }
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={(e) => handleSendAIMessage(e, chip.query)}
                        disabled={aiLoading}
                        className="text-[10px] bg-slate-900 border border-white/5 text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-1 rounded-lg cursor-pointer transition-all hover:border-cyan-500/20"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Input Form Bar */}
                <form onSubmit={handleSendAIMessage} className="p-3 border-t border-white/5 flex gap-2 items-center bg-black/20 shrink-0">
                  <input
                    type="text"
                    placeholder="Ask AI Copilot..."
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    className="flex-1 bg-[#121826] border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 transition-all text-white disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl cursor-pointer transition-all shadow-md shrink-0 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB: LIVE MEETING POLLS */}
            {activeTab === 'polls' && (
              <div className="h-full flex flex-col justify-between p-4 overflow-y-auto">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Interactive Polls</h4>
                    <span className="text-[10px] text-gray-500 bg-slate-900 px-2 py-0.5 rounded border border-white/5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-500" />
                      Live Synced
                    </span>
                  </div>

                  {/* List of Polls */}
                  <div className="space-y-4">
                    {polls.map((poll) => {
                      const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);
                      const hasVoted = poll.options.some(opt => opt.votes?.includes(user?._id));

                      return (
                        <div key={poll.id} className="bg-[#161d30] border border-white/5 rounded-2xl p-4 space-y-3 shadow-md">
                          <div>
                            <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
                              <span>Created by {poll.creatorName}</span>
                              <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
                            </div>
                            <h5 className="text-xs font-bold text-gray-100">{poll.question}</h5>
                          </div>

                          {/* Poll Options */}
                          <div className="space-y-2">
                            {poll.options.map((opt, optIdx) => {
                              const voteCount = opt.votes?.length || 0;
                              const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                              const isThisOptionVoted = opt.votes?.includes(user?._id);

                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => votePoll(poll.id, optIdx)}
                                  className={`w-full text-left p-2.5 rounded-xl text-xs border border-white/5 relative overflow-hidden transition-all flex items-center justify-between cursor-pointer ${
                                    isThisOptionVoted
                                      ? 'border-cyan-500/30 text-cyan-200 bg-cyan-950/10 shadow-lg shadow-cyan-500/5'
                                      : 'border-white/5 text-gray-300 hover:bg-white/5'
                                  }`}
                                >
                                  {/* Percentage Fill Bar */}
                                  <div
                                    className="absolute inset-y-0 left-0 bg-cyan-500/10 transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                  
                                  {/* Option Text */}
                                  <span className="relative z-10 font-medium flex items-center gap-2">
                                    {isThisOptionVoted && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                                    {opt.text}
                                  </span>

                                  {/* Vote Count & Percent */}
                                  <span className="relative z-10 text-[10px] text-gray-400 font-bold">
                                    {percentage}% ({voteCount})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {polls.length === 0 && (
                      <div className="text-center py-12 text-gray-600 text-xs">
                        <BarChart2 className="w-8 h-8 text-slate-800 mx-auto mb-2 animate-pulse" />
                        No active polls.<br/>Use the form below to launch one!
                      </div>
                    )}
                  </div>
                </div>

                {/* Create Poll Form */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    const question = fd.get('question');
                    const opt1 = fd.get('opt1');
                    const opt2 = fd.get('opt2');
                    const opt3 = fd.get('opt3');
                    if (!question || !opt1 || !opt2) return;
                    
                    const options = [opt1, opt2];
                    if (opt3) options.push(opt3);

                    createPoll(question, options);
                    e.target.reset();
                  }}
                  className="border-t border-white/5 pt-4 mt-4 bg-[#0e1320] space-y-3 shrink-0"
                >
                  <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Create a Poll</span>
                  
                  <input
                    name="question"
                    type="text"
                    required
                    placeholder="Question (e.g. Next code freeze?)"
                    className="w-full bg-[#121826] border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-white"
                  />

                  <div className="space-y-1.5">
                    <input
                      name="opt1"
                      type="text"
                      required
                      placeholder="Option 1"
                      className="w-full bg-[#121826]/60 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 text-gray-300"
                    />
                    <input
                      name="opt2"
                      type="text"
                      required
                      placeholder="Option 2"
                      className="w-full bg-[#121826]/60 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 text-gray-300"
                    />
                    <input
                      name="opt3"
                      type="text"
                      placeholder="Option 3 (Optional)"
                      className="w-full bg-[#121826]/60 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 text-gray-300"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer"
                  >
                    Launch Live Poll
                  </button>
                </form>
              </div>
            )}

          </div>

        </aside>

      </div>
    </div>
  );
};
