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
const INITIAL_TRAININGS = [
  { id: 't1', name: 'Toolbox Talk', points: 10 },
  { id: 't2', name: 'Working at Heights', points: 30 },
  { id: 't3', name: 'BIM Awareness', points: 20 },
];

const apiKey = ""; // Environment handles this

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

  // --- LOGIC: SCORING ---
  const handleLogSubmit = async (e) => {
    e.preventDefault();
    const user = users.find(u => u.id === logForm.employeeId.trim());
    const training = trainings.find(t => t.id === logForm.trainingId);
    
    if (!user) return showNotification("Error: Employee ID not found.");
    
    let pointsAwarded = training.points;
    if (logForm.isConductor) pointsAwarded *= 2;

    const { error: logError } = await supabase
      .from('logs')
      .insert([{
        user_id: user.id,
        training_name: training.name,
        points: pointsAwarded,
        role: logForm.isConductor ? 'CONDUCTOR' : 'ATTENDEE',
        date: new Date().toISOString().split('T')[0]
      }]);

    if (logError) return showNotification("Failed to save log: " + logError.message);

    const currentScore = Number(user.total_score) || 0;
    const newScore = currentScore + pointsAwarded;

    const { error: userError } = await supabase
      .from('profiles')
      .update({ total_score: newScore })
      .eq('id', user.id);

    if (userError) return showNotification("Failed to update score.");

    await fetchCloudData(); 
    showNotification(`Success: ${pointsAwarded} pts for ${user.name}`);
    setLogForm({ ...logForm, employeeId: '' });
  };

  // --- LOGIC: ADMIN ---
  const saveUser = async (e) => {
    e.preventDefault();
    if (editingItem && editingItem.type === 'user') {
      const { error } = await supabase.from('profiles').update({ name: userForm.name, role: userForm.role }).eq('id', userForm.id);
      if (error) return showNotification("Update failed.");
      setEditingItem(null);
    } else {
      if (users.some(u => u.id === userForm.id)) return showNotification("ID already exists.");
      const { error } = await supabase.from('profiles').insert([{ ...userForm, total_score: 0 }]);
      if (error) return showNotification("Database error.");
    }
    await fetchCloudData();
    setUserForm({ id: '', name: '', role: 'General Worker' });
  };

  // --- PDF & EXCEL Logic (Updated to use total_score) ---
  const downloadPDFReport = () => {
    const doc = new jsPDF();
    const tableRows = users.map(u => [u.id, u.name, u.role, u.total_score || 0, (u.total_score || 0) >= complianceTarget ? "ACHIEVED" : "PENDING"]);
    autoTable(doc, { head: [["ID", "Name", "Role", "Score", "Status"]], body: tableRows });
    doc.save("QSHE_Report.pdf");
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

      <main className="max-w-5xl mx-auto p-4">
        <div className="flex bg-white rounded-2xl shadow-sm mb-6 p-1.5 border border-slate-200 overflow-hidden">
          {['log', 'repo', 'rank', 'admin'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${activeTab === tab ? 'bg-[#002B49] text-white' : 'text-slate-500'}`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'repo' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-xl font-black text-[#002B49] uppercase">Compliance Audit</h2>
                <div className="flex gap-4">
                    <div className="text-center"><p className="text-[8px] font-bold text-slate-400">TOTAL</p><p className="font-black">{users.length}</p></div>
                    <div className="text-center"><p className="text-[8px] font-bold text-green-500">KPI</p><p className="font-black">{users.filter(u => (u.total_score || 0) >= complianceTarget).length}</p></div>
                </div>
             </div>
             <table className="w-full">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                  <tr><th className="px-6 py-4 text-left">Employee</th><th className="px-6 py-4 text-center">Score</th><th className="px-6 py-4 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 font-bold">{user.name}<br/><span className="text-[9px] text-slate-400">{user.id}</span></td>
                      <td className="px-6 py-4 text-center font-black text-lg">{user.total_score || 0}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setSelectedUserHistory(user)} className="text-blue-600 font-black text-[10px] uppercase">Audit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        )}

        {/* LOG VIEW */}
        {activeTab === 'log' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 max-w-xl mx-auto">
             <h2 className="text-2xl font-black text-center mb-6">Log Training</h2>
             <form onSubmit={handleLogSubmit} className="space-y-4">
                <input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" placeholder="EMPLOYEE ID" value={logForm.employeeId} onChange={e => setLogForm({...logForm, employeeId: e.target.value.toUpperCase()})} required />
                <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={logForm.trainingId} onChange={e => setLogForm({...logForm, trainingId: e.target.value})}>
                  {trainings.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="w-full bg-[#002B49] text-white p-4 rounded-2xl font-black uppercase">Save Record</button>
             </form>
          </div>
        )}

        {/* MODAL AUDIT */}
        {selectedUserHistory && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden">
              <div className="bg-[#002B49] p-6 text-white flex justify-between">
                <div><h3 className="text-xl font-black">{selectedUserHistory.name}</h3><p className="text-xs">{selectedUserHistory.id}</p></div>
                <button onClick={() => setSelectedUserHistory(null)}><X /></button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {logs.filter(l => l.user_id === selectedUserHistory.id).map(log => (
                  <div key={log.id} className="flex justify-between border-b py-3">
                    <div><p className="font-bold text-sm uppercase">{log.training_name}</p><p className="text-[9px] text-slate-400">{log.date || 'No Date'}</p></div>
                    <p className="font-black text-blue-600">+{log.points}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full font-black text-[10px] uppercase z-[200]">
          {notification}
        </div>
      )}
    </div>
  );
};

export default App;