/**
 * Dependency free bar chart. Height is a percentage of the maximum value, so the shape stays
 * correct whatever the week looks like. Zero-value days still render a 4px stub.
 */
export default function BarChart({ data, format = (value) => value }) {
  const max = Math.max(1, ...data.map((entry) => entry.value));

  return (
    <div className="bar-chart" role="img" aria-label="Orders per day">
      {data.map((entry) => (
        <div className="bar" key={entry.label}>
          <span className="small">{format(entry.value)}</span>
          <div className="fill" style={{ height: `${(entry.value / max) * 100}%` }} />
          <span className="label">{entry.label}</span>
        </div>
      ))}
    </div>
  );
}
