import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import Timeline from "./pages/Timeline";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { DEFAULT_WORKSHEET_SLUG } from "./lib/worksheets";

function CompanyEntry() {
  const slug = encodeURIComponent(DEFAULT_WORKSHEET_SLUG);

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
            href={`/alrajhi/${slug}`}
            className="rounded-xl border border-gray-200 p-5 hover:border-[#1E4483] hover:shadow-md transition"
          >
            <h2 className="text-lg font-bold text-[#1E4483] mb-1">الراجحي</h2>
            <p className="text-sm text-gray-500">الدخول إلى مسار شركة الراجحي</p>
          </a>

          <a
            href={`/saudia/${slug}`}
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
  const { company } = useParams();
  return <Navigate to={`/${company}/${encodeURIComponent(DEFAULT_WORKSHEET_SLUG)}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CompanyEntry />} />
      <Route path="/login" element={<Login />} />
      <Route path="/:company/dashboard/:worksheetSlug?" element={<Dashboard />} />
      <Route path="/:company" element={<CompanyRedirect />} />
      <Route path="/:company/:worksheetSlug" element={<Timeline />} />
    </Routes>
  );
}
