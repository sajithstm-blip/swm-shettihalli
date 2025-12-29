import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeApp } from 'firebase/app';
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
  Table as TableIcon,
  Database,
  Loader2,
  Info
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
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'swm-national-v1'; 

const formatDate = (date) => date.toISOString().split('T')[0];

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState({ 
    states: [], wards: [], blocks: [], supervisors: [] 
  });
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

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

  // --- Real-time Data Sync ---
  useEffect(() => {
    // 1. Fetch Configuration
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
      setLoading(false); // Stop loading once config is pulled
    }, (err) => {
      console.error("Config Error:", err);
      setLoading(false);
    });

    // 2. Fetch Daily Logs
    const dataRef = collection(db, 'artifacts', appId, 'public', 'data', 'daily_logs');
    const unsubData = onSnapshot(query(dataRef), (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDailyData(logs);
    }, (err) => console.error("Data Error:", err));

    return () => { unsubConfig(); unsubData(); };
  }, []);

  // --- Logic Helpers ---
  const showStatus = (type, text) => {
    setStatusMsg({ type, text: String(text) });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
  };

  const saveConfig = async (newConfig) => {
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'app_config', 'settings');
      await setDoc(configRef, newConfig);
      showStatus('success', 'Configuration saved successfully.');
    } catch (e) {
      showStatus('error', 'Failed to save configuration.');
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
    
    try {
      const logId = `${formData.date}_${entryBlock}`;
      const logRef = doc(db, 'artifacts', appId, 'public', 'data', 'daily_logs', logId);
      await setDoc(logRef, {
        ...formData,
        wardId: ward?.id || '',
        wardName: ward?.name || '',
        blockId: entryBlock,
        blockName: block?.name || '',
        supervisorId: block?.supervisorId || 'unassigned',
        supervisorName: config.supervisors.find(s => s.id === block?.supervisorId)?.name || 'Unassigned',
        timestamp: new Date().toISOString(),
        enteredBy: 'public-user'
      });
      showStatus('success', 'Entry submitted.');
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
    const headers = ["Date", "Ward", "Block", "Supervisor", "HH Covered", "Waste Given", "Waste Segregated", "Status", "Reason"];
    const logRows = exportLogs.sort((a,b) => a.date.localeCompare(b.date)).map(l => [
      l.date, l.wardName || 'N/A', l.blockName || 'N/A', l.supervisorName || 'Unassigned', l.hhCovered,
      l.noCollection ? 0 : l.hhGiving, l.noCollection ? 0 : l.hhSegregating,
      l.noCollection ? "Absent" : "Collected", l.noCollection ? `"${l.reason}"` : ""
    ]);
    
    // Calculate Averages
    const calculateStats = (data) => {
      const cov = data.reduce((s,l) => s + Number(l.hhCovered || 0), 0);
      const giv = data.reduce((s,l) => s + (l.noCollection ? 0 : Number(l.hhGiving || 0)), 0);
      const seg = data.reduce((s,l) => s + (l.noCollection ? 0 : Number(l.hhSegregating || 0)), 0);
      return {
        givingPct: cov > 0 ? ((giv/cov)*100).toFixed(2) : "0.00",
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
        return [name, s.givingPct, s.segPct];
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
      <p className="font-bold text-slate-500 tracking-tight uppercase text-[10px]">Loading Saahas SWM...</p>
    </div>
  );

  const statsAgg = {
    covered: filteredLogs.reduce((s, v) => s + Number(v.hhCovered || 0), 0),
    giving: filteredLogs.reduce((s, v) => s + (v.noCollection ? 0 : Number(v.hhGiving || 0)), 0),
    seg: filteredLogs.reduce((s, v) => s + (v.noCollection ? 0 : Number(v.hhSegregating || 0)), 0),
    absences: filteredLogs.filter(v => v.noCollection).length
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 md:pb-0 flex flex-col md:flex-row">
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 md:sticky md:top-0 md:flex-col md:w-64 md:h-screen md:justify-start md:gap-2 md:p-6 shadow-sm">
        <div className="hidden md:flex p-2 font-black text-2xl text-blue-600 mb-8 items-center gap-3"><Globe size={32} /> <span>Saahas SWM</span></div>
        <button onClick={() => setActiveTab('dashboard')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'dashboard' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={20} /><span className="text-[10px] md:text-base">Analytics</span></button>
        <button onClick={() => setActiveTab('review')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'review' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><TableIcon size={20} /><span className="text-[10px] md:text-base">Review</span></button>
        <button onClick={() => setActiveTab('entry')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'entry' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={20} /><span className="text-[10px] md:text-base tracking-tight">Entry</span></button>
        <button onClick={() => setActiveTab('setup')} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 px-4 py-3 rounded-2xl transition ${activeTab === 'setup' ? 'text-blue-600 bg-blue-50 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Settings size={20} /><span className="text-[10px] md:text-base">Setup</span></button>
      </nav>

      <main className="flex-1 pt-6 px-4 md:pt-10 md:px-10 max-w-7xl overflow-x-hidden">
        
        {/* DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
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

            {/* Filters */}
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

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 transition hover:shadow-md">
                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl"><Users size={28}/></div>
                <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">HH Covered</p><p className="text-2xl font-black text-slate-800 leading-tight">{statsAgg.covered.toLocaleString()}</p></div>
              </div>
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 transition hover:shadow-md">
                <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl"><Truck size={28}/></div>
                <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Participation</p><p className="text-2xl font-black text-slate-800 leading-tight">{(statsAgg.covered > 0 ? (statsAgg.giving/statsAgg.covered*100).toFixed(1) : 0)}%</p></div>
              </div>
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 transition hover:shadow-md">
                <div className="bg-green-50 text-green-600 p-4 rounded-2xl"><CheckCircle2 size={28}/></div>
                <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Efficiency</p><p className="text-2xl font-black text-slate-800 leading-tight">{(statsAgg.giving > 0 ? ((statsAgg.seg / statsAgg.giving) * 100).toFixed(1) : 0)}%</p></div>
              </div>
              <div className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5 transition hover:shadow-md">
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl"><Ban size={28}/></div>
                <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Absences</p><p className="text-2xl font-black text-slate-800 leading-tight">{statsAgg.absences}</p></div>
              </div>
            </div>

            {/* Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-slate-700 flex items-center gap-3 mb-8 tracking-tight"><History className="text-blue-500" size={20}/> Coverage Timeline</h3>
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={timeSeriesData}><defs><linearGradient id="colorGiving" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient><linearGradient id="colorSeg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.1}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} /><Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontSize: '14px', fontWeight: '900', color: '#1e293b' }} /><Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} /><Area type="monotone" dataKey="giving" name="Giving Waste" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorGiving)" /><Area type="monotone" dataKey="seg" name="Waste Segregated" stroke="#a855f7" strokeWidth={4} fillOpacity={1} fill="url(#colorSeg)" /></AreaChart></ResponsiveContainer></div>
              </div>
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col justify-center items-center gap-4 text-center">
                 <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-2"><TrendingUp size={48}/></div>
                 <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight">System Status</h4>
                 <p className="text-slate-400 text-sm font-medium">Tracking active across {config.blocks?.length || 0} blocks.</p>
              </div>
            </div>
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

        {/* DATA ENTRY VIEW */}
        {activeTab === 'entry' && (
          <div className="max-w-xl mx-auto py-6 animate-in slide-in-from-bottom-6">
            <header className="text-center mb-8"><h1 className="text-2xl font-black text-slate-800 tracking-tight">Field Submission</h1></header>
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Ward Mapping</label><select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none" value={entryWard} onChange={(e) => {setEntryWard(e.target.value); setEntryBlock('');}}><option value="">Select Ward</option>{config.wards?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Operating Block</label><select className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none" value={entryBlock} onChange={(e) => setEntryBlock(e.target.value)}><option value="">Select Block</option>{config.blocks?.filter(b => b.wardId === entryWard).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                </div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase text-center block tracking-widest">Collection Date</label><input type="date" className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold outline-none text-center" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
              </div>
              {/* Optional No Collection Toggle */}
              <div className="flex items-center gap-3 p-5 bg-red-50 rounded-3xl border border-red-100">
                <input type="checkbox" id="noCollection" className="w-6 h-6 rounded-lg text-red-600 border-red-200" checked={formData.noCollection} onChange={(e) => setFormData({...formData, noCollection: e.target.checked})} />
                <label htmlFor="noCollection" className="text-red-700 font-bold text-sm tracking-tight">Gaps: No Collection Activity Today</label>
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

        {/* SETUP VIEW */}
        {activeTab === 'setup' && (
          <div className="max-w-4xl mx-auto py-6 space-y-8 animate-in slide-in-from-bottom-6">
            {statusMsg.text && <div className="fixed top-4 right-4 p-4 bg-blue-600 text-white rounded-xl shadow-2xl font-bold">{statusMsg.text}</div>}
            <header className="space-y-2"><h1 className="text-3xl font-black text-slate-800 tracking-tight">Operational Setup</h1></header>
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><ShieldCheck className="text-blue-500"/> Team Access Mapping</h3></div>
              <div className="grid grid-cols-1 gap-4"><div className="flex flex-col sm:flex-row gap-2"><input id="new-user-email" placeholder="staff@saahas.org" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none" /><select id="new-user-role" className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"><option value="supervisor">Supervisor</option><option value="coordinator">Coordinator</option><option value="manager">Manager</option></select><button onClick={() => { const em = document.getElementById('new-user-email').value; const rl = document.getElementById('new-user-role').value; if(em) updateUserRole(em, rl); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black active:scale-95 transition">Authorize Staff</button></div></div>
            </section>
            
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><Users className="text-blue-500"/> Lead List</h3><button onClick={() => setConfig({...config, supervisors: [...config.supervisors, { id: Date.now().toString(), name: '' }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add Staff</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{config.supervisors?.map((fs, idx) => (<div key={fs.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 transition hover:bg-white hover:shadow-md"><input placeholder="Full Name" className="flex-1 bg-transparent border-none outline-none font-bold text-slate-700" value={fs.name} onChange={(e) => { const ns = [...config.supervisors]; ns[idx].name = e.target.value; setConfig({...config, supervisors: ns}); }} /><button onClick={() => removeSupervisor(fs.id)} className="text-red-400 hover:text-red-600 transition"><Trash2 size={18}/></button></div>))}</div>
            </section>
            
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><Globe className="text-blue-500" /> Geography Mapping</h3><button onClick={() => setConfig({...config, states: [...config.states, { id: Date.now().toString(), name: '' }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add State</button></div>
              <div className="space-y-6">{config.states?.map((st, sIdx) => (<div key={st.id} className="border border-slate-100 rounded-[24px] overflow-hidden"><div className="bg-slate-50 p-4 flex items-center gap-4"><input className="flex-1 bg-transparent font-black text-blue-600 outline-none text-lg" placeholder="State Name" value={st.name} onChange={(e) => { const ns = [...config.states]; ns[sIdx].name = e.target.value; setConfig({...config, states: ns}); }} /><button onClick={() => setConfig({...config, wards: [...config.wards, { id: Date.now().toString(), stateId: st.id, name: '' }]})} className="text-[10px] bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold">+ Ward</button><button onClick={() => setConfig({...config, states: config.states.filter(s => s.id !== st.id)})} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div><div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">{config.wards?.filter(w => w.stateId === st.id).map((wd) => (<div key={wd.id} className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-xl"><input className="flex-1 text-sm font-bold outline-none" placeholder="Ward" value={wd.name} onChange={(e) => { const nw = [...config.wards]; const idx = config.wards.findIndex(w => w.id === wd.id); nw[idx].name = e.target.value; setConfig({...config, wards: nw}); }} /><button onClick={() => setConfig({...config, wards: config.wards.filter(w => w.id !== wd.id)})} className="text-red-400">&times;</button></div>))}</div></div>))}</div>
            </section>
            
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8"><h3 className="text-xl font-black flex items-center gap-3"><Database className="text-blue-500" /> Operational Units</h3><button onClick={() => setConfig({...config, blocks: [...config.blocks, { id: Date.now().toString(), name: '', wardId: '', supervisorId: '', totalHH: 0 }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add Block</button></div>
              <div className="space-y-4">{config.blocks?.map((bl, bIdx) => (<div key={bl.id} className="bg-slate-50 p-5 rounded-[24px] border border-slate-100 space-y-4 transition hover:bg-slate-100/50"><div className="flex items-center gap-4"><input className="flex-1 bg-transparent font-black text-slate-800 outline-none text-lg border-b-2 border-slate-200 focus:border-blue-500 transition" placeholder="Block Name" value={bl.name} onChange={(e) => { const nb = [...config.blocks]; nb[bIdx].name = e.target.value; setConfig({...config, blocks: nb}); }} /><button onClick={() => setConfig({...config, blocks: config.blocks.filter(b => b.id !== bl.id)})} className="text-red-400"><Trash2 size={16}/></button></div><div className="grid grid-cols-2 md:grid-cols-3 gap-4"><select className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={bl.wardId} onChange={(e) => { const nb = [...config.blocks]; nb[bIdx].wardId = e.target.value; setConfig({...config, blocks: nb}); }}><option value="">Ward</option>{config.wards?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select><select className="bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none" value={bl.supervisorId} onChange={(e) => { const nb = [...config.blocks]; nb[bIdx].supervisorId = e.target.value; setConfig({...config, blocks: nb}); }}><option value="">Lead</option>{config.supervisors?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><div className="flex items-center gap-2"><label className="text-[10px] font-black text-slate-400 uppercase">Total HH</label><input type="number" className="w-full bg-white border border-slate-200 rounded-lg p-2 font-black text-xs" value={bl.totalHH} onChange={(e) => { const nb = [...config.blocks]; nb[bIdx].totalHH = Number(e.target.value); setConfig({...config, blocks: nb}); }} /></div></div></div>))}</div>
            </section>
            
            <button onClick={() => saveConfig(config)} className="w-full py-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-[32px] font-black text-xl shadow-2xl transition hover:scale-[1.01] active:scale-[0.99]">Publish Operational Settings</button>
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
