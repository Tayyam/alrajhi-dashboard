import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import Timeline from "./pages/Timeline";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { DEFAULT_WORKSHEET_SLUG } from "./lib/worksheets";
import { supabase } from "./lib/supabase";

function CompanyEntry() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Helmet>
        <title>اختيار البوابة</title>
        <link rel="icon" href="/logorajhi.webp" />
      </Helmet>
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-8" dir="rtl">
        <h1 className="text-2xl font-bold text-[#1E4483] text-center mb-2">اختر البوابة</h1>
        <p className="text-sm text-gray-500 text-center mb-8">يرجى اختيار الجهة للمتابعة</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="/alrajhi"
            className="rounded-xl border border-gray-200 p-5 hover:border-[#1E4483] hover:shadow-md transition"
          >
            <h2 className="text-lg font-bold text-[#1E4483] mb-1">الراجحي</h2>
            <p className="text-sm text-gray-500">الدخول إلى مسار شركة الراجحي</p>
          </a>

          <a
            href="/saudia"
            className="rounded-xl border border-gray-200 p-5 hover:border-[#1E4483] hover:shadow-md transition"
          >
            <h2 className="text-lg font-bold text-[#1E4483] mb-1">السعودية</h2>
            <p className="text-sm text-gray-500">الدخول إلى مسار شركة السعودية</p>
          </a>
        </div>
      </div>
    </div>
  );
}

function CompanyRedirect() {
  const navigate = useNavigate();
  const { company } = useParams();
  const currentCompany = company || "alrajhi";

  useEffect(() => {
    let cancelled = false;

    async function resolveDefaultWorksheet() {
      let slug = DEFAULT_WORKSHEET_SLUG;
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      let defaultId: string | null = null;

      const { data: worksheets } = await supabase
        .from("worksheets")
        .select("id,slug")
        .eq("company", currentCompany)
        .order("created_at", { ascending: true });

      const list = worksheets ?? [];

      if (uid) {
        const { data: setting } = await supabase
          .from("settings")
          .select("default_worksheet_id")
          .eq("user_id", uid)
          .eq("company", currentCompany)
          .maybeSingle();

        defaultId = setting?.default_worksheet_id ?? null;
      }

      const selected =
        (defaultId ? list.find((w) => w.id === defaultId) : null)
        ?? list.find((w) => w.slug === DEFAULT_WORKSHEET_SLUG)
        ?? list[0]
        ?? null;

      if (selected?.slug) slug = selected.slug;

      if (!cancelled) {
        navigate(`/${currentCompany}/${encodeURIComponent(slug)}`, { replace: true });
      }
    }

    resolveDefaultWorksheet();

    return () => {
      cancelled = true;
    };
  }, [currentCompany, navigate]);

  return null;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CompanyEntry />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/:company/login" element={<Login />} />
      <Route path="/:company/dashboard/:worksheetSlug?" element={<Dashboard />} />
      <Route path="/:company" element={<CompanyRedirect />} />
      <Route path="/:company/:worksheetSlug" element={<Timeline />} />
    </Routes>
  );
}
