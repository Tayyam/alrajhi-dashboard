import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, iconUrl, assetUrl, LOGO_KEY, BG_KEY } from "../lib/supabase";
import * as XLSX from "xlsx";

interface NodeRow {
  id: number;
  title: string;
  date: string;
  icon: string;
  progress: number;
}

const P = "#1E4483";
const S = "#B99A57";

const ICON_OPTIONS = [
  "pilgrim", "camping", "approved", "passport", "group", "logistic",
  "home", "accommodation", "airplane", "box", "credit-card", "application",
  "contract", "agreement", "calendar", "people", "folder", "data",
  "checklist", "document", "greater-than-symbol", "less-than-symbol",
];

const emptyForm = { title: "", date: "", icon: "document", progress: 0 };
const emptyAccount = { email: "", password: "", role: "user" as "admin" | "user" };

export default function Dashboard() {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [editNode, setEditNode] = useState<NodeRow | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [showMenu, setShowMenu] = useState(false);

  const [iconList, setIconList] = useState<string[]>(ICON_OPTIONS);
  const [assetTs, setAssetTs] = useState(Date.now());

  const fileRef = useRef<HTMLInputElement>(null);
  const editIconRef = useRef<HTMLInputElement>(null);
  const addIconRef = useRef<HTMLInputElement>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const bgUploadRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
    fetchNodes();
    fetchIcons();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "timeline_nodes" }, (payload) => {
        setNodes((prev) => {
          if (prev.some((n) => n.id === (payload.new as NodeRow).id)) return prev;
          return [...prev, payload.new as NodeRow].sort((a, b) => a.date.localeCompare(b.date));
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "timeline_nodes" }, (payload) => {
        setNodes((prev) => prev.map((n) => n.id === (payload.new as NodeRow).id ? (payload.new as NodeRow) : n));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "timeline_nodes" }, (payload) => {
        setNodes((prev) => prev.filter((n) => n.id !== (payload.old as NodeRow).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!showMenu) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMenu]);

  async function checkAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) navigate("/login", { replace: true });
  }

  async function fetchNodes() {
    setLoading(true);
    const { data, error } = await supabase.from("timeline_nodes").select("*").order("date", { ascending: true });
    if (error) showToast(error.message, "err");
    else if (data) setNodes(data);
    setLoading(false);
  }

  async function fetchIcons() {
    const { data } = await supabase.storage.from("icons").list("", { limit: 200 });
    if (data && data.length > 0) {
      const names = data.filter((f) => f.name.endsWith(".png")).map((f) => f.name.replace(".png", ""));
      if (names.length > 0) setIconList(names);
    }
  }

  function showToast(msg: string, type: "ok" | "err") { setToast({ msg, type }); }

  // ── Icon upload (inside modals) ──

  async function uploadNewIcon(e: ChangeEvent<HTMLInputElement>, setForm: (fn: (f: typeof emptyForm) => typeof emptyForm) => void, oldIcon?: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\s+/g, "-").replace(/\.png$/i, "").toLowerCase();
    setSaving(-1);
    if (oldIcon && oldIcon !== name) await supabase.storage.from("icons").remove([`${oldIcon}.png`]);
    const { error } = await supabase.storage.from("icons").upload(`${name}.png`, file, { upsert: true, contentType: file.type });
    if (error) showToast("خطأ في رفع الأيقونة: " + error.message, "err");
    else { await fetchIcons(); setForm((prev) => ({ ...prev, icon: name })); showToast(`تم رفع أيقونة ${name}`, "ok"); }
    setSaving(null);
    if (editIconRef.current) editIconRef.current.value = "";
    if (addIconRef.current) addIconRef.current.value = "";
  }

  // ── CRUD ──

  async function handleAdd() {
    if (!addForm.title || !addForm.date) { showToast("يرجى ملء العنوان والتاريخ", "err"); return; }
    setSaving(-1);
    const { error } = await supabase.from("timeline_nodes").insert(addForm);
    if (error) showToast("خطأ: " + error.message, "err");
    else { showToast("تمت الإضافة", "ok"); setShowAdd(false); setAddForm(emptyForm); await fetchNodes(); }
    setSaving(null);
  }

  function openEdit(node: NodeRow) {
    setEditNode(node);
    setEditForm({ title: node.title, date: node.date, icon: node.icon, progress: node.progress });
  }

  async function handleEdit() {
    if (!editNode || !editForm.title || !editForm.date) { showToast("يرجى ملء العنوان والتاريخ", "err"); return; }
    setSaving(editNode.id);
    const { error } = await supabase.from("timeline_nodes").update({ title: editForm.title, date: editForm.date, icon: editForm.icon, progress: Math.max(0, Math.min(100, editForm.progress)) }).eq("id", editNode.id);
    if (error) showToast("خطأ: " + error.message, "err");
    else { setNodes((p) => p.map((n) => n.id === editNode.id ? { ...n, ...editForm, progress: Math.max(0, Math.min(100, editForm.progress)) } : n)); showToast("تم التعديل", "ok"); setEditNode(null); }
    setSaving(null);
  }

  async function handleDelete() {
    if (deleteId === null) return;
    setSaving(deleteId);
    const { error } = await supabase.from("timeline_nodes").delete().eq("id", deleteId);
    if (error) showToast("خطأ: " + error.message, "err");
    else { setNodes((p) => p.filter((n) => n.id !== deleteId)); showToast("تم الحذف", "ok"); }
    setDeleteId(null); setSaving(null);
  }

  async function handleDeleteAll() {
    setSaving(-1);
    const { error } = await supabase.from("timeline_nodes").delete().gte("id", 0);
    if (error) showToast("خطأ: " + error.message, "err");
    else { setNodes([]); showToast("تم حذف جميع المهام", "ok"); }
    setShowDeleteAll(false); setSaving(null);
  }

  // ── Account ──

  async function handleAddAccount() {
    if (!accountForm.email || !accountForm.password) { showToast("يرجى ملء البريد وكلمة المرور", "err"); return; }
    if (accountForm.password.length < 6) { showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "err"); return; }
    setSaving(-1);
    const { data: sessionData } = await supabase.auth.getSession();
    const cur = sessionData.session;
    const { error } = await supabase.auth.signUp({ email: accountForm.email, password: accountForm.password });
    if (error) { showToast("خطأ: " + error.message, "err"); setSaving(null); return; }
    if (accountForm.role === "admin") await supabase.from("profiles").update({ role: "admin" }).eq("email", accountForm.email);
    if (cur) await supabase.auth.setSession({ access_token: cur.access_token, refresh_token: cur.refresh_token });
    showToast(`تم إنشاء حساب ${accountForm.email}`, "ok");
    setShowAccount(false); setAccountForm(emptyAccount); setSaving(null);
  }

  // ── Asset upload ──

  async function handleAssetUpload(e: ChangeEvent<HTMLInputElement>, key: string, label: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(-1);
    const { error } = await supabase.storage.from("assets").upload(key, file, { upsert: true, contentType: file.type });
    if (error) showToast(`خطأ: ` + error.message, "err");
    else { setAssetTs(Date.now()); showToast(`تم تحديث ${label}`, "ok"); }
    setSaving(null);
    if (logoUploadRef.current) logoUploadRef.current.value = "";
    if (bgUploadRef.current) bgUploadRef.current.value = "";
  }

  // ── Excel ──

  async function handleBackup() {
    setSaving(-1);
    const d = nodes.map((n) => ({ "العنوان": n.title, "التاريخ": n.date, "الأيقونة": n.icon, "نسبة الإكتمال (%)": n.progress }));
    const ws = XLSX.utils.json_to_sheet(d);
    ws["!cols"] = [{ wch: 45 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "البيانات");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const now = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `backup_${now}.xlsx`;
    const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const { error } = await supabase.storage.from("backups").upload(fileName, new Blob([buf], { type: xlsxMime }), { contentType: xlsxMime });
    if (error) showToast("خطأ: " + error.message, "err");
    else showToast("تم حفظ النسخة الاحتياطية على السيرفر", "ok");
    setSaving(null);
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        if (!rows.length) { showToast("الملف فارغ", "err"); return; }
        setSaving(-1);
        let u = 0, ins = 0;
        for (const row of rows) {
          const title = String(row["العنوان"] ?? row["title"] ?? "");
          const date = String(row["التاريخ"] ?? row["date"] ?? "");
          const icon = String(row["الأيقونة"] ?? row["icon"] ?? "document");
          const progress = Math.max(0, Math.min(100, Number(row["نسبة الإكتمال (%)"] ?? row["progress"] ?? 0)));
          if (!title || !date) continue;
          const ex = nodes.find((n) => n.title === title);
          if (ex) { await supabase.from("timeline_nodes").update({ title, date, icon, progress }).eq("id", ex.id); u++; }
          else { await supabase.from("timeline_nodes").insert({ title, date, icon, progress }); ins++; }
        }
        await fetchNodes();
        showToast(`تم: ${u} تحديث، ${ins} إضافة`, "ok");
      } catch { showToast("خطأ في قراءة الملف", "err"); }
      finally { setSaving(null); if (fileRef.current) fileRef.current.value = ""; }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleLogout() { await supabase.auth.signOut(); navigate("/login"); }

  function statusBadge(progress: number, date: string) {
    const past = new Date(date).getTime() <= Date.now();
    if (progress === 100) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">مكتمل</span>;
    if (past && progress > 50) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">تحذير</span>;
    if (past) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">متأخر</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">قادم</span>;
  }

  function nodeFormFields(form: typeof emptyForm, setForm: (f: typeof emptyForm) => void, iconInputRef: React.RefObject<HTMLInputElement | null>, oldIcon?: string) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">العنوان</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm" placeholder="عنوان المهمة" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">التاريخ</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">نسبة الإكتمال</label>
            <input type="number" min={0} max={100} value={form.progress}
              onChange={(e) => setForm({ ...form, progress: Math.max(0, Math.min(100, Number(e.target.value))) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm text-center" dir="ltr" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">الأيقونة</label>
          <div className="flex items-center gap-3">
            <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm">
              {iconList.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <img src={iconUrl(form.icon)} alt="" className="w-8 h-8 rounded-lg bg-gray-100 p-1" />
          </div>
          <label className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition" style={{ background: `${S}22`, color: S }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 6l-4-4m0 0L8 6m4-4v13" /></svg>
            رفع أيقونة جديدة
            <input ref={iconInputRef} type="file" accept="image/png" className="hidden"
              onChange={(e) => uploadNewIcon(e, (fn) => setForm(fn(form)), oldIcon)} />
          </label>
        </div>
      </div>
    );
  }

  const btnP = `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-sm font-semibold transition cursor-pointer`;
  const btnO = `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer border`;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-gray-200" style={{ background: P }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg px-2 py-1 flex items-center cursor-pointer" onClick={() => navigate("/")}>
              <img src={`${assetUrl(LOGO_KEY)}?t=${assetTs}`} alt="Logo" className="h-9 object-contain" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-white">لوحة التحكم</h1>
              <p className="text-xs text-white/60">إدارة الجدول الزمني</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Back to main */}
            <button onClick={() => navigate("/")} className={btnO} style={{ borderColor: "rgba(255,255,255,.25)", color: "white" }}>
              <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              <span className="hidden sm:inline">الصفحة الرئيسية</span>
            </button>

            {/* Add task */}
            <button onClick={() => setShowAdd(true)} className={btnP} style={{ background: S }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              <span className="hidden sm:inline">إضافة مهمة</span>
            </button>

            {/* Backup */}
            <button onClick={handleBackup} className={btnO} style={{ borderColor: "rgba(255,255,255,.25)", color: "white" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" /></svg>
              <span className="hidden sm:inline">نسخ احتياطي</span>
            </button>

            {/* More menu */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)} className={btnO} style={{ borderColor: "rgba(255,255,255,.25)", color: "white" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg>
                <span className="hidden sm:inline">المزيد</span>
              </button>

              {showMenu && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50" dir="rtl">
                  <label className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 6l-4-4m0 0L8 6m4-4v13" /></svg>
                    رفع Excel
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { handleUpload(e); setShowMenu(false); }} />
                  </label>
                  <label className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    تغيير اللوجو
                    <input ref={logoUploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { handleAssetUpload(e, LOGO_KEY, "اللوجو"); setShowMenu(false); }} />
                  </label>
                  <label className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" /></svg>
                    تغيير الخلفية
                    <input ref={bgUploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { handleAssetUpload(e, BG_KEY, "الخلفية"); setShowMenu(false); }} />
                  </label>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { setShowAccount(true); setShowMenu(false); }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 w-full cursor-pointer transition">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                    إضافة حساب
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { setShowDeleteAll(true); setShowMenu(false); }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full cursor-pointer transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    حذف جميع المهام
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { handleLogout(); setShowMenu(false); }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 w-full cursor-pointer transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" /></svg>
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === "ok" ? "text-white" : "bg-red-600 text-white"}`}
          style={toast.type === "ok" ? { background: P } : undefined}>
          {toast.msg}
        </div>
      )}

      {/* Loading overlay */}
      {saving === -1 && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-xl text-center">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${P} transparent ${P} ${P}` }} />
            <p className="text-sm font-semibold text-gray-700">جاري المعالجة...</p>
          </div>
        </div>
      )}

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-5" style={{ color: P }}>إضافة مهمة جديدة</h2>
            {nodeFormFields(addForm, setAddForm, addIconRef)}
            <div className="flex gap-3 mt-6">
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition cursor-pointer" style={{ background: P }}>إضافة</button>
              <button onClick={() => { setShowAdd(false); setAddForm(emptyForm); }} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 transition cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editNode && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditNode(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-5" style={{ color: P }}>تعديل المهمة</h2>
            {nodeFormFields(editForm, setEditForm, editIconRef, editNode.icon)}
            <div className="flex gap-3 mt-6">
              <button onClick={handleEdit} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition cursor-pointer" style={{ background: P }}>حفظ التعديلات</button>
              <button onClick={() => setEditNode(null)} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 transition cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Single ── */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">تأكيد الحذف</h3>
            <p className="text-sm text-gray-500 mb-5">هل أنت متأكد من حذف هذه المهمة؟</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition cursor-pointer">حذف</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 transition cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete All ── */}
      {showDeleteAll && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowDeleteAll(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">حذف جميع المهام</h3>
            <p className="text-sm text-gray-500 mb-5">سيتم حذف جميع المهام ({nodes.length}) نهائياً. ننصح بأخذ نسخة احتياطية أولاً.</p>
            <div className="flex gap-3">
              <button onClick={handleDeleteAll} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition cursor-pointer">حذف الكل</button>
              <button onClick={() => setShowDeleteAll(false)} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 transition cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Account ── */}
      {showAccount && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAccount(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-5" style={{ color: P }}>إضافة حساب جديد</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">البريد الإلكتروني</label>
                <input type="email" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm" placeholder="user@example.com" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">كلمة المرور</label>
                <input type="password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm" placeholder="••••••••" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">الصلاحية</label>
                <select value={accountForm.role} onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value as "admin" | "user" })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm">
                  <option value="user">مستخدم عادي</option>
                  <option value="admin">مدير (Admin)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAddAccount} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition cursor-pointer" style={{ background: P }}>إنشاء الحساب</button>
              <button onClick={() => { setShowAccount(false); setAccountForm(emptyAccount); }} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 transition cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <main className="mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${P} transparent ${P} ${P}` }} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `${P}08` }} className="border-b border-gray-200">
                    <th className="px-4 py-3 text-right font-bold text-gray-600 w-12">#</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-600 w-full">العنوان</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-600 w-32">التاريخ</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-600 w-36">الأيقونة</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-600 w-32">الإكتمال</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-600 w-24">الحالة</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600 w-28">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node, idx) => (
                    <tr key={node.id} className={`border-b border-gray-100 hover:bg-gray-50/50 transition ${saving === node.id ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 whitespace-nowrap"><span className="text-gray-400 font-mono text-xs">{idx + 1}</span></td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{node.title}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" dir="ltr">{node.date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img src={iconUrl(node.icon)} alt={node.icon} className="w-6 h-6" />
                          <span className="text-gray-500 text-xs">{node.icon}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${node.progress}%`, backgroundColor: node.progress === 100 ? "#22c55e" : node.progress > 50 ? S : "#ef4444" }} />
                          </div>
                          <span className="text-xs text-gray-500 font-mono w-8 text-left" dir="ltr">{node.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{statusBadge(node.progress, node.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(node)} className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 transition cursor-pointer" style={{ ["--tw-text-opacity" as string]: 1 }} onMouseEnter={(e) => (e.currentTarget.style.color = P)} onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")} title="تعديل">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => setDeleteId(node.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer" title="حذف">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between" style={{ background: `${P}05` }}>
              <span>إجمالي: <b>{nodes.length}</b> مهمة</span>
              <span style={{ color: S }}>اضغط على زر التعديل لتحرير المهمة</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
