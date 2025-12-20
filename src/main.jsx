import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, LineChart, Line 
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
  ArrowRight
} from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDns4NX18h_dCrZ3hyyFzHT-bUvdwdRLw0",
  authDomain: "admob-app-id-4497163742.firebaseapp.com",
  databaseURL: "https://admob-app-id-4497163742.firebaseio.com",
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
  const fileInputRef = useRef(null);

  // Global Filters for Dashboard
  const [dashState, setDashState] = useState('all');
  const [dashWard, setDashWard] = useState('all');
  const [dashSupervisor, setDashSupervisor] = useState('all');
  
  // Date Range State
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);
  
  const [dashStartDate, setDashStartDate] = useState(formatDate(weekAgo));
  const [dashEndDate, setDashEndDate] = useState(formatDate(today));
  const [viewTimeframe, setViewTimeframe] = useState('daily');

  // Entry Form State
  const [entryMode, setEntryMode] = useState('single');
  const [entryState, setEntryState] = useState('');
  const [entryWard, setEntryWard] = useState('');
  const [entryBlock, setEntryBlock] = useState('');
  const [formData, setFormData] = useState({
    date: formatDate(new Date()),
    hhCovered: 0,
    hhGiving: 0,
    hhSegregating: 0
  });

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Firestore Sync
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
    });

    const dataRef = collection(db, 'artifacts', appId, 'public', 'data', 'daily_logs');
    const unsubData = onSnapshot(query(dataRef), (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDailyData(logs);
    });

    return () => {
      unsubConfig();
      unsubData();
    };
  }, [user]);

  // --- Actions ---
  const showStatus = (type, text) => {
    setStatusMsg({ type, text: String(text) });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
  };

  const saveConfig = async (newConfig) => {
    if (!user) return;
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_config', 'settings');
      await setDoc(configRef, newConfig);
      showStatus('success', 'Project configuration updated successfully!');
    } catch (e) {
      showStatus('error', 'Failed to save configuration.');
    }
  };

  const submitDailyLog = async () => {
    if (!entryBlock) {
      showStatus('error', "Please select a State, Ward, and Block.");
      return;
    }

    const block = config.blocks.find(b => b.id === entryBlock);
    const ward = config.wards.find(w => w.id === block?.wardId);
    const state = config.states.find(s => s.id === ward?.stateId);
    const supervisor = config.supervisors.find(s => s.id === block?.supervisorId);

    try {
      const logId = `${formData.date}_${entryBlock}`;
      const logRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_logs', logId);
      
      await setDoc(logRef, {
        ...formData,
        stateId: state?.id,
        stateName: state?.name,
        wardId: ward?.id,
        wardName: ward?.name,
        blockId: entryBlock,
        blockName: block?.name,
        supervisorId: supervisor?.id || 'unassigned',
        supervisorName: supervisor?.name || 'Unassigned',
        timestamp: new Date().toISOString()
      });
      
      showStatus('success', `Data saved for ${block.name} in ${ward.name}`);
      setFormData({ ...formData, hhCovered: 0, hhGiving: 0, hhSegregating: 0 });
    } catch (e) {
      showStatus('error', "Submission failed. Please check your connection.");
    }
  };

  const handleBulkUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx]);

        const block = config.blocks.find(b => b.name.toLowerCase() === row['block name']?.toLowerCase());
        
        if (block && row['date']) {
          const ward = config.wards.find(w => w.id === block.wardId);
          const state = config.states.find(s => s.id === ward?.stateId);
          const supervisor = config.supervisors.find(s => s.id === block.supervisorId);

          const logId = `${row['date']}_${block.id}`;
          const logRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_logs', logId);

          try {
            await setDoc(logRef, {
              date: row['date'],
              hhCovered: Number(row['hh covered'] || 0),
              hhGiving: Number(row['hh giving'] || 0),
              hhSegregating: Number(row['hh segregating'] || 0),
              stateId: state?.id,
              stateName: state?.name,
              wardId: ward?.id,
              wardName: ward?.name,
              blockId: block.id,
              blockName: block.name,
              supervisorId: supervisor?.id || 'unassigned',
              supervisorName: supervisor?.name || 'Unassigned',
              timestamp: new Date().toISOString()
            });
            successCount++;
          } catch (err) { errorCount++; }
        } else { errorCount++; }
      }
      showStatus('success', `Bulk upload complete: ${successCount} saved, ${errorCount} failed.`);
    };
    reader.readAsText(file);
  };

  // --- Analytics Memoization ---
  const filteredLogs = useMemo(() => {
    return dailyData.filter(log => {
      const stateMatch = dashState === 'all' || log.stateId === dashState;
      const wardMatch = dashWard === 'all' || log.wardId === dashWard;
      const supervisorMatch = dashSupervisor === 'all' || log.supervisorId === dashSupervisor;
      
      // Range check
      const dateMatch = log.date >= dashStartDate && log.date <= dashEndDate;
      
      return stateMatch && wardMatch && supervisorMatch && dateMatch;
    });
  }, [dailyData, dashState, dashWard, dashSupervisor, dashStartDate, dashEndDate]);

  const timeSeriesData = useMemo(() => {
    const groups = {};
    filteredLogs.forEach(log => {
      let key = log.date;
      if (viewTimeframe === 'weekly') {
        const d = new Date(log.date);
        const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
        key = `W/O ${new Date(d.setDate(diff)).toLocaleDateString('en-IN', {day:'numeric', month:'short'})}`;
      } else if (viewTimeframe === 'monthly') {
        key = new Date(log.date).toLocaleString('en-IN', {month:'long', year:'numeric'});
      }

      if (!groups[key]) groups[key] = { name: key, giving: 0, seg: 0, count: 0 };
      groups[key].giving += Number(log.hhGiving || 0);
      groups[key].seg += Number(log.hhSegregating || 0);
      groups[key].count += 1;
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)).map(g => ({
      ...g,
      avgGiving: (g.giving / (viewTimeframe === 'daily' ? 1 : g.count)).toFixed(0),
      avgSeg: (g.seg / (viewTimeframe === 'daily' ? 1 : g.count)).toFixed(0)
    }));
  }, [filteredLogs, viewTimeframe]);

  const performanceTable = useMemo(() => {
    return config.blocks
      .filter(b => {
        const ward = config.wards.find(w => w.id === b.wardId);
        const stateMatch = dashState === 'all' || ward?.stateId === dashState;
        const wardMatch = dashWard === 'all' || b.wardId === dashWard;
        const supervisorMatch = dashSupervisor === 'all' || b.supervisorId === dashSupervisor;
        return stateMatch && wardMatch && supervisorMatch;
      })
      .map(block => {
        const logs = filteredLogs.filter(d => d.blockId === block.id);
        const totalGiving = logs.reduce((s, l) => s + Number(l.hhGiving || 0), 0);
        const totalSeg = logs.reduce((s, l) => s + Number(l.hhSegregating || 0), 0);
        const supervisor = config.supervisors.find(s => s.id === block.supervisorId);
        const ward = config.wards.find(w => w.id === block.wardId);
        
        return {
          name: block.name,
          ward: ward?.name || 'N/A',
          supervisor: supervisor?.name || 'Unassigned',
          giving: totalGiving,
          seg: totalSeg,
          rate: totalGiving > 0 ? ((totalSeg / totalGiving) * 100).toFixed(1) : 0
        };
      });
  }, [filteredLogs, config, dashState, dashWard, dashSupervisor]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-slate-500 font-medium animate-pulse">Initializing National SWM Tracker...</p>
    </div>
  );

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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 md:sticky md:top-0 md:flex-col md:w-64 md:h-screen md:justify-start md:gap-2 md:p-6 shadow-sm">
        <div className="hidden md:flex p-2 font-black text-2xl text-blue-600 mb-8 items-center gap-3">
          <Globe size={32} /> <span>SWM India</span>
        </div>
        {[
          { id: 'dashboard', label: 'Analytics', icon: LayoutDashboard },
          { id: 'entry', label: 'Field Entry', icon: PlusCircle },
          { id: 'setup', label: 'Project Setup', icon: Settings }
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
              activeTab === item.id 
              ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' 
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <item.icon size={20} />
            <span className="text-[10px] md:text-base tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 pt-6 px-4 md:pt-10 md:px-10 max-w-7xl overflow-x-hidden">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">Operational Dashboard</h1>
                <p className="text-slate-500 font-medium">Monitoring {viewTimeframe} performance across India</p>
              </div>
              <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                {['daily', 'weekly', 'monthly'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setViewTimeframe(t)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition ${viewTimeframe === t ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </header>

            {/* Range & Geography Filter Suite */}
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Globe size={10}/> State</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none" value={dashState} onChange={(e) => {setDashState(e.target.value); setDashWard('all');}}>
                    <option value="all">All States</option>
                    {config.states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><MapPin size={10}/> Ward</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none" value={dashWard} onChange={(e) => setDashWard(e.target.value)}>
                    <option value="all">All Wards</option>
                    {config.wards.filter(w => dashState === 'all' || w.stateId === dashState).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><UserCheck size={10}/> Supervisor</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none" value={dashSupervisor} onChange={(e) => setDashSupervisor(e.target.value)}>
                    <option value="all">All Team Leads</option>
                    {config.supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Date Range Selectors */}
                <div className="space-y-1 lg:col-span-2 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Calendar size={10}/> Start Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-blue-50/30 border border-blue-100 rounded-xl p-2.5 text-sm outline-none font-bold text-blue-700"
                      value={dashStartDate}
                      onChange={(e) => setDashStartDate(e.target.value)}
                    />
                  </div>
                  <ArrowRight size={16} className="text-slate-300 mt-6" />
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Calendar size={10}/> End Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-blue-50/30 border border-blue-100 rounded-xl p-2.5 text-sm outline-none font-bold text-blue-700"
                      value={dashEndDate}
                      onChange={(e) => setDashEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-2">
                  <Search size={12}/> Showing data for {new Date(dashStartDate).toLocaleDateString()} to {new Date(dashEndDate).toLocaleDateString()}
                </p>
                <button 
                  onClick={() => {
                    setDashState('all'); 
                    setDashWard('all'); 
                    setDashSupervisor('all'); 
                    setDashStartDate(formatDate(weekAgo));
                    setDashEndDate(formatDate(today));
                  }}
                  className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
                >
                  Clear All Filters
                </button>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'HH Collected', value: filteredLogs.reduce((s,v) => s + Number(v.hhGiving), 0).toLocaleString(), icon: Database, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'In selected range' },
                { label: 'HH Segregating', value: filteredLogs.reduce((s,v) => s + Number(v.hhSegregating), 0).toLocaleString(), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', sub: 'Waste segregated' },
                { label: 'Segregation Rate', value: (filteredLogs.reduce((s,v) => s + Number(v.hhGiving), 0) > 0 ? ((filteredLogs.reduce((s,v) => s + Number(v.hhSegregating), 0) / filteredLogs.reduce((s,v) => s + Number(v.hhGiving), 0)) * 100).toFixed(1) : 0) + '%', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', sub: 'Range efficiency' }
              ].map((card, i) => (
                <div key={i} className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 transition hover:shadow-md">
                  <div className={`${card.bg} ${card.color} p-4 rounded-2xl`}><card.icon size={28}/></div>
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{card.label}</p>
                    <p className="text-3xl font-black text-slate-800 leading-tight">{card.value}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart Area */}
              <div className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-lg text-slate-700 flex items-center gap-3">
                    <History className="text-blue-500" size={20}/> {viewTimeframe.charAt(0).toUpperCase() + viewTimeframe.slice(1)} Performance Trend
                  </h3>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                      <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                      <Line type="monotone" dataKey="avgGiving" name="HH Collection" stroke="#3b82f6" strokeWidth={4} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6}} />
                      <Line type="monotone" dataKey="avgSeg" name="HH Segregation" stroke="#a855f7" strokeWidth={4} dot={{r: 4, fill: '#a855f7'}} activeDot={{r: 6}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Range Summary / Insights */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[40px] text-white flex flex-col justify-between shadow-xl shadow-blue-200">
                <div>
                  <h4 className="text-blue-100 font-bold uppercase tracking-widest text-[10px] mb-2">Range Focus</h4>
                  <p className="text-xl font-black mb-6 leading-relaxed">
                    Analyzing Period: <br/>
                    <span className="text-white/80 font-medium text-sm">{new Date(dashStartDate).toLocaleDateString('en-IN', {day:'numeric', month:'short'})} — {new Date(dashEndDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year: 'numeric'})}</span>
                  </p>
                  
                  <div className="space-y-4">
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                      <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Reporting Blocks</p>
                      <p className="text-xl font-bold">{new Set(filteredLogs.map(l => l.blockId)).size} / {config.blocks.length}</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                      <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Active Supervisors</p>
                      <p className="text-xl font-bold">{new Set(filteredLogs.map(l => l.supervisorId)).size}</p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    const csvRows = [["Block", "Ward", "Supervisor", "HH Giving (Total)", "HH Segregating (Total)", "Average Rate (%)"]];
                    performanceTable.forEach(p => csvRows.push([p.name, p.ward, p.supervisor, p.giving, p.seg, p.rate]));
                    const csvContent = csvRows.map(e => e.join(",")).join("\n");
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('href', url);
                    a.setAttribute('download', `SWM_CustomRange_Report_${dashStartDate}_to_${dashEndDate}.csv`);
                    a.click();
                  }}
                  className="mt-8 bg-white text-blue-600 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition shadow-lg"
                >
                  <Download size={18}/> Export Custom Range
                </button>
              </div>
            </div>

            {/* Performance Breakdown Table */}
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden mb-12">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="font-black text-slate-800 text-xl">Block Breakdown (Total in Range)</h2>
                  <p className="text-xs text-slate-400 font-medium">Accumulated collection metrics for the specified dates</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Geography</th>
                      <th className="px-6 py-5">Team Lead</th>
                      <th className="px-6 py-5 text-center">Total Giving</th>
                      <th className="px-6 py-5 text-center">Total Seg.</th>
                      <th className="px-8 py-5">Efficiency Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {performanceTable.map((block, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition group">
                        <td className="px-8 py-5">
                          <div className="font-black text-slate-700 group-hover:text-blue-600 transition">{block.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5"><MapPin size={8}/> {block.ward}</div>
                        </td>
                        <td className="px-6 py-5 font-bold text-slate-500 text-sm">{block.supervisor}</td>
                        <td className="px-6 py-5 font-black text-blue-600 text-lg text-center">{block.giving.toLocaleString()}</td>
                        <td className="px-6 py-5 font-black text-purple-600 text-lg text-center">{block.seg.toLocaleString()}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                              <div className={`h-full rounded-full transition-all duration-1000 ${Number(block.rate) > 85 ? 'bg-green-500' : Number(block.rate) > 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{width: `${block.rate}%`}} />
                            </div>
                            <span className="text-sm font-black text-slate-700">{block.rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {performanceTable.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-8 py-20 text-center text-slate-300 italic font-medium">No activity recorded for this date range. Try expanding your search.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DAILY ENTRY TAB */}
        {activeTab === 'entry' && (
          <div className="max-w-xl mx-auto py-6 animate-in slide-in-from-bottom-6 duration-500">
            <header className="text-center mb-8 space-y-2">
              <h1 className="text-2xl font-black text-slate-800">Field Data Entry</h1>
              <div className="inline-flex p-1 bg-slate-200 rounded-2xl mt-4">
                <button onClick={() => setEntryMode('single')} className={`px-6 py-2 rounded-xl text-sm font-bold transition ${entryMode === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Manual Entry</button>
                <button onClick={() => setEntryMode('bulk')} className={`px-6 py-2 rounded-xl text-sm font-bold transition ${entryMode === 'bulk' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Bulk CSV</button>
              </div>
            </header>

            {entryMode === 'single' ? (
              <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-blue-100/50 border border-slate-100 space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">State</label>
                      <select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold focus:border-blue-500 outline-none transition" value={entryState} onChange={(e) => {setEntryState(e.target.value); setEntryWard(''); setEntryBlock('');}}>
                        <option value="">Select State</option>
                        {config.states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ward</label>
                      <select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold focus:border-blue-500 outline-none transition" value={entryWard} onChange={(e) => {setEntryWard(e.target.value); setEntryBlock('');}}>
                        <option value="">Select Ward</option>
                        {config.wards.filter(w => w.stateId === entryState).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Operating Block</label>
                    <select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold focus:border-blue-500 outline-none transition" value={entryBlock} onChange={(e) => setEntryBlock(e.target.value)}>
                      <option value="">Select Block/Street</option>
                      {config.blocks.filter(b => b.wardId === entryWard).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Date</label>
                    <input type="date" className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold focus:border-blue-500 outline-none transition text-center" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-50">
                  {[
                    { label: 'Households Covered', key: 'hhCovered', bg: 'bg-slate-50', text: 'text-slate-600' },
                    { label: 'Giving Waste', key: 'hhGiving', bg: 'bg-blue-50', text: 'text-blue-700' },
                    { label: 'Segregating Waste', key: 'hhSegregating', bg: 'bg-purple-50', text: 'text-purple-700' }
                  ].map(field => (
                    <div key={field.key} className={`${field.bg} p-5 rounded-3xl flex items-center justify-between border border-white/50 shadow-inner`}>
                      <span className={`${field.text} font-bold`}>{field.label}</span>
                      <input 
                        type="number" 
                        className="w-24 text-right bg-transparent border-none outline-none font-black text-2xl text-slate-800"
                        value={formData[field.key]}
                        onChange={(e) => setFormData({...formData, [field.key]: Number(e.target.value)})}
                      />
                    </div>
                  ))}
                </div>

                <button 
                  onClick={submitDailyLog}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-blue-200 hover:shadow-2xl transition-all active:scale-[0.98]"
                >
                  Confirm & Submit
                </button>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-blue-100/50 border border-slate-100 text-center space-y-8">
                <div className="p-12 border-4 border-dashed border-slate-100 rounded-[32px] bg-slate-50/50 flex flex-col items-center gap-6">
                  <div className="bg-blue-100 text-blue-600 p-6 rounded-full shadow-inner"><Upload size={48}/></div>
                  <div className="space-y-2">
                    <p className="text-xl font-black text-slate-800">CSV Bulk Upload</p>
                    <p className="text-sm text-slate-400 font-medium px-8">Process large datasets from Google Sheets or Excel directly into the database.</p>
                  </div>
                  <input type="file" accept=".csv" onChange={handleBulkUpload} ref={fileInputRef} className="hidden" id="csv-upload-main" />
                  <label htmlFor="csv-upload-main" className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black cursor-pointer hover:bg-blue-700 shadow-lg shadow-blue-100 transition">Select CSV File</label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETUP TAB */}
        {activeTab === 'setup' && (
          <div className="max-w-4xl mx-auto py-6 space-y-8 animate-in fade-in duration-700">
            <header className="space-y-2">
              <h1 className="text-3xl font-black text-slate-800">Hierarchy & Team Setup</h1>
              <p className="text-slate-500 font-medium">Configure national geography and assign field supervisors</p>
            </header>

            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black flex items-center gap-3"><UserCheck className="text-blue-500" /> Field Supervisors</h3>
                <button onClick={() => setConfig({...config, supervisors: [...config.supervisors, { id: Date.now().toString(), name: '' }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-md transition">Add Member</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.supervisors.map((fs, idx) => (
                  <div key={fs.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                    <input 
                      placeholder="Enter Full Name" 
                      className="flex-1 bg-transparent border-none outline-none font-bold text-slate-700 placeholder:text-slate-300"
                      value={fs.name}
                      onChange={(e) => {
                        const newSupers = [...config.supervisors];
                        newSupers[idx].name = e.target.value;
                        setConfig({...config, supervisors: newSupers});
                      }}
                    />
                    <button onClick={() => setConfig({...config, supervisors: config.supervisors.filter(s => s.id !== fs.id)})} className="text-slate-300 hover:text-red-500 transition"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black flex items-center gap-3"><Globe className="text-blue-500" /> Geography Hierarchy</h3>
                <button onClick={() => setConfig({...config, states: [...config.states, { id: Date.now().toString(), name: '' }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-md">Add State</button>
              </div>
              
              <div className="space-y-6">
                {config.states.map((st, sIdx) => (
                  <div key={st.id} className="border border-slate-100 rounded-[24px] overflow-hidden">
                    <div className="bg-slate-50 p-4 flex items-center gap-4">
                      <input className="flex-1 bg-transparent font-black text-blue-600 outline-none text-lg" placeholder="State Name (e.g. Karnataka)" value={st.name} onChange={(e) => {
                        const newStates = [...config.states];
                        newStates[sIdx].name = e.target.value;
                        setConfig({...config, states: newStates});
                      }} />
                      <button onClick={() => setConfig({...config, wards: [...config.wards, { id: Date.now().toString(), stateId: st.id, name: '' }]})} className="text-[10px] bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-slate-600">+ Add Ward</button>
                      <button onClick={() => setConfig({...config, states: config.states.filter(s => s.id !== st.id)})} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {config.wards.filter(w => w.stateId === st.id).map((wd, wIdx) => (
                        <div key={wd.id} className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-xl">
                          <MapPin size={14} className="text-slate-300"/>
                          <input className="flex-1 text-sm font-bold outline-none" placeholder="Ward/District Name" value={wd.name} onChange={(e) => {
                            const newWards = [...config.wards];
                            const idx = config.wards.findIndex(w => w.id === wd.id);
                            newWards[idx].name = e.target.value;
                            setConfig({...config, wards: newWards});
                          }} />
                          <button onClick={() => setConfig({...config, wards: config.wards.filter(w => w.id !== wd.id)})} className="text-slate-200 hover:text-red-500">&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black flex items-center gap-3"><Database className="text-blue-500" /> Operational Blocks</h3>
                <button onClick={() => setConfig({...config, blocks: [...config.blocks, { id: Date.now().toString(), name: '', wardId: '', supervisorId: '', totalHH: 0 }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-md">Add Block</button>
              </div>
              <div className="space-y-4">
                {config.blocks.map((bl, bIdx) => (
                  <div key={bl.id} className="flex flex-col md:flex-row gap-4 bg-slate-50 p-5 rounded-[24px] border border-slate-100 relative group">
                    <div className="flex-1 space-y-2">
                      <input className="w-full bg-transparent font-black text-slate-800 outline-none text-lg border-b-2 border-slate-200 focus:border-blue-500 transition" placeholder="Block/Street Name" value={bl.name} onChange={(e) => {
                        const newBlocks = [...config.blocks];
                        newBlocks[bIdx].name = e.target.value;
                        setConfig({...config, blocks: newBlocks});
                      }} />
                      <div className="grid grid-cols-2 gap-2">
                        <select className="bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold outline-none" value={bl.wardId} onChange={(e) => {
                          const newBlocks = [...config.blocks];
                          newBlocks[bIdx].wardId = e.target.value;
                          setConfig({...config, blocks: newBlocks});
                        }}>
                          <option value="">Select Ward</option>
                          {config.wards.map(w => <option key={w.id} value={w.id}>{w.name} ({config.states.find(s => s.id === w.stateId)?.name})</option>)}
                        </select>
                        <select className="bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold outline-none" value={bl.supervisorId} onChange={(e) => {
                          const newBlocks = [...config.blocks];
                          newBlocks[bIdx].supervisorId = e.target.value;
                          setConfig({...config, blocks: newBlocks});
                        }}>
                          <option value="">Assigned FS</option>
                          {config.supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total HH</label>
                      <input type="number" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-center font-black outline-none" value={bl.totalHH} onChange={(e) => {
                        const newBlocks = [...config.blocks];
                        newBlocks[bIdx].totalHH = Number(e.target.value);
                        setConfig({...config, blocks: newBlocks});
                      }} />
                    </div>
                    <button onClick={() => setConfig({...config, blocks: config.blocks.filter(b => b.id !== bl.id)})} className="absolute -top-2 -right-2 bg-white text-red-400 shadow-sm border border-slate-100 rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg">&times;</button>
                  </div>
                ))}
              </div>
            </section>

            <button onClick={() => saveConfig(config)} className="w-full py-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-[32px] font-black text-xl shadow-2xl shadow-green-100 hover:scale-[1.01] transition transform active:scale-[0.98]">Publish National Config</button>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
