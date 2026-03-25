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

const INITIAL_TRAININGS = [
  { id: 't1', name: 'Toolbox Talk', points: 10 },
  { id: 't2', name: 'Working at Heights', points: 30 },
  { id: 't3', name: 'BIM Awareness', points: 20 },
];

const App = () => {
  const [activeTab, setActiveTab] = useState('log');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [trainings, setTrainings] = useState(INITIAL_TRAININGS);
  const [complianceTarget, setComplianceTarget] = useState(40);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [selectedUserHistory, setSelectedUserHistory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiSuggestionInput, setAiSuggestionInput] = useState("");

  // Forms State
  const [logForm, setLogForm] = useState({ employeeId: '', trainingId: INITIAL_TRAININGS[0].id, isConductor: false });
  const [userForm, setUserForm] = useState({ id: '', name: '', role: 'General Worker' });
  const [trainingForm, setTrainingForm] = useState({ name: '', points: 10 });

  // --- CLOUD DATA FETCHING ---
  const fetchCloudData = async () => {
    const { data: profileData } = await supabase.from('profiles').select('*').order('name');
    if (profileData) setUsers(profileData);
    const { data: logData } = await supabase.from('logs').select('*').order('created_at', { ascending: false });
    if (logData) setLogs(logData);
  };

  useEffect(() => {
    fetchCloudData();
  }, []);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // --- SCORING LOGIC ---
  const handleLogSubmit = async (e) => {
    e.preventDefault();
    const user = users.find(u => u.id === logForm.employeeId.trim());
    const training = trainings.find(t => t.id === logForm.trainingId);
    if (!user) return showNotification("Error: Employee ID not found.");
    
    let pointsAwarded = training.points;
    if (logForm.isConductor) pointsAwarded *= 2;

    const { error: logError } = await supabase.from('logs').insert([{
        user_id: user.id,
        training_name: training.name,
        points: pointsAwarded,
        role: logForm.isConductor ? 'CONDUCTOR' : 'ATTENDEE',
        date: new Date().toISOString().split('T')[0]
    }]);

    if (logError) return showNotification("Log failed: " + logError.message);

    const newScore = (Number(user.total_score) || 0) + pointsAwarded;
    await supabase.from('profiles').update({ total_score: newScore }).eq('id', user.id);

    await fetchCloudData(); 
    showNotification(`Success: ${pointsAwarded} pts for ${user.name}`);
    setLogForm({ ...logForm, employeeId: '' });
  };

  // --- ADMIN LOGIC ---
  const saveUser = async (e) => {
    e.preventDefault();
    if (editingItem?.type === 'user') {
      await supabase.from('profiles').update({ name: userForm.name, role: userForm.role }).eq('id', userForm.id);
      setEditingItem(null);
    } else {
      if (users.some(u => u.id === userForm.id)) return showNotification("ID exists.");
      await supabase.from('profiles').insert([{ ...userForm, total_score: 0 }]);
    }
    await fetchCloudData();
    setUserForm({ id: '', name: '', role: 'General Worker' });
  };

  // --- EXPORT TOOLS (RESTORED) ---
  const downloadPDFReport = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    doc.setFillColor(0, 43, 73);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("SITE COMPLIANCE REPORT", 14, 22);
    const tableRows = users.map(u => [u.id, u.name, u.role, u.total_score || 0, (u.total_score || 0) >= complianceTarget ? "ACHIEVED" : "PENDING"]);
    autoTable(doc, { head: [["ID", "Name", "Role", "Score", "Status"]], body: tableRows, startY: 50 });
    doc.save(`QSHE_Report_${date}.pdf`);
  };

  const exportToExcel = () => {
    const headers = "Date,Employee Name,Employee ID,Training,Points,Role\n";
    const csvRows = logs.map(l => `${l.date},${users.find(u=>u.id===l.user_id)?.name || 'Unknown'},${l.user_id},${l.training_name},${l.points},${l.role}`).join("\n");
    const blob = new Blob([headers + csvRows], { type: 'text/csv' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "QSHE_Logs.csv";
    link.click();
  };

  const downloadIDBadge = async (user) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85, 55] });
    const qrDataUrl = await QRCode.toDataURL(`USER_ID:${user.id}`);
    doc.setFillColor(0, 43, 73);
    doc.rect(0, 0, 85, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text("QSHE ID CARD", 42.5, 10, { align: "center" });
    doc.setTextColor(0, 43, 73);
    doc.text(user.name.toUpperCase(), 10, 25);
    doc.addImage(qrDataUrl, 'PNG', 50, 18, 30, 30);
    doc.save(`Badge_${user.id}.pdf`);
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-24">
      <header className="bg-[#002B49] text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-yellow-400 w-8 h-8" />
            <h1 className="font-black text-lg uppercase">QSHE Training Tracker</h1>
          </div>
          <button onClick={() => setActiveTab('admin')} className="p-2 hover:bg-white/10 rounded-lg"><Settings /></button>
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
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl ${activeTab === tab.id ? 'bg-[#002B49] text-white' : 'text-slate-500'}`}>
              <tab.icon size={18} /> <span className="text-[10px] font-black uppercase">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'log' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 max-w-xl mx-auto">
             <h2 className="text-2xl font-black text-center mb-6">Log Achievement</h2>
             <form onSubmit={handleLogSubmit} className="space-y-6">
                <input className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold" placeholder="EMPLOYEE ID" value={logForm.employeeId} onChange={e => setLogForm({...logForm, employeeId: e.target.value.toUpperCase()})} required />
                <select className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold" value={logForm.trainingId} onChange={e => setLogForm({...logForm, trainingId: e.target.value})}>
                  {trainings.map(t => <option key={t.id} value={t.id}>{t.name} ({t.points} PTS)</option>)}
                </select>
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-2xl border-2 border-yellow-100">
                   <span className="font-black text-xs uppercase">Facilitator (2x Points)</span>
                   <input type="checkbox" checked={logForm.isConductor} onChange={() => setLogForm({...logForm, isConductor: !logForm.isConductor})} className="w-6 h-6" />
                </div>
                <button className="w-full bg-[#002B49] text-white p-5 rounded-2xl font-black uppercase shadow-lg">Record Achievement</button>
             </form>
          </div>
        )}

        {activeTab === 'repo' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-xl font-black text-[#002B49] uppercase">Compliance Audit</h2>
                <div className="flex gap-2">
                   <button onClick={downloadPDFReport} className="bg-[#002B49] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Download size={14}/> PDF</button>
                   <button onClick={exportToExcel} className="bg-green-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><FileSpreadsheet size={14}/> Excel</button>
                </div>
                <input type="text" placeholder="Search..." className="border p-2 rounded-xl text-xs w-full md:w-48" onChange={e => setSearchTerm(e.target.value)} />
             </div>
             <table className="w-full">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                  <tr><th className="px-6 py-4 text-left">Employee</th><th className="px-6 py-4 text-center">Score</th><th className="px-6 py-4 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 font-bold">{user.name}<br/><span className="text-[9px] text-slate-400">{user.id} • {user.role}</span></td>
                      <td className="px-6 py-4 text-center font-black text-lg">{user.total_score || 0}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setSelectedUserHistory(user)} className="text-blue-600 font-black text-[10px] uppercase flex items-center gap-1 ml-auto"><Clock size={14}/> Audit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
              <h3 className="font-black uppercase mb-4">Personnel Roster</h3>
              <form onSubmit={saveUser} className="space-y-3 mb-6">
                <input className="w-full border p-2 rounded-lg text-sm" placeholder="ID" value={userForm.id} onChange={e => setUserForm({...userForm, id: e.target.value.toUpperCase()})} />
                <input className="w-full border p-2 rounded-lg text-sm" placeholder="Name" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                <button className="w-full bg-blue-600 text-white py-2 rounded-lg font-black uppercase text-xs">Save Member</button>
              </form>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {users.map(u => (
                  <div key={u.id} className="p-3 border rounded-xl flex justify-between items-center">
                    <span className="text-xs font-bold">{u.name} ({u.id})</span>
                    <button onClick={() => supabase.from('profiles').delete().eq('id', u.id).then(() => fetchCloudData())} className="text-red-500"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
               <h3 className="font-black uppercase mb-4">Settings</h3>
               <label className="text-[10px] font-black text-slate-400">KPI Target Points</label>
               <input type="number" className="w-full border p-2 rounded-lg mt-1 mb-4" value={complianceTarget} onChange={e => setComplianceTarget(e.target.value)} />
            </div>
          </div>
        )}

        {activeTab === 'rank' && (
           <div className="space-y-4">
              {users.sort((a,b) => (b.total_score||0) - (a.total_score||0)).map((u, idx) => (
                <div key={u.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border">
                   <span className="font-black text-slate-300">#{idx+1}</span>
                   <span className="font-bold text-sm">{u.name}</span>
                   <span className="bg-[#002B49] text-white px-3 py-1 rounded-lg font-black text-xs">{u.total_score || 0} PTS</span>
                </div>
              ))}
           </div>
        )}
      </main>

      {/* AUDIT POPUP */}
      {selectedUserHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <header className="bg-[#002B49] p-8 text-white relative">
              <button onClick={() => setSelectedUserHistory(null)} className="absolute top-4 right-4"><X /></button>
              <h2 className="text-2xl font-black">{selectedUserHistory.name}</h2>
              <p className="text-blue-300 text-[10px] font-black uppercase">{selectedUserHistory.id} • {selectedUserHistory.role}</p>
            </header>
            <div className="p-6 overflow-y-auto">
              {logs.filter(l => l.user_id === selectedUserHistory.id).map(log => (
                <div key={log.id} className="flex justify-between border-b py-3">
                  <div><p className="font-bold text-xs uppercase">{log.training_name}</p><p className="text-[9px] text-slate-400">{log.date} • {log.role}</p></div>
                  <span className="font-black text-blue-600">+{log.points}</span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50 border-t flex gap-2">
               <button onClick={() => downloadIDBadge(selectedUserHistory)} className="flex-1 bg-blue-50 text-blue-700 p-3 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2"><IdCard size={16}/> Print Badge</button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full font-black text-[10px] uppercase z-[200]">
          {notification}
        </div>
      )}
    </div>
  );
};

export default App;