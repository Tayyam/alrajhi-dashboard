import { Routes, Route, Navigate } from "react-router-dom";
import Timeline from "./pages/Timeline";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { DEFAULT_WORKSHEET_SLUG } from "./lib/worksheets";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${encodeURIComponent(DEFAULT_WORKSHEET_SLUG)}`} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard/:worksheetSlug?" element={<Dashboard />} />
      <Route path="/:worksheetSlug" element={<Timeline />} />
    </Routes>
  );
}
