import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase, iconUrl, LOGO, BG_KEY, type NodeRow, type WorksheetRow } from "../lib/supabase";
import * as XLSX from "xlsx";
import { decodeWorksheetSlug, DEFAULT_WORKSHEET_SLUG, makeWorksheetSlug } from "../lib/worksheets";

const P = "#1E4483";
const S = "#B99A57";
const emptyForm = { title: "", date: "", icon: "document", progress: 0 };
const emptyAccount = { email: "", password: "", role: "user" as "admin" | "user" };
const emptyWorksheetForm = { name: "", label: "", country: "" };
const emptyWorksheetRenameForm = { name: "", label: "", country: "" };
const emptyWorksheetDuplicateForm = { name: "", label: "", country: "" };
const COUNTRY_OPTIONS = ["", "النيجر", "مصر", "باكستان"];

function worksheetLabelText(worksheet?: WorksheetRow | null) {
  if (!worksheet) return "";
  return worksheet.label?.trim() || worksheet.name;
}

function formatDateAr(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ar-SA-u-nu-latn", { calendar: "islamic-umalqura", day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildWorkbook(nodes: NodeRow[]) {
  const rows = nodes.map((n) => ({ "العنوان": n.title, "التاريخ": n.date, "الأيقونة": n.icon, "نسبة الإكتمال (%)": n.progress }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 45 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "البيانات");
  return wb;
}

function statusBadge(progress: number, date: string) {
  const past = new Date(date).getTime() <= Date.now();
  if (progress === 100) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">مكتمل</span>;
  if (past && progress > 50) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">تحذير</span>;
  if (past) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">متأخر</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">قادم</span>;
}

function toIsoDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    const yyyy = String(parsed.y).padStart(4, "0");
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const asText = String(value ?? "").trim();
  if (!asText) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(asText)) return asText;

  const d = new Date(asText);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { worksheetSlug } = useParams();
  const resolvedSlug = decodeWorksheetSlug(worksheetSlug || DEFAULT_WORKSHEET_SLUG);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [worksheets, setWorksheets] = useState<WorksheetRow[]>([]);
  const [currentWorksheet, setCurrentWorksheet] = useState<WorksheetRow | null>(null);
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
  const [showWorksheetCreate, setShowWorksheetCreate] = useState(false);
  const [showWorksheetRename, setShowWorksheetRename] = useState(false);
  const [showWorksheetDuplicate, setShowWorksheetDuplicate] = useState(false);
  const [showWorksheetDelete, setShowWorksheetDelete] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [worksheetForm, setWorksheetForm] = useState(emptyWorksheetForm);
  const [worksheetRenameForm, setWorksheetRenameForm] = useState(emptyWorksheetRenameForm);
  const [worksheetDuplicateForm, setWorksheetDuplicateForm] = useState(emptyWorksheetDuplicateForm);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const [iconList, setIconList] = useState<string[]>([]);
  const [pendingIcon, setPendingIcon] = useState<{ file: File; setForm: (fn: (f: typeof emptyForm) => typeof emptyForm) => void; oldIcon?: string } | null>(null);
  const [iconName, setIconName] = useState("");

  const editIconRef = useRef<HTMLInputElement>(null);
  const addIconRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
    fetchWorksheets();
    fetchIcons();
  }, [resolvedSlug]);

  useEffect(() => {
    if (!currentWorksheet?.id) return;
    fetchNodes(currentWorksheet.id);

    const ch = supabase
      .channel(`dashboard-rt-${currentWorksheet.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${currentWorksheet.id}` }, ({ new: n }) => {
        setNodes((prev) => prev.some((x) => x.id === (n as NodeRow).id) ? prev : [...prev, n as NodeRow].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${currentWorksheet.id}` }, ({ new: n }) => {
        setNodes((prev) => prev.map((x) => x.id === (n as NodeRow).id ? (n as NodeRow) : x));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${currentWorksheet.id}` }, ({ old: o }) => {
        setNodes((prev) => prev.filter((x) => x.id !== (o as NodeRow).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [currentWorksheet?.id]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMenu]);

  async function checkAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) navigate("/login", { replace: true });
  }

  async function fetchWorksheets() {
    const { data, error } = await supabase.from("worksheets").select("id,name,slug,label,country").order("created_at", { ascending: true });
    if (error) {
      msg(error.message, "err");
      setLoading(false);
      return;
    }
    const list = (data ?? []) as WorksheetRow[];
    setWorksheets(list);
    const selected = list.find((w) => w.slug === resolvedSlug) ?? list.find((w) => w.slug === DEFAULT_WORKSHEET_SLUG) ?? list[0] ?? null;
    setCurrentWorksheet(selected);
    if (selected && selected.slug !== resolvedSlug) {
      navigate(`/dashboard/${encodeURIComponent(selected.slug)}`, { replace: true });
    }
    if (!selected) setLoading(false);
  }

  async function fetchNodes(worksheetId: string) {
    setLoading(true);
    const { data, error } = await supabase.from("timeline_nodes").select("*").eq("worksheet_id", worksheetId).order("date", { ascending: true });
    if (error) msg(error.message, "err"); else if (data) setNodes(data as NodeRow[]);
    setLoading(false);
  }

  async function fetchIcons() {
    const { data } = await supabase.storage.from("icons").list("", { limit: 200 });
    if (data?.length) {
      const names = data.filter((f) => f.name.endsWith(".png")).map((f) => f.name.replace(".png", ""));
      if (names.length) setIconList(names);
    }
  }

  function msg(text: string, type: "ok" | "err") { setToast({ msg: text, type }); }

  function onIconFileSelect(e: ChangeEvent<HTMLInputElement>, setForm: (fn: (f: typeof emptyForm) => typeof emptyForm) => void, oldIcon?: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    const suggested = file.name.replace(/\s+/g, "-").replace(/\.png$/i, "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    setIconName(suggested);
    setPendingIcon({ file, setForm, oldIcon });
    [editIconRef, addIconRef].forEach((r) => { if (r.current) r.current.value = ""; });
  }

  async function confirmIconUpload() {
    if (!pendingIcon) return;
    const name = iconName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) { msg("الاسم يجب أن يبدأ بحرف ويحتوي فقط على أحرف إنجليزية وأرقام وشرطات", "err"); return; }
    const { file, setForm, oldIcon } = pendingIcon;
    setSaving(-1);
    if (oldIcon && oldIcon !== name) await supabase.storage.from("icons").remove([`${oldIcon}.png`]);
    const { error } = await supabase.storage.from("icons").upload(`${name}.png`, file, { upsert: true, contentType: file.type });
    if (error) msg("خطأ: " + error.message, "err");
    else { await fetchIcons(); setForm((prev) => ({ ...prev, icon: name })); msg(`تم رفع أيقونة ${name}`, "ok"); }
    setSaving(null);
    setPendingIcon(null); setIconName("");
  }

  async function handleAdd() {
    if (!currentWorksheet) { msg("الـ Worksheet غير محدد", "err"); return; }
    if (!addForm.title || !addForm.date) { msg("يرجى ملء العنوان والتاريخ", "err"); return; }
    setSaving(-1);
    const { error } = await supabase.from("timeline_nodes").insert({ ...addForm, worksheet_id: currentWorksheet.id });
    if (error) msg("خطأ: " + error.message, "err");
    else { msg("تمت الإضافة", "ok"); setShowAdd(false); setAddForm(emptyForm); await fetchNodes(currentWorksheet.id); }
    setSaving(null);
  }

  async function handleEdit() {
    if (!editNode || !editForm.title || !editForm.date) { msg("يرجى ملء العنوان والتاريخ", "err"); return; }
    setSaving(editNode.id);
    const prog = Math.max(0, Math.min(100, editForm.progress));
    const { error } = await supabase.from("timeline_nodes").update({ title: editForm.title, date: editForm.date, icon: editForm.icon, progress: prog }).eq("id", editNode.id);
    if (error) msg("خطأ: " + error.message, "err");
    else { setNodes((p) => p.map((n) => n.id === editNode.id ? { ...n, ...editForm, progress: prog } : n)); msg("تم التعديل", "ok"); setEditNode(null); }
    setSaving(null);
  }

  async function handleDelete() {
    if (deleteId === null) return;
    setSaving(deleteId);
    const { error } = await supabase.from("timeline_nodes").delete().eq("id", deleteId);
    if (error) msg("خطأ: " + error.message, "err");
    else { setNodes((p) => p.filter((n) => n.id !== deleteId)); msg("تم الحذف", "ok"); }
    setDeleteId(null); setSaving(null);
  }

  async function handleDeleteAll() {
    if (!currentWorksheet) { msg("الـ Worksheet غير محدد", "err"); return; }
    setSaving(-1);
    const { error } = await supabase.from("timeline_nodes").delete().eq("worksheet_id", currentWorksheet.id);
    if (error) msg("خطأ: " + error.message, "err");
    else { setNodes([]); msg("تم حذف جميع المهام", "ok"); }
    setShowDeleteAll(false); setSaving(null);
  }

  async function handleAddAccount() {
    if (!accountForm.email || !accountForm.password) { msg("يرجى ملء البريد وكلمة المرور", "err"); return; }
    if (accountForm.password.length < 6) { msg("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "err"); return; }
    setSaving(-1);
    const { data: sd } = await supabase.auth.getSession();
    const cur = sd.session;
    const { error } = await supabase.auth.signUp({ email: accountForm.email, password: accountForm.password });
    if (error) { msg("خطأ: " + error.message, "err"); setSaving(null); return; }
    if (accountForm.role === "admin") await supabase.from("profiles").update({ role: "admin" }).eq("email", accountForm.email);
    if (cur) await supabase.auth.setSession({ access_token: cur.access_token, refresh_token: cur.refresh_token });
    msg(`تم إنشاء حساب ${accountForm.email}`, "ok");
    setShowAccount(false); setAccountForm(emptyAccount); setSaving(null);
  }

  async function handleAssetUpload(e: ChangeEvent<HTMLInputElement>, key: string, label: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(-1);
    const { error } = await supabase.storage.from("assets").upload(key, file, { upsert: true, contentType: file.type });
    if (error) msg("خطأ: " + error.message, "err");
    else msg(`تم تحديث ${label}`, "ok");
    setSaving(null);
    if (bgRef.current) bgRef.current.value = "";
  }

  async function handleBackup() {
    setSaving(-1);
    const buf = XLSX.write(buildWorkbook(nodes), { type: "array", bookType: "xlsx" });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const { error } = await supabase.storage.from("backups").upload(`backup_${ts}.xlsx`, new Blob([buf], { type: mime }), { contentType: mime });
    if (error) msg("خطأ: " + error.message, "err"); else msg("تم حفظ النسخة الاحتياطية", "ok");
    setSaving(null);
  }

  function handleExport() {
    XLSX.writeFile(buildWorkbook(nodes), "timeline_data.xlsx");
    msg("تم تصدير الملف", "ok");
  }

  function handleDownloadImportTemplate() {
    const rows = [
      {
        "العنوان": "",
        "التاريخ": "",
        "الأيقونة": "document",
        "نسبة الإكتمال (%)": 0,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 45 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "timeline_import_template.xlsx");
  }

  async function handleImport(file: File) {
    if (!currentWorksheet) { msg("الـ Worksheet غير محدد", "err"); return; }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        if (!rows.length) { msg("الملف فارغ", "err"); return; }
        setSaving(-1);
        let u = 0, ins = 0, fail = 0;
        for (const row of rows) {
          const title = String(row["العنوان"] ?? row["title"] ?? "");
          const date = toIsoDate(row["التاريخ"] ?? row["date"]);
          const icon = String(row["الأيقونة"] ?? row["icon"] ?? "document");
          const progress = Math.max(0, Math.min(100, Number(row["نسبة الإكتمال (%)"] ?? row["progress"] ?? 0)));
          if (!title || !date) { fail++; continue; }
          const ex = nodes.find((n) => n.title === title);
          if (ex) {
            const { error } = await supabase.from("timeline_nodes").update({ title, date, icon, progress }).eq("id", ex.id);
            if (error) fail++; else u++;
          } else {
            const { error } = await supabase.from("timeline_nodes").insert({ title, date, icon, progress, worksheet_id: currentWorksheet.id });
            if (error) fail++; else ins++;
          }
        }
        await fetchNodes(currentWorksheet.id);
        if (u === 0 && ins === 0) {
          msg("لم يتم استيراد أي صف. تأكد من الأعمدة وصيغة التاريخ (YYYY-MM-DD).", "err");
        } else if (fail > 0) {
          msg(`تم: ${u} تحديث، ${ins} إضافة، ${fail} صف فشل`, "ok");
        } else {
          msg(`تم: ${u} تحديث، ${ins} إضافة`, "ok");
        }
        setShowImportModal(false);
        setImportFile(null);
      } catch { msg("خطأ في قراءة الملف", "err"); }
      finally { setSaving(null); }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleCreateWorksheet() {
    const name = worksheetForm.name.trim();
    const label = worksheetForm.label.trim();
    if (!name) { msg("يرجى إدخال معرف الرابط", "err"); return; }
    if (!label) { msg("يرجى إدخال التسمية المعروضة", "err"); return; }
    setSaving(-1);
    const slug = makeWorksheetSlug(name);
    const country = worksheetForm.country || null;
    const { data, error } = await supabase
      .from("worksheets")
      .insert({ name, slug, label, country })
      .select("id,name,slug,label,country")
      .single();
    if (error || !data) {
      msg("خطأ: " + (error?.message ?? "تعذر إنشاء Worksheet"), "err");
      setSaving(null);
      return;
    }
    msg("تم إنشاء Worksheet جديد", "ok");
    setShowWorksheetCreate(false);
    setWorksheetForm(emptyWorksheetForm);
    await fetchWorksheets();
    navigate(`/dashboard/${encodeURIComponent(data.slug)}`);
    setSaving(null);
  }

  async function handleRenameWorksheet() {
    if (!currentWorksheet) { msg("الـ Worksheet غير محدد", "err"); return; }
    const name = worksheetRenameForm.name.trim();
    const label = worksheetRenameForm.label.trim();
    if (!name) { msg("يرجى إدخال معرف الرابط", "err"); return; }
    if (!label) { msg("يرجى إدخال التسمية المعروضة", "err"); return; }

    setSaving(-1);
    const slug = makeWorksheetSlug(name);
    const country = worksheetRenameForm.country || null;
    const { data, error } = await supabase
      .from("worksheets")
      .update({ name, slug, label, country })
      .eq("id", currentWorksheet.id)
      .select("id,name,slug,label,country")
      .single();

    if (error || !data) {
      msg("خطأ: " + (error?.message ?? "تعذر تعديل Worksheet"), "err");
      setSaving(null);
      return;
    }

    msg("تم تعديل اسم Worksheet", "ok");
    setShowWorksheetRename(false);
    setWorksheetRenameForm(emptyWorksheetRenameForm);
    await fetchWorksheets();
    navigate(`/dashboard/${encodeURIComponent(data.slug)}`);
    setSaving(null);
  }

  async function handleDuplicateWorksheet() {
    if (!currentWorksheet) { msg("الـ Worksheet غير محدد", "err"); return; }
    const name = worksheetDuplicateForm.name.trim();
    const label = worksheetDuplicateForm.label.trim();
    if (!name) { msg("يرجى إدخال معرف الرابط", "err"); return; }
    if (!label) { msg("يرجى إدخال التسمية المعروضة", "err"); return; }

    setSaving(-1);
    const slug = makeWorksheetSlug(name);
    const country = worksheetDuplicateForm.country || null;

    const { data: created, error: createErr } = await supabase
      .from("worksheets")
      .insert({ name, slug, label, country })
      .select("id,name,slug,label,country")
      .single();

    if (createErr || !created) {
      msg("خطأ: " + (createErr?.message ?? "تعذر إنشاء Worksheet المنسوخ"), "err");
      setSaving(null);
      return;
    }

    const copiedNodes = nodes.map((n) => ({
      title: n.title,
      date: n.date,
      icon: n.icon,
      progress: n.progress,
      worksheet_id: created.id,
    }));

    if (copiedNodes.length > 0) {
      const { error: copyErr } = await supabase.from("timeline_nodes").insert(copiedNodes);
      if (copyErr) {
        msg("تم إنشاء Worksheet لكن فشل نسخ بعض المهام: " + copyErr.message, "err");
      }
    }

    msg("تم نسخ Worksheet بنجاح", "ok");
    setShowWorksheetDuplicate(false);
    setWorksheetDuplicateForm(emptyWorksheetDuplicateForm);
    await fetchWorksheets();
    navigate(`/dashboard/${encodeURIComponent(created.slug)}`);
    setSaving(null);
  }

  async function handleDeleteWorksheet() {
    if (!currentWorksheet) { msg("الـ Worksheet غير محدد", "err"); return; }
    if (worksheets.length <= 1) {
      msg("لا يمكن حذف آخر Worksheet", "err");
      setShowWorksheetDelete(false);
      return;
    }

    setSaving(-1);
    const { error } = await supabase.from("worksheets").delete().eq("id", currentWorksheet.id);
    if (error) {
      msg("خطأ: " + error.message, "err");
      setSaving(null);
      return;
    }

    const remaining = worksheets.filter((w) => w.id !== currentWorksheet.id);
    const next = remaining[0];
    setWorksheets(remaining);
    setCurrentWorksheet(next ?? null);
    setShowWorksheetDelete(false);

    if (next) {
      navigate(`/dashboard/${encodeURIComponent(next.slug)}`, { replace: true });
    }
    msg("تم حذف Worksheet", "ok");
    setSaving(null);
  }

  async function handleLogout() { await supabase.auth.signOut(); navigate("/login"); }

  function formFields(form: typeof emptyForm, setForm: (f: typeof emptyForm) => void, ref: React.RefObject<HTMLInputElement | null>, oldIcon?: string) {
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
            <input ref={ref} type="file" accept="image/png" className="hidden"
              onChange={(e) => onIconFileSelect(e, (fn) => setForm(fn(form)), oldIcon)} />
          </label>
        </div>
      </div>
    );
  }

  const btn = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer";
  const btnOut = `${btn} border`;
  const outStyle = { borderColor: "rgba(255,255,255,.25)", color: "white" };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-gray-200" style={{ background: P }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg px-2 py-1 flex items-center cursor-pointer" onClick={() => navigate(`/${encodeURIComponent(currentWorksheet?.slug ?? DEFAULT_WORKSHEET_SLUG)}`)}>
              <img src={LOGO} alt="Logo" className="h-9 object-contain" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-white">لوحة التحكم</h1>
              <p className="text-xs text-white/60">{currentWorksheet ? `إدارة: ${worksheetLabelText(currentWorksheet)}` : "إدارة الجدول الزمني"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={currentWorksheet?.slug ?? ""}
              onChange={(e) => navigate(`/dashboard/${encodeURIComponent(e.target.value)}`)}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-white text-[#1E4483] outline-none border border-white/30 min-w-52"
            >
              {worksheets.map((w) => <option key={w.id} value={w.slug}>{w.country ? `${worksheetLabelText(w)} (${w.country})` : worksheetLabelText(w)}</option>)}
            </select>
            <button onClick={() => setShowAdd(true)} className={`${btn} text-white`} style={{ background: S }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              <span className="hidden sm:inline">إضافة مهمة</span>
            </button>

            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)} className={btnOut} style={outStyle}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg>
                <span className="hidden sm:inline">المزيد</span>
              </button>
              {showMenu && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50" dir="rtl">
                  <MenuItem icon="M17 8l4 4m0 0l-4 4m4-4H3" label="الصفحة الرئيسية"
                    onClick={() => { navigate(`/${encodeURIComponent(currentWorksheet?.slug ?? DEFAULT_WORKSHEET_SLUG)}`); setShowMenu(false); }} />
                  <hr className="border-gray-100 my-1" />
                  <MenuItem icon="M12 4v16m8-8H4" label="Worksheet جديد"
                    onClick={() => { setShowWorksheetCreate(true); setShowMenu(false); }} />
                  <MenuItem icon="M4 4v5h.582m15.356 2A8.003 8.003 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    label="نسخ Worksheet"
                    onClick={() => {
                      setWorksheetDuplicateForm({
                        name: `${currentWorksheet?.name ?? ""} copy`,
                        label: `${worksheetLabelText(currentWorksheet)} نسخة`,
                        country: currentWorksheet?.country ?? "",
                      });
                      setShowWorksheetDuplicate(true);
                      setShowMenu(false);
                    }} />
                  <MenuItem icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    label="تعديل Worksheet"
                    onClick={() => {
                      setWorksheetRenameForm({
                        name: currentWorksheet?.name ?? "",
                        label: currentWorksheet?.label ?? currentWorksheet?.name ?? "",
                        country: currentWorksheet?.country ?? "",
                      });
                      setShowWorksheetRename(true);
                      setShowMenu(false);
                    }} />
                  <MenuItem icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    label="حذف Worksheet"
                    danger
                    onClick={() => { setShowWorksheetDelete(true); setShowMenu(false); }} />
                  <hr className="border-gray-100 my-1" />
                  <MenuItem icon="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 6l-4-4m0 0L8 6m4-4v13" label="رفع Excel"
                    onClick={() => { setShowImportModal(true); setShowMenu(false); }} />
                  <MenuItem icon="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" label="تصدير Excel"
                    onClick={() => { handleExport(); setShowMenu(false); }} />
                  <MenuItem icon="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" label="نسخ احتياطي"
                    onClick={() => { handleBackup(); setShowMenu(false); }} />
                  <MenuItem icon="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" label="تغيير الخلفية" asLabel
                    input={<input ref={bgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleAssetUpload(e, BG_KEY, "الخلفية"); setShowMenu(false); }} />} />
                  <hr className="border-gray-100 my-1" />
                  <MenuItem icon="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" label="إضافة حساب" onClick={() => { setShowAccount(true); setShowMenu(false); }} />
                  <hr className="border-gray-100 my-1" />
                  <MenuItem icon="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" label="حذف جميع المهام" danger onClick={() => { setShowDeleteAll(true); setShowMenu(false); }} />
                  <hr className="border-gray-100 my-1" />
                  <MenuItem icon="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" label="تسجيل الخروج" muted onClick={() => { handleLogout(); setShowMenu(false); }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white`}
          style={{ background: toast.type === "ok" ? P : "#dc2626" }}>{toast.msg}</div>
      )}

      {saving === -1 && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-xl text-center">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${P} transparent ${P} ${P}` }} />
            <p className="text-sm font-semibold text-gray-700">جاري المعالجة...</p>
          </div>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="إضافة مهمة جديدة">
        {formFields(addForm, setAddForm, addIconRef)}
        <div className="flex gap-3 mt-6">
          <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer" style={{ background: P }}>إضافة</button>
          <button onClick={() => { setShowAdd(false); setAddForm(emptyForm); }} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 cursor-pointer">إلغاء</button>
        </div>
      </Modal>

      <Modal open={!!editNode} onClose={() => setEditNode(null)} title="تعديل المهمة">
        {formFields(editForm, setEditForm, editIconRef, editNode?.icon)}
        <div className="flex gap-3 mt-6">
          <button onClick={handleEdit} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer" style={{ background: P }}>حفظ التعديلات</button>
          <button onClick={() => setEditNode(null)} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 cursor-pointer">إلغاء</button>
        </div>
      </Modal>

      <ConfirmModal open={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="تأكيد الحذف" desc="هل أنت متأكد من حذف هذه المهمة؟" confirmLabel="حذف" />

      <ConfirmModal open={showDeleteAll} onClose={() => setShowDeleteAll(false)} onConfirm={handleDeleteAll}
        title="حذف جميع المهام" desc={`سيتم حذف جميع المهام (${nodes.length}) نهائياً. ننصح بأخذ نسخة احتياطية أولاً.`} confirmLabel="حذف الكل" />

      <ConfirmModal
        open={showWorksheetDelete}
        onClose={() => setShowWorksheetDelete(false)}
        onConfirm={handleDeleteWorksheet}
        title="حذف Worksheet"
        desc={`سيتم حذف "${worksheetLabelText(currentWorksheet)}" مع جميع المهام التابعة له نهائياً.`}
        confirmLabel="حذف Worksheet"
      />

      <Modal open={!!pendingIcon} onClose={() => { setPendingIcon(null); setIconName(""); }} title="تسمية الأيقونة" sm>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">أدخل اسماً واضحاً للأيقونة باللغة الإنجليزية فقط.</p>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
            <p>- استخدم أحرف إنجليزية صغيرة (a-z) وأرقام (0-9) وشرطات (-)</p>
            <p>- يجب أن يبدأ الاسم بحرف إنجليزي</p>
            <p>- أمثلة: <span className="font-mono text-gray-700">calendar</span>, <span className="font-mono text-gray-700">check-list</span>, <span className="font-mono text-gray-700">airplane-2</span></p>
          </div>
          <input value={iconName}
            onChange={(e) => setIconName(e.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm font-mono" dir="ltr"
            placeholder="icon-name" />
          {iconName && !/^[a-z][a-z0-9-]*$/.test(iconName) && (
            <p className="text-xs text-red-500">الاسم غير صالح — يجب أن يبدأ بحرف إنجليزي</p>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={confirmIconUpload}
            disabled={!iconName || !/^[a-z][a-z0-9-]*$/.test(iconName)}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer disabled:opacity-40" style={{ background: P }}>رفع الأيقونة</button>
          <button onClick={() => { setPendingIcon(null); setIconName(""); }} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 cursor-pointer">إلغاء</button>
        </div>
      </Modal>

      <Modal open={showAccount} onClose={() => setShowAccount(false)} title="إضافة حساب جديد" sm>
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
          <button onClick={handleAddAccount} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer" style={{ background: P }}>إنشاء الحساب</button>
          <button onClick={() => { setShowAccount(false); setAccountForm(emptyAccount); }} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 cursor-pointer">إلغاء</button>
        </div>
      </Modal>

      <Modal open={showWorksheetCreate} onClose={() => setShowWorksheetCreate(false)} title="إنشاء Worksheet جديد" sm>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">معرف الرابط</label>
            <input
              type="text"
              value={worksheetForm.name}
              onChange={(e) => setWorksheetForm({ ...worksheetForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm"
              placeholder="مثال: Pilgrimage Affairs 2027"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">التسمية المعروضة</label>
            <input
              type="text"
              value={worksheetForm.label}
              onChange={(e) => setWorksheetForm({ ...worksheetForm, label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm"
              placeholder="مثال: مكاتب شؤون الحج"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الدولة (اختياري)</label>
            <select
              value={worksheetForm.country}
              onChange={(e) => setWorksheetForm({ ...worksheetForm, country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm"
            >
              <option value="">بدون دولة</option>
              {COUNTRY_OPTIONS.filter(Boolean).map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            المعرف يستخدم للرابط، والتسمية المعروضة تظهر داخل الصفحة.
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleCreateWorksheet} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer" style={{ background: P }}>إنشاء</button>
          <button onClick={() => { setShowWorksheetCreate(false); setWorksheetForm(emptyWorksheetForm); }} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 cursor-pointer">إلغاء</button>
        </div>
      </Modal>

      <Modal open={showWorksheetRename} onClose={() => setShowWorksheetRename(false)} title="تعديل اسم Worksheet" sm>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">معرف الرابط</label>
            <input
              type="text"
              value={worksheetRenameForm.name}
              onChange={(e) => setWorksheetRenameForm({ ...worksheetRenameForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm"
              placeholder="أدخل معرف الرابط"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">التسمية المعروضة</label>
            <input
              type="text"
              value={worksheetRenameForm.label}
              onChange={(e) => setWorksheetRenameForm({ ...worksheetRenameForm, label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm"
              placeholder="أدخل التسمية المعروضة"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الدولة (اختياري)</label>
            <select
              value={worksheetRenameForm.country}
              onChange={(e) => setWorksheetRenameForm({ ...worksheetRenameForm, country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm"
            >
              <option value="">بدون دولة</option>
              {COUNTRY_OPTIONS.filter(Boolean).map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            يمكنك تغيير الرابط والتسمية المعروضة بشكل مستقل.
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleRenameWorksheet} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer" style={{ background: P }}>حفظ</button>
          <button onClick={() => { setShowWorksheetRename(false); setWorksheetRenameForm(emptyWorksheetRenameForm); }} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 cursor-pointer">إلغاء</button>
        </div>
      </Modal>

      <Modal open={showWorksheetDuplicate} onClose={() => setShowWorksheetDuplicate(false)} title="نسخ Worksheet" sm>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">معرف الرابط الجديد</label>
            <input
              type="text"
              value={worksheetDuplicateForm.name}
              onChange={(e) => setWorksheetDuplicateForm({ ...worksheetDuplicateForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm"
              placeholder="أدخل معرف الرابط"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">التسمية المعروضة الجديدة</label>
            <input
              type="text"
              value={worksheetDuplicateForm.label}
              onChange={(e) => setWorksheetDuplicateForm({ ...worksheetDuplicateForm, label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm"
              placeholder="أدخل التسمية المعروضة"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">الدولة (اختياري)</label>
            <select
              value={worksheetDuplicateForm.country}
              onChange={(e) => setWorksheetDuplicateForm({ ...worksheetDuplicateForm, country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-[#1E4483] text-sm"
            >
              <option value="">بدون دولة</option>
              {COUNTRY_OPTIONS.filter(Boolean).map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            سيتم نسخ جميع المهام الحالية إلى Worksheet جديد بالبيانات التي تحددها.
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleDuplicateWorksheet} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer" style={{ background: P }}>نسخ</button>
          <button onClick={() => { setShowWorksheetDuplicate(false); setWorksheetDuplicateForm(emptyWorksheetDuplicateForm); }} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 cursor-pointer">إلغاء</button>
        </div>
      </Modal>

      <Modal open={showImportModal} onClose={() => { setShowImportModal(false); setImportFile(null); }} title="رفع ملف Excel" sm>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            ارفع ملف Excel بصيغة الأعمدة المعتمدة، أو قم بتنزيل قالب جاهز.
          </p>
          <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold cursor-pointer hover:bg-gray-200 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 6l-4-4m0 0L8 6m4-4v13" /></svg>
            اختيار ملف Excel
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            {importFile ? `الملف المختار: ${importFile.name}` : "لم يتم اختيار أي ملف بعد"}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => handleDownloadImportTemplate()}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 cursor-pointer"
          >
            تنزيل Template
          </button>
          <button
            onClick={() => { if (importFile) handleImport(importFile); }}
            disabled={!importFile}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm cursor-pointer disabled:opacity-40"
            style={{ background: P }}
          >
            رفع الملف
          </button>
        </div>
      </Modal>

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
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateAr(node.date)}</td>
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
                          <button onClick={() => { setEditNode(node); setEditForm({ title: node.title, date: node.date, icon: node.icon, progress: node.progress }); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1E4483] hover:bg-blue-50 transition cursor-pointer" title="تعديل">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => setDeleteId(node.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer" title="حذف">
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

function Modal({ open, onClose, title, children, sm }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; sm?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${sm ? "max-w-md" : "max-w-lg"} p-6`} dir="rtl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-5" style={{ color: "#1E4483" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ open, onClose, onConfirm, title, desc, confirmLabel }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; desc: string; confirmLabel: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-5">{desc}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition cursor-pointer">{confirmLabel}</button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-300 transition cursor-pointer">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, onClick, asLabel, input, danger, muted }: { icon: string; label: string; onClick?: () => void; asLabel?: boolean; input?: React.ReactNode; danger?: boolean; muted?: boolean }) {
  const cls = `flex items-center gap-2 px-4 py-2.5 text-sm w-full cursor-pointer transition ${danger ? "text-red-600 hover:bg-red-50" : muted ? "text-gray-500 hover:bg-gray-50" : "text-gray-700 hover:bg-gray-50"}`;
  const svg = <svg className={`w-4 h-4 ${danger || muted ? "" : "text-gray-400"}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>;
  if (asLabel) return <label className={cls}>{svg}{label}{input}</label>;
  return <button onClick={onClick} className={cls}>{svg}{label}</button>;
}
