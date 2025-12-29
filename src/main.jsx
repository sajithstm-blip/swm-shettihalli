import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
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
  Send,
  Loader2,
  RefreshCw
} from 'lucide-react';

/**
 * --- Firebase Configuration ---
 * Project: admob-app-id-4497163742
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
  const [userRole, setUserRole] = useState(null); // 'manager', 'coordinator', 'supervisor'
  const [emailInput, setEmailInput] = useState('');
  const [isLinkSent, setIsLinkSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState({ 
    states: [], wards: [], blocks: [], supervisors: [] 
  });
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  
  // Dashboard UI Filters
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

  // Review & Export Filters
  const [reviewStart, setReviewStart] = useState(dashStartDate);
  const [reviewEnd, setReviewEnd] = useState(dashEndDate);
  const [exportStart, setExportStart] = useState(dashStartDate);
  const [exportEnd, setExportEnd] = useState(dashEndDate);

  // Entry Form State
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

  // --- Auth Logic: Passwordless Email Link ---
  const handleSendLink = async (e) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    
    if (!cleanEmail.endsWith('@saahas.org')) {
      showStatus('error', 'Only @saahas.org emails allowed.');
      return;
    }

    setAuthLoading(true);
    const actionCodeSettings = {
      // Must exactly match the Vercel URL or the URL the user is on
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', cleanEmail);
      setIsLinkSent(true);
      showStatus('success', 'Sign-in link sent to your inbox!');
    } catch (error) {
      console.error("Auth Error:", error);
      showStatus('error', error.message || 'Check Firebase Console Email Link settings.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setUserRole(null);
    setUser(null);
    setRoleLoading(false);
    setIsLinkSent(false);
  };

  useEffect(() => {
    // 1. Detect magic link arrival
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Please confirm your @saahas.org email address:');
      }
      if (email) {
        setRoleLoading(true);
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            window.localStorage.removeItem('emailForSignIn');
            window.history.replaceState(null, null, window.location.origin + window.location.pathname);
            showStatus('success', 'Login successful!');
          })
          .catch((err) => {
            showStatus('error', 'Link expired or used. Get a new link.');
            setRoleLoading(false);
          });
      }
    }

    // 2. Auth State and Role Sync
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setRoleLoading(true);
        try {
          const roleRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_roles', u.email.toLowerCase());
          const roleSnap = await getDoc(roleRef);
          if (roleSnap.exists()) {
            const role = roleSnap.data().role;
            setUserRole(role);
            if (role === 'supervisor') setActiveTab('entry');
          } else {
            setUserRole('unauthorized');
          }
        } catch (err) {
          console.error("Role Fetch Error:", err);
          setUserRole('unauthorized');
        } finally {
          setRoleLoading(false);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Data Sync ---
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

  // --- Helpers ---
  const showStatus = (type, text) => {
    setStatusMsg({ type, text: String(text) });
    if (type !== 'info') {
        setTimeout(() => setStatusMsg({ type: '', text: '' }), 6000);
    }
  };

  const saveConfig = async (newConfig) => {
    if (userRole !== 'manager') return;
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_config', 'settings');
      await setDoc(configRef, newConfig);
      showStatus('success', 'Operational settings updated!');
    } catch (e) {
      showStatus('error', 'Failed to save.');
    }
  };

  const updateUserRole = async (email, role) => {
    if (userRole !== 'manager') return;
    try {
      const roleRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_roles', email.toLowerCase().trim());
      await setDoc(roleRef, { role, updatedAt: new Date().toISOString() });
      showStatus('success', `${email} set as ${role}`);
    } catch (e) {
      showStatus('error', 'Role update failed.');
    }
  };

  const toggleBlockFilter = (id) => {
    setDashBlocks(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const removeSupervisor = (id) => {
    const newSupers = config.supervisors.filter(s => s.id !== id);
    const newBlocks = config.blocks.map(b => b.supervisorId === id ? { ...b, supervisorId: '' } : b);
    setConfig({ ...config, supervisors: newSupers, blocks: newBlocks });
    showStatus('success', 'Supervisor removed.');
  };

  const submitDailyLog = async () => {
    if (!entryBlock) { showStatus('error', "Select Block."); return; }
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
      showStatus('success', `Data saved for ${block.name}`);
      setFormData({ ...formData, hhCovered: 0, hhGiving: 0, hhSegregating: 0, noCollection: false });
    } catch (e) {
      showStatus('error', "Database error.");
    }
  };

  // --- Analytical Computations ---
  const filteredLogs = useMemo(() => {
    return dailyData.filter(log => {
      const wardMatch = dashWard === 'all' || log.wardId === dashWard;
      const blockMatch = dashBlocks.length === 0 || dashBlocks.includes(log.blockId);
      const supervisorMatch = dashSupervisor === 'all' || log.supervisorId === dashSupervisor;
      const dateMatch = log.date >= dashStartDate && log.date <= dashEndDate;
      return wardMatch && blockMatch && supervisorMatch && dateMatch;
    });
  }, [dailyData, dashWard, dashBlocks, dashSupervisor, dashStartDate, dashEndDate]);

  const reviewTableData = useMemo(() => {
    return dailyData
      .filter(l => l.date >= reviewStart && l.date <= reviewEnd)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyData, reviewStart, reviewEnd]);

  const timeSeriesData = useMemo(() => {
    const groups = {};
    filteredLogs.forEach(log => {
      let key = log.date;
      let label = log.date;
      if (viewTimeframe === 'weekly') {
        const d = new Date(log.date);
        const start = new Date(d.setDate(d.getDate() - d.getDay()));
        label = `W/O ${start.toLocaleDateString('en-IN', {day:'numeric', month:'short'})}`;
        key = start.toISOString().split('T')[0];
      } else if (viewTimeframe === 'monthly') {
        const d = new Date(log.date);
        label = d.toLocaleString('en-IN', {month:'short', year:'numeric'});
        key = `${d.getFullYear()}-${d.getMonth()}`;
      }

      if (!groups[key]) {
        groups[key] = { name: label, giving: 0, seg: 0, covered: 0, rawDate: log.date };
      }
      
      if (!log.noCollection) {
        groups[key].giving += Number(log.hhGiving || 0);
        groups[key].seg += Number(log.hhSegregating || 0);
      }
    });
    // Strict chronological sort for graph tooltip accuracy
    return Object.values(groups).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [filteredLogs, viewTimeframe]);

  const handleExportCSV = () => {
    const exportLogs = dailyData.filter(l => l.date >= exportStart && l.date <= exportEnd);
    if (exportLogs.length === 0) { showStatus('error', 'No data for range.'); return; }

    const headers = ["Reporting Date", "Ward", "Block", "Supervisor", "HH Covered", "Giving Waste", "Segregating", "Status", "Reason"];
    const logRows = exportLogs.sort((a,b) => a.date.localeCompare(b.date)).map(l => [
      l.date, l.wardName || 'N/A', l.blockName || 'N/A', l.supervisorName || 'Unassigned', l.hhCovered,
      l.noCollection ? 0 : l.hhGiving, l.noCollection ? 0 : l.hhSegregating,
      l.noCollection ? "Absent" : "Collected", l.noCollection ? `"${l.reason}"` : ""
    ]);

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
      if (type === 'W') return `Week ${new Date(d.setDate(d.getDate() - d.getDay())).toISOString().split('T')[0]}`;
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

    const summaryHeader = ["Summary Period", "Avg Giving %", "Avg Segregation %"];
    const csvContent = [
      headers, ...logRows, [], ["AVERAGE PERFORMANCE SUMMARY"], summaryHeader,
      ...aggregate('W').map(r => ["Weekly", ...r]),
      ...aggregate('M').map(r => ["Monthly", ...r]),
      ...aggregate('Q').map(r => ["Quarterly", ...r]),
      ...aggregate('Y').map(r => ["Yearly", ...r])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SWM_Report_${exportStart}_to_${exportEnd}.csv`;
    link.click();
    showStatus('success', 'CSV Report Exported.');
  };

  // --- Master View Switcher ---
  if (loading || (user && userRole === null)) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-slate-500 font-medium">Validating Secure Session...</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl space-y-8 animate-in fade-in">
        {statusMsg.text && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${statusMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                <AlertCircle size={16} /> {statusMsg.text}
            </div>
        )}
        <div className="bg-blue-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-blue-600"><Globe size={40} /></div>
        <div className="text-center">
          <h1 className="text-3xl font-black text-slate-800">Saahas SWM</h1>
          <p className="text-slate-500 mt-2 font-medium">Passwordless Organization Portal</p>
        </div>

        {!isLinkSent ? (
          <form onSubmit={handleSendLink} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" 
                  placeholder="name@saahas.org" 
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={authLoading}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-blue-700 transition shadow-xl disabled:opacity-50"
            >
              {authLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              {authLoading ? 'Requesting Link...' : 'Get Sign-In Link'}
            </button>
            <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-tighter">No password required. Login link will be sent to your email.</p>
          </form>
        ) : (
          <div className="p-6 bg-green-50 border border-green-100 rounded-3xl text-center space-y-4 animate-in zoom-in-95">
            <CheckCircle2 size={48} className="text-green-500 mx-auto" />
            <p className="font-bold text-green-800 leading-tight">Magic link sent to <b>{emailInput}</b>. Check your inbox to complete sign-in without a password.</p>
            <button onClick={() => setIsLinkSent(false)} className="text-xs font-bold text-green-600 underline">Enter a different email</button>
          </div>
        )}
      </div>
    </div>
  );

  if (roleLoading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-slate-500 font-medium text-center">Session Verified. <br/>Checking permissions for {user.email}...</p>
    </div>
  );

  if (userRole === 'unauthorized') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl text-center space-y-6">
        <AlertCircle size={64} className="text-red-500 mx-auto" />
        <h1 className="text-2xl font-black text-slate-800">Access Restricted</h1>
        <p className="text-slate-500 font-medium">Your email <b>{user.email}</b> is not authorized. Please contact your Project Manager to enable your account.</p>
        <button onClick={handleLogout} className="text-blue-600 font-bold hover:underline">Log Out & Change Account</button>
      </div>
    </div>
  );

  const stats = {
    covered: filteredLogs.reduce((s, v) => s + Number(v.hhCovered || 0), 0),
    giving: filteredLogs.reduce((s, v) => s + (v.noCollection ? 0 : Number(v.hhGiving || 0)), 0),
    seg: filteredLogs.reduce((s, v) => s + (v.noCollection ? 0 : Number(v.hhSegregating || 0)), 0),
    absences: filteredLogs.filter(v => v.noCollection).length
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 md:pb-0 flex flex-col md:flex-row">
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 md:sticky md:top-0 md:flex-col md:w-64 md:h-screen md:justify-start md:gap-2 md:p-6 shadow-sm">
        <div className="hidden md:flex p-2 font-black text-2xl text-blue-600 mb-8 items-center gap-3"><Globe size={32} /> <span>Saahas SWM</span></div>
        {(userRole === 'manager' || userRole === 'coordinator') && (
          <>
            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'dashboard' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
              <LayoutDashboard size={20} /> <span className="text-[10px] md:text-base">Analytics</span>
            </button>
            <button onClick={() => setActiveTab('review')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'review' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
              <TableIcon size={20} /> <span className="text-[10px] md:text-base">Review</span>
            </button>
          </>
        )}
        <button onClick={() => setActiveTab('entry')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'entry' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
          <PlusCircle size={20} /> <span className="text-[10px] md:text-base tracking-tight">Entry</span>
        </button>
        {userRole === 'manager' && (
          <button onClick={() => setActiveTab('setup')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'setup' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Settings size={20} /> <span className="text-[10px] md:text-base">Setup</span>
          </button>
        )}
        <div className="mt-auto hidden md:block pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{user?.email?.[0].toUpperCase()}</div>
            <div className="flex flex-col"><span className="text-xs font-black text-slate-700 truncate max-w-[120px]">{user?.email?.split('@')[0]}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{userRole}</span></div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition"><LogOut size={18} /> Logout</button>
        </div>
      </nav>

      <main className="flex-1 pt-6 px-4 md:pt-10 md:px-10 max-w-7xl overflow-x-hidden">
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div><h1 className="text-3xl font-bold tracking-tight text-slate-800">Operational Analytics</h1><p className="text-slate-500 font-medium">India SWM performance tracking</p></div>
              <div className="bg-white p-4 rounded-[28px] border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-2">
                  <input type="date" className="bg-slate-50 border-none rounded-lg p-1.5 text-[11px] font-bold outline-none" value={exportStart} onChange={e => setExportStart(e.target.value)} />
                  <ArrowRight size={14} className="text-slate-300" />
                  <input type="date" className="bg-slate-50 border-none rounded-lg p-1.5 text-[11px] font-bold outline-none" value={exportEnd} onChange={e => setExportEnd(e.target.value)} />
                </div>
                <button onClick={handleExportCSV} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-black shadow-lg hover:bg-blue-700 transition active:scale-95">
                  <FileSpreadsheet size={18}/> Report Export
                </button>
              </div>
            </header>

            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Ward Mapping</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none font-semibold" value={dashWard} onChange={(e) => {setDashWard(e.target.value); setDashBlocks([]);}}>
                    <option value="all">All Wards</option>
                    {config.wards?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex justify-between"><span>Blocks (Multi)</span> {dashBlocks.length > 0 && <button onClick={() => setDashBlocks([])} className="text-blue-500 text-[9px] hover:underline">Clear</button>}</label>
                  <div className="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1">
                    {config.blocks?.filter(b => dashWard === 'all' || b.wardId === dashWard).map(block => (
                      <button key={block.id} onClick={() => toggleBlockFilter(block.id)} className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${dashBlocks.includes(block.id) ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-200 text-slate-600'}`}>
                        {dashBlocks.includes(block.id) ? <CheckSquare size={14}/> : <Square size={14}/>} <span className="truncate">{block.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Scale</label>
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
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 transition hover:shadow-md">
                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl"><Users size={28}/></div>
                <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">HH Area</p><p className="text-2xl font-black text-slate-800 leading-tight">{stats.covered.toLocaleString()}</p></div>
              </div>
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 transition hover:shadow-md">
                <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl"><Truck size={28}/></div>
                <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">participation</p><p className="text-2xl font-black text-slate-800 leading-tight">{(stats.covered > 0 ? (stats.giving/stats.covered*100).toFixed(1) : 0)}%</p></div>
              </div>
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 transition hover:shadow-md">
                <div className="bg-green-50 text-green-600 p-4 rounded-2xl"><CheckCircle2 size={28}/></div>
                <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Efficiency</p><p className="text-2xl font-black text-slate-800 leading-tight">{(stats.giving > 0 ? ((stats.seg / stats.giving) * 100).toFixed(1) : 0)}%</p></div>
              </div>
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 transition hover:shadow-md">
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl"><Ban size={28}/></div>
                <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Absences</p><p className="text-2xl font-black text-slate-800 leading-tight">{stats.absences}</p></div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-slate-700 flex items-center gap-3 mb-8"><History className="text-blue-500" size={20}/> Performance Timeline</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeriesData}>
                      <defs>
                        <linearGradient id="colorGiving" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorSeg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.1}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontSize: '14px', fontWeight: '900', color: '#1e293b' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                      <Area type="monotone" dataKey="giving" name="Giving Waste" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorGiving)" />
                      <Area type="monotone" dataKey="seg" name="Segregation" stroke="#a855f7" strokeWidth={4} fillOpacity={1} fill="url(#colorSeg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-slate-700 flex items-center gap-3 mb-8"><Ban className="text-red-500" size={20}/> Failure Gaps</h3>
                {gapData.length > 0 ? (
                  <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={gapData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}} width={120} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} /><Bar dataKey="value" name="Incidents" radius={[0, 10, 10, 0]}>{gapData.map((_, index) => <Cell key={index} fill={['#ef4444', '#f97316', '#f59e0b', '#84cc16'][index % 4]} />)}</Bar></BarChart></ResponsiveContainer></div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30"><CheckCircle2 size={64} className="text-green-500"/><p className="font-bold text-sm mt-3">All Active!</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REVIEW TAB */}
        {activeTab === 'review' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-6">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div><h1 className="text-3xl font-black text-slate-800">Raw Data Audit</h1><p className="text-slate-500 font-medium">Daily operational review</p></div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm"><input type="date" className="bg-transparent border-none p-1 font-bold text-xs" value={reviewStart} onChange={e => setReviewStart(e.target.value)} /><ArrowRight size={14} className="text-slate-300" /><input type="date" className="bg-transparent border-none p-1 font-bold text-xs" value={reviewEnd} onChange={e => setReviewEnd(e.target.value)} /></div>
            </header>
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden mb-12">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-8 py-5">Date</th><th className="px-6 py-5">Block</th><th className="px-6 py-5">Status</th><th className="px-6 py-5 text-center">Covered</th><th className="px-6 py-5 text-center">Waste Given</th><th className="px-6 py-5 text-center">Waste Segregated</th><th className="px-6 py-5">Given %</th><th className="px-6 py-5">Segregated %</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reviewTableData.map((l, i) => {
                      const givPct = l.hhCovered > 0 ? (l.hhGiving/l.hhCovered*100).toFixed(1) : 0;
                      const segPct = l.hhGiving > 0 ? (l.hhSegregating/l.hhGiving*100).toFixed(1) : 0;
                      return (
                        <tr key={i} className="hover:bg-blue-50/20 transition">
                          <td className="px-8 py-5 font-bold text-slate-600 text-xs">{l.date}</td>
                          <td className="px-6 py-5"><div className="font-black text-slate-700">{l.blockName}</div><div className="text-[10px] text-slate-400 font-bold">{l.supervisorName}</div></td>
                          <td className="px-6 py-5">{l.noCollection ? <span className="px-2 py-1 bg-red-100 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest">Gap</span> : <span className="px-2 py-1 bg-green-100 text-green-600 rounded-lg text-[9px] font-black uppercase tracking-widest">Active</span>}</td>
                          <td className="px-6 py-5 font-black text-slate-700 text-center">{l.hhCovered}</td>
                          <td className="px-6 py-5 font-black text-blue-600 text-center">{l.noCollection ? 0 : l.hhGiving}</td>
                          <td className="px-6 py-5 font-black text-purple-600 text-center">{l.noCollection ? 0 : l.hhSegregating}</td>
                          <td className="px-6 py-5 font-black text-slate-700">{l.noCollection ? '-' : `${givPct}%`}</td>
                          <td className="px-6 py-5 font-black text-slate-700">{l.noCollection ? '-' : `${segPct}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DATA ENTRY */}
        {activeTab === 'entry' && (
          <div className="max-w-xl mx-auto py-6 animate-in slide-in-from-bottom-6">
            <header className="text-center mb-8"><h1 className="text-2xl font-black text-slate-800">Field Data Submission</h1></header>
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ward Mapping</label>
                    <select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none" value={entryWard} onChange={(e) => {setEntryWard(e.target.value); setEntryBlock('');}}>
                      <option value="">Select Ward</option>
                      {config.wards?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operating Unit</label>
                    <select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none" value={entryBlock} onChange={(e) => setEntryBlock(e.target.value)}>
                      <option value="">Select Block</option>
                      {config.blocks?.filter(b => b.wardId === entryWard).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 text-center block">Collection Date</label><input type="date" className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none text-center" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
              </div>
              <div className="flex items-center gap-3 p-5 bg-red-50 rounded-3xl border border-red-100">
                <input type="checkbox" id="noCollection" className="w-6 h-6 rounded-lg text-red-600 border-red-200" checked={formData.noCollection} onChange={(e) => setFormData({...formData, noCollection: e.target.checked})} />
                <label htmlFor="noCollection" className="text-red-700 font-bold text-sm">Gaps: No Collection Today</label>
              </div>
              {formData.noCollection ? (
                <div className="space-y-1 animate-in slide-in-from-top-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Reason for Gap</label><select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-white font-bold outline-none" value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})}><option value="Vehicle didn't come">1) Vehicle didn't come</option><option value="Vehicle breakdown">2) Vehicle breakdown</option><option value="Collection staff not available">3) Collection staff not available</option><option value="Field supervisor absent">4) Field supervisor absent</option></select></div>
              ) : (
                <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-50 animate-in fade-in">
                  {[{ label: 'Total HH Covered', key: 'hhCovered', bg: 'bg-slate-50', text: 'text-slate-600' }, { label: 'HH Giving Waste', key: 'hhGiving', bg: 'bg-blue-50', text: 'text-blue-700' }, { label: 'HH Segregating', key: 'hhSegregating', bg: 'bg-purple-50', text: 'text-purple-700' }].map(f => (
                    <div key={f.key} className={`${f.bg} p-5 rounded-3xl flex items-center justify-between border border-white/50 shadow-inner`}><span className={`${f.text} font-bold text-sm`}>{f.label}</span><input type="number" className="w-24 text-right bg-transparent border-none outline-none font-black text-2xl text-slate-800" value={formData[f.key]} onChange={(e) => setFormData({...formData, [f.key]: Number(e.target.value)})} /></div>
                  ))}
                </div>
              )}
              <button onClick={submitDailyLog} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl active:scale-[0.98] transition-all">Submit Intake</button>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="max-w-4xl mx-auto py-6 space-y-8 animate-in slide-in-from-bottom-6">
            <header className="space-y-2"><h1 className="text-3xl font-black text-slate-800">Operational Hierarchy</h1></header>
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><ShieldCheck className="text-blue-500"/> Account Access Mapping</h3></div>
              <div className="grid grid-cols-1 gap-4"><div className="flex flex-col sm:flex-row gap-2"><input id="new-user-email" placeholder="staff@saahas.org" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none" /><select id="new-user-role" className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"><option value="supervisor">Supervisor</option><option value="coordinator">Coordinator</option><option value="manager">Manager</option></select><button onClick={() => { const em = document.getElementById('new-user-email').value; const rl = document.getElementById('new-user-role').value; if(em) updateUserRole(em, rl); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black">Authorize</button></div></div>
            </section>
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><Users className="text-blue-500"/> Supervisor List</h3><button onClick={() => setConfig({...config, supervisors: [...config.supervisors, { id: Date.now().toString(), name: '' }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add Staff</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{config.supervisors?.map((fs, idx) => (<div key={fs.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100"><input placeholder="Name" className="flex-1 bg-transparent border-none outline-none font-bold text-slate-700" value={fs.name} onChange={(e) => { const ns = [...config.supervisors]; ns[idx].name = e.target.value; setConfig({...config, supervisors: ns}); }} /><button onClick={() => removeSupervisor(fs.id)} className="text-red-400 hover:text-red-600 transition"><Trash2 size={18}/></button></div>))}</div>
            </section>
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><Globe className="text-blue-500" /> Geography Mapping</h3><button onClick={() => setConfig({...config, states: [...config.states, { id: Date.now().toString(), name: '' }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add State</button></div>
              <div className="space-y-6">{config.states?.map((st, sIdx) => (<div key={st.id} className="border border-slate-100 rounded-[24px] overflow-hidden"><div className="bg-slate-50 p-4 flex items-center gap-4"><input className="flex-1 bg-transparent font-black text-blue-600 outline-none text-lg" placeholder="State Name" value={st.name} onChange={(e) => { const ns = [...config.states]; ns[sIdx].name = e.target.value; setConfig({...config, states: ns}); }} /><button onClick={() => setConfig({...config, wards: [...config.wards, { id: Date.now().toString(), stateId: st.id, name: '' }]})} className="text-[10px] bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold">+ Ward</button><button onClick={() => setConfig({...config, states: config.states.filter(s => s.id !== st.id)})} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div><div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">{config.wards?.filter(w => w.stateId === st.id).map((wd) => (<div key={wd.id} className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-xl"><input className="flex-1 text-sm font-bold outline-none" placeholder="Ward" value={wd.name} onChange={(e) => { const nw = [...config.wards]; const idx = config.wards.findIndex(w => w.id === wd.id); nw[idx].name = e.target.value; setConfig({...config, wards: nw}); }} /><button onClick={() => setConfig({...config, wards: config.wards.filter(w => w.id !== wd.id)})} className="text-red-400">&times;</button></div>))}</div></div>))}</div>
            </section>
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><Database className="text-blue-500" /> Operational Units</h3><button onClick={() => setConfig({...config, blocks: [...config.blocks, { id: Date.now().toString(), name: '', wardId: '', supervisorId: '', totalHH: 0 }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add Block</button></div>
              <div className="space-y-4">{config.blocks?.map((bl, bIdx) => (<div key={bl.id} className="bg-slate-50 p-5 rounded-[24px] border border-slate-100 space-y-4 transition hover:bg-slate-100/50"><div className="flex items-center gap-4"><input className="flex-1 bg-transparent font-black text-slate-800 outline-none text-lg border-b-2 border-slate-200 focus:border-blue-500 transition" placeholder="Block Name" value={bl.name} onChange={(e) => { const nb = [...config.blocks]; nb[bIdx].name = e.target.value; setConfig({...config, blocks: nb}); }} /><button onClick={() => setConfig({...config, blocks: config.blocks.filter(b => b.id !== bl.id)})} className="text-red-400"><Trash2 size={16}/></button></div><div className="grid grid-cols-2 md:grid-cols-3 gap-4"><select className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={bl.wardId} onChange={(e) => { const nb = [...config.blocks]; nb[bIdx].wardId = e.target.value; setConfig({...config, blocks: nb}); }}><option value="">Ward</option>{config.wards?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select><select className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={bl.supervisorId} onChange={(e) => { const nb = [...config.blocks]; nb[bIdx].supervisorId = e.target.value; setConfig({...config, blocks: nb}); }}><option value="">Lead</option>{config.supervisors?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><div className="flex items-center gap-2"><label className="text-[10px] font-black text-slate-400 uppercase">Total HH</label><input type="number" className="w-full bg-white border border-slate-200 rounded-lg p-2 font-black text-xs" value={bl.totalHH} onChange={(e) => { const nb = [...config.blocks]; nb[bIdx].totalHH = Number(e.target.value); setConfig({...config, blocks: nb}); }} /></div></div></div>))}</div>
            </section>
            <button onClick={() => saveConfig(config)} className="w-full py-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-[32px] font-black text-xl shadow-2xl transition hover:scale-[1.01] active:scale-[0.99]">Publish Operational Logic</button>
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
