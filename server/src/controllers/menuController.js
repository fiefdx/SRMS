/**
 * Menu endpoints. Reading the menu is public; changing it is admin only (enforced on the routes).
 */
import { createMenuItem, deleteMenuItem, getMenuItem, listMenu, menuFacets, updateMenuItem } from '../services/menuService.js';

export async function browseMenu(req, res) {
  res.json(await listMenu(req.valid.query));
}

export async function facets(req, res) {
  res.json(await menuFacets());
}

export async function readItem(req, res) {
  res.json({ item: await getMenuItem(req.valid.params.itemId) });
}

export async function addItem(req, res) {
  res.status(201).json({ item: await createMenuItem(req.valid.body) });
}

export async function editItem(req, res) {
  res.json({ item: await updateMenuItem(req.valid.params.itemId, req.valid.body) });
}

export async function removeItem(req, res) {
  res.json(await deleteMenuItem(req.valid.params.itemId));
}
