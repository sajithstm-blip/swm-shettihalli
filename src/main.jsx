import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query 
} from 'firebase/firestore';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell
} from 'recharts';
import { 
  LayoutDashboard, 
  Database, 
  Settings, 
  PlusCircle, 
  Save, 
  History,
  TrendingUp,
  Users,
  Download,
  AlertCircle,
  CheckCircle2,
  Filter,
  Calendar,
  UserCheck,
  MapPin,
  Globe,
  Trash2,
  ChevronRight,
  Upload,
  FileText,
  Search,
  ArrowRight,
  BarChart3,
  Ban,
  CheckSquare,
  Square,
  Activity,
  Truck,
  FileSpreadsheet
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
      databaseURL: "https://admob-app-id-4497163742.firebaseio.com",
      projectId: "admob-app-id-4497163742",
      storageBucket: "admob-app-id-4497163742.firebasestorage.app",
      messagingSenderId: "944948366460",
      appId: "1:944948366460:web:da3388aeb8af102302cdf9"
    };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'swm-national-v1'; 

const formatDate = (date) => date.toISOString().split('T')[0];

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState({ 
    states: [], 
    wards: [], 
    blocks: [], 
    supervisors: [] 
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

  // Dedicated Export Range
  const [exportStart, setExportStart] = useState(dashStartDate);
  const [exportEnd, setExportEnd] = useState(dashEndDate);

  // Entry Form State
  const [entryState, setEntryState] = useState('');
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

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isCanvas && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Sync with Firestore
  useEffect(() => {
    if (!user) return;

    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_config', 'settings');
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig({
          states: Array.isArray(data.states) ? data.states : [],
          wards: Array.isArray(data.wards) ? data.wards : [],
          blocks: Array.isArray(data.blocks) ? data.blocks : [],
          supervisors: Array.isArray(data.supervisors) ? data.supervisors : []
        });
      }
      setLoading(false);
    }, (err) => {
      console.error("Config Error:", err);
      setLoading(false);
    });

    const dataRef = collection(db, 'artifacts', appId, 'public', 'data', 'daily_logs');
    const unsubData = onSnapshot(query(dataRef), (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDailyData(logs);
    }, (err) => {
      console.error("Data Error:", err);
    });

    return () => { unsubConfig(); unsubData(); };
  }, [user]);

  const showStatus = (type, text) => {
    setStatusMsg({ type, text: String(text) });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
  };

  const saveConfig = async (newConfig) => {
    if (!user) return;
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_config', 'settings');
      await setDoc(configRef, newConfig);
      showStatus('success', 'Project configuration published!');
    } catch (e) {
      showStatus('error', 'Failed to save configuration.');
    }
  };

  const removeSupervisor = (id) => {
    const newSupers = config.supervisors.filter(s => s.id !== id);
    const newBlocks = config.blocks.map(b => b.supervisorId === id ? { ...b, supervisorId: '' } : b);
    setConfig({ ...config, supervisors: newSupers, blocks: newBlocks });
    showStatus('success', 'Supervisor removed.');
  };

  const toggleBlockFilter = (id) => {
    setDashBlocks(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const submitDailyLog = async () => {
    if (!user) return;
    if (!entryBlock) {
      showStatus('error', "Please select a Block.");
      return;
    }

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
        timestamp: new Date().toISOString()
      });
      
      showStatus('success', `Data saved for ${block.name}`);
      setFormData({ 
        ...formData, 
        hhCovered: 0, 
        hhGiving: 0, 
        hhSegregating: 0, 
        noCollection: false 
      });
    } catch (e) {
      showStatus('error', "Database error. Please retry.");
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

  const timeSeriesData = useMemo(() => {
    const groups = {};
    filteredLogs.forEach(log => {
      let key = log.date;
      if (viewTimeframe === 'weekly') {
        const d = new Date(log.date);
        const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
        key = `W/O ${new Date(d.setDate(diff)).toLocaleDateString('en-IN', {day:'numeric', month:'short'})}`;
      } else if (viewTimeframe === 'monthly') {
        key = new Date(log.date).toLocaleString('en-IN', {month:'short', year:'numeric'});
      }

      if (!groups[key]) {
        groups[key] = { name: key, giving: 0, seg: 0, rawDate: log.date };
      }
      
      if (!log.noCollection) {
        groups[key].giving += Number(log.hhGiving || 0);
        groups[key].seg += Number(log.hhSegregating || 0);
      }
    });

    // Fix: Strict sorting prevents overlapping date labels on mouseover
    return Object.values(groups).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [filteredLogs, viewTimeframe]);

  const gapData = useMemo(() => {
    const reasons = {};
    filteredLogs.filter(l => l.noCollection).forEach(l => {
      reasons[l.reason] = (reasons[l.reason] || 0) + 1;
    });
    return Object.entries(reasons).map(([name, value]) => ({ name, value }));
  }, [filteredLogs]);

  const performanceTable = useMemo(() => {
    return config.blocks
      .filter(b => (dashWard === 'all' || b.wardId === dashWard) && (dashBlocks.length === 0 || dashBlocks.includes(b.id)))
      .map(block => {
        const logs = filteredLogs.filter(d => d.blockId === block.id);
        const valid = logs.filter(l => !l.noCollection);
        const totalCovered = logs.reduce((s, l) => s + Number(l.hhCovered || 0), 0);
        const totalGiving = valid.reduce((s, l) => s + Number(l.hhGiving || 0), 0);
        const totalSeg = valid.reduce((s, l) => s + Number(l.hhSegregating || 0), 0);
        const absences = logs.filter(l => l.noCollection);
        const supervisor = config.supervisors.find(s => s.id === block.supervisorId);
        
        return {
          name: block.name,
          supervisor: supervisor?.name || 'Unassigned',
          covered: totalCovered,
          giving: totalGiving,
          seg: totalSeg,
          absences: absences.length,
          lastReason: absences.length > 0 ? absences[absences.length - 1].reason : null,
          rate: totalGiving > 0 ? ((totalSeg / totalGiving) * 100).toFixed(1) : 0
        };
      });
  }, [filteredLogs, config, dashWard, dashBlocks]);

  // --- Executive Report Export ---
  const handleExportCSV = () => {
    const exportLogs = dailyData.filter(l => l.date >= exportStart && l.date <= exportEnd);
    if (exportLogs.length === 0) {
      showStatus('error', 'No data found in the selected range.');
      return;
    }

    const headers = ["Reporting Date", "Ward", "Block", "Supervisor", "HH Covered", "Giving Waste", "Segregating", "Status", "Reason"];
    const logRows = exportLogs.sort((a,b) => a.date.localeCompare(b.date)).map(l => [
      l.date, l.wardName || 'N/A', l.blockName || 'N/A', l.supervisorName || 'Unassigned', l.hhCovered,
      l.noCollection ? 0 : l.hhGiving, l.noCollection ? 0 : l.hhSegregating,
      l.noCollection ? "Absent" : "Collected", l.noCollection ? `"${l.reason}"` : ""
    ]);

    // Period Calculations Helper
    const calculateStats = (data) => {
      const cov = data.reduce((s,l) => s + Number(l.hhCovered || 0), 0);
      const giv = data.reduce((s,l) => s + (l.noCollection ? 0 : Number(l.hhGiving || 0)), 0);
      const seg = data.reduce((s,l) => s + (l.noCollection ? 0 : Number(l.hhSegregating || 0)), 0);
      return {
        givingPct: cov > 0 ? ((giv/cov)*100).toFixed(2) : "0.00",
        segPct: giv > 0 ? ((seg/giv)*100).toFixed(2) : "0.00"
      };
    };

    const getPeriod = (dateStr, type) => {
      const d = new Date(dateStr);
      if (type === 'W') return `Week Starting ${new Date(d.setDate(d.getDate() - d.getDay())).toISOString().split('T')[0]}`;
      if (type === 'M') return `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
      if (type === 'Q') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      if (type === 'Y') return `${d.getFullYear()}`;
    };

    const aggregate = (type) => {
      const periods = {};
      exportLogs.forEach(l => {
        const pk = getPeriod(l.date, type);
        if (!periods[pk]) periods[pk] = [];
        periods[pk].push(l);
      });
      return Object.entries(periods).map(([name, data]) => {
        const s = calculateStats(data);
        return [name, s.givingPct, s.segPct];
      });
    };

    const summaryHeader = ["Summary Type", "Period Name", "Average Giving (%)", "Average Segregation (%)"];
    const weeklySummary = aggregate('W').map(row => ["Weekly Average", ...row]);
    const monthlySummary = aggregate('M').map(row => ["Monthly Average", ...row]);
    const quarterlySummary = aggregate('Q').map(row => ["Quarterly Average", ...row]);
    const yearlySummary = aggregate('Y').map(row => ["Yearly Average", ...row]);

    const csvContent = [
      headers,
      ...logRows,
      [],
      ["MANAGEMENT SUMMARY ANALYSIS"],
      summaryHeader,
      ...weeklySummary,
      ...monthlySummary,
      ...quarterlySummary,
      ...yearlySummary
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SWM_Report_${exportStart}_to_${exportEnd}.csv`;
    link.click();
    showStatus('success', 'Full management report generated.');
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-slate-500 font-medium">Loading Management Panel...</p>
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
      {statusMsg.text && (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 ${
          statusMsg.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-semibold">{statusMsg.text}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 md:sticky md:top-0 md:flex-col md:w-64 md:h-screen md:justify-start md:gap-2 md:p-6 shadow-sm">
        <div className="hidden md:flex p-2 font-black text-2xl text-blue-600 mb-8 items-center gap-3">
          <Globe size={32} /> <span>SWM India</span>
        </div>
        {[
          { id: 'dashboard', label: 'Analytics', icon: LayoutDashboard },
          { id: 'entry', label: 'Field Entry', icon: PlusCircle },
          { id: 'setup', label: 'Setup', icon: Settings }
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
              activeTab === item.id ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <item.icon size={20} />
            <span className="text-[10px] md:text-base tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 pt-6 px-4 md:pt-10 md:px-10 max-w-7xl overflow-x-hidden">
        {/* ANALYTICS TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header with Integrated Export Controls */}
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">Management Control Center</h1>
                <p className="text-slate-500 font-medium">Monitoring service footprint & team accountability</p>
              </div>
              
              <div className="bg-white p-4 rounded-[28px] border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Report Start</label>
                    <input type="date" className="bg-slate-50 border-none rounded-lg p-1.5 text-[11px] font-bold outline-none" value={exportStart} onChange={e => setExportStart(e.target.value)} />
                  </div>
                  <ArrowRight size={14} className="text-slate-300 mt-3" />
                  <div className="flex flex-col">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Report End</label>
                    <input type="date" className="bg-slate-50 border-none rounded-lg p-1.5 text-[11px] font-bold outline-none" value={exportEnd} onChange={e => setExportEnd(e.target.value)} />
                  </div>
                </div>
                <button onClick={handleExportCSV} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition active:scale-95">
                  <FileSpreadsheet size={18}/> Report Export
                </button>
              </div>
            </header>

            {/* Dashboard Filters */}
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Ward Filter</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none font-semibold" value={dashWard} onChange={(e) => {setDashWard(e.target.value); setDashBlocks([]);}}>
                    <option value="all">All Wards</option>
                    {config.wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex justify-between">
                    <span>Block Intelligence (Multi)</span>
                    {dashBlocks.length > 0 && <button onClick={() => setDashBlocks([])} className="text-blue-500 text-[9px] hover:underline">Clear</button>}
                  </label>
                  <div className="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1">
                    {config.blocks.filter(b => dashWard === 'all' || b.wardId === dashWard).map(block => (
                      <button 
                        key={block.id} 
                        onClick={() => toggleBlockFilter(block.id)}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${dashBlocks.includes(block.id) ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-200 text-slate-600'}`}
                      >
                        {dashBlocks.includes(block.id) ? <CheckSquare size={14}/> : <Square size={14}/>}
                        <span className="truncate">{block.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Lead Responsible</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none font-semibold" value={dashSupervisor} onChange={(e) => setDashSupervisor(e.target.value)}>
                    <option value="all">All Supervisors</option>
                    {config.supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 text-center block">Visual Analysis Range</label>
                  <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 gap-1">
                    {['daily', 'weekly', 'monthly'].map(t => (
                      <button key={t} onClick={() => setViewTimeframe(t)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black capitalize transition ${viewTimeframe === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5">
                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl"><Users size={28}/></div>
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Service Coverage</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight">{stats.covered.toLocaleString()}</p>
                  <p className="text-[9px] text-blue-400 font-bold mt-1">HH Area of Operation</p>
                </div>
              </div>
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5">
                <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl"><Truck size={28}/></div>
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Active Intake</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight">{(stats.covered > 0 ? (stats.giving/stats.covered*100).toFixed(1) : 0)}%</p>
                  <p className="text-[9px] text-indigo-400 font-bold mt-1">{stats.giving.toLocaleString()} Participating HH</p>
                </div>
              </div>
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5">
                <div className="bg-green-50 text-green-600 p-4 rounded-2xl"><CheckCircle2 size={28}/></div>
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Segregation Rate</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight">{(stats.giving > 0 ? ((stats.seg / stats.giving) * 100).toFixed(1) : 0)}%</p>
                  <p className="text-[9px] text-green-400 font-bold mt-1">{stats.seg.toLocaleString()} Quality Stream</p>
                </div>
              </div>
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5">
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl"><Ban size={28}/></div>
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Service Gaps</p>
                  <p className="text-2xl font-black text-slate-800 leading-tight">{stats.absences}</p>
                  <p className="text-[9px] text-red-400 font-bold mt-1">Non-collection events</p>
                </div>
              </div>
            </div>

            {/* Visual Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-slate-700 flex items-center gap-3 mb-8"><History className="text-blue-500" size={20}/> Coverage & Efficiency Trends</h3>
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
                      <Area type="monotone" dataKey="giving" name="HH Collection" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorGiving)" />
                      <Area type="monotone" dataKey="seg" name="HH Segregation" stroke="#a855f7" strokeWidth={4} fillOpacity={1} fill="url(#colorSeg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-slate-700 flex items-center gap-3 mb-8"><Ban className="text-red-500" size={20}/> Failure Mode Analysis</h3>
                {gapData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gapData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}} width={120} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="value" name="Incidents" radius={[0, 10, 10, 0]}>
                          {gapData.map((_, index) => <Cell key={index} fill={['#ef4444', '#f97316', '#f59e0b', '#84cc16'][index % 4]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10 gap-3 opacity-30">
                    <CheckCircle2 size={64} className="text-green-500"/>
                    <p className="font-bold text-sm">Perfect Uptime! <br/> No gaps reported.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Performance Table */}
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden mb-12">
              <div className="p-8 border-b border-slate-50">
                <h2 className="font-black text-slate-800 text-xl">Operational Unit Performance</h2>
                <p className="text-slate-400 text-xs mt-1">Tracking supervisor effectiveness across blocks</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-8 py-5">Block</th><th className="px-6 py-5">Responsible Lead</th><th className="px-6 py-5 text-center">HH Area</th><th className="px-6 py-5 text-center">Giving</th><th className="px-8 py-5">Segregation Efficiency</th><th className="px-6 py-5">Reliability</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {performanceTable.map((block, i) => (
                      <tr key={i} className="hover:bg-blue-50/20 transition group">
                        <td className="px-8 py-5"><div className="font-black text-slate-700">{block.name}</div></td>
                        <td className="px-6 py-5 font-bold text-slate-500 text-sm">{block.supervisor}</td>
                        <td className="px-6 py-5 font-black text-slate-700 text-center">{block.covered}</td>
                        <td className="px-6 py-5 font-black text-blue-600 text-center">{block.giving}</td>
                        <td className="px-8 py-5"><div className="flex items-center gap-3"><div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]"><div className={`h-full rounded-full ${Number(block.rate) > 85 ? 'bg-green-500' : Number(block.rate) > 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${block.rate}%`}} /></div><span className="text-sm font-black text-slate-700">{block.rate}%</span></div></td>
                        <td className="px-6 py-5">{block.absences > 0 ? <div className="text-red-500 text-[10px] font-bold">{block.absences} Gaps</div> : <div className="text-green-600 text-[10px] font-bold">100% Active</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* FIELD ENTRY TAB */}
        {activeTab === 'entry' && (
          <div className="max-w-xl mx-auto py-6 animate-in slide-in-from-bottom-6">
            <header className="text-center mb-8"><h1 className="text-2xl font-black text-slate-800">Field Data Entry</h1></header>
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">State</label>
                    <select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none" value={entryState} onChange={(e) => {setEntryState(e.target.value); setEntryWard(''); setEntryBlock('');}}>
                      <option value="">Select State</option>
                      {config.states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ward</label>
                    <select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none" value={entryWard} onChange={(e) => {setEntryWard(e.target.value); setEntryBlock('');}}>
                      <option value="">Select Ward</option>
                      {config.wards.filter(w => w.stateId === entryState).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Operating Block</label>
                  <select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none" value={entryBlock} onChange={(e) => setEntryBlock(e.target.value)}>
                    <option value="">Select Block</option>
                    {config.blocks.filter(b => b.wardId === entryWard).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Collection Date</label>
                  <input type="date" className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none text-center" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>

              <div className="flex items-center gap-3 p-5 bg-red-50 rounded-3xl border border-red-100">
                <input 
                  type="checkbox" 
                  id="noCollection" 
                  className="w-6 h-6 rounded-lg text-red-600 border-red-200 focus:ring-red-500" 
                  checked={formData.noCollection} 
                  onChange={(e) => setFormData({...formData, noCollection: e.target.checked})}
                />
                <label htmlFor="noCollection" className="text-red-700 font-bold text-sm select-none">No collection data for this day</label>
              </div>

              {formData.noCollection ? (
                <div className="space-y-1 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Gap</label>
                  <select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-white font-bold outline-none" value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})}>
                    <option value="Vehicle didn't come">1) Vehicle didn't come</option>
                    <option value="Vehicle breakdown">2) Vehicle breakdown</option>
                    <option value="Collection staff not available">3) Collection staff not available</option>
                    <option value="Field supervisor absent">4) Field supervisor absent</option>
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-50 animate-in fade-in">
                  {[
                    { label: 'Total HH Covered', key: 'hhCovered', bg: 'bg-slate-50', text: 'text-slate-600' }, 
                    { label: 'HH Giving Waste', key: 'hhGiving', bg: 'bg-blue-50', text: 'text-blue-700' }, 
                    { label: 'HH Segregating', key: 'hhSegregating', bg: 'bg-purple-50', text: 'text-purple-700' }
                  ].map(f => (
                    <div key={f.key} className={`${f.bg} p-5 rounded-3xl flex items-center justify-between border border-white/50 shadow-inner`}>
                      <span className={`${f.text} font-bold text-sm`}>{f.label}</span>
                      <input type="number" className="w-24 text-right bg-transparent border-none outline-none font-black text-2xl text-slate-800" value={formData[f.key]} onChange={(e) => setFormData({...formData, [f.key]: Number(e.target.value)})} />
                    </div>
                  ))}
                </div>
              )}

              <button onClick={submitDailyLog} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl active:scale-[0.98] transition-all">Submit Entry</button>
            </div>
          </div>
        )}

        {/* SETUP TAB */}
        {activeTab === 'setup' && (
          <div className="max-w-4xl mx-auto py-6 space-y-8 animate-in slide-in-from-bottom-6">
            <header className="space-y-2"><h1 className="text-3xl font-black text-slate-800">Hierarchy Management</h1></header>
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><UserCheck className="text-blue-500"/> Field Supervisors</h3><button onClick={() => setConfig({...config, supervisors: [...config.supervisors, { id: Date.now().toString(), name: '' }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add Lead</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.supervisors.map((fs, idx) => (
                  <div key={fs.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <input placeholder="Name" className="flex-1 bg-transparent border-none outline-none font-bold text-slate-700" value={fs.name} onChange={(e) => {
                      const newSupers = [...config.supervisors]; newSupers[idx].name = e.target.value; setConfig({...config, supervisors: newSupers});
                    }} />
                    <button onClick={() => removeSupervisor(fs.id)} className="text-red-400 hover:text-red-600 transition"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
            </section>
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><Globe className="text-blue-500" /> Geography Mapping</h3><button onClick={() => setConfig({...config, states: [...config.states, { id: Date.now().toString(), name: '' }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add State</button></div>
              <div className="space-y-6">
                {config.states.map((st, sIdx) => (
                  <div key={st.id} className="border border-slate-100 rounded-[24px] overflow-hidden">
                    <div className="bg-slate-50 p-4 flex items-center gap-4">
                      <input className="flex-1 bg-transparent font-black text-blue-600 outline-none text-lg" placeholder="State" value={st.name} onChange={(e) => {
                        const newStates = [...config.states]; newStates[sIdx].name = e.target.value; setConfig({...config, states: newStates});
                      }} />
                      <button onClick={() => setConfig({...config, wards: [...config.wards, { id: Date.now().toString(), stateId: st.id, name: '' }]})} className="text-[10px] bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold">+ Ward</button>
                      <button onClick={() => setConfig({...config, states: config.states.filter(s => s.id !== st.id)})} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {config.wards.filter(w => w.stateId === st.id).map((wd) => (
                        <div key={wd.id} className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-xl">
                          <input className="flex-1 text-sm font-bold outline-none" placeholder="Ward" value={wd.name} onChange={(e) => {
                            const newWards = [...config.wards]; const idx = config.wards.findIndex(w => w.id === wd.id); newWards[idx].name = e.target.value; setConfig({...config, wards: newWards});
                          }} />
                          <button onClick={() => setConfig({...config, wards: config.wards.filter(w => w.id !== wd.id)})} className="text-red-400">&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><Database className="text-blue-500" /> Operational Blocks</h3><button onClick={() => setConfig({...config, blocks: [...config.blocks, { id: Date.now().toString(), name: '', wardId: '', supervisorId: '', totalHH: 0 }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add Block</button></div>
              <div className="space-y-4">
                {config.blocks.map((bl, bIdx) => (
                  <div key={bl.id} className="bg-slate-50 p-5 rounded-[24px] border border-slate-100 space-y-4 transition hover:bg-slate-100/50">
                    <div className="flex items-center gap-4">
                      <input className="flex-1 bg-transparent font-black text-slate-800 outline-none text-lg border-b-2 border-slate-200 focus:border-blue-500 transition" placeholder="Block Name" value={bl.name} onChange={(e) => {
                        const newBlocks = [...config.blocks]; newBlocks[bIdx].name = e.target.value; setConfig({...config, blocks: newBlocks});
                      }} />
                      <button onClick={() => setConfig({...config, blocks: config.blocks.filter(b => b.id !== bl.id)})} className="text-red-400"><Trash2 size={16}/></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <select className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={bl.wardId} onChange={(e) => {
                        const newBlocks = [...config.blocks]; newBlocks[bIdx].wardId = e.target.value; setConfig({...config, blocks: newBlocks});
                      }}><option value="">Select Ward</option>{config.wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                      <select className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={bl.supervisorId} onChange={(e) => {
                        const newBlocks = [...config.blocks]; newBlocks[bIdx].supervisorId = e.target.value; setConfig({...config, blocks: newBlocks});
                      }}><option value="">Assign Lead</option>{config.supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                      <div className="flex items-center gap-2"><label className="text-[10px] font-black text-slate-400 uppercase">Total HH</label><input type="number" className="w-full bg-white border border-slate-200 rounded-lg p-2 font-black text-xs" value={bl.totalHH} onChange={(e) => {
                        const newBlocks = [...config.blocks]; newBlocks[bIdx].totalHH = Number(e.target.value); setConfig({...config, blocks: newBlocks});
                      }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <button onClick={() => saveConfig(config)} className="w-full py-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-[32px] font-black text-xl shadow-2xl transition hover:scale-[1.01] active:scale-[0.99]">Publish Configuration</button>
          </div>
        )}
      </main>
    </div>
  );
};

// Vercel Auto-Mount
if (!isCanvas) {
  const container = document.getElementById('root');
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
  }
}

export default App;
