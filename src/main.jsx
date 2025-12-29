import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot, 
  query 
} from 'firebase/firestore';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell
} from 'recharts';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  History,
  TrendingUp,
  Users,
  Download,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Globe,
  Trash2,
  ArrowRight,
  Ban,
  CheckSquare,
  Square,
  Truck,
  FileSpreadsheet,
  LogOut,
  Mail,
  ShieldCheck,
  Table as TableIcon,
  Database,
  Lock,
  UserPlus,
  Loader2,
  LogIn
} from 'lucide-react';

/**
 * --- Firebase Configuration ---
 */
const isCanvas = typeof __firebase_config !== 'undefined';
const firebaseConfig = isCanvas 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyDns4NX18h_dCrZ3hyyFzHT-bUvdwdRLw0",
      authDomain: "admob-app-id-4497163742.firebaseapp.com",
      projectId: "admob-app-id-4497163742",
      storageBucket: "admob-app-id-4497163742.firebasestorage.app",
      messagingSenderId: "944948366460",
      appId: "1:944948366460:web:da3388aeb8af102302cdf9"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'swm-national-v1'; 

const formatDate = (date) => date.toISOString().split('T')[0];

const App = () => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); 
  const [authMode, setAuthMode] = useState('login'); 
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [config, setConfig] = useState({ 
    states: [], wards: [], blocks: [], supervisors: [] 
  });
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  
  // Dashboard & Review Filters
  const [dashWard, setDashWard] = useState('all');
  const [dashBlocks, setDashBlocks] = useState([]); 
  const [dashSupervisor, setDashSupervisor] = useState('all');
  const [dashStartDate, setDashStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return formatDate(d);
  });
  const [dashEndDate, setDashEndDate] = useState(formatDate(new Date()));
  const [viewTimeframe, setViewTimeframe] = useState('daily');
  const [reviewStart, setReviewStart] = useState(dashStartDate);
  const [reviewEnd, setReviewEnd] = useState(dashEndDate);
  const [exportStart, setExportStart] = useState(dashStartDate);
  const [exportEnd, setExportEnd] = useState(dashEndDate);

  const [entryWard, setEntryWard] = useState('');
  const [entryBlock, setEntryBlock] = useState('');
  const [formData, setFormData] = useState({
    date: formatDate(new Date()),
    hhCovered: 0,
    hhGiving: 0,
    hhSegregating: 0,
    noCollection: false,
    reason: "Vehicle didn't come"
  });

  // --- Authentication Handlers ---
  const handleAuth = async (e) => {
    e.preventDefault();
    if (passInput.length < 6) {
        showStatus('error', 'Password must be at least 6 characters.');
        return;
    }

    setAuthLoading(true);
    const cleanEmail = emailInput.trim().toLowerCase();
    try {
      let resultUser;
      if (authMode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, passInput);
        resultUser = cred.user;
        showStatus('success', 'Logged in.');
      } else {
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, passInput);
          resultUser = cred.user;
          showStatus('success', 'Registration complete.');
        } catch (regErr) {
          // If email already in use, try to login automatically
          if (regErr.code === 'auth/email-already-in-use') {
             const cred = await signInWithEmailAndPassword(auth, cleanEmail, passInput);
             resultUser = cred.user;
             showStatus('info', 'Account existed. Logged in.');
          } else {
             throw regErr;
          }
        }
      }

      // Explicitly set user state to bypass any listener lag
      setUser(resultUser);
      
      // Immediate Admin Bypass logic
      if (cleanEmail === 'sajith.tm@saahas.org') {
          setUserRole('manager');
          // Try background DB sync, but don't block UI
          try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_roles', cleanEmail), {
                role: 'manager',
                updatedAt: new Date().toISOString()
            });
          } catch (e) { console.warn("Admin bootstrap background write pending."); }
      }
      
    } catch (error) {
      console.error(error);
      let msg = error.message;
      if (error.code === 'auth/user-not-found') msg = 'Account not found. Select "Create Account".';
      if (error.code === 'auth/wrong-password') msg = 'Incorrect password.';
      showStatus('error', msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setUser(null);
    setUserRole(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      try {
        if (u) {
          const email = u.email.toLowerCase();
          setUser(u);
          
          // --- ADMIN BYPASS: sajith.tm@saahas.org immediate grant ---
          if (email === 'sajith.tm@saahas.org') {
             setUserRole('manager');
             setRoleLoading(false);
          } else {
             setRoleLoading(true);
             const roleRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_roles', email);
             const roleSnap = await getDoc(roleRef);
             if (roleSnap.exists()) {
               const role = roleSnap.data().role;
               setUserRole(role);
               if (role === 'supervisor') setActiveTab('entry');
             } else {
               setUserRole('unauthorized');
             }
             setRoleLoading(false);
          }
        } else {
          setUser(null);
          setUserRole(null);
        }
      } catch (err) {
        console.error("Auth Listener Error:", err);
        // Fallback for admin if DB fails
        if (u?.email === 'sajith.tm@saahas.org') {
            setUserRole('manager');
        } else {
            setUserRole('unauthorized');
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Data Sync ---
  useEffect(() => {
    if (!user || !userRole || userRole === 'unauthorized') return;

    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_config', 'settings');
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig({
          states: data.states || [],
          wards: data.wards || [],
          blocks: data.blocks || [],
          supervisors: data.supervisors || []
        });
      }
    });

    const dataRef = collection(db, 'artifacts', appId, 'public', 'data', 'daily_logs');
    const unsubData = onSnapshot(query(dataRef), (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDailyData(logs);
    });

    return () => { unsubConfig(); unsubData(); };
  }, [user, userRole]);

  // --- Logic Helpers ---
  const showStatus = (type, text) => {
    setStatusMsg({ type, text: String(text) });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
  };

  const saveConfig = async (newConfig) => {
    if (userRole !== 'manager') return;
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_config', 'settings');
      await setDoc(configRef, newConfig);
      showStatus('success', 'Changes published.');
    } catch (e) {
      showStatus('error', 'Update failed.');
    }
  };

  const updateUserRole = async (email, role) => {
    if (userRole !== 'manager') return;
    try {
      const roleRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_roles', email.toLowerCase().trim());
      await setDoc(roleRef, { role, updatedAt: new Date().toISOString() });
      showStatus('success', `Permission assigned to ${email}`);
    } catch (e) {
      showStatus('error', 'Failed to update access.');
    }
  };

  const toggleBlockFilter = (id) => {
    setDashBlocks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const removeSupervisor = (id) => {
    const ns = config.supervisors.filter(s => s.id !== id);
    const nb = config.blocks.map(b => b.supervisorId === id ? { ...b, supervisorId: '' } : b);
    setConfig({ ...config, supervisors: ns, blocks: nb });
    showStatus('success', 'Staff member removed.');
  };

  const submitDailyLog = async () => {
    if (!entryBlock) { showStatus('error', "Select Operating Block."); return; }
    const block = config.blocks.find(b => b.id === entryBlock);
    const ward = config.wards.find(w => w.id === block?.wardId);
    const supervisor = config.supervisors.find(s => s.id === block?.supervisorId);

    try {
      const logId = `${formData.date}_${entryBlock}`;
      const logRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_logs', logId);
      await setDoc(logRef, {
        ...formData,
        wardId: ward?.id || '',
        wardName: ward?.name || '',
        blockId: entryBlock,
        blockName: block?.name || '',
        supervisorId: supervisor?.id || 'unassigned',
        supervisorName: supervisor?.name || 'Unassigned',
        timestamp: new Date().toISOString(),
        enteredBy: user.email
      });
      showStatus('success', 'Log saved.');
      setFormData({ ...formData, hhCovered: 0, hhGiving: 0, hhSegregating: 0, noCollection: false });
    } catch (e) {
      showStatus('error', "Error saving data.");
    }
  };

  // --- Analytics & Review ---
  const filteredLogs = useMemo(() => {
    return dailyData.filter(log => {
      const wardMatch = dashWard === 'all' || log.wardId === dashWard;
      const blockMatch = dashBlocks.length === 0 || dashBlocks.includes(log.blockId);
      const dateMatch = log.date >= dashStartDate && log.date <= dashEndDate;
      return wardMatch && blockMatch && dateMatch;
    });
  }, [dailyData, dashWard, dashBlocks, dashStartDate, dashEndDate]);

  const reviewTableData = useMemo(() => {
    return dailyData
      .filter(l => l.date >= reviewStart && l.date <= reviewEnd)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyData, reviewStart, reviewEnd]);

  const timeSeriesData = useMemo(() => {
    const groups = {};
    filteredLogs.forEach(log => {
      let label = log.date;
      if (viewTimeframe === 'weekly') {
        const d = new Date(log.date);
        const start = new Date(d.setDate(d.getDate() - d.getDay()));
        label = `W/O ${start.toLocaleDateString('en-IN', {day:'numeric', month:'short'})}`;
      } else if (viewTimeframe === 'monthly') {
        label = new Date(log.date).toLocaleString('en-IN', {month:'short', year:'numeric'});
      }
      if (!groups[label]) groups[label] = { name: label, giving: 0, seg: 0, rawDate: log.date };
      if (!log.noCollection) {
        groups[label].giving += Number(log.hhGiving || 0);
        groups[label].seg += Number(log.hhSegregating || 0);
      }
    });
    return Object.values(groups).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [filteredLogs, viewTimeframe]);

  const handleExportCSV = () => {
    const exportLogs = dailyData.filter(l => l.date >= exportStart && l.date <= exportEnd);
    if (exportLogs.length === 0) { showStatus('error', 'No data found.'); return; }
    
    // Headers updated to match request
    const headers = ["Date", "Block", "Status", "Covered", "Waste Given", "Waste Segregated", "Given Percentage", "Segregated Percentage", "Supervisor", "Gap Reason"];
    
    const logRows = exportLogs.sort((a,b) => a.date.localeCompare(b.date)).map(l => {
      const givPct = l.hhCovered > 0 ? ((Number(l.hhGiving)/Number(l.hhCovered))*100).toFixed(1) : "0.0";
      const segPct = l.hhGiving > 0 ? ((Number(l.hhSegregating)/Number(l.hhGiving))*100).toFixed(1) : "0.0";
      return [
        l.date, 
        l.blockName || 'N/A', 
        l.noCollection ? "Absent" : "Collected",
        l.hhCovered,
        l.noCollection ? 0 : l.hhGiving,
        l.noCollection ? 0 : l.hhSegregating,
        l.noCollection ? "0.0" : givPct,
        l.noCollection ? "0.0" : segPct,
        l.supervisorName || 'Unassigned',
        l.noCollection ? `"${l.reason}"` : ""
      ];
    });

    const calculateStats = (data) => {
      const cov = data.reduce((s,l) => s + Number(l.hhCovered || 0), 0);
      const giv = data.reduce((s,l) => s + (l.noCollection ? 0 : Number(l.hhGiving || 0)), 0);
      const seg = data.reduce((s,l) => s + (l.noCollection ? 0 : Number(l.hhSegregating || 0)), 0);
      return {
        givPct: cov > 0 ? ((giv/cov)*100).toFixed(2) : "0.00",
        segPct: giv > 0 ? ((seg/giv)*100).toFixed(2) : "0.00"
      };
    };

    const getPeriodKey = (dateStr, type) => {
      const d = new Date(dateStr);
      if (type === 'W') return `Week Starting ${new Date(d.setDate(d.getDate() - d.getDay())).toISOString().split('T')[0]}`;
      if (type === 'M') return `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
      if (type === 'Q') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      if (type === 'Y') return `${d.getFullYear()}`;
    };

    const aggregate = (type) => {
      const periods = {};
      exportLogs.forEach(l => {
        const pk = getPeriodKey(l.date, type);
        if (!periods[pk]) periods[pk] = [];
        periods[pk].push(l);
      });
      return Object.entries(periods).map(([name, data]) => {
        const s = calculateStats(data);
        return [name, s.givPct, s.segPct];
      });
    };

    const summaryHeader = ["Summary Period", "Avg Giving (%)", "Avg Segregation (%)"];
    const summaries = [
      ...aggregate('W').map(r => ["Weekly Average", ...r]),
      ...aggregate('M').map(r => ["Monthly Average", ...r]),
      ...aggregate('Q').map(r => ["Quarterly Average", ...r]),
      ...aggregate('Y').map(r => ["Yearly Average", ...r])
    ];

    const csvContent = [headers, ...logRows, [], ["PERIODICAL AGGREGATES"], summaryHeader, ...summaries].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SWM_Report.csv`;
    link.click();
    showStatus('success', 'CSV Exported.');
  };

  // --- Views ---
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40}/>
      <p className="font-bold text-slate-500 tracking-tight uppercase text-[10px]">Initializing Saahas SWM...</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl space-y-8 animate-in fade-in">
        <div className="bg-blue-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-blue-600"><Globe size={40} /></div>
        <div className="text-center">
          <h1 className="text-3xl font-black text-slate-800">Saahas SWM</h1>
          <p className="text-slate-500 mt-2 font-medium tracking-tight">Organization Portal</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Email ID</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="email" placeholder="name@saahas.org" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition" value={emailInput} onChange={e => setEmailInput(e.target.value)}/>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="password" placeholder="min 6 chars" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition" value={passInput} onChange={e => setPassInput(e.target.value)}/>
            </div>
          </div>
          <button type="submit" disabled={authLoading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-blue-700 transition shadow-xl shadow-blue-100 active:scale-[0.98]">
            {authLoading ? <Loader2 className="animate-spin" size={20} /> : (authMode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />)}
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="text-center">
          <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-sm font-bold text-blue-600 hover:underline transition">
            {authMode === 'login' ? "New user? Register" : "Have an account? Log in"}
          </button>
        </div>
        
        {emailInput.toLowerCase() === 'sajith.tm@saahas.org' && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3">
                <Info className="text-amber-500 shrink-0" size={20}/>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-relaxed text-left">
                    Admin Bypass Active. Login/Registration will grant full access immediately.
                </p>
            </div>
        )}
      </div>
    </div>
  );

  if (roleLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40}/>
      <p className="font-bold text-slate-500 text-center tracking-tight uppercase text-[10px]">Permission Check.<br/>Verifying access for {user.email}...</p>
    </div>
  );

  if (userRole === 'unauthorized') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl text-center space-y-6">
        <AlertCircle size={64} className="text-red-500 mx-auto" />
        <h1 className="text-2xl font-black text-slate-800">Access Restricted</h1>
        <p className="text-slate-500 font-medium">Authentication complete, but your account is not whitelisted. Please contact <b>sajith.tm@saahas.org</b> for authorization.</p>
        <button onClick={handleLogout} className="text-blue-600 font-bold hover:underline flex items-center gap-2 mx-auto"><LogOut size={16}/> Logout & Change ID</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 md:pb-0 flex flex-col md:flex-row">
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 md:sticky md:top-0 md:flex-col md:w-64 md:h-screen md:justify-start md:gap-2 md:p-6 shadow-sm">
        <div className="hidden md:flex p-2 font-black text-2xl text-blue-600 mb-8 items-center gap-3"><Globe size={32} /> <span>Saahas SWM</span></div>
        {(userRole === 'manager' || userRole === 'coordinator') && (
          <>
            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'dashboard' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={20} /><span className="text-[10px] md:text-base">Analytics</span></button>
            <button onClick={() => setActiveTab('review')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'review' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><TableIcon size={20} /><span className="text-[10px] md:text-base">Review</span></button>
          </>
        )}
        <button onClick={() => setActiveTab('entry')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'entry' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={20} /><span className="text-[10px] md:text-base tracking-tight">Entry</span></button>
        {userRole === 'manager' && (
          <button onClick={() => setActiveTab('setup')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'setup' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Settings size={20} /><span className="text-[10px] md:text-base">Setup</span></button>
        )}
        <div className="mt-auto hidden md:block pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{user.email[0].toUpperCase()}</div>
            <div className="flex flex-col"><span className="text-xs font-black text-slate-700 truncate max-w-[120px]">{user.email.split('@')[0]}</span><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{userRole}</span></div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition"><LogOut size={18} /> Logout</button>
        </div>
      </nav>

      <main className="flex-1 pt-6 px-4 md:pt-10 md:px-10 max-w-7xl overflow-x-hidden">
        {/* DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div><h1 className="text-3xl font-bold tracking-tight text-slate-800">Operational Dashboard</h1><p className="text-slate-500 font-medium tracking-tight">Real-time India SWM performance tracking</p></div>
              <div className="bg-white p-4 rounded-[28px] border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-2">
                  <input type="date" className="bg-slate-50 border-none rounded-lg p-1.5 text-[11px] font-bold outline-none" value={exportStart} onChange={e => setExportStart(e.target.value)} />
                  <ArrowRight size={14} className="text-slate-300" />
                  <input type="date" className="bg-slate-50 border-none rounded-lg p-1.5 text-[11px] font-bold outline-none" value={exportEnd} onChange={e => setExportEnd(e.target.value)} />
                </div>
                <button onClick={handleExportCSV} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-black shadow-lg hover:bg-blue-700 transition active:scale-95"><FileSpreadsheet size={18}/> Report Export</button>
              </div>
            </header>

            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Ward Mapping</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none font-semibold" value={dashWard} onChange={(e) => {setDashWard(e.target.value); setDashBlocks([]);}}>
                    <option value="all">All Wards</option>
                    {config.wards?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex justify-between tracking-widest"><span>Unit Segregation</span> {dashBlocks.length > 0 && <button onClick={() => setDashBlocks([])} className="text-blue-500 text-[9px] hover:underline">Clear</button>}</label>
                  <div className="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1">
                    {config.blocks?.filter(b => dashWard === 'all' || b.wardId === dashWard).map(block => (
                      <button key={block.id} onClick={() => toggleBlockFilter(block.id)} className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${dashBlocks.includes(block.id) ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-200 text-slate-600'}`}>
                        {dashBlocks.includes(block.id) ? <CheckSquare size={14}/> : <Square size={14}/>} <span className="truncate">{block.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Scale</label>
                  <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 gap-1">
                    {['daily', 'weekly', 'monthly'].map(t => (<button key={t} onClick={() => setViewTimeframe(t)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black capitalize transition ${viewTimeframe === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>))}
                  </div>
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <input type="date" className="flex-1 bg-blue-50 border border-blue-100 rounded-xl p-2 text-[10px] outline-none font-bold text-blue-700" value={dashStartDate} onChange={(e) => setDashStartDate(e.target.value)} />
                  <input type="date" className="flex-1 bg-blue-50 border border-blue-100 rounded-xl p-2 text-[10px] outline-none font-bold text-blue-700" value={dashEndDate} onChange={(e) => setDashEndDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Stats Cards (Same as before) */}
            </div>

            {/* Graphs (Same as before) */}
          </div>
        )}

        {/* REVIEW VIEW */}
        {activeTab === 'review' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-6">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div><h1 className="text-3xl font-black text-slate-800 tracking-tight">Raw Data Audit</h1><p className="text-slate-500 font-medium">Daily operational review</p></div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm"><input type="date" className="bg-transparent border-none p-1 font-bold text-xs" value={reviewStart} onChange={e => setReviewStart(e.target.value)} /><ArrowRight size={14} className="text-slate-300" /><input type="date" className="bg-transparent border-none p-1 font-bold text-xs" value={reviewEnd} onChange={e => setReviewEnd(e.target.value)} /></div>
            </header>
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden mb-12">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-8 py-5 text-center">Date</th><th className="px-6 py-5">Block</th><th className="px-6 py-5">Status</th><th className="px-6 py-5 text-center">Covered</th><th className="px-6 py-5 text-center">Waste Given</th><th className="px-6 py-5 text-center">Waste Segregated</th><th className="px-6 py-5 text-center">Given Percentage</th><th className="px-6 py-5 text-center">Segregated Percentage</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reviewTableData.map((l, i) => {
                      const givPct = l.hhCovered > 0 ? ((Number(l.hhGiving)/Number(l.hhCovered))*100).toFixed(1) : "0.0";
                      const segPct = l.hhGiving > 0 ? ((Number(l.hhSegregating)/Number(l.hhGiving))*100).toFixed(1) : "0.0";
                      return (
                        <tr key={i} className="hover:bg-blue-50/20 transition">
                          <td className="px-8 py-5 font-bold text-slate-600 text-xs text-center">{l.date}</td>
                          <td className="px-6 py-5"><div className="font-black text-slate-700">{l.blockName}</div><div className="text-[10px] text-slate-400 font-bold lowercase tracking-tighter leading-none">{l.supervisorName}</div></td>
                          <td className="px-6 py-5">{l.noCollection ? <span className="px-2 py-1 bg-red-100 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest">Gap</span> : <span className="px-2 py-1 bg-green-100 text-green-600 rounded-lg text-[9px] font-black uppercase tracking-widest">Active</span>}</td>
                          <td className="px-6 py-5 font-black text-slate-700 text-center">{l.hhCovered}</td>
                          <td className="px-6 py-5 font-black text-blue-600 text-center">{l.noCollection ? 0 : l.hhGiving}</td>
                          <td className="px-6 py-5 font-black text-purple-600 text-center">{l.noCollection ? 0 : l.hhSegregating}</td>
                          <td className="px-6 py-5 font-black text-slate-700 text-center">{l.noCollection ? '-' : `${givPct}%`}</td>
                          <td className="px-6 py-5 font-black text-slate-700 text-center">{l.noCollection ? '-' : `${segPct}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ENTRY & SETUP TABS (Standard) */}
        {activeTab === 'entry' && (
           <div className="max-w-xl mx-auto py-6 animate-in slide-in-from-bottom-6">
              {/* Entry form implementation */}
           </div>
        )}
        {activeTab === 'setup' && (
           <div className="max-w-4xl mx-auto py-6 space-y-8 animate-in slide-in-from-bottom-6">
              {/* Setup UI implementation */}
           </div>
        )}
      </main>
    </div>
  );
};

// AUTO-RENDER FOR DEPLOYMENT
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}

export default App;
