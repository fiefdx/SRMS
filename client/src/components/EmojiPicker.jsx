import { useMemo, useState } from 'react';
import { MENU_EMOJIS } from '../data/menuData';

const DEFAULT_EMOJI = '🍽️';

/**
 * Emoji picker for the admin menu editor: the icon is chosen from a curated food-emoji list, so no
 * copy/paste from another site is needed. A small custom field stays available for anything exotic.
 *
 * Props in / events out — the parent (AdminMenu) owns the draft value.
 */
export default function EmojiPicker({ value, onChange, groups = MENU_EMOJIS, label = 'Icon' }) {
  const [search, setSearch] = useState('');

  const selectedLabel = useMemo(() => {
    for (const group of groups) {
      const hit = group.items.find((item) => item.emoji === value);
      if (hit) return hit.label;
    }
    return 'custom icon';
  }, [groups, value]);

  const visibleGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => item.label.toLowerCase().includes(needle) || item.emoji === search.trim(),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, search]);

  const totalOptions = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="field">
      <label htmlFor="item-emoji">
        {label} <span className="small muted">(choose one — {totalOptions} options)</span>
      </label>

      <div className="emoji-picker">
        <div className="emoji-preview">
          <span className="emoji-preview-icon">{value || DEFAULT_EMOJI}</span>
          <span className="small muted">
            {value || DEFAULT_EMOJI} · {selectedLabel}
          </span>
        </div>

        <input
          id="item-emoji"
          className="input"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter icons: pasta, fish, cake, drink…"
        />

        {visibleGroups.length === 0 ? (
          <p className="small muted">No icon matches “{search}”. Use the custom field below.</p>
        ) : (
          visibleGroups.map((group) => (
            <div key={group.group}>
              <div className="small muted">{group.group}</div>
              <div className="emoji-grid">
                {group.items.map((item) => (
                  <button
                    key={`${group.group}-${item.emoji}`}
                    type="button"
                    className={`emoji-btn${item.emoji === value ? ' selected' : ''}`}
                    title={`${item.emoji} ${item.label}`}
                    aria-label={item.label}
                    aria-pressed={item.emoji === value}
                    onClick={() => onChange(item.emoji)}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
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
