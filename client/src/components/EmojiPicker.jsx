import { useMemo, useState } from 'react';
import { MENU_EMOJIS } from '../data/menuData';

const DEFAULT_EMOJI = '🍽️';

/**
 * Food-emoji picker for the admin menu editor: one flat table of icons, so the icon is chosen with a
 * click instead of copy-pasted from another site.
 *
 * Props in / events out — the parent (AdminMenu) owns the draft value.
 */
export default function EmojiPicker({ value, onChange, options = MENU_EMOJIS, label = 'Icon' }) {
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (item) => item.label.toLowerCase().includes(needle) || item.emoji === search.trim(),
    );
  }, [options, search]);

  const selected = options.find((item) => item.emoji === value);

  return (
    <div className="field">
      <label htmlFor="item-emoji-search">
        {label} <span className="small muted">(pick from the {options.length} icons below)</span>
      </label>

      <div className="emoji-picker">
        <div className="emoji-preview">
          <span className="emoji-preview-icon">{value || DEFAULT_EMOJI}</span>
          <span className="small muted">
            Selected: {value || DEFAULT_EMOJI} · {selected ? selected.label : 'custom icon'}
          </span>
        </div>

        <input
          id="item-emoji-search"
          className="input"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter icons: pasta, fish, cake, coffee…"
        />

        {visible.length === 0 ? (
          <p className="small muted">No icon matches “{search}”. Use the custom field below.</p>
        ) : (
          <div className="emoji-grid" role="group" aria-label="Food icons">
            {visible.map((item) => (
              <button
                key={item.emoji}
                type="button"
                className={`emoji-btn${item.emoji === value ? ' selected' : ''}`}
                title={`${item.emoji} ${item.label}`}
                aria-label={item.label}
                aria-pressed={item.emoji === value}
                onClick={() => onChange(item.emoji)}
              >
                <span className="emoji-cell-icon">{item.emoji}</span>
                <span className="emoji-cell-label">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="emoji-custom">
          <input
            className="input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Or type any character/emoji"
            aria-label="Custom icon"
          />
          <button type="button" className="btn small ghost" onClick={() => onChange(DEFAULT_EMOJI)}>
            Use default
          </button>
        </div>
      </div>
    </div>
  );
}
