import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, assetUrl, LOGO, BG_KEY } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
      else setChecking(false);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    navigate("/dashboard");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${assetUrl(BG_KEY)}')` }}>
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4"
      style={{ backgroundImage: `url('${assetUrl(BG_KEY)}')` }}>
      <div className="w-full max-w-md bg-white/95 rounded-2xl shadow-xl p-8 backdrop-blur-sm" dir="rtl">
        <div className="flex justify-center mb-6">
          <img src={LOGO} alt="Logo" className="h-20 object-contain" />
        </div>

        <h1 className="text-2xl font-bold text-center text-[#1E4483] mb-2">تسجيل الدخول</h1>
        <p className="text-sm text-center text-gray-500 mb-8">الجدول الزمني لمهام مكاتب شؤون الحج</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">البريد الإلكتروني</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#1E4483] focus:ring-2 focus:ring-[#1E4483]/20 outline-none transition text-sm"
              placeholder="example@email.com" dir="ltr" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">كلمة المرور</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#1E4483] focus:ring-2 focus:ring-[#1E4483]/20 outline-none transition text-sm"
              placeholder="••••••••" dir="ltr" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-[#1E4483] text-white font-bold text-base hover:bg-[#163366] transition disabled:opacity-60 cursor-pointer">
            {loading ? "جاري التحميل..." : "دخول"}
          </button>
        </form>

        <button onClick={() => navigate("/")}
          className="w-full mt-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 transition cursor-pointer flex items-center justify-center gap-2">
          <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          العودة للصفحة الرئيسية
        </button>
      </div>
    </div>
  );
}
