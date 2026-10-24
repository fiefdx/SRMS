/**
 * Small presentational component driven by props only.
 * The status text is uppercased by CSS, the class name drives the colour.
 */
export default function StatusBadge({ status, label }) {
  const safe = String(status || 'pending').toLowerCase();
  return <span className={`badge ${safe}`}>{label ?? safe}</span>;
}
