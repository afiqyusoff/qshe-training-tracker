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

    const newScore = (Number(user.total_score) || 0) + pointsAwarded;
    await supabase.from('profiles').update({ total_score: newScore }).eq('id', user.id);

    await fetchCloudData(); 
    showNotification(`Success: ${pointsAwarded} pts for ${user.name}`);
    setLogForm({ ...logForm, employeeId: '' });
  };

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

  // --- RESTORED EXPORT LOGIC ---
  const downloadPDFReport = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    doc.setFillColor(0, 43, 73);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("SITE COMPLIANCE REPORT", 14, 22);
    const tableRows = users.map(u => [u.id, u.name, u.role, u.total_score || 0, (u.total_score || 0) >= complianceTarget ? "ACHIEVED" : "PENDING"]);
    autoTable(doc, { head: [["ID", "Name", "Role", "Score", "Status"]], body: tableRows, startY: 50, headStyles: { fillColor: [0, 43, 73] } });
    doc.save(`QSHE_Full_Report_${date}.pdf`);
  };

  const downloadUserAuditPDF = async (user) => {
    const doc = new jsPDF();
    const qrDataUrl = await QRCode.toDataURL(`QSHE-ID: ${user.id}`);
    doc.setFillColor(0, 43, 73);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("PERSONNEL TRAINING RECORD", 14, 20);
    doc.setFontSize(10);
    doc.text(`EMPLOYEE: ${user.name.toUpperCase()} | ID: ${user.id}`, 14, 30);
    doc.addImage(qrDataUrl, 'PNG', 170, 5, 30, 30);
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
    doc.setFontSize(10);
    doc.text("QSHE TRAINING ID", 42.5, 10, { align: "center" });
    doc.setTextColor(0, 43, 73);
    doc.setFontSize(11);
    doc.text(user.name.toUpperCase(), 10, 25);
    doc.setFontSize(7);
    doc.text(`ID: ${user.id}`, 10, 30);
    const isVerified = (user.total_score || 0) >= complianceTarget;
    doc.setFillColor(isVerified ? 34 : 217, isVerified ? 197 : 119, isVerified ? 94 : 6);
    doc.roundedRect(10, 38, 30, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(isVerified ? "VERIFIED" : "PENDING", 25, 43.5, { align: "center" });
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
            <div className="bg-yellow-400 p-1.5 rounded-lg shadow-inner">
              <ShieldCheck className="text-[#002B49] w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-tight uppercase">QSHE Training Tracker</h1>
              <p className="text-[10px] text-blue-300 uppercase font-bold tracking-widest">Attendance & Performance</p>
            </div>
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
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-[#002B49] text-white shadow-md' : 'text-slate-500'}`}>
              <tab.icon size={18} /> <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'log' && (
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200 max-w-2xl mx-auto">
             <div className="mb-8 text-center">
                <div className="inline-flex bg-blue-50 p-3 rounded-2xl text-blue-600 mb-4"><PlusCircle size={32} /></div>
                <h2 className="text-2xl font-black text-[#002B49]">Log Achievement</h2>
             </div>
             <form onSubmit={handleLogSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee ID</label>
                  <div className="relative">
                    <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold" value={logForm.employeeId} onChange={e => setLogForm({...logForm, employeeId: e.target.value.toUpperCase()})} required />
                    <QrCode className="absolute left-4 top-4 text-slate-400" size={20} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Training Type</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 font-bold" value={logForm.trainingId} onChange={e => setLogForm({...logForm, trainingId: e.target.value})}>
                    {trainings.map(t => <option key={t.id} value={t.id}>{t.name} ({t.points} PTS)</option>)}
                  </select>
                </div>
                <div className="p-5 bg-yellow-50/50 rounded-2xl border-2 border-yellow-100 flex items-center justify-between cursor-pointer" onClick={() => setLogForm({...logForm, isConductor: !logForm.isConductor})}>
                   <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${logForm.isConductor ? 'bg-yellow-400 text-[#002B49]' : 'bg-white text-slate-300'}`}><TrendingUp size={20} /></div>
                      <span className="font-black text-[#002B49] text-sm uppercase">Facilitator Multiplier (2x)</span>
                   </div>
                   <input type="checkbox" checked={logForm.isConductor} readOnly className="w-6 h-6" />
                </div>
                <button className="w-full bg-[#002B49] text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-sm flex items-center justify-center gap-3"><Award size={20} /> Record achievement</button>
             </form>
          </div>
        )}

        {activeTab === 'repo' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 bg-slate-50/50 border-b flex flex-wrap justify-between items-center gap-4">
                <div><h2 className="text-xl font-black text-[#002B49] uppercase">Compliance Audit</h2></div>
                <div className="flex gap-3">
                   <button onClick={downloadPDFReport} className="bg-[#002B49] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Download size={14}/> Export PDF</button>
                </div>
                <div className="relative w-full sm:w-64">
                   <input type="text" placeholder="Search personnel..." className="w-full border rounded-xl py-2.5 px-10 text-xs font-bold" onChange={e => setSearchTerm(e.target.value)} />
                   <Search className="absolute left-3.5 top-3 text-slate-400" size={14} />
                </div>
             </div>
             <table className="w-full text-left">
                <thead className="text-[10px] uppercase font-black text-slate-400 bg-white">
                  <tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-center">Score</th><th className="px-6 py-4 text-right">Records</th></tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4"><div className="font-bold">{user.name}</div><div className="text-[9px] font-bold text-slate-400 uppercase">{user.id} • {user.role}</div></td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black border ${(user.total_score || 0) >= complianceTarget ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                          {(user.total_score || 0) >= complianceTarget ? 'ACHIEVED' : 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-[#002B49] text-lg">{user.total_score || 0}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setSelectedUserHistory(user)} className="p-2 text-blue-600 font-black uppercase text-[10px] flex items-center gap-1 ml-auto"><Clock size={16} /> Audit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
               <h3 className="text-lg font-black text-[#002B49] mb-6 flex items-center gap-2 uppercase"><Users className="text-blue-600" /> Personnel Roster</h3>
               <form onSubmit={saveUser} className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-4 border border-slate-100">
                  <div className="grid grid-cols-2 gap-3">
                    <input className="bg-white border p-2 rounded-lg text-sm font-bold" placeholder="ID" value={userForm.id} onChange={e => setUserForm({...userForm, id: e.target.value.toUpperCase()})} />
                    <select className="bg-white border p-2 rounded-lg text-sm font-bold" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}><option>General Worker</option><option>Supervisor</option><option>Safety Officer</option><option>Engineer</option></select>
                  </div>
                  <input className="w-full bg-white border p-2 rounded-lg text-sm font-bold" placeholder="Full Name" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                  <button className="w-full bg-blue-600 text-white font-black py-2 rounded-lg text-[10px] uppercase">Save Member</button>
               </form>
               <div className="space-y-2 max-h-64 overflow-y-auto">
                 {users.map(u => (
                   <div key={u.id} className="p-3 bg-white border border-slate-100 rounded-xl flex justify-between items-center">
                     <div className="text-xs font-bold">{u.name} <span className="text-[9px] text-slate-400 block">{u.id}</span></div>
                     <button onClick={() => supabase.from('profiles').delete().eq('id', u.id).then(() => fetchCloudData())} className="p-1.5 text-red-600"><Trash2 size={14}/></button>
                   </div>
                 ))}
               </div>
            </div>

            <div className="space-y-6">
               <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-black text-[#002B49] mb-4 flex items-center gap-2 uppercase"><ShieldCheck className="text-yellow-500" /> Site Compliance Policy</h3>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points Required for KPI Achievement</label>
                  <input type="number" className="w-full border rounded-lg py-2 px-3 font-bold mt-1" value={complianceTarget} onChange={e => setComplianceTarget(e.target.value)} />
               </div>

               <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-black text-[#002B49] mb-6 flex items-center gap-2 uppercase"><BookOpen className="text-blue-600" /> Training Catalog</h3>
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl mb-6 text-white">
                     <div className="flex items-center gap-2 mb-3"><Sparkles size={16} className="text-yellow-400" /><span className="text-[10px] font-black uppercase">AI Module Designer</span></div>
                     <div className="flex gap-2">
                        <input className="flex-1 bg-white/10 border rounded-xl py-2 px-3 text-xs text-white font-bold" placeholder="Describe safety issue..." value={aiSuggestionInput} onChange={e => setAiSuggestionInput(e.target.value)} />
                        <button className="bg-yellow-400 text-[#002B49] p-2 rounded-xl" disabled={isAiLoading}><BrainCircuit size={18} /></button>
                     </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {trainings.map(t => (
                      <div key={t.id} className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center text-xs font-bold">{t.name} <span>{t.points} PTS</span></div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'rank' && (
          <div className="space-y-4">
            {users.sort((a,b) => (b.total_score||0) - (a.total_score||0)).map((u, idx) => (
              <div key={u.id} className="bg-white p-4 rounded-3xl border flex items-center justify-between">
                <div className="flex items-center gap-4"><span className="text-slate-300 font-black italic">#{idx+1}</span><span className="text-sm font-bold">{u.name}</span></div>
                <div className="bg-[#002B49] text-white font-black py-1 px-4 rounded-xl text-xs">{u.total_score || 0} PTS</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedUserHistory && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <header className="bg-[#002B49] p-8 text-white relative">
              <button onClick={() => setSelectedUserHistory(null)} className="absolute top-4 right-4 text-white/50"><X size={24} /></button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center text-[#002B49] font-black text-2xl">{selectedUserHistory.name.charAt(0)}</div>
                <div><h2 className="text-2xl font-black">{selectedUserHistory.name}</h2><p className="text-blue-300 text-[10px] font-black uppercase">{selectedUserHistory.id} • {selectedUserHistory.role}</p></div>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Engagement History</h3>
               {logs.filter(l => l.user_id === selectedUserHistory.id).map(log => (
                 <div key={log.id} className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between">
                    <div><p className="text-xs font-black uppercase">{log.training_name}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{log.date} • {log.role}</p></div>
                    <span className="font-black text-blue-700">+{log.points}</span>
                 </div>
               ))}
            </div>
            <div className="p-6 bg-slate-50 border-t flex gap-3">
               <button onClick={() => downloadUserAuditPDF(selectedUserHistory)} className="flex-1 border py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2"><Printer size={16}/> PRINT LOG</button>
               <button onClick={() => downloadIDBadge(selectedUserHistory)} className="flex-1 bg-blue-50 text-blue-700 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2"><IdCard size={16}/> PRINT BADGE</button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl z-[200] font-black text-[10px] uppercase">{notification}</div>
      )}
    </div>
  );
};

export default App;