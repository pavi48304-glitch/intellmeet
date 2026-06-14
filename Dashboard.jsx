import { useState, useEffect } from 'react';
import { useAuth, API_URL } from '../../context/AuthContext';
import { useMeeting } from '../../context/MeetingContext';
import { 
  Video, Calendar, CheckSquare, Clock, PlusCircle, 
  ArrowRight, Search, FileText, 
  LogOut, User, Download, Plus, Trash2, ArrowLeftRight,
  Users, UserPlus, UserCheck, UserX, Contact
} from 'lucide-react';


export const Dashboard = () => {
  const { user, logout, updateProfile } = useAuth();
  const { joinMeeting } = useMeeting();

  // Tabs: 'overview', 'history', 'kanban', 'profile'
  const [activeTab, setActiveTab] = useState('overview');

  // Input states
  const [meetingTitle, setMeetingTitle] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [resumeCandidateName, setResumeCandidateName] = useState('');

  // History & Detailed View States
  const [meetingHistory, setMeetingHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedPastMeeting, setSelectedPastMeeting] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Kanban Task States
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  // Device Contacts API Support
  const isContactsSupported = 'contacts' in navigator && 'ContactsManager' in window;
  
  const pickDeviceContact = async (onEmailSelected) => {
    try {
      const properties = ['email'];
      const options = { multiple: false };
      const contacts = await navigator.contacts.select(properties, options);
      if (contacts && contacts.length > 0 && contacts[0].email && contacts[0].email.length > 0) {
        onEmailSelected(contacts[0].email[0]);
      }
    } catch (err) {
      console.error('Failed to pick contact:', err);
    }
  };
  const [newTaskPriority, setNewTaskPriority] = useState('medium');

  // Profile Edit States
  const [editName, setEditName] = useState(user?.name || '');
  const avatarOptions = [
    `https://api.dicebear.com/7.x/bottts/svg?seed=Ares`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=Helix`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=Nova`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=Vektor`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=Spectrum`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=Comet`
  ];
  const [editAvatar, setEditAvatar] = useState(user?.avatar || avatarOptions[0]);
  const [registeredUsersCount, setRegisteredUsersCount] = useState(0);

  // Friends States
  const [friendsList, setFriendsList] = useState([]);
  const [friendRequestsList, setFriendRequestsList] = useState([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);

  // Load meeting history & tasks on mount/tab change
  useEffect(() => {
    if (user) {
      fetchHistory();
      fetchTasks();
      fetchUsersCount();
      if (activeTab === 'friends') {
        fetchFriendsData();
      }

      // Check for share link in URL
      const urlParams = new URLSearchParams(window.location.search);
      const roomToJoin = urlParams.get('room');
      if (roomToJoin) {
        // Remove param from URL to prevent loop
        window.history.replaceState({}, '', window.location.pathname);
         
        setRoomCodeInput(roomToJoin);
        
        const autoJoin = async () => {
          setJoinLoading(true);
          setFormError('');
          try {
            await joinMeeting(roomToJoin);
          } catch (err) {
            setFormError(err.message || 'Invalid room code in link.');
          } finally {
            setJoinLoading(false);
          }
        };
        autoJoin();
      }
    }
     
  }, [user, activeTab]);

  async function fetchUsersCount() {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/auth/users/count`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setRegisteredUsersCount(data.count);
      }
    } catch (err) {
      console.error('Error fetching users count:', err);
    }
  };

  async function fetchFriendsData() {
    if (!user) return;
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/friends`, { headers: { 'Authorization': `Bearer ${user.token}` } }),
        fetch(`${API_URL}/friends/requests`, { headers: { 'Authorization': `Bearer ${user.token}` } })
      ]);
      if (friendsRes.ok) setFriendsList(await friendsRes.json());
      if (requestsRes.ok) setFriendRequestsList(await requestsRes.json());
    } catch (err) {
      console.error('Error fetching friends data:', err);
    }
  };

  const handleFriendSearch = async (e) => {
    e.preventDefault();
    if (!friendSearchQuery.trim() || friendSearchQuery.length < 2) return;
    try {
      const res = await fetch(`${API_URL}/friends/search?q=${encodeURIComponent(friendSearchQuery)}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) setFriendSearchResults(await res.json());
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/friends/request/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        setFormSuccess('Friend request sent!');
        setFriendSearchResults(prev => prev.filter(u => u._id !== userId));
      } else {
        const data = await res.json();
        setFormError(data.message || 'Failed to send request');
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
    }
    setTimeout(() => { setFormSuccess(''); setFormError(''); }, 3000);
  };

  const respondToRequest = async (userId, action) => {
    try {
      const res = await fetch(`${API_URL}/friends/${action}/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        fetchFriendsData();
      }
    } catch (err) {
      console.error(`Error ${action} request:`, err);
    }
  };

  const removeFriend = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/friends/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) fetchFriendsData();
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  async function fetchHistory() {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/meetings/history`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMeetingHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  async function fetchTasks() {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTasks(data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  // Handle Meeting Creation
  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    
    if (!meetingTitle.trim()) {
      setFormError('Please enter a meeting title.');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch(`${API_URL}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ title: meetingTitle })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create meeting');
      }

      setMeetingTitle('');
      setFormSuccess(`Meeting room created! Joining code: ${data.code}`);
      
      // Auto-join meeting
      setTimeout(() => {
        joinMeeting(data.code);
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle Resume Meeting Creation
  const handleCreateResumeMeeting = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    
    const title = resumeCandidateName.trim() ? `Resume Review: ${resumeCandidateName}` : 'Resume Review Meeting';

    setCreateLoading(true);
    try {
      const res = await fetch(`${API_URL}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ title })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create meeting');
      }

      setResumeCandidateName('');
      setFormSuccess(`Resume meeting room created! Joining code: ${data.code}`);
      
      setTimeout(() => {
        joinMeeting(data.code);
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle Meeting Joining
  const handleJoinMeeting = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!roomCodeInput.trim()) {
      setFormError('Please enter a valid meeting code.');
      return;
    }

    setJoinLoading(true);
    try {
      await joinMeeting(roomCodeInput.trim().toLowerCase());
    } catch (err) {
      setFormError(err.message || 'Could not join meeting. Verify code.');
    } finally {
      setJoinLoading(false);
    }
  };

  // Create Kanban Task manually
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDesc,
          assignedTo: newTaskAssignee,
          priority: newTaskPriority,
          status: 'todo'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTasks(prev => [data, ...prev]);
        setNewTaskTitle('');
        setNewTaskDesc('');
        setNewTaskAssignee('');
        setNewTaskPriority('medium');
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  // Move Kanban Card status
  const moveTaskStatus = async (taskId, currentStatus) => {
    const statusMap = {
      'todo': 'in_progress',
      'in_progress': 'review',
      'review': 'completed',
      'completed': 'todo'
    };
    const nextStatus = statusMap[currentStatus];

    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        setTasks(prev => prev.map(t => t._id === taskId ? data : t));
      }
    } catch (err) {
      console.error('Error moving task:', err);
    }
  };

  // Delete Kanban Card
  const deleteTask = async (taskId) => {
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t._id !== taskId));
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Save Profile settings
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!editName.trim()) {
      setFormError('Name cannot be blank.');
      return;
    }

    try {
      await updateProfile(editName, editAvatar);
      setFormSuccess('Profile settings updated successfully!');
    } catch (err) {
      setFormError(err.message);
    }
  };

  // Filtered History
  const filteredHistory = meetingHistory.filter(m => 
    m.title.toLowerCase().includes(historySearch.toLowerCase()) ||
    m.code.toLowerCase().includes(historySearch.toLowerCase())
  );

  const handleExportMeetingReport = (meeting) => {
    if (!meeting) return;
    const overview = meeting.summary?.overview || 'No AI summary overview generated.';
    const tone = meeting.summary?.tone || 'Neutral';
    const topics = (meeting.summary?.topics || []).map(t => `- ${t}`).join('\n') || '- None logged';
    const decisions = (meeting.summary?.decisions || []).map(d => `- ${d}`).join('\n') || '- None logged';
    const actionItems = (meeting.actionItems || []).map(item => `- [${item.status === 'completed' ? 'X' : ' '}] ${item.text} (Assignee: ${item.assignee || 'Unassigned'})`).join('\n') || '- None extracted';
    const transcript = (meeting.transcript || []).map(seg => `[${new Date(seg.timestamp).toLocaleTimeString()}] ${seg.userName}: ${seg.text}`).join('\n') || 'No dialogue transcript recorded.';

    const reportContent = `INTELLMEET SESSION REPORT\n==========================\nTitle: ${meeting.title}\nRoom Code: ${meeting.code}\nDate: ${new Date(meeting.createdAt).toLocaleString()}\nHost: ${meeting.hostName}\n\nAI SUMMARY OVERVIEW\n------------------\n${overview}\nTone: ${tone}\n\nTOPICS DISCUSSED\n----------------\n${topics}\n\nDECISIONS MADE\n--------------\n${decisions}\n\nACTION ITEMS CHECKLIST\n----------------------\n${actionItems}\n\nDIALOGUE TRANSCRIPT\n-------------------\n${transcript}\n`;

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `IntellMeet_Report_${meeting.code}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportWeeklyMetrics = () => {
    const csvRows = [
      ['Metric', 'Value', 'Details'],
      ['Weekly Meeting Hours', '0', 'Monday to Friday aggregate duration'],
      ['Monday Duration', '0.0 Hours', 'Planning and kickoff session'],
      ['Tuesday Duration', '0.0 Hours', 'Engineering standup and backlog groom'],
      ['Wednesday Duration', '0.0 Hours', 'Design critique and client sync'],
      ['Thursday Duration', '0.0 Hours', 'Marketing sync & copywriting audit'],
      ['Friday Duration', '0.0 Hours', 'Weekly showcase and sprint wrap'],
      ['Weekly Target Achievement', '0%', 'Exceeded baseline KPI by 0%'],
      ['Registered Team Members', registeredUsersCount.toString(), 'Active space logins']
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'IntellMeet_Weekly_Activity_Metrics.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-900/60 text-slate-100 flex flex-col font-sans backdrop-blur-sm">
      
      {/* 1. Header Navigation Navbar */}
      <header className="glass-panel border-b border-white/5 py-4 px-6 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Video className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-wider text-white">
              Intell<span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Meet</span>
            </span>
            <span className="text-xs bg-purple-950/60 border border-purple-500/20 text-purple-300 font-semibold px-2 py-0.5 rounded-full">
              Enterprise v2.0
            </span>
          </div>

          <div className="flex items-center gap-6">
            {/* Nav Tabs */}
            <nav className="hidden md:flex items-center gap-1.5 bg-black/25 border border-white/5 p-1 rounded-xl">
              <button 
                onClick={() => { setActiveTab('overview'); setSelectedPastMeeting(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${activeTab === 'overview' ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                Overview
              </button>
              <button 
                onClick={() => { setActiveTab('history'); setSelectedPastMeeting(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${activeTab === 'history' ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                Client History
              </button>
              <button 
                onClick={() => { setActiveTab('kanban'); setSelectedPastMeeting(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${activeTab === 'kanban' ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                Action Board
              </button>
              <button 
                onClick={() => { setActiveTab('friends'); setSelectedPastMeeting(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${activeTab === 'friends' ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                Friends
              </button>
              <button 
                onClick={() => { setActiveTab('resume_meeting'); setSelectedPastMeeting(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${activeTab === 'resume_meeting' ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                Resume Meeting
              </button>
              <button 
                onClick={() => { setActiveTab('profile'); setSelectedPastMeeting(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${activeTab === 'profile' ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                Profile & Settings
              </button>
            </nav>

            {/* Profile widget */}
            <div className="flex items-center gap-3 pl-6 border-l border-white/5">
              <div className="w-9 h-9 rounded-lg bg-slate-800 p-1 border border-white/10 shrink-0">
                <img src={user?.avatar} alt="User Avatar" className="w-full h-full" />
              </div>
              <div className="hidden lg:flex flex-col text-left shrink-0">
                <span className="text-xs font-bold text-white">{user?.name}</span>
                <span className="text-[10px] text-gray-500 uppercase font-semibold">{user?.role}</span>
              </div>
              <button 
                onClick={logout}
                className="p-2 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-gray-400 hover:text-red-400 transition-all cursor-pointer shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 relative">
        
        {/* Alerts and errors */}
        {(formError || formSuccess) && (
          <div className={`mb-6 max-w-xl mx-auto border rounded-xl p-4 text-sm flex items-center gap-3 ${formError ? 'bg-red-950/20 border-red-500/30 text-red-200' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'}`}>
            <span>{formError || formSuccess}</span>
          </div>
        )}

        {/* ==================== TABS: OVERVIEW ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Top statistics panel */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4 glow-cyan">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Meetings</span>
                  <span className="text-2xl font-black text-white">{meetingHistory.length}</span>
                </div>
              </div>
              
              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">Meeting Minutes</span>
                  <span className="text-2xl font-black text-white">0m</span>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">Tasks Complete</span>
                  <span className="text-2xl font-black text-white">
                    {tasks.filter(t => t.status === 'completed').length} / {tasks.length}
                  </span>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Users className="w-6 h-6 animate-pulse" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">Registered Members</span>
                  <span className="text-2xl font-black text-white">{registeredUsersCount}</span>
                </div>
              </div>
            </div>

            {/* Launchpad & Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Meeting Launcher (left) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Create a meeting */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl"></div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-cyan-400" />
                    Host New Meeting
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">Start an instant high-quality meeting room with transcripts, notes, and translation.</p>
                  
                  <form onSubmit={handleCreateMeeting} className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Enter Meeting Title (e.g., Weekly Sync)"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-black/20 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all text-xs"
                    />
                    <button 
                      type="submit"
                      disabled={createLoading}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-500/60 to-blue-600/60 hover:from-blue-400/60 hover:to-blue-500/60 border border-blue-400/20 text-white text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      {createLoading ? 'Provisioning...' : 'Create & Host Room'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Join a meeting */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl"></div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-purple-400" />
                    Join Existing Meeting
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">Enter a 10-character code to jump straight into an active meeting room.</p>
                  
                  <form onSubmit={handleJoinMeeting} className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Room Code (format: xxx-yyyy-zzz)"
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-black/20 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all text-xs"
                    />
                    <button 
                      type="submit"
                      disabled={joinLoading}
                      className="w-full py-2.5 bg-gradient-to-r from-indigo-500/60 to-indigo-600/60 hover:from-indigo-400/60 hover:to-indigo-500/60 border border-indigo-400/20 text-white text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      {joinLoading ? 'Connecting...' : 'Secure Join Room'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Invite Team Member */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-400" />
                    Invite Colleague
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">Send a secure invite to collaborate on your team space.</p>
                  
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const email = e.target.inviteEmail.value;
                      if (!email) return;
                      
                      try {
                        const res = await fetch(`${API_URL}/invite`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${user.token}`
                          },
                          body: JSON.stringify({ email })
                        });
                        
                        if (res.ok) {
                          setFormSuccess(`Invitation email successfully dispatched to ${email}!`);
                          e.target.reset();
                        } else {
                          setFormError(`Failed to send invitation to ${email}.`);
                        }
                      } catch (err) {
                        console.error(err);
                        setFormError(`Network error while sending invitation.`);
                      }
                      
                      setTimeout(() => {
                        setFormSuccess('');
                        setFormError('');
                      }, 4000);
                    }} 
                    className="space-y-3"
                  >
                    <input 
                      type="email" 
                      id="inviteEmailInput"
                      name="inviteEmail"
                      placeholder="colleague@enterprise.com"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-black/20 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-all text-xs"
                    />
                    {isContactsSupported && (
                      <button
                        type="button"
                        onClick={() => pickDeviceContact((email) => {
                          const input = document.getElementById('inviteEmailInput');
                          if(input) input.value = email;
                        })}
                        className="w-full py-2 bg-black/30 border border-white/10 hover:bg-black/50 text-emerald-400 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mb-2"
                      >
                        <Contact className="w-4 h-4" />
                        Pick from Contacts
                      </button>
                    )}
                    <button 
                      type="submit"
                      className="w-full py-2.5 bg-gradient-to-r from-teal-500/60 to-teal-600/60 hover:from-teal-400/60 hover:to-teal-500/60 border border-teal-400/20 text-white text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      Send Secure Invitation
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>

              </div>

              {/* Breathtaking custom CSS metrics chart (right) */}
              <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-white/5 text-left flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Collaborative Activity Metrics</h3>
                      <p className="text-xs text-gray-400">Real-time stats across meetings duration and deliverables tracking.</p>
                    </div>
                    <button 
                      onClick={handleExportWeeklyMetrics}
                      className="px-3 py-1.5 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-400 transition-all text-xs flex items-center gap-1.5 cursor-pointer font-bold shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Metrics (CSV)
                    </button>
                  </div>
                  
                  {/* Custom CSS Bars representing weekly meet timings */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-gray-300 mb-1">
                        <span>Weekly Meeting Hours</span>
                        <span className="font-bold text-cyan-400">0 Hours Total</span>
                      </div>
                      {/* Interactive CSS bars layout */}
                      <div className="flex items-end gap-2.5 h-36 bg-black/20 rounded-xl p-3 border border-white/5">
                        <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <div className="w-full bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/30 rounded-t-lg transition-all" style={{ height: '0%' }}></div>
                          <span className="text-[9px] text-gray-500">Mon</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <div className="w-full bg-purple-500/40 hover:bg-purple-500/60 border border-purple-500/50 rounded-t-lg transition-all" style={{ height: '0%' }}></div>
                          <span className="text-[9px] text-gray-500">Tue</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <div className="w-full bg-cyan-500/60 hover:bg-cyan-500/80 border border-cyan-500/70 rounded-t-lg transition-all glow-cyan" style={{ height: '0%' }}></div>
                          <span className="text-[9px] text-gray-500">Wed</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <div className="w-full bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 rounded-t-lg transition-all" style={{ height: '0%' }}></div>
                          <span className="text-[9px] text-gray-500">Thu</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <div className="w-full bg-cyan-500/80 hover:bg-cyan-500 border border-cyan-400 rounded-t-lg transition-all glow-cyan" style={{ height: '0%' }}></div>
                          <span className="text-[9px] text-gray-500">Fri</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/5 pt-4 flex items-center justify-between text-xs text-gray-400">
                  <span>Weekly Target Achievement</span>
                  <span className="text-cyan-400 font-bold">0% of Target</span>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ==================== TABS: CLIENT HISTORY ==================== */}
        {activeTab === 'history' && (
          <div className="space-y-6 text-left">
            
            {/* If a past meeting detail is selected, show detail view */}
            {selectedPastMeeting ? (
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6 animate-fade-in relative">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs bg-cyan-950/60 border border-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-bold">
                      Completed Meeting Room Log
                    </span>
                    <h2 className="text-2xl font-black text-white mt-3">{selectedPastMeeting.title}</h2>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-400 mt-2">
                      <span>Code: <code className="text-purple-400 bg-purple-950/30 px-1 py-0.5 rounded">{selectedPastMeeting.code}</code></span>
                      <span>•</span>
                      <span>Date: {new Date(selectedPastMeeting.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Host: {selectedPastMeeting.hostName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleExportMeetingReport(selectedPastMeeting)}
                      className="px-3 py-1.5 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-400 transition-all text-xs flex items-center gap-1.5 cursor-pointer font-bold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Report (TXT)
                    </button>
                    <button 
                      onClick={() => setSelectedPastMeeting(null)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-black/10 text-gray-300 hover:text-white transition-all text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5 rotate-90" />
                      Back to List
                    </button>
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Split grid for Details */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: AI Summary report */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* Summary Card */}
                    <div className="bg-black/20 border border-white/5 rounded-xl p-5 space-y-3">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider text-cyan-400">AI Summary Overview</h4>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {selectedPastMeeting.summary?.overview || 'No AI summary overview generated for this session.'}
                      </p>
                      <div className="text-[10px] text-gray-500 font-bold uppercase">
                        Meeting Tone Analyzer: <span className="text-amber-400">{selectedPastMeeting.summary?.tone || 'Neutral'}</span>
                      </div>
                    </div>

                    {/* Topics and decisions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4 space-y-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider text-purple-400">Core Topics Discussed</h4>
                        <ul className="list-disc pl-4 text-xs text-gray-400 space-y-1">
                          {(selectedPastMeeting.summary?.topics || []).map((topic, i) => (
                            <li key={i}>{topic}</li>
                          ))}
                          {(!selectedPastMeeting.summary?.topics || selectedPastMeeting.summary.topics.length === 0) && (
                            <span className="text-gray-600 block">None logged</span>
                          )}
                        </ul>
                      </div>

                      <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4 space-y-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider text-emerald-400">Milestone Decisions</h4>
                        <ul className="list-disc pl-4 text-xs text-gray-400 space-y-1">
                          {(selectedPastMeeting.summary?.decisions || []).map((dec, i) => (
                            <li key={i}>{dec}</li>
                          ))}
                          {(!selectedPastMeeting.summary?.decisions || selectedPastMeeting.summary.decisions.length === 0) && (
                            <span className="text-gray-600 block">None logged</span>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* Speech Transcript logs */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-cyan-400">
                        <FileText className="w-4 h-4" />
                        AI Dialogue Transcript Timeline
                      </h4>
                      <div className="bg-black/30 border border-white/5 rounded-xl p-4 h-64 overflow-y-auto space-y-3">
                        {(selectedPastMeeting.transcript || []).map((seg, i) => (
                          <div key={i} className="text-xs border-b border-white/5 pb-2 last:border-b-0">
                            <div className="flex items-center justify-between text-gray-500 mb-1">
                              <span className="font-bold text-purple-400">{seg.userName}</span>
                              <span>{new Date(seg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-gray-300">{seg.text}</p>
                          </div>
                        ))}
                        {(!selectedPastMeeting.transcript || selectedPastMeeting.transcript.length === 0) && (
                          <div className="text-center text-gray-600 py-12">No speech segments transcribed.</div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Files & Action Items checklist */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    {/* Action items */}
                    <div className="bg-black/20 border border-white/5 rounded-xl p-5 space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider text-emerald-400">Action Deliverables Checklist</h4>
                      <div className="space-y-2">
                        {(selectedPastMeeting.actionItems || []).map((action, i) => (
                          <div key={i} className="flex items-start gap-3 bg-black/30 border border-white/5 p-3 rounded-lg">
                            <input 
                              type="checkbox" 
                              checked={action.status === 'completed'} 
                              readOnly
                              className="mt-0.5 rounded border-white/10 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                            <div className="text-xs">
                              <span className="block text-gray-200 font-medium">{action.text}</span>
                              <span className="block text-[10px] text-gray-500 mt-0.5">Owner: {action.assignee || 'Unassigned'}</span>
                            </div>
                          </div>
                        ))}
                        {(!selectedPastMeeting.actionItems || selectedPastMeeting.actionItems.length === 0) && (
                          <div className="text-center text-gray-600 py-6 text-xs">No actionable tasks extracted.</div>
                        )}
                      </div>
                    </div>

                    {/* Shared Files list */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider text-cyan-400">Shared Session Files</h4>
                      <div className="space-y-2">
                        {(selectedPastMeeting.sharedFiles || []).map((file, i) => (
                          <div key={i} className="flex items-center justify-between bg-black/40 border border-white/5 p-3 rounded-xl">
                            <div className="text-xs">
                              <span className="block text-gray-200 truncate font-semibold max-w-[200px]">{file.name}</span>
                              <span className="block text-[10px] text-gray-500 mt-0.5">Uploaded by {file.uploaderName}</span>
                            </div>
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all cursor-pointer"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}
                        {(!selectedPastMeeting.sharedFiles || selectedPastMeeting.sharedFiles.length === 0) && (
                          <div className="text-center text-gray-600 py-6 text-xs bg-black/10 border border-dashed border-white/5 rounded-xl">No files uploaded.</div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Search / Filter header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">Historical Client Meetings Archive</h2>
                    <p className="text-xs text-gray-400">Search and audit meeting audio transcripts, deliverables checklists, and summaries.</p>
                  </div>
                  <div className="relative max-w-xs w-full">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="w-4 h-4 text-gray-500" />
                    </span>
                    <input 
                      type="text"
                      placeholder="Search meetings by title..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/10 bg-black/20 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all text-xs"
                    />
                  </div>
                </div>

                {/* History Grid list */}
                {historyLoading ? (
                  <div className="text-center py-20 text-gray-500 text-xs">Loading records...</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-20 bg-black/10 border border-dashed border-white/5 rounded-2xl text-gray-600 text-sm">
                    No completed meetings archived yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredHistory.map((meet) => (
                      <div 
                        key={meet._id}
                        onClick={() => setSelectedPastMeeting(meet)}
                        className="glass-panel p-5 rounded-2xl border border-white/5 text-left hover:border-cyan-500/30 transition-all cursor-pointer hover:shadow-lg hover:shadow-cyan-500/5 group"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-all line-clamp-1">{meet.title}</h3>
                          <span className="text-[10px] bg-emerald-950/60 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-semibold tracking-wide">
                            Completed
                          </span>
                        </div>
                        
                        <div className="text-[10px] text-gray-500 font-bold uppercase mt-2">
                          Room Code: <code className="text-purple-400 bg-purple-950/20 px-1 py-0.5 rounded">{meet.code}</code>
                        </div>

                        <p className="text-xs text-gray-400 mt-3 line-clamp-2 leading-relaxed">
                          {meet.summary?.overview || 'Meeting synchronisation completed. Click view details to retrieve transcripts and tasks.'}
                        </p>

                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
                          <span>Date: {new Date(meet.createdAt).toLocaleDateString()}</span>
                          <span className="text-cyan-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            View Report
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* ==================== TABS: KANBAN BOARD ==================== */}
        {activeTab === 'kanban' && (
          <div className="space-y-6 text-left animate-fade-in">
            
            {/* Kanban Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Enterprise Action Board</h2>
                <p className="text-xs text-gray-400">Track and assign meeting actions dynamically in real-time.</p>
              </div>
              
              {/* Manual Task Creator Overlay Form */}
              <form onSubmit={handleCreateTask} className="flex flex-wrap items-center gap-2 bg-black/20 border border-white/5 p-2 rounded-xl">
                <input 
                  type="text" 
                  placeholder="Task Summary..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all text-xs w-48"
                  required
                />
                <input 
                  type="text" 
                  placeholder="Assignee Name..."
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all text-xs w-32"
                />
                <button 
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Task
                </button>
              </form>
            </div>

            {/* Kanban Columns (Grid Layout) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Column: Todo */}
              <div className="bg-[#0f1422]/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col h-[520px] shadow-xl">
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2 shrink-0">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 block"></span>
                    To Do
                  </span>
                  <span className="text-[10px] bg-red-950/60 border border-red-500/20 text-red-300 font-bold px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === 'todo').length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {tasks.filter(t => t.status === 'todo').map((task) => (
                    <div key={task._id} className={`bg-[#161d30] border-t border-r border-b border-white/5 rounded-xl p-3.5 space-y-3 shadow-md hover:border-white/10 hover:scale-[1.02] transition-all text-xs relative group border-l-4 ${
                      task.priority === 'high' ? 'border-l-red-500' : task.priority === 'low' ? 'border-l-emerald-500' : 'border-l-amber-500'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${task.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : task.priority === 'low' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            {task.priority}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveTaskStatus(task._id, 'todo')} className="p-1 rounded bg-black/30 hover:bg-black/50 text-cyan-400 cursor-pointer" title="Move status">
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteTask(task._id)} className="p-1 rounded bg-black/30 hover:bg-red-500/30 text-red-400 cursor-pointer" title="Delete Task">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-white text-xs">{task.title}</h4>
                        {task.description && <p className="text-gray-400 mt-1 line-clamp-2">{task.description}</p>}
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-gray-500">
                        <span>Assignee: <strong className="text-gray-300">{task.assignedTo}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column: In Progress */}
              <div className="bg-[#0f1422]/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col h-[520px] shadow-xl">
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2 shrink-0">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block animate-pulse"></span>
                    In Progress
                  </span>
                  <span className="text-[10px] bg-amber-950/60 border border-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === 'in_progress').length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {tasks.filter(t => t.status === 'in_progress').map((task) => (
                    <div key={task._id} className={`bg-[#161d30] border-t border-r border-b border-white/5 rounded-xl p-3.5 space-y-3 shadow-md hover:border-white/10 hover:scale-[1.02] transition-all text-xs relative group border-l-4 ${
                      task.priority === 'high' ? 'border-l-red-500' : task.priority === 'low' ? 'border-l-emerald-500' : 'border-l-amber-500'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${task.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : task.priority === 'low' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            {task.priority}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveTaskStatus(task._id, 'in_progress')} className="p-1 rounded bg-black/30 hover:bg-black/50 text-cyan-400 cursor-pointer" title="Move status">
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteTask(task._id)} className="p-1 rounded bg-black/30 hover:bg-red-500/30 text-red-400 cursor-pointer" title="Delete Task">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-white text-xs">{task.title}</h4>
                        {task.description && <p className="text-gray-400 mt-1 line-clamp-2">{task.description}</p>}
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-gray-500">
                        <span>Assignee: <strong className="text-gray-300">{task.assignedTo}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column: Review */}
              <div className="bg-[#0f1422]/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col h-[520px] shadow-xl">
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2 shrink-0">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 block animate-pulse"></span>
                    Review
                  </span>
                  <span className="text-[10px] bg-cyan-950/60 border border-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === 'review').length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {tasks.filter(t => t.status === 'review').map((task) => (
                    <div key={task._id} className={`bg-[#161d30] border-t border-r border-b border-white/5 rounded-xl p-3.5 space-y-3 shadow-md hover:border-white/10 hover:scale-[1.02] transition-all text-xs relative group border-l-4 ${
                      task.priority === 'high' ? 'border-l-red-500' : task.priority === 'low' ? 'border-l-emerald-500' : 'border-l-amber-500'
                    }`}>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${task.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : task.priority === 'low' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            {task.priority}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveTaskStatus(task._id, 'review')} className="p-1 rounded bg-black/30 hover:bg-black/50 text-cyan-400 cursor-pointer" title="Move status">
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteTask(task._id)} className="p-1 rounded bg-black/30 hover:bg-red-500/30 text-red-400 cursor-pointer" title="Delete Task">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-white text-xs">{task.title}</h4>
                        {task.description && <p className="text-gray-400 mt-1 line-clamp-2">{task.description}</p>}
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-gray-500">
                        <span>Assignee: <strong className="text-gray-300">{task.assignedTo}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column: Completed */}
              <div className="bg-[#0f1422]/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col h-[520px] shadow-xl">
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2 shrink-0">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                    Completed
                  </span>
                  <span className="text-[10px] bg-emerald-950/60 border border-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === 'completed').length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {tasks.filter(t => t.status === 'completed').map((task) => (
                    <div key={task._id} className="bg-[#161d30] border-t border-r border-b border-white/5 border-l-4 border-l-gray-500 rounded-xl p-3.5 space-y-3 shadow-md hover:border-white/10 hover:scale-[1.02] transition-all text-xs relative group line-through text-gray-500">
                      <div>
                        <div className="flex items-center justify-between mb-1.5 font-normal">
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-500 border border-emerald-800">
                            done
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveTaskStatus(task._id, 'completed')} className="p-1 rounded bg-black/30 hover:bg-black/50 text-cyan-400 cursor-pointer" title="Move status">
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteTask(task._id)} className="p-1 rounded bg-black/30 hover:bg-red-500/30 text-red-400 cursor-pointer" title="Delete Task">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-gray-300 text-xs">{task.title}</h4>
                        {task.description && <p className="text-gray-500 mt-1 line-clamp-1">{task.description}</p>}
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-gray-600">
                        <span>Assignee: <strong className="text-gray-400">{task.assignedTo}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ==================== TABS: FRIENDS ==================== */}
        {activeTab === 'friends' && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: My Friends & Requests */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Pending Requests */}
                {friendRequestsList.length > 0 && (
                  <div className="glass-panel p-6 rounded-2xl border border-amber-500/20 bg-amber-950/10">
                    <h3 className="text-sm font-bold text-amber-400 mb-4 flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      Pending Friend Requests ({friendRequestsList.length})
                    </h3>
                    <div className="space-y-3">
                      {friendRequestsList.map(req => (
                        <div key={req._id} className="flex items-center justify-between bg-black/40 border border-white/5 p-3 rounded-xl">
                          <div className="flex items-center gap-3">
                            <img src={req.avatar} alt="Avatar" className="w-10 h-10 rounded-lg bg-slate-800" />
                            <div>
                              <span className="block text-sm font-bold text-white">{req.name}</span>
                              <span className="block text-xs text-gray-500">{req.email}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => respondToRequest(req._id, 'accept')} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer">Accept</button>
                            <button onClick={() => respondToRequest(req._id, 'reject')} className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer">Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* My Friends */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    My Friends ({friendsList.length})
                  </h3>
                  {friendsList.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-sm">
                      You haven't added any friends yet. Search for colleagues to connect!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {friendsList.map(friend => (
                        <div key={friend._id} className="flex items-center justify-between bg-black/30 border border-white/5 p-4 rounded-xl">
                          <div className="flex items-center gap-3">
                            <img src={friend.avatar} alt="Avatar" className="w-10 h-10 rounded-lg bg-slate-800" />
                            <div>
                              <span className="block text-sm font-bold text-white">{friend.name}</span>
                              <span className="block text-[10px] text-cyan-400 uppercase tracking-wider">{friend.role}</span>
                            </div>
                          </div>
                          <button onClick={() => removeFriend(friend._id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer" title="Remove Friend">
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: Search */}
              <div className="lg:col-span-5 space-y-6">
                <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl"></div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <Search className="w-5 h-5 text-purple-400" />
                    Find Colleagues
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">Search by name or email address to add them to your friends list.</p>
                  
                  <form onSubmit={handleFriendSearch} className="flex flex-col gap-2 mb-6">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Search name or email..."
                        value={friendSearchQuery}
                        onChange={(e) => setFriendSearchQuery(e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-black/20 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all text-sm"
                      />
                      <button type="submit" className="px-4 py-2.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-xl font-bold transition-all cursor-pointer">
                        Search
                      </button>
                    </div>
                    {isContactsSupported && (
                      <button
                        type="button"
                        onClick={() => pickDeviceContact((email) => setFriendSearchQuery(email))}
                        className="w-full py-2 bg-black/30 border border-white/10 hover:bg-black/50 text-purple-400 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                      >
                        <Contact className="w-4 h-4" />
                        Pick from Contacts
                      </button>
                    )}
                  </form>

                  <div className="space-y-3">
                    {friendSearchResults.map(res => (
                      <div key={res._id} className="flex items-center justify-between bg-black/40 border border-white/5 p-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <img src={res.avatar} alt="Avatar" className="w-8 h-8 rounded-lg bg-slate-800" />
                          <div>
                            <span className="block text-sm font-bold text-white">{res.name}</span>
                            <span className="block text-[10px] text-gray-500">{res.email}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => sendFriendRequest(res._id)}
                          className="p-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-all cursor-pointer"
                          title="Send Friend Request"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {friendSearchResults.length === 0 && friendSearchQuery && (
                      <div className="text-center text-xs text-gray-500 py-4">Hit search to find users</div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== TABS: RESUME MEETING ==================== */}
        {activeTab === 'resume_meeting' && (
          <div className="max-w-md mx-auto glass-panel p-8 rounded-2xl border border-white/5 text-left space-y-6 glow-cyan">
            <div>
              <h2 className="text-xl font-bold text-white">Schedule Resume Meeting</h2>
              <p className="text-xs text-gray-400">Start a dedicated room to review and discuss resumes.</p>
            </div>
            
            <form onSubmit={handleCreateResumeMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Candidate Name (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-500" />
                  </span>
                  <input
                    type="text"
                    value={resumeCandidateName}
                    onChange={(e) => setResumeCandidateName(e.target.value)}
                    placeholder="Enter candidate name..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md cursor-pointer pt-3 pb-3 flex items-center justify-center gap-2"
              >
                {createLoading ? 'Provisioning...' : 'Start Resume Meeting'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ==================== TABS: PROFILE ==================== */}
        {activeTab === 'profile' && (
          <div className="max-w-md mx-auto glass-panel p-8 rounded-2xl border border-white/5 text-left space-y-6 glow-cyan">
            <div>
              <h2 className="text-xl font-bold text-white">Modify User Profile Settings</h2>
              <p className="text-xs text-gray-400">Update your avatar representation and name visible in meetings.</p>
            </div>
            
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Full Profile Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-500" />
                  </span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Choose New Avatar Robot
                </label>
                <div className="grid grid-cols-3 gap-2 bg-black/20 border border-white/5 p-3 rounded-xl">
                  {avatarOptions.map((avUrl, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setEditAvatar(avUrl)}
                      className={`w-12 h-12 mx-auto rounded-lg border-2 p-1.5 transition-all bg-slate-900 cursor-pointer ${
                        editAvatar === avUrl ? 'border-cyan-400 scale-105 shadow-md shadow-cyan-400/20' : 'border-transparent hover:border-white/20'
                      }`}
                    >
                      <img src={avUrl} alt={`Avatar selection ${index + 1}`} className="w-full h-full" />
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md cursor-pointer pt-3 pb-3"
              >
                Save Settings
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
};
