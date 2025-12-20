import ReactDOM from 'react-dom/client';
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
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line 
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

/**
 * --- Firebase Configuration ---
 * Integrated with your project specific credentials: admob-app-id-4497163742
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
  const fileInputRef = useRef(null);

  // Global Filters for Dashboard
  const [dashState, setDashState] = useState('all');
  const [dashWard, setDashWard] = useState('all');
  const [dashSupervisor, setDashSupervisor] = useState('all');
  
  // Date Range State
  const [dashStartDate, setDashStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  });
  const [dashEndDate, setDashEndDate] = useState(formatDate(new Date()));
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

    return () => {
      unsubConfig();
      unsubData();
    };
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
      showStatus('success', 'Project configuration published successfully!');
    } catch (e) {
      showStatus('error', 'Failed to save configuration.');
    }
  };

  const submitDailyLog = async () => {
    if (!user) return;
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
      
      showStatus('success', `Data saved for ${block.name}`);
      setFormData({ ...formData, hhCovered: 0, hhGiving: 0, hhSegregating: 0 });
    } catch (e) {
      showStatus('error', "Submission failed. Please check your rules.");
    }
  };

  const handleBulkUpload = (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) return;

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
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const filteredLogs = useMemo(() => {
    return dailyData.filter(log => {
      const stateMatch = dashState === 'all' || log.stateId === dashState;
      const wardMatch = dashWard === 'all' || log.wardId === dashWard;
      const supervisorMatch = dashSupervisor === 'all' || log.supervisorId === dashSupervisor;
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
        key = new Date(log.date).toLocaleString('en-IN', {month:'short', year:'numeric'});
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
          id: block.id,
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
      <p className="text-slate-500 font-medium animate-pulse text-sm">Synchronizing Cloud Data...</p>
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
          { id: 'setup', label: 'Setup', icon: Settings }
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
                <p className="text-slate-500 font-medium">Monitoring {viewTimeframe} performance</p>
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

            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">State</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none" value={dashState} onChange={(e) => {setDashState(e.target.value); setDashWard('all');}}>
                    <option value="all">All States</option>
                    {config.states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Ward</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none" value={dashWard} onChange={(e) => setDashWard(e.target.value)}>
                    <option value="all">All Wards</option>
                    {config.wards.filter(w => dashState === 'all' || w.stateId === dashState).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Supervisor</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none" value={dashSupervisor} onChange={(e) => setDashSupervisor(e.target.value)}>
                    <option value="all">All Team Leads</option>
                    {config.supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1 lg:col-span-2 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">From</label>
                    <input type="date" className="w-full bg-blue-50/50 border border-blue-100 rounded-xl p-2.5 text-xs outline-none font-bold text-blue-700" value={dashStartDate} onChange={(e) => setDashStartDate(e.target.value)} />
                  </div>
                  <ArrowRight size={14} className="text-slate-300 mt-6" />
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">To</label>
                    <input type="date" className="w-full bg-blue-50/50 border border-blue-100 rounded-xl p-2.5 text-xs outline-none font-bold text-blue-700" value={dashEndDate} onChange={(e) => setDashEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'HH Collected', value: filteredLogs.reduce((s,v) => s + Number(v.hhGiving), 0).toLocaleString(), icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'HH Segregating', value: filteredLogs.reduce((s,v) => s + Number(v.hhSegregating), 0).toLocaleString(), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Efficiency Rate', value: (filteredLogs.reduce((s,v) => s + Number(v.hhGiving), 0) > 0 ? ((filteredLogs.reduce((s,v) => s + Number(v.hhSegregating), 0) / filteredLogs.reduce((s,v) => s + Number(v.hhGiving), 0)) * 100).toFixed(1) : 0) + '%', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' }
              ].map((card, i) => (
                <div key={i} className="bg-white p-7 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5">
                  <div className={`${card.bg} ${card.color} p-4 rounded-2xl`}><card.icon size={28}/></div>
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{card.label}</p>
                    <p className="text-2xl font-black text-slate-800 leading-tight">{card.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden mb-12">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h2 className="font-black text-slate-800 text-xl">Operational Breakdown (Range Total)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Location</th>
                      <th className="px-6 py-5">Supervisor</th>
                      <th className="px-6 py-5 text-center">HH Giving</th>
                      <th className="px-6 py-5 text-center">HH Seg.</th>
                      <th className="px-8 py-5">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {performanceTable.map((block) => (
                      <tr key={block.id} className="hover:bg-blue-50/20 transition group">
                        <td className="px-8 py-5">
                          <div className="font-black text-slate-700">{block.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5"><MapPin size={8} className="inline mr-1"/>{block.ward}</div>
                        </td>
                        <td className="px-6 py-5 font-bold text-slate-500 text-sm">{block.supervisor}</td>
                        <td className="px-6 py-5 font-black text-blue-600 text-lg text-center">{block.giving}</td>
                        <td className="px-6 py-5 font-black text-purple-600 text-lg text-center">{block.seg}</td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                              <div className={`h-full rounded-full ${Number(block.rate) > 80 ? 'bg-green-500' : 'bg-amber-500'}`} style={{width: `${block.rate}%`}} />
                            </div>
                            <span className="text-sm font-black text-slate-700">{block.rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'entry' && (
          <div className="max-w-xl mx-auto py-6">
            <header className="text-center mb-8">
              <h1 className="text-2xl font-black text-slate-800">Daily Field Intake</h1>
            </header>
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Block / Street Unit</label>
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
              <button onClick={submitDailyLog} className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-blue-100 transition-all active:scale-[0.98]">Submit Daily Report</button>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="max-w-4xl mx-auto py-6 space-y-8">
            <header className="space-y-2">
              <h1 className="text-3xl font-black text-slate-800">Project Configuration</h1>
              <p className="text-slate-500 font-medium">Define geography and team assignments</p>
            </header>
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black flex items-center gap-3"><UserCheck className="text-blue-500"/> Team Supervisors</h3>
                <button onClick={() => setConfig({...config, supervisors: [...config.supervisors, { id: Date.now().toString(), name: '' }]})} className="text-xs bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold">Add Lead</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.supervisors.map((fs, idx) => (
                  <div key={fs.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <input placeholder="Name" className="flex-1 bg-transparent border-none outline-none font-bold" value={fs.name} onChange={(e) => {
                      const newSupers = [...config.supervisors];
                      newSupers[idx].name = e.target.value;
                      setConfig({...config, supervisors: newSupers});
                    }} />
                    <button onClick={() => setConfig({...config, supervisors: config.supervisors.filter(s => s.id !== fs.id)})} className="text-red-400 hover:text-red-500"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
            </section>
            <button onClick={() => saveConfig(config)} className="w-full py-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-[32px] font-black text-xl shadow-2xl transition hover:scale-[1.01]">Publish Global Configuration</button>
          </div>
        )}
      </main>
    </div>
  );
};
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

export default App;
