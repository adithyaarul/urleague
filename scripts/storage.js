function _lsGet(key) { try { return localStorage.getItem(key); } catch(e) { return null; } }
function _lsSet(key, val) { try { localStorage.setItem(key, val); } catch(e) {} }

const ROOM_CFG = {
  supabaseUrl: _lsGet('room_supabase_url') || 'https://bltofcduuxlvniqmmsdb.supabase.co',
  supabaseKey: _lsGet('room_supabase_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsdG9mY2R1dXhsdm5pcW1tc2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDkyMDgsImV4cCI6MjA5NTkyNTIwOH0.YnFAz8WnRbZPUPmZ0unbBS3EMvogcI8tf8cd3hBe-5w',
};

// ── Runtime state ──
let _sb = null;          // Supabase client
let _roomChannel = null; // Realtime channel
let _roomState = {
  active: false,
  roomId: null,
  roomCode: null,
  role: null,            // 'host' | 'scorer' | 'viewer'
  userId: null,
  userName: null,
  members: [],
  matchState: null,
  version: 0,
  auditLog: [],
  lobbyOpen: false,
};
let _pendingRetry = null;
let _connStatus = 'connected'; // 'connected' | 'reconnecting' | 'offline'

// ── Permissions ──
const ROOM_PERMISSIONS = {
  host:   ['score.edit','score.undo','match.control','room.manage','room.delete','room.lock'],
  scorer: ['score.edit','score.undo'],
  viewer: [],
};