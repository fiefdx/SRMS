/**
 * One field = one component. Every Assignment 1 form (checkout, reservation, sign in, admin menu
 * editor) uses this so labels, error messages and input types stay consistent.
 */
export default function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required = false,
  hint,
  as = 'input',
  options = [],
  rows,
  min,
  max,
  step,
}) {
  const common = {
    id,
    value,
    placeholder,
    required,
    onChange: (event) => onChange(id, event.target.type === 'checkbox' ? event.target.checked : event.target.value),
    'aria-invalid': error ? 'true' : 'false',
  };

  let control;
  if (as === 'textarea') {
    control = <textarea className="textarea" rows={rows ?? 4} {...common} />;
  } else if (as === 'select') {
    control = (
      <select className="select" {...common}>
        {options.map((option) => (
          <option key={option.value ?? option.id} value={option.value ?? option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = <input className="input" type={type} min={min} max={max} step={step} {...common} />;
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {hint && !error && <span className="small muted">{hint}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}
