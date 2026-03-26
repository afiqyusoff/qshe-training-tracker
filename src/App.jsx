import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Award, 
  ClipboardCheck, 
  Search, 
  PlusCircle, 
  Trophy, 
  ShieldCheck,
  QrCode,
  ChevronRight,
  TrendingUp,
  UserPlus,
  Download,
  Printer,
  X,
  Settings,
  Edit2,
  Trash2,
  Clock,
  BookOpen,
  Calendar,
  AlertCircle,
  Sparkles,
  Loader2,
  BrainCircuit,
  FileSpreadsheet,
  IdCard
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Note the 'autoTable' name here
import QRCode from 'qrcode';
import { supabase } from './supabaseClient';

// --- INITIAL DATA ---
const INITIAL_USERS = [
  { id: 'G-1001', name: 'Ahmad bin Zulkifli', role: 'Site Supervisor', attended: 2, conducted: 1, totalScore: 40 },
  { id: 'G-1002', name: 'Chen Wei Ming', role: 'Structural Engineer', attended: 1, conducted: 2, totalScore: 70 },
  { id: 'G-1003', name: 'S. Rajendran', role: 'Safety Officer', attended: 2, conducted: 3, totalScore: 110 },
];

const INITIAL_TRAININGS = [
  { id: 't1', name: 'Toolbox Talk', points: 10 },
  { id: 't2', name: 'Working at Heights', points: 30 },
  { id: 't3', name: 'BIM Awareness', points: 20 },
];

const INITIAL_LOGS = [
  { id: 1, userId: 'G-1003', trainingName: 'Toolbox Talk', points: 20, role: 'CONDUCTOR', date: '2023-10-24' },
  { id: 2, userId: 'G-1003', trainingName: 'Working at Heights', points: 60, role: 'CONDUCTOR', date: '2023-10-25' },
  { id: 3, userId: 'G-1003', trainingName: 'BIM Awareness', points: 20, role: 'ATTENDEE', date: '2023-10-26' },
  { id: 4, userId: 'G-1003', trainingName: 'Toolbox Talk', points: 10, role: 'ATTENDEE', date: '2023-10-27' },
];

// --- GEMINI API UTILITY ---
const apiKey = ""; // Environment handles this

async function callGemini(prompt, isJson = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: isJson ? { responseMimeType: "application/json" } : {}
  };

  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('API Error');
      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (err) {
      if (i === 4) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}

const App = () => {
  const [activeTab, setActiveTab] = useState('log');
  // --- UPGRADED DATA STORAGE (LOCALSTORAGE) ---
  
  // 1. Initialize Users (Checks if you have saved data, otherwise uses Initial list)
  const [users, setUsers] = useState([]);

  // 2. Initialize Trainings
  const [trainings, setTrainings] = useState(() => {
    const saved = localStorage.getItem('gamuda_trainings');
    return saved ? JSON.parse(saved) : INITIAL_TRAININGS;
  });

  // 3. Initialize Logs
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('gamuda_logs');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  // 1. Load data from Cloud on Startup
    useEffect(() => {
      const fetchProfiles = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('name', { ascending: true });

        if (error) {
          console.error("Error fetching profiles:", error);
        } else if (data && data.length > 0) {
          setUsers(data); // This replaces your local list with the Cloud list
        }
      };

      fetchProfiles();
}, []);

  // --- AUTOMATIC SAVING LOGIC ---
  // This runs every time "users", "trainings", or "logs" change
  useEffect(() => {
    localStorage.setItem('gamuda_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('gamuda_trainings', JSON.stringify(trainings));
  }, [trainings]);

  useEffect(() => {
    localStorage.setItem('gamuda_logs', JSON.stringify(logs));
  }, [logs]);

  // 1. Add the Target Score to State (Checks LocalStorage or defaults to ComplianceTarget)
  const [complianceTarget, setComplianceTarget] = useState(() => {
    const saved = localStorage.getItem('gamuda_target');
    // If no saved value, use a hardcoded default (like 40)
    return saved ? parseInt(saved) : 40; 
  });

// 2. Add the Auto-Save logic for the Target
useEffect(() => {
  localStorage.setItem('gamuda_target', complianceTarget.toString());
}, [complianceTarget]);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [selectedUserHistory, setSelectedUserHistory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // AI Feature States
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiSuggestionInput, setAiSuggestionInput] = useState("");

  // Forms State
  const [logForm, setLogForm] = useState({ employeeId: '', trainingId: INITIAL_TRAININGS[0].id, isConductor: false });
  const [userForm, setUserForm] = useState({ id: '', name: '', role: 'General Worker' });
  const [trainingForm, setTrainingForm] = useState({ name: '', points: 10 });

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // --- AI FEATURE: ANALYSIS ---
  const generateAiAnalysis = async (user) => {
    setIsAiLoading(true);
    setAiAnalysis("");
    const userLogs = logs.filter(l => l.userId === user.id);
    const logSummary = userLogs.map(l => `${l.date}: ${l.trainingName} (${l.role})`).join(', ');
    
    const prompt = `Act as a senior construction project manager. Analyze this employee's training record:
      Name: ${user.name}
      Role: ${user.role}
      Total Points: ${user.totalScore}
      Logs: ${logSummary}
      
      Provide a concise 3-sentence summary of their safety mindset, their leadership potential, and one specific training area they should pursue next to improve site compliance. Use a professional and encouraging tone.`;

    try {
      const result = await callGemini(prompt);
      setAiAnalysis(result);
    } catch (err) {
      showNotification("AI Analysis failed. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- AI FEATURE: MODULE GENERATOR ---
  const generateTrainingModule = async () => {
    if (!aiSuggestionInput) return;
    setIsAiLoading(true);
    
    const prompt = `Act as a construction safety engineer. Based on this site issue: "${aiSuggestionInput}", suggest a new training module.
      Respond ONLY with a JSON object containing:
      {
        "name": "Short Professional Title",
        "points": "A number between 10-50 based on safety criticality"
      }`;

    try {
      const result = await callGemini(prompt, true);
      const data = JSON.parse(result);
      setTrainingForm({ name: data.name, points: data.points });
      setAiSuggestionInput("");
      showNotification("✨ AI suggested a new module!");
    } catch (err) {
      showNotification("AI could not generate module.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- LOGIC: SCORING ---
  const handleLogSubmit = (e) => {
    e.preventDefault();
    const user = users.find(u => u.id === logForm.employeeId.trim());
    const training = trainings.find(t => t.id === logForm.trainingId);
    
    if (!user) return showNotification("Error: Employee ID not found.");
    
    let pointsAwarded = training.points;
    if (logForm.isConductor) pointsAwarded *= 2;

    const newLog = {
      id: Date.now(),
      userId: user.id, // Using 'userId' to match your existing state
      userName: user.name, // <--- ADD THIS: Very important for the PDF search!
      trainingName: training.name,
      points: pointsAwarded,
      role: logForm.isConductor ? 'CONDUCTOR' : 'ATTENDEE',
      date: new Date().toISOString().split('T')[0]
    };
    setLogs([newLog, ...logs]);

    setUsers(users.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          totalScore: u.totalScore + pointsAwarded,
          conducted: u.conducted + (logForm.isConductor ? 1 : 0),
          attended: u.attended + (logForm.isConductor ? 0 : 1)
        };
      }
      return u;
    }));

    showNotification(`Success: ${pointsAwarded} pts for ${user.name}`);
    setLogForm({ ...logForm, employeeId: '' });
  };

  // --- LOGIC: ADMIN CRUD ---
  const saveUser = (e) => {
    e.preventDefault();
    if (editingItem && editingItem.type === 'user') {
      setUsers(users.map(u => u.id === editingItem.data.id ? userForm : u));
      setEditingItem(null);
      showNotification("User profile updated.");
    } else {
      if (users.some(u => u.id === userForm.id)) return showNotification("Error: ID already exists.");
      setUsers([{ ...userForm, attended: 0, conducted: 0, totalScore: 0 }, ...users]);
      showNotification("New member registered.");
    }
    setUserForm({ id: '', name: '', role: 'General Worker' });
  };

  const saveTraining = (e) => {
    e.preventDefault();
    if (editingItem && editingItem.type === 'training') {
      setTrainings(trainings.map(t => t.id === editingItem.data.id ? { ...trainingForm, id: t.id } : t));
      setEditingItem(null);
    } else {
      setTrainings([...trainings, { ...trainingForm, id: `t-${Date.now()}` }]);
    }
    setTrainingForm({ name: '', points: 10 });
    showNotification("Training catalog updated.");
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  //download pdf report
  const downloadPDFReport = () => {
  try {
    console.log("Starting PDF Build...");
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();

    // 1. Header Header
    doc.setFillColor(0, 43, 73); // Gamuda Navy
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("SITE COMPLIANCE REPORT", 14, 22);
    doc.setFontSize(10);
    doc.text(`PROJECT: QSHE TRACKER | GENERATED: ${date}`, 14, 32);

    // 2. Data Table (Using the direct autoTable call)
    const tableColumn = ["ID", "Name", "Role", "Score", "Status"];
    const tableRows = users.map(user => [
      user.id,
      user.name,
      user.role,
      user.totalScore,
      user.totalScore >= complianceTarget ? "ACHIEVED KPI" : "PENDING"
    ]);

    // This is the CRITICAL change:
    autoTable(doc, {
      startY: 50,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [0, 43, 73] },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      theme: 'grid'
    });

    doc.save(`Gamuda_Report_${date}.pdf`);
    console.log("PDF Saved Successfully!");
  } catch (err) {
    console.error("CRITICAL PDF ERROR:", err);
    alert("Check the console for errors. Make sure npm install jspdf-autotable was successful.");
  }
};

  //download pdf specific user
    const downloadUserAuditPDF = async (user) => { // Added 'async'
  try {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    
    // 1. Generate the QR Code (links to their ID)
    // In a real app, this URL would be your website link + user ID
    const qrDataUrl = await QRCode.toDataURL(`QSHE-ID: ${user.id}`);

    // 2. Navy Header
    doc.setFillColor(0, 43, 73);
    doc.rect(0, 0, 210, 45, 'F');
    
    // 3. Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("PERSONNEL TRAINING RECORD", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`EMPLOYEE: ${user.name.toUpperCase()}`, 14, 30);
    doc.text(`ID: ${user.id} | ROLE: ${user.role}`, 14, 35);
    doc.text(`KPI ACHIEVEMENT: ${user.totalScore >= complianceTarget ? 'ACHIEVED' : 'PENDING'}`, 14, 40);

    // 4. INSERT THE QR CODE (Top Right)
    doc.addImage(qrDataUrl, 'PNG', 170, 5, 30, 30);
    doc.setFontSize(7);
    doc.text("SCAN TO VERIFY", 175, 40);

    // 5. Training Table (Same as before)
    const userLogs = logs.filter(log => String(log.userId) === String(user.id));
    autoTable(doc, {
      startY: 50,
      head: [["Date", "Module", "Points"]],
      body: userLogs.map(l => [l.date, l.trainingName, `${l.points} PTS`]),
      headStyles: { fillColor: [0, 43, 73] }
    });

    doc.save(`Audit_${user.id}.pdf`);
  } catch (err) {
    console.error(err);
  }
};

const exportToExcel = () => {
  // 1. Headers
  const headers = ["Date,Employee Name,Employee ID,Training,Points,Role\n"];
  
  // 2. Map through logs with a "Fallback Lookup" for names
  const csvRows = logs.map(log => {
    // If userName is missing in the log, find it in the users list
    let displayName = log.userName;
    
    if (!displayName || displayName === "undefined") {
      const foundUser = users.find(u => String(u.id) === String(log.userId));
      displayName = foundUser ? foundUser.name : "Unknown User";
    }

    // Clean data (removing commas so they don't break the CSV columns)
    const cleanName = displayName.replace(/,/g, "");
    const cleanTraining = log.trainingName.replace(/,/g, "");

    return `${log.date},${cleanName},${log.userId},${cleanTraining},${log.points},${log.role}`;
  }).join("\n");

  // 3. Create and trigger download
  const blob = new Blob([headers + csvRows], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `QSHE_Training_Logs_${new Date().toLocaleDateString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadIDBadge = async (user) => {
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85, 55] // Standard Credit Card Size
    });

    const qrDataUrl = await QRCode.toDataURL(`USER_ID:${user.id}`);

    // 1. Background Design
    doc.setFillColor(0, 43, 73); // Gamuda Navy
    doc.rect(0, 0, 85, 15, 'F'); 
    
    // 2. Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("QSHE", 42.5, 8, { align: "center" });
    doc.setFontSize(6);
    doc.text("Training ID", 42.5, 12, { align: "center" });

    // 3. User Details
    doc.setTextColor(0, 43, 73);
    doc.setFontSize(11);
    doc.text(user.name.toUpperCase(), 10, 25);
    
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(`ID: ${user.id}`, 10, 30);
    doc.text(`ROLE: ${user.role}`, 10, 34);

    // 4. Status Indicator
    const isVerified = user.totalScore >= complianceTarget;
    doc.setFillColor(isVerified ? 34 : 217, isVerified ? 197 : 119, isVerified ? 94 : 6); // Green or Amber
    doc.roundedRect(10, 38, 30, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(isVerified ? "VERIFIED" : "PENDING", 25, 43.5, { align: "center" });

    // 5. The QR Code
    doc.addImage(qrDataUrl, 'PNG', 50, 18, 30, 30);
    
    // 6. Footer Line
    doc.setDrawColor(0, 43, 73);
    doc.setLineWidth(0.5);
    doc.line(0, 52, 85, 52);

    doc.save(`Badge_${user.id}.pdf`);
  } catch (err) {
    console.error("Badge Error:", err);
  }
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
              <h1 className="font-black text-lg leading-tight tracking-tight uppercase">QSHE Training Tracker </h1>
              <p className="text-[10px] text-blue-300 uppercase font-bold tracking-widest">Attendance & Performance</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('admin')} className="p-2 hover:bg-white/10 rounded-lg transition-all text-slate-300 hover:text-white">
              <Settings size={20} />
            </button>
          </div>
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
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setEditingItem(null); }}
              className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-[#002B49] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <tab.icon size={18} />
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* LOG VIEW */}
        {activeTab === 'log' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200 max-w-2xl mx-auto">
              <div className="mb-8 text-center">
                <div className="inline-flex bg-blue-50 p-3 rounded-2xl text-blue-600 mb-4">
                  <PlusCircle size={32} />
                </div>
                <h2 className="text-2xl font-black text-[#002B49]">Log Achievement</h2>
                <p className="text-slate-500 text-sm font-medium">Record site activity and distribute points.</p>
              </div>
              <form onSubmit={handleLogSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee ID</label>
                  <div className="relative">
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500 focus:bg-white outline-none font-bold"
                      value={logForm.employeeId}
                      onChange={(e) => setLogForm({...logForm, employeeId: e.target.value.toUpperCase()})}
                      required
                    />
                    <QrCode className="absolute left-4 top-4 text-slate-400" size={20} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Training Type</label>
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-4 focus:border-blue-500 outline-none font-bold"
                    value={logForm.trainingId}
                    onChange={(e) => setLogForm({...logForm, trainingId: e.target.value})}
                  >
                    {trainings.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.points} PTS)</option>
                    ))}
                  </select>
                </div>
                <div className="p-5 bg-yellow-50/50 rounded-2xl border-2 border-yellow-100 flex items-center justify-between cursor-pointer" onClick={() => setLogForm({...logForm, isConductor: !logForm.isConductor})}>
                   <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${logForm.isConductor ? 'bg-yellow-400 text-[#002B49]' : 'bg-white text-slate-300'}`}>
                        <TrendingUp size={20} />
                      </div>
                      <span className="font-black text-[#002B49] text-sm uppercase">Facilitator Multiplier (2x)</span>
                   </div>
                   <input type="checkbox" checked={logForm.isConductor} readOnly className="w-6 h-6 rounded-lg" />
                </div>
                <button type="submit" className="w-full bg-[#002B49] text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                  <Award size={20} /> Record achievement
                </button>
              </form>
            </div>
          </div>
        )}

        {/* REPOSITORY VIEW */}
        {activeTab === 'repo' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 bg-slate-50/50 border-b">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                  
                  {/* 1. Title Section */}
                  <div>
                    <h2 className="text-xl font-black text-[#002B49] uppercase tracking-tighter">Compliance Audit</h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Real-time personnel verification</p>
                  </div>

                  <div className="flex gap-3">
                  
                  {/* TOTAL WORKFORCE */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center min-w-[80px] shadow-sm">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] text-center leading-tight mb-1">
                      Total<br/>Workforce
                    </p>
                    <h4 className="text-xl font-black text-[#002B49]">{users.length}</h4>
                  </div>

                  {/* KPI ACHIEVED */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center min-w-[80px] shadow-sm">
                    <p className="text-[8px] font-black text-green-500 uppercase tracking-[0.1em] text-center leading-tight mb-1">
                      KPI<br/>Achieved
                    </p>
                    <h4 className="text-xl font-black text-green-600">
                      {users.filter(u => u.totalScore >= complianceTarget).length}
                    </h4>
                  </div>

                  {/* ACTION REQUIRED */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center min-w-[80px] shadow-sm">
                    <p className="text-[8px] font-black text-amber-500 uppercase tracking-[0.1em] text-center leading-tight mb-1">
                      Action<br/>Required
                    </p>
                    <h4 className="text-xl font-black text-amber-600">
                      {users.filter(u => u.totalScore < complianceTarget).length}
                    </h4>
                  </div>
                </div>

                  {/* 2. Tools Section (Buttons + Search) */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    
                    {/* Export PDF */}
                    <button 
                      onClick={downloadPDFReport}
                      className="flex items-center justify-center gap-2 bg-[#002B49] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-900 transition-all shadow-sm group w-full sm:w-auto whitespace-nowrap"
                    >
                      <Download size={14} className="group-hover:scale-110 transition-transform" /> 
                      Export PDF
                    </button>

                    {/* Export Excel */}
                    <button 
                      onClick={exportToExcel}
                      className="flex items-center justify-center gap-2 bg-green-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-800 transition-all shadow-sm group w-full sm:w-auto whitespace-nowrap"
                    >
                      <FileSpreadsheet size={14} className="group-hover:scale-110 transition-transform" /> 
                      Excel (.CSV)
                    </button>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                      <input 
                        type="text"
                        placeholder="Search personnel..."
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 pl-10 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <Search className="absolute left-3.5 top-3 text-slate-400" size={14} />
                    </div>

                  </div>
                </div>
              </div>
              <table className="w-full text-left">
                <thead className="text-[10px] uppercase font-black text-slate-400 bg-white">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">KPI ACHIEVEMENT</th>
                    <th className="px-6 py-4 text-center">Score</th>
                    <th className="px-6 py-4 text-right">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold">{user.name}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">{user.id} • {user.role}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black border ${user.totalScore >= complianceTarget ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                          {user.totalScore >= complianceTarget ? 'ACHIEVED' : 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-[#002B49] text-lg">{user.totalScore}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setSelectedUserHistory(user)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg flex items-center gap-1 ml-auto text-[10px] font-black uppercase tracking-widest">
                          <Clock size={16} /> Audit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADMIN VIEW */}
        {activeTab === 'admin' && (          
          <div className="animate-in fade-in duration-400 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-[#002B49] mb-6 flex items-center gap-2 uppercase tracking-tight">
                <Users className="text-blue-600" /> Personnel Roster
              </h3>
              <form onSubmit={saveUser} className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                   <input className="bg-white border p-2 rounded-lg text-sm font-bold" placeholder="ID (G-100X)" value={userForm.id} onChange={e => setUserForm({...userForm, id: e.target.value.toUpperCase()})} required />
                   <select className="bg-white border p-2 rounded-lg text-sm font-bold" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                      <option>General Worker</option><option>Supervisor</option><option>Safety Officer</option><option>Engineer</option>
                   </select>
                </div>
                <input className="w-full bg-white border p-2 rounded-lg text-sm font-bold" placeholder="Full Name" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required />
                <button type="submit" className="w-full bg-blue-600 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-widest">
                  {editingItem ? 'Update' : 'Add Member'}
                </button>
              </form>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {users.map(u => (
                  <div key={u.id} className="p-3 bg-white border border-slate-100 rounded-xl flex justify-between items-center group">
                    <div className="text-xs font-bold">{u.name} <span className="text-[9px] text-slate-400 block">{u.id}</span></div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setEditingItem({ type: 'user', data: u }); setUserForm(u); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={14}/></button>
                      <button onClick={() => setUsers(users.filter(x => x.id !== u.id))} className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
              
            </div>
             {/* --- SITE POLICY SETTINGS --- */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-6">
              <h3 className="text-lg font-black text-[#002B49] mb-4 flex items-center gap-2 uppercase">
                <ShieldCheck className="text-yellow-500" /> Site Compliance Policy
              </h3>
              
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points Required for "Achieved KPI" Status</label>
                  <input 
                    type="number" 
                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 font-bold mt-1"
                    value={complianceTarget}
                    onChange={(e) => setComplianceTarget(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="text-center px-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Current Goal</p>
                  <p className="text-xl font-black text-blue-600">{complianceTarget} PTS</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 italic">*Changing this instantly updates the status for all workers on-site.</p>
            </div>   
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-[#002B49] mb-6 flex items-center gap-2 uppercase tracking-tight">
                <BookOpen className="text-blue-600" /> Training Catalog
              </h3>
              
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl mb-6 text-white shadow-lg shadow-blue-900/10">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-yellow-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">AI Module Designer</span>
                </div>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl py-2 px-3 text-xs placeholder:text-white/40 focus:bg-white/20 outline-none text-white font-bold"
                    placeholder="Describe a site safety issue..."
                    value={aiSuggestionInput}
                    onChange={e => setAiSuggestionInput(e.target.value)}
                  />
                  <button 
                    onClick={generateTrainingModule}
                    disabled={isAiLoading || !aiSuggestionInput}
                    className="bg-yellow-400 text-[#002B49] p-2 rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-all"
                  >
                    {isAiLoading ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                  </button>
                </div>
                <p className="text-[9px] mt-2 font-bold text-white/50 italic leading-tight">Gemini will design the module name and points ✨</p>
              </div>

              <form onSubmit={saveTraining} className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                   <input className="bg-white border p-2 rounded-lg text-sm font-bold" placeholder="Module Name" value={trainingForm.name} onChange={e => setTrainingForm({...trainingForm, name: e.target.value})} required />
                   <input className="bg-white border p-2 rounded-lg text-sm font-bold" type="number" placeholder="Points" value={trainingForm.points} onChange={e => setTrainingForm({...trainingForm, points: parseInt(e.target.value)})} required />
                </div>
                <button type="submit" className="w-full bg-[#002B49] text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-widest">
                  {editingItem ? 'Save Change' : 'Register Module'}
                </button>
                
              </form>
            </div>
          </div>
        )}
        
        {/* RANKING VIEW */}
        {activeTab === 'rank' && (
           <div className="animate-in fade-in slide-in-from-right-4 duration-400">
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {users.sort((a,b) => b.totalScore - a.totalScore).slice(0, 3).map((u, idx) => (
                <div key={u.id} className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex flex-col items-center text-center">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 font-black text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : 'bg-orange-600'}`}>#{idx + 1}</div>
                  <h3 className="font-black text-xs text-[#002B49] uppercase">{u.name}</h3>
                  <p className="text-3xl font-black text-[#002B49] mt-2">{u.totalScore}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden divide-y divide-slate-50 shadow-sm">
              {users.sort((a,b) => b.totalScore - a.totalScore).map((u, idx) => (
                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4"><span className="text-slate-300 font-black italic">#{idx + 1}</span><span className="text-sm font-bold">{u.name}</span></div>
                  <div className="bg-[#002B49] text-white font-black py-1 px-4 rounded-xl text-xs">{u.totalScore} PTS</div>
                </div>
              ))}
            </div>
           </div>
        )}
      </main>

      {/* AUDIT MODAL WITH AI ANALYSIS */}
      {selectedUserHistory && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            <header className="bg-[#002B49] p-8 text-white relative">
               <button onClick={() => { setSelectedUserHistory(null); setAiAnalysis(""); }} className="absolute top-4 right-4 text-white/50 hover:text-white"><X size={24} /></button>
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center text-[#002B49] font-black text-2xl shadow-xl shadow-yellow-400/20">{selectedUserHistory.name.charAt(0)}</div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{selectedUserHistory.name}</h2>
                    <p className="text-blue-300 text-[10px] font-black uppercase tracking-widest">{selectedUserHistory.id} • {selectedUserHistory.role}</p>
                  </div>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               {/* ✨ AI ANALYSIS SECTION */}
               <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-200 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <div className="flex items-center gap-2">
                      <Sparkles className="text-blue-600" size={16} />
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">✨ AI Performance Review</span>
                    </div>
                    {!aiAnalysis && !isAiLoading && (
                      <button 
                        onClick={() => generateAiAnalysis(selectedUserHistory)}
                        className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-blue-700 transition-all shadow-md shadow-blue-900/10"
                      >
                        Generate Review
                      </button>
                    )}
                  </div>
                  
                  {isAiLoading ? (
                    <div className="flex items-center gap-3 py-4">
                      <Loader2 className="animate-spin text-blue-600" size={20} />
                      <p className="text-[10px] font-bold text-blue-400 uppercase italic">Gemini is analyzing site history...</p>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="animate-in fade-in duration-500">
                      <p className="text-xs text-slate-700 leading-relaxed font-medium mb-3">{aiAnalysis}</p>
                      <div className="text-[8px] font-bold text-blue-400 uppercase text-right">Insight powered by Gemini LLM</div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-bold uppercase italic text-center py-2">Click to generate automated personnel insight</p>
                  )}
                  <div className="absolute -right-6 -bottom-6 text-blue-500/5 rotate-12"><BrainCircuit size={80} /></div>
               </div>

               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Engagement History</h3>
               {logs.filter(l => l.userId === selectedUserHistory.id).map(log => (
                 <div key={log.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-lg ${log.role === 'CONDUCTOR' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                         {log.role === 'CONDUCTOR' ? <TrendingUp size={16}/> : <BookOpen size={16}/>}
                       </div>
                       <div><p className="text-xs font-black text-[#002B49] uppercase">{log.trainingName}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{log.date} • {log.role}</p></div>
                    </div>
                    <span className="font-black text-blue-700 text-sm">+{log.points}</span>
                 </div>
               ))}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
               <button 
                  onClick={() => downloadUserAuditPDF(selectedUserHistory)}
                  className="flex items-center justify-center gap-2 border border-slate-200 py-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all w-full"
                >
                  <Printer size={16} /> PRINT
                </button>
                <button 
                  onClick={() => downloadIDBadge(selectedUserHistory)}
                  className="flex items-center justify-center gap-2 border border-blue-200 bg-blue-50 text-blue-700 py-3 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all w-full"
                >
                  <IdCard size={16} /> PRINT ID BADGE
                </button>
               
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