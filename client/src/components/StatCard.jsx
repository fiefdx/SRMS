export default function StatCard({ label, value, hint }) {
  return (
    <div className="card tight">
      <div className="small muted">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="small muted">{hint}</div>}
    </div>
  );
}
