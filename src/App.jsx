import React, { useState, useEffect } from 'react';
import { 
  Users, Award, ClipboardCheck, Search, PlusCircle, Trophy, ShieldCheck,
  QrCode, ChevronRight, TrendingUp, UserPlus, Download, Printer, X,
  Settings, Edit2, Trash2, Clock, BookOpen, Calendar, AlertCircle,
  Sparkles, Loader2, BrainCircuit, FileSpreadsheet, IdCard
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import QRCode from 'qrcode';
import { supabase } from './supabaseClient';

// --- INITIAL DATA ---
const INITIAL_USERS = [
  { id: 'G-1001', name: 'Ahmad bin Zulkifli', role: 'Site Supervisor', total_score: 40 },
  { id: 'G-1002', name: 'Chen Wei Ming', role: 'Structural Engineer', total_score: 70 },
  { id: 'G-1003', name: 'S. Rajendran', role: 'Safety Officer', total_score: 110 },
];

const INITIAL_TRAININGS = [
  { id: 't1', name: 'Toolbox Talk', points: 10 },
  { id: 't2', name: 'Working at Heights', points: 30 },
  { id: 't3', name: 'BIM Awareness', points: 20 },
];

const App = () => {
  const [activeTab, setActiveTab] = useState('log');

  // --- CHANGED: Initialized with empty arrays for Cloud Data ---
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [trainings, setTrainings] = useState(INITIAL_TRAININGS);

  // --- NEW: FETCH CLOUD DATA FUNCTION ---
  const fetchCloudData = async () => {
    // Pull Profiles from Supabase (Matches your 'profiles' screenshot)
    const { data: profileData, error: pError } = await supabase.from('profiles').select('*').order('name');
    if (profileData) setUsers(profileData);

    // Pull Logs from Supabase (Matches your 'logs' screenshot)
    const { data: logData, error: lError } = await supabase.from('logs').select('*').order('created_at', { ascending: false });
    if (logData) setLogs(logData);
  };

  // --- NEW: Trigger Cloud Pull on Startup ---
  useEffect(() => {
    fetchCloudData();
  }, []);

  /* --- OLD LOCALSTORAGE LOGIC (COMMENTED OUT FOR REVIEW) ---
  const [trainings, setTrainings] = useState(() => {
    const saved = localStorage.getItem('gamuda_trainings');
    return saved ? JSON.parse(saved) : INITIAL_TRAININGS;
  });

  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('gamuda_logs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('gamuda_users', JSON.stringify(users));
  }, [users]);
  ... etc ...
  */

  const [complianceTarget, setComplianceTarget] = useState(40);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [selectedUserHistory, setSelectedUserHistory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiSuggestionInput, setAiSuggestionInput] = useState("");

  const [logForm, setLogForm] = useState({ employeeId: '', trainingId: INITIAL_TRAININGS[0].id, isConductor: false });
  const [userForm, setUserForm] = useState({ id: '', name: '', role: 'General Worker' });
  const [trainingForm, setTrainingForm] = useState({ name: '', points: 10 });

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // --- CHANGED: handleLogSubmit now pushes to Supabase 'logs' and updates 'profiles' ---
  const handleLogSubmit = async (e) => {
    e.preventDefault();
    const user = users.find(u => u.id === logForm.employeeId.trim());
    const training = trainings.find(t => t.id === logForm.trainingId);
    
    if (!user) return showNotification("Error: Employee ID not found.");
    
    let pointsAwarded = training.points;
    if (logForm.isConductor) pointsAwarded *= 2;

    // 1. INSERT into 'logs' table
    const { error: logError } = await supabase.from('logs').insert([{
        user_id: user.id,
        training_name: training.name,
        points: pointsAwarded,
        role: logForm.isConductor ? 'CONDUCTOR' : 'ATTENDEE',
        date: new Date().toISOString().split('T')[0]
    }]);

    if (logError) return showNotification("Log failed: " + logError.message);

    // 2. UPDATE 'total_score' in 'profiles' table
    const newScore = (Number(user.total_score) || 0) + pointsAwarded;
    await supabase.from('profiles').update({ total_score: newScore }).eq('id', user.id);

    // 3. Refresh Screen
    await fetchCloudData(); 
    showNotification(`Success: ${pointsAwarded} pts for ${user.name}`);
    setLogForm({ ...logForm, employeeId: '' });
  };

  // --- CHANGED: saveUser now pushes to Supabase 'profiles' ---
  const saveUser = async (e) => {
    e.preventDefault();
    if (editingItem && editingItem.type === 'user') {
      await supabase.from('profiles').update({ name: userForm.name, role: userForm.role }).eq('id', userForm.id);
      setEditingItem(null);
    } else {
      if (users.some(u => u.id === userForm.id)) return showNotification("Error: ID already exists.");
      // INSERT into 'profiles'
      await supabase.from('profiles').insert([{ id: userForm.id, name: userForm.name, role: userForm.role, total_score: 0 }]);
    }
    await fetchCloudData();
    setUserForm({ id: '', name: '', role: 'General Worker' });
  };

  const saveTraining = (e) => {
    e.preventDefault();
    setTrainings([...trainings, { ...trainingForm, id: `t-${Date.now()}` }]);
    setTrainingForm({ name: '', points: 10 });
    showNotification("Training catalog updated.");
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- UPDATED: PDF Report to use 'total_score' column ---
  const downloadPDFReport = () => {
    const doc = new jsPDF();
    const tableRows = users.map(user => [
      user.id, user.name, user.role, user.total_score || 0, 
      (user.total_score || 0) >= complianceTarget ? "ACHIEVED" : "PENDING"
    ]);
    autoTable(doc, { head: [["ID", "Name", "Role", "Score", "Status"]], body: tableRows, startY: 50, headStyles: { fillColor: [0, 43, 73] } });
    doc.save(`QSHE_Report.pdf`);
  };

  const downloadUserAuditPDF = async (user) => {
    const doc = new jsPDF();
    const qrDataUrl = await QRCode.toDataURL(`USER_ID:${user.id}`);
    const userLogs = logs.filter(l => l.user_id === user.id);
    autoTable(doc, { startY: 50, head: [["Date", "Module", "Points"]], body: userLogs.map(l => [l.date, l.training_name, `${l.points} PTS`]), headStyles: { fillColor: [0, 43, 73] } });
    doc.save(`Audit_${user.id}.pdf`);
  };

  const downloadIDBadge = async (user) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85, 55] });
    const qrDataUrl = await QRCode.toDataURL(`USER_ID:${user.id}`);
    doc.setFillColor(0, 43, 73);
    doc.rect(0, 0, 85, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text("QSHE ID CARD", 42.5, 10, { align: "center" });
    doc.addImage(qrDataUrl, 'PNG', 50, 18, 30, 30);
    doc.save(`Badge_${user.id}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-24">
      <header className="bg-[#002B49] text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-1.5 rounded-lg shadow-inner">
              <ShieldCheck className="text-[#002B49] w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-tight uppercase">QSHE Training Tracker</h1>
              <p className="text-[10px] text-blue-300 uppercase font-bold tracking-widest">Attendance & Performance</p>
            </div>
          </div>
          <button onClick={() => setActiveTab('admin')} className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-300 hover:text-white">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:pt-8">
        <div className="flex bg-white rounded-2xl shadow-sm mb-6 p-1.5 border border-slate-200 overflow-hidden sticky top-20 z-40">
          {[
            { id: 'log', icon: PlusCircle, label: 'Activity' },
            { id: 'repo', icon: ClipboardCheck, label: 'Audit' },
            { id: 'rank', icon: Trophy, label: 'Ranking' },
            { id: 'admin', icon: Settings, label: 'Admin' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-[#002B49] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <tab.icon size={18} />
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'log' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200 max-w-2xl mx-auto">
              <div className="mb-8 text-center">
                <div className="inline-flex bg-blue-50 p-3 rounded-2xl text-blue-600 mb-4"><PlusCircle size={32} /></div>
                <h2 className="text-2xl font-black text-[#002B49]">Log Achievement</h2>
              </div>
              <form onSubmit={handleLogSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee ID</label>
                  <div className="relative">
                    <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold" value={logForm.employeeId} onChange={(e) => setLogForm({...logForm, employeeId: e.target.value.toUpperCase()})} required />
                    <QrCode className="absolute left-4 top-4 text-slate-400" size={20} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Training Type</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 font-bold" value={logForm.trainingId} onChange={(e) => setLogForm({...logForm, trainingId: e.target.value})}>
                    {trainings.map(t => <option key={t.id} value={t.id}>{t.name} ({t.points} PTS)</option>)}
                  </select>
                </div>
                <div className="p-5 bg-yellow-50/50 rounded-2xl border-2 border-yellow-100 flex items-center justify-between cursor-pointer" onClick={() => setLogForm({...logForm, isConductor: !logForm.isConductor})}>
                   <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${logForm.isConductor ? 'bg-yellow-400 text-[#002B49]' : 'bg-white text-slate-300'}`}><TrendingUp size={20} /></div>
                      <span className="font-black text-[#002B49] text-sm uppercase">Facilitator Multiplier (2x)</span>
                   </div>
                   <input type="checkbox" checked={logForm.isConductor} readOnly className="w-6 h-6 rounded-lg" />
                </div>
                <button type="submit" className="w-full bg-[#002B49] text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-sm flex items-center justify-center gap-3"><Award size={20} /> Record achievement</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'repo' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 bg-slate-50/50 border-b flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-xl font-black text-[#002B49] uppercase tracking-tighter">Compliance Audit</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Real-time personnel verification</p>
                </div>
                <div className="flex gap-3">
                   <button onClick={downloadPDFReport} className="bg-[#002B49] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all hover:bg-blue-900 shadow-sm"><Download size={14}/> Export PDF</button>
                   <div className="relative w-full sm:w-64">
                      <input type="text" placeholder="Search personnel..." className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 pl-10 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      <Search className="absolute left-3.5 top-3 text-slate-400" size={14} />
                   </div>
                </div>
              </div>
              <table className="w-full text-left">
                <thead className="text-[10px] uppercase font-black text-slate-400 bg-white">
                  <tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-center">Score</th><th className="px-6 py-4 text-right">Records</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4"><div className="font-bold">{user.name}</div><div className="text-[9px] font-bold text-slate-400 uppercase">{user.id} • {user.role}</div></td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black border ${(user.total_score || 0) >= complianceTarget ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                          {(user.total_score || 0) >= complianceTarget ? 'ACHIEVED' : 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-[#002B49] text-lg">{user.total_score || 0}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setSelectedUserHistory(user)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg flex items-center gap-1 ml-auto text-[10px] font-black uppercase tracking-widest"><Clock size={16} /> Audit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="animate-in fade-in duration-400 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-[#002B49] mb-6 flex items-center gap-2 uppercase tracking-tight"><Users className="text-blue-600" /> Personnel Roster</h3>
              <form onSubmit={saveUser} className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                   <input className="bg-white border p-2 rounded-lg text-sm font-bold" placeholder="ID" value={userForm.id} onChange={e => setUserForm({...userForm, id: e.target.value.toUpperCase()})} required />
                   <select className="bg-white border p-2 rounded-lg text-sm font-bold" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}><option>General Worker</option><option>Supervisor</option><option>Safety Officer</option><option>Engineer</option></select>
                </div>
                <input className="w-full bg-white border p-2 rounded-lg text-sm font-bold" placeholder="Full Name" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required />
                <button type="submit" className="w-full bg-blue-600 text-white font-black py-2 rounded-lg text-[10px] uppercase">Save Member</button>
              </form>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {users.map(u => (
                  <div key={u.id} className="p-3 bg-white border border-slate-100 rounded-xl flex justify-between items-center group">
                    <div className="text-xs font-bold">{u.name} <span className="text-[9px] text-slate-400 block">{u.id}</span></div>
                    <button onClick={() => supabase.from('profiles').delete().eq('id', u.id).then(() => fetchCloudData())} className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-6">
               <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-black text-[#002B49] mb-4 flex items-center gap-2 uppercase tracking-tight"><ShieldCheck className="text-yellow-500" /> Site Compliance Policy</h3>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points Required for KPI Achievement</label>
                  <input type="number" className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 font-bold mt-1" value={complianceTarget} onChange={(e) => setComplianceTarget(parseInt(e.target.value) || 0)} />
               </div>

               <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-black text-[#002B49] mb-6 flex items-center gap-2 uppercase tracking-tight"><BookOpen className="text-blue-600" /> Training Catalog</h3>
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl mb-6 text-white shadow-lg shadow-blue-900/10">
                     <div className="flex items-center gap-2 mb-3"><Sparkles size={16} className="text-yellow-400" /><span className="text-[10px] font-black uppercase tracking-widest">AI Module Designer</span></div>
                     <div className="flex gap-2">
                        <input className="flex-1 bg-white/10 border border-white/20 rounded-xl py-2 px-3 text-xs placeholder:text-white/40 focus:bg-white/20 outline-none text-white font-bold" placeholder="Describe a site safety issue..." value={aiSuggestionInput} onChange={e => setAiSuggestionInput(e.target.value)} />
                        <button className="bg-yellow-400 text-[#002B49] p-2 rounded-xl hover:bg-yellow-300 transition-all"><BrainCircuit size={18} /></button>
                     </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {trainings.map(t => (
                      <div key={t.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs font-bold">{t.name} <span className="text-blue-600">{t.points} PTS</span></div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'rank' && (
           <div className="animate-in fade-in duration-400 space-y-4">
              {users.sort((a,b) => (b.total_score||0) - (a.total_score||0)).map((u, idx) => (
                <div key={u.id} className="bg-white p-4 rounded-3xl border flex items-center justify-between hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-4"><span className="text-slate-300 font-black italic">#{idx + 1}</span><span className="text-sm font-bold">{u.name}</span></div>
                  <div className="bg-[#002B49] text-white font-black py-1 px-4 rounded-xl text-xs">{(u.total_score||0)} PTS</div>
                </div>
              ))}
           </div>
        )}
      </main>

      {selectedUserHistory && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            <header className="bg-[#002B49] p-8 text-white relative">
              <button onClick={() => setSelectedUserHistory(null)} className="absolute top-4 right-4 text-white/50 hover:text-white"><X size={24} /></button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center text-[#002B49] font-black text-2xl shadow-xl shadow-yellow-400/20">{selectedUserHistory.name.charAt(0)}</div>
                <div><h2 className="text-2xl font-black tracking-tight">{selectedUserHistory.name}</h2><p className="text-blue-300 text-[10px] font-black uppercase tracking-widest">{selectedUserHistory.id} • {selectedUserHistory.role}</p></div>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Engagement History</h3>
               {logs.filter(l => l.user_id === selectedUserHistory.id).map(log => (
                 <div key={log.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                    <div><p className="text-xs font-black text-[#002B49] uppercase">{log.training_name}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{log.date} • {log.role}</p></div>
                    <span className="font-black text-blue-700 text-sm">+{log.points}</span>
                 </div>
               ))}
            </div>
            <div className="p-6 bg-slate-50 border-t flex gap-3">
               <button onClick={() => downloadUserAuditPDF(selectedUserHistory)} className="flex-1 border border-slate-200 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"><Printer size={16}/> PRINT LOG</button>
               <button onClick={() => downloadIDBadge(selectedUserHistory)} className="flex-1 bg-blue-50 text-blue-700 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"><IdCard size={16}/> PRINT BADGE</button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-[200] animate-in slide-in-from-bottom-10">
          <div className="bg-yellow-400 rounded-lg p-1.5 shadow-inner"><ShieldCheck size={18} className="text-[#002B49]" /></div>
          <span className="text-[10px] font-black uppercase tracking-tight">{notification}</span>
        </div>
      )}
    </div>
  );
};

export default App;