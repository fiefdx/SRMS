import { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import MenuFilters from '../../components/MenuFilters';
import StatusBadge from '../../components/StatusBadge';
import useMenuFilters from '../../hooks/useMenuFilters';
import { CATEGORIES, DIETARY_TAGS } from '../../data/menuData';
import { formatMoney } from '../../utils/helpers';

const blankDraft = {
  id: null,
  name: '',
  category: 'mains',
  price: '',
  description: '',
  ingredients: '',
  dietary: [],
  available: true,
  popular: false,
  todaySpecial: false,
  emoji: '🍽️',
};

const toDraft = (item) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  price: String(item.price),
  description: item.description,
  ingredients: item.ingredients.join(', '),
  dietary: [...item.dietary],
  available: item.available,
  popular: item.popular,
  todaySpecial: item.todaySpecial,
  emoji: item.emoji,
});

export default function AdminMenu() {
  const { menuItems, saveMenuItem, deleteMenuItem, toggleAvailability, resetMenu, notify } = useApp();
  const [draft, setDraft] = useState(blankDraft);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(false);

  const { filters, setFilter, toggleDietary, resetFilters, results, activeFilterCount } =
    useMenuFilters(menuItems);

  const changeField = (id, value) => {
    setDraft((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => (prev[id] ? { ...prev, [id]: undefined } : prev));
  };

  const toggleDraftDietary = (tag) =>
    setDraft((prev) => ({
      ...prev,
      dietary: prev.dietary.includes(tag)
        ? prev.dietary.filter((t) => t !== tag)
        : [...prev.dietary, tag],
    }));

  const startCreate = () => {
    setDraft(blankDraft);
    setErrors({});
    setEditing(true);
  };

  const startEdit = (item) => {
    setDraft(toDraft(item));
    setErrors({});
    setEditing(true);
  };

  function validate(values) {
    const next = {};
    if (values.name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    const price = Number(values.price);
    if (!Number.isFinite(price) || price <= 0 || price > 200) next.price = 'Price must be a number between 0 and 200.';
    if (values.description.trim().length < 10) next.description = 'Give a description of at least 10 characters.';
    if (values.ingredients.trim().length < 3) next.ingredients = 'List at least one ingredient.';
    return next;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      notify('The menu item was not saved — check the highlighted fields.', 'error');
      return;
    }
    const saved = saveMenuItem(draft);
    notify(`${saved.name} ${draft.id ? 'updated' : 'added'} to the menu.`);
    setEditing(false);
    setDraft(blankDraft);
  };

  const handleDelete = (item) => {
    if (!window.confirm(`Delete "${item.name}" from the menu?`)) return;
    deleteMenuItem(item.id);
    notify(`${item.name} removed from the menu.`, 'info');
  };

  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <MenuFilters
        filters={filters}
        setFilter={setFilter}
        toggleDietary={toggleDietary}
        resetFilters={resetFilters}
        resultCount={results.length}
        totalCount={menuItems.length}
        activeFilterCount={activeFilterCount}
      />

      <div className="btn-row">
        <button className="btn primary" onClick={startCreate}>
          Add menu item
        </button>
        <button className="btn ghost" onClick={() => { resetMenu(); notify('Menu restored to the original dataset.', 'info'); }}>
          Restore original menu
        </button>
      </div>

      {editing && (
        <form className="card form" onSubmit={handleSubmit}>
          <div className="card-heading">
            <h3>{draft.id ? `Edit ${draft.name}` : 'New menu item'}</h3>
            <button className="btn small ghost" type="button" onClick={() => setEditing(false)}>
              Close
            </button>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="item-name">Name *</label>
              <input id="item-name" className="input" value={draft.name} onChange={(e) => changeField('name', e.target.value)} />
              {errors.name && <span className="error">{errors.name}</span>}
            </div>
            <div className="field">
              <label htmlFor="item-category">Category *</label>
              <select id="item-category" className="select" value={draft.category} onChange={(e) => changeField('category', e.target.value)}>
                {CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="item-price">Price (USD) *</label>
              <input id="item-price" className="input" type="number" min="0" step="0.01" value={draft.price} onChange={(e) => changeField('price', e.target.value)} />
              {errors.price && <span className="error">{errors.price}</span>}
            </div>
            <div className="field">
              <label htmlFor="item-emoji">Icon</label>
              <input id="item-emoji" className="input" value={draft.emoji} onChange={(e) => changeField('emoji', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="item-description">Description *</label>
            <textarea id="item-description" className="textarea" value={draft.description} onChange={(e) => changeField('description', e.target.value)} />
            {errors.description && <span className="error">{errors.description}</span>}
          </div>

          <div className="field">
            <label htmlFor="item-ingredients">Ingredients (comma separated) *</label>
            <input id="item-ingredients" className="input" value={draft.ingredients} onChange={(e) => changeField('ingredients', e.target.value)} />
            {errors.ingredients && <span className="error">{errors.ingredients}</span>}
          </div>

          <div className="field">
            <label>Dietary tags</label>
            <div className="checkbox-group">
              {DIETARY_TAGS.map((tag) => (
                <label key={tag.id} className={`checkbox${draft.dietary.includes(tag.id) ? ' checked' : ''}`}>
                  <input type="checkbox" checked={draft.dietary.includes(tag.id)} onChange={() => toggleDraftDietary(tag.id)} />
                  {tag.label}
                </label>
              ))}
            </div>
          </div>

          <div className="checkbox-group">
            <label className={`checkbox${draft.available ? ' checked' : ''}`}>
              <input type="checkbox" checked={draft.available} onChange={(e) => changeField('available', e.target.checked)} />
              Available
            </label>
            <label className={`checkbox${draft.popular ? ' checked' : ''}`}>
              <input type="checkbox" checked={draft.popular} onChange={(e) => changeField('popular', e.target.checked)} />
              Show as popular
            </label>
            <label className={`checkbox${draft.todaySpecial ? ' checked' : ''}`}>
              <input type="checkbox" checked={draft.todaySpecial} onChange={(e) => changeField('todaySpecial', e.target.checked)} />
              Today&apos;s special
            </label>
          </div>

          <div className="btn-row">
            <button className="btn primary" type="submit">
              {draft.id ? 'Save changes' : 'Create item'}
            </button>
            <button className="btn ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="card">
        <div className="card-heading">
          <h3>Menu items ({results.length})</h3>
          <span className="small muted">Availability changes are reflected on the customer menu immediately.</span>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Dietary</th>
                <th className="right">Price</th>
                <th>Available</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.emoji} {item.name}</strong>
                    <div className="small muted">{item.description}</div>
                    <div className="small muted">
                      {item.popular && '★ popular '}
                      {item.todaySpecial && '· today special'}
                    </div>
                  </td>
                  <td>{item.category}</td>
                  <td>
                    <div className="chip-row">
                      {item.dietary.map((tag) => (
                        <span key={tag} className="chip">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="right">{formatMoney(item.price)}</td>
                  <td>
                    {item.available ? <StatusBadge status="approved" label="yes" /> : <StatusBadge status="unavailable" label="no" />}
                    <div style={{ marginTop: 6 }}>
                      <button className="btn small ghost" onClick={() => toggleAvailability(item.id)}>
                        {item.available ? 'Mark unavailable' : 'Mark available'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="btn-row">
                      <button className="btn small" onClick={() => startEdit(item)}>Edit</button>
                      <button className="btn small danger" onClick={() => handleDelete(item)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">No menu item matches the filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
