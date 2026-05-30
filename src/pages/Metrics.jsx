import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Scale,
  Ruler,
  Activity,
  Flame,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";

const API = process.env.REACT_APP_API_URL;

// Convert bodyFatMass (kg) and weight (kg) to body fat percentage.
const bfPct = (entry) => {
  if (!entry) return null;
  const { bodyFatMass, weight } = entry;
  if (!bodyFatMass || !weight) return null;
  return +((bodyFatMass / weight) * 100).toFixed(1);
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const fmtShortDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  weight: "",
  height: "",
  bodyFatMass: "",
  muscleMass: "",
};

const Metrics = () => {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(4);
  const [chartRange, setChartRange] = useState("1M"); // 1M | 3M | 6M | 1Y | ALL

  // Chart line colors — aligned to the brand gradient stops in `index.css`
  // (indigo --accent-from → fuchsia --accent-via → orange --accent-to).
  // Update both these and the CSS variables together if re-theming.
  const CHART_COLORS = {
    bodyFat: "#f97316", // accent-to   (orange-500)
    muscle:  "#cb2d9c", // accent-via  (fuchsia)
    weight:  "#6366f1", // accent-from (indigo-500)
    axisMuted: "#94a3b8",
    axisRight: "#64748b",
  };

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchMetrics = async () => {
    try {
      const res = await axios.get(
        `${API}/api/auth/body-metrics/${user.id}`,
        authHeaders,
      );
      setMetrics(res.data || []);
    } catch (err) {
      console.error("Failed to fetch metrics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // --- DERIVED DATA ---
  const sortedDesc = useMemo(
    () =>
      [...metrics].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [metrics],
  );

  const latest = sortedDesc[0] || null;

  const chartData = useMemo(() => {
    const all = [...metrics]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((m) => ({
        date: fmtShortDate(m.date),
        rawDate: m.date,
        bodyFatPct: bfPct(m),
        muscleMass: m.muscleMass ?? null,
        weight: m.weight ?? null,
      }));

    if (chartRange === "ALL" || all.length === 0) return all;

    const monthsMap = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 };
    const months = monthsMap[chartRange] ?? 3;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return all.filter((d) => new Date(d.rawDate) >= cutoff);
  }, [metrics, chartRange]);

  const showDots = chartData.length <= 30;

  // --- FORM HANDLING ---
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditingId(m._id);
    setForm({
      date: new Date(m.date).toISOString().slice(0, 10),
      weight: m.weight ?? "",
      height: m.height ?? "",
      bodyFatMass: m.bodyFatMass ?? "",
      muscleMass: m.muscleMass ?? "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      date: form.date,
      weight: form.weight === "" ? undefined : Number(form.weight),
      height: form.height === "" ? undefined : Number(form.height),
      bodyFatMass:
        form.bodyFatMass === "" ? undefined : Number(form.bodyFatMass),
      muscleMass:
        form.muscleMass === "" ? undefined : Number(form.muscleMass),
    };

    try {
      if (editingId) {
        await axios.put(
          `${API}/api/auth/body-metrics/${user.id}/${editingId}`,
          payload,
          authHeaders,
        );
      } else {
        await axios.post(
          `${API}/api/auth/body-metrics/${user.id}`,
          payload,
          authHeaders,
        );
      }
      await fetchMetrics();
      closeForm();
    } catch (err) {
      console.error("Failed to save metric", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(
        `${API}/api/auth/body-metrics/${user.id}/${id}`,
        authHeaders,
      );
      await fetchMetrics();
    } catch (err) {
      console.error("Failed to delete metric", err);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // --- RENDER ---
  return (
    <div className="relative min-h-screen px-6 pt-8 pb-32">
      {loading ? (
        <MetricsLoader />
      ) : (
        <>
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 text-slate-500 dark:text-slate-300 active:scale-95 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  Body Metrics
                </h1>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                  Track your progress over time
                </p>
              </div>
            </div>
          </div>
          {/* CURRENT METRICS SUMMARY */}
          <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-[32px] p-6 mb-6 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-5 relative z-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Current
                </p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">
                  {latest ? fmtDate(latest.date) : "No entries yet"}
                </p>
              </div>
              <div className="bg-accent-50 dark:bg-accent-900/30 p-2 rounded-xl text-accent-500 dark:text-accent-400">
                <Activity size={18} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 relative z-10">
              <SummaryStat
                icon={<Scale size={14} />}
                label="Weight"
                value={latest?.weight}
                unit="kg"
              />
              <SummaryStat
                icon={<Ruler size={14} />}
                label="Height"
                value={latest?.height}
                unit="cm"
              />
              <SummaryStat
                icon={<Flame size={14} />}
                label="Body Fat"
                value={bfPct(latest)}
                unit="%"
              />
              <SummaryStat
                icon={<TrendingUp size={14} />}
                label="Muscle Mass"
                value={latest?.muscleMass}
                unit="kg"
              />
            </div>

            <Activity className="absolute -right-6 -bottom-6 w-32 h-32 text-accent-500/10 dark:text-accent-400/10 rotate-12" />
          </div>

          {/* CHART */}
          <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-[32px] p-6 mb-6 shadow-sm border border-white/40 dark:border-white/10">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  Trend
                </h2>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                  Body Fat % · Weight · Muscle (kg)
                </p>
              </div>
            </div>

            {/* Range selector */}
            <div className="flex items-center gap-1 bg-white/30 dark:bg-white/5 backdrop-blur-md p-1 rounded-2xl mb-3">
              {["1M", "3M", "6M", "1Y", "ALL"].map((r) => (
                <button
                  key={r}
                  onClick={() => setChartRange(r)}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    chartRange === r
                      ? "bg-white/70 dark:bg-slate-800/60 backdrop-blur-md text-accent-600 dark:text-accent-400 shadow-sm"
                      : "text-slate-400 dark:text-slate-500 active:scale-95"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="h-64 w-full [&_.recharts-surface]:outline-none [&_.recharts-surface]:focus:outline-none [&_*:focus]:outline-none">
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                      strokeOpacity={0.4}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize: 10,
                        fontWeight: 700,
                        fill: CHART_COLORS.axisMuted,
                      }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={32}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{
                        fontSize: 10,
                        fontWeight: 700,
                        fill: CHART_COLORS.bodyFat,
                      }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      label={{
                        value: "BF %",
                        angle: -90,
                        position: "insideLeft",
                        style: {
                          fontSize: 10,
                          fontWeight: 700,
                          fill: CHART_COLORS.bodyFat,
                        },
                      }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{
                        fontSize: 10,
                        fontWeight: 700,
                        fill: CHART_COLORS.axisRight,
                      }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      label={{
                        value: "kg",
                        angle: 90,
                        position: "insideRight",
                        style: {
                          fontSize: 10,
                          fontWeight: 700,
                          fill: CHART_COLORS.axisRight,
                        },
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.95)",
                        border: "none",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                      labelStyle={{ color: "#94a3b8", fontSize: 10 }}
                      formatter={(value, name) => {
                        if (value == null) return ["—", name];
                        if (name === "Body Fat %") return [`${value}%`, name];
                        if (name === "Muscle Mass")
                          return [`${value} kg`, name];
                        if (name === "Weight") return [`${value} kg`, name];
                        return [value, name];
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                      iconType="circle"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="bodyFatPct"
                      name="Body Fat %"
                      stroke={CHART_COLORS.bodyFat}
                      strokeWidth={3}
                      dot={showDots ? { r: 4, fill: CHART_COLORS.bodyFat } : false}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="muscleMass"
                      name="Muscle Mass"
                      stroke={CHART_COLORS.muscle}
                      strokeWidth={3}
                      dot={showDots ? { r: 4, fill: CHART_COLORS.muscle } : false}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="weight"
                      name="Weight"
                      stroke={CHART_COLORS.weight}
                      strokeWidth={3}
                      dot={showDots ? { r: 4, fill: CHART_COLORS.weight } : false}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs italic px-4 text-center">
                  {metrics.length < 2
                    ? "Log at least 2 entries to see the trend chart"
                    : `Not enough entries in the last ${chartRange}. Try a wider range.`}
                </div>
              )}
            </div>
          </div>

          {/* HISTORY */}
          <div className="flex justify-between items-center mb-4 mt-2">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              History
            </h2>
            <button
              onClick={openAdd}
              className="bg-accent-gradient text-white px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all shadow-sm"
            >
              <Plus size={14} strokeWidth={3} /> New
            </button>
          </div>

          {sortedDesc.length === 0 ? (
            <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl rounded-[32px] p-10 text-center border-2 border-dashed border-white/40 dark:border-white/10">
              <Calendar
                size={32}
                className="mx-auto mb-3 text-slate-300 dark:text-slate-600"
              />
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                No measurements yet
              </p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                Tap "New" to log your first entry
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedDesc.slice(0, visibleCount).map((m) => {
                const pct = bfPct(m);
                return (
                  <div
                    key={m._id}
                    className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-[24px] p-5 shadow-sm border border-white/40 dark:border-white/10"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-accent-50 dark:bg-accent-900/30 p-1.5 rounded-lg text-accent-500 dark:text-accent-400">
                          <Calendar size={12} strokeWidth={2.5} />
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {fmtDate(m.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          className="p-2 rounded-xl bg-white/40 dark:bg-white/5 backdrop-blur-md text-slate-400 dark:text-slate-300 hover:text-accent-500 dark:hover:text-accent-400 active:scale-95 transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(m._id)}
                          className="p-2 rounded-xl bg-red-50/60 dark:bg-red-900/20 backdrop-blur-md text-red-400 dark:text-red-400 hover:text-red-600 active:scale-95 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <HistoryStat label="Weight" value={m.weight} unit="kg" />
                      <HistoryStat label="Height" value={m.height} unit="cm" />
                      <HistoryStat
                        label="Body Fat"
                        value={pct}
                        unit="%"
                        highlight="orange"
                      />
                      <HistoryStat
                        label="Muscle"
                        value={m.muscleMass}
                        unit="kg"
                        highlight="accent"
                      />
                    </div>
                  </div>
                );
              })}

              {visibleCount < sortedDesc.length && (
                <button
                  onClick={() => setVisibleCount((c) => c + 4)}
                  className="w-full py-4 mt-1 rounded-2xl bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl border border-white/40 dark:border-white/10 text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest active:scale-[0.98] transition-all shadow-sm hover:text-accent-500 dark:hover:text-accent-400"
                >
                  Show More ({sortedDesc.length - visibleCount} remaining)
                </button>
              )}

              {visibleCount > 4 && visibleCount >= sortedDesc.length && (
                <button
                  onClick={() => setVisibleCount(4)}
                  className="w-full py-4 mt-1 rounded-2xl bg-white/30 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest active:scale-[0.98] transition-all"
                >
                  Show Less
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ADD/EDIT MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-end justify-center">
          <form
            onSubmit={handleSubmit}
            className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-lg rounded-t-[40px] p-8 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  {editingId ? "Edit Entry" : "New Entry"}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                  Log your body measurements
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white/70 dark:hover:bg-white/20 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <DatePicker
                label="Date"
                value={form.date}
                onChange={(v) => setForm({ ...form, date: v })}
                max={new Date().toISOString().slice(0, 10)}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Weight (kg)"
                  type="number"
                  step="0.1"
                  value={form.weight}
                  onChange={(v) => setForm({ ...form, weight: v })}
                  placeholder="e.g. 75.5"
                />
                <FormField
                  label="Height (cm)"
                  type="number"
                  step="0.1"
                  value={form.height}
                  onChange={(v) => setForm({ ...form, height: v })}
                  placeholder="e.g. 178"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Body Fat (kg)"
                  type="number"
                  step="0.1"
                  value={form.bodyFatMass}
                  onChange={(v) => setForm({ ...form, bodyFatMass: v })}
                  placeholder="e.g. 13.5"
                />
                <FormField
                  label="Muscle (kg)"
                  type="number"
                  step="0.1"
                  value={form.muscleMass}
                  onChange={(v) => setForm({ ...form, muscleMass: v })}
                  placeholder="e.g. 35"
                />
              </div>

              {form.bodyFatMass && form.weight && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40 rounded-2xl p-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-orange-500 dark:text-orange-400 uppercase tracking-widest">
                    Body Fat %
                  </p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-300">
                    {(
                      (Number(form.bodyFatMass) / Number(form.weight)) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 py-4 rounded-2xl bg-white/50 dark:bg-white/10 backdrop-blur-md text-slate-500 dark:text-slate-300 font-bold text-sm uppercase tracking-widest active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-4 rounded-2xl bg-accent-gradient text-white font-bold text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg disabled:opacity-50"
              >
                {submitting ? "Saving..." : editingId ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRM */}
      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => handleDelete(confirmDeleteId)}
        title="Delete this entry?"
        message="This action cannot be undone."
      />
    </div>
  );
};

// --- SUB-COMPONENTS ---
const SummaryStat = ({ icon, label, value, unit }) => (
  <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl p-3">
    <div className="flex items-center gap-1.5 mb-1 text-accent-500 dark:text-accent-400">
      {icon}
      <p className="text-[9px] font-bold uppercase tracking-widest">{label}</p>
    </div>
    <p className="text-2xl font-bold leading-none text-slate-800 dark:text-slate-100">
      {value != null && value !== "" ? value : "—"}
      {value != null && value !== "" && (
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1">
          {unit}
        </span>
      )}
    </p>
  </div>
);

const HistoryStat = ({ label, value, unit, highlight }) => {
  const colorMap = {
    orange: "text-orange-500 dark:text-orange-400",
    accent: "text-accent-500 dark:text-accent-400",
    default: "text-slate-700 dark:text-slate-200",
  };
  const valueColor = colorMap[highlight] || colorMap.default;
  return (
    <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-xl p-2.5 text-center">
      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className={`text-sm font-bold ${valueColor}`}>
        {value != null && value !== "" ? (
          <>
            {value}
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 ml-0.5">
              {unit}
            </span>
          </>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </p>
    </div>
  );
};

const FormField = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  step,
  required,
  max,
  min,
}) => (
  <div>
    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
      {label}
    </label>
    <input
      type={type}
      step={step}
      max={max}
      min={min}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 px-4 py-3 rounded-2xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-accent-500 dark:focus:border-accent-400 transition-colors"
    />
  </div>
);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const toISO = (d) => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
};

const MetricsLoader = () => (
  <div className="flex flex-col items-center justify-center py-24 h-[calc(100vh-80px)]">
    <div className="relative mb-8">
      <div className="absolute inset-0 rounded-full bg-accent-500/20 animate-ping duration-[2000ms]"></div>
      <div className="relative bg-white dark:bg-slate-900 p-8 rounded-full shadow-xl dark:shadow-md border border-accent-100 dark:border-accent-500/30">
        <Scale size={48} className="text-accent-500 animate-pulse" />
      </div>
    </div>
    <div className="w-full max-w-[200px] text-center">
      <h2 className="text-slate-800 dark:text-slate-100 font-bold text-sm uppercase tracking-[0.3em] mb-4">
        Loading Body Metrics
      </h2>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-accent-500 rounded-full animate-progress-loading"></div>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-4 animate-bounce">
        Fetching Your Data...
      </p>
    </div>
  </div>
);

const ITEM_H = 40; // px per wheel row
const WHEEL_H = 200; // px wheel viewport height (5 rows visible)
const SPACER = (WHEEL_H - ITEM_H) / 2; // 80

const WheelColumn = ({ items, value, onChange, format }) => {
  const ref = useRef(null);
  const timer = useRef(null);

  // Sync external value -> scroll position
  useEffect(() => {
    if (!ref.current) return;
    const idx = items.indexOf(value);
    if (idx < 0) return;
    const target = idx * ITEM_H;
    if (Math.abs(ref.current.scrollTop - target) > 1) {
      ref.current.scrollTop = target;
    }
  }, [value, items]);

  const handleScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const target = clamped * ITEM_H;
      if (Math.abs(ref.current.scrollTop - target) > 1) {
        ref.current.scrollTo({ top: target, behavior: "smooth" });
      }
      const newVal = items[clamped];
      if (newVal !== value) onChange(newVal);
    }, 120);
  };

  return (
    <div className="relative flex-1 overflow-hidden" style={{ height: WHEEL_H }}>
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
        style={{
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>{`.wheel-scroll::-webkit-scrollbar{display:none}`}</style>
        <div style={{ height: SPACER }} />
        {items.map((item) => {
          const isSel = item === value;
          return (
            <div
              key={item}
              style={{ height: ITEM_H, scrollSnapAlign: "center" }}
              className={`flex items-center justify-center text-sm font-bold transition-all ${isSel
                  ? "text-slate-900 dark:text-white scale-105"
                  : "text-slate-400 dark:text-slate-500"
                }`}
            >
              {format ? format(item) : item}
            </div>
          );
        })}
        <div style={{ height: SPACER }} />
      </div>

      {/* Center selection band */}
      <div
        className="pointer-events-none absolute left-1 right-1 top-1/2 -translate-y-1/2 rounded-xl border-y border-accent-200 dark:border-accent-500/30 bg-accent-50/40 dark:bg-accent-500/5"
        style={{ height: ITEM_H }}
      />

      {/* Top / bottom fade */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 bg-gradient-to-b from-white dark:from-slate-800 to-transparent"
        style={{ height: SPACER }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white dark:from-slate-800 to-transparent"
        style={{ height: SPACER }}
      />
    </div>
  );
};

const DatePicker = ({ label, value, onChange, max, min }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const maxDate = max ? new Date(max + "T23:59:59") : null;
  const minDate = min ? new Date(min + "T00:00:00") : null;

  const parsed = value ? new Date(value + "T00:00:00") : new Date();
  const [draft, setDraft] = useState({
    y: parsed.getFullYear(),
    m: parsed.getMonth(),
    d: parsed.getDate(),
  });

  // Re-sync when reopening
  useEffect(() => {
    if (!open) return;
    const p = value ? new Date(value + "T00:00:00") : new Date();
    setDraft({ y: p.getFullYear(), m: p.getMonth(), d: p.getDate() });
  }, [open, value]);

  // Click outside to close + commit
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        commit();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  // Build year range
  const currentYear = new Date().getFullYear();
  const minYear = minDate ? minDate.getFullYear() : 1950;
  const maxYear = maxDate ? maxDate.getFullYear() : currentYear + 5;
  const years = useMemo(() => {
    const arr = [];
    for (let y = minYear; y <= maxYear; y++) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  const months = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], []);

  const daysInMonth = new Date(draft.y, draft.m + 1, 0).getDate();
  const days = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [daysInMonth]);

  // Clamp draft day if month/year shrink
  useEffect(() => {
    if (draft.d > daysInMonth) {
      setDraft((s) => ({ ...s, d: daysInMonth }));
    }
  }, [daysInMonth, draft.d]);

  const clampToBounds = (y, m, d) => {
    let dt = new Date(y, m, d);
    if (maxDate && dt > maxDate) dt = new Date(maxDate);
    if (minDate && dt < minDate) dt = new Date(minDate);
    return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() };
  };

  const commit = () => {
    const c = clampToBounds(draft.y, draft.m, draft.d);
    onChange(toISO(new Date(c.y, c.m, c.d)));
  };

  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "Select a date";

  return (
    <div className="relative" ref={ref}>
      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 px-4 py-3 rounded-2xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-accent-500 dark:focus:border-accent-400 transition-colors flex items-center justify-between"
      >
        <span className={value ? "" : "text-slate-400"}>{display}</span>
        <Calendar size={16} className="text-accent-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 p-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Pick a date
            </span>
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                const c = clampToBounds(
                  t.getFullYear(),
                  t.getMonth(),
                  t.getDate(),
                );
                setDraft(c);
              }}
              className="text-[10px] font-bold text-accent-600 dark:text-accent-400 uppercase tracking-widest px-2 py-1 rounded-md hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex gap-1 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl p-1">
            <WheelColumn
              items={days}
              value={draft.d}
              onChange={(d) => setDraft((s) => ({ ...s, d }))}
            />
            <WheelColumn
              items={months}
              value={draft.m}
              onChange={(m) => setDraft((s) => ({ ...s, m }))}
              format={(m) => MONTH_NAMES[m].slice(0, 3)}
            />
            <WheelColumn
              items={years}
              value={draft.y}
              onChange={(y) => setDraft((s) => ({ ...s, y }))}
            />
          </div>

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                commit();
                setOpen(false);
              }}
              className="flex-1 py-2.5 rounded-xl bg-accent-gradient text-white text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-md"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Metrics;
