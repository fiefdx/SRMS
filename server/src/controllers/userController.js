/**
 * User management endpoints. The controller keeps the HTTP part (which id, whose token, which status
 * code) and delegates every rule to src/services/userService.js.
 */
import { deleteUser, getFavourites, getUser, listUsers, setFavourites, updateUser } from '../services/userService.js';

export async function listAccounts(req, res) {
  res.json(await listUsers(req.valid.query));
}

/** The signed-in account: used by the frontend to restore a profile after a page reload. */
export async function myProfile(req, res) {
  res.json({ user: await getUser(req.user.id) });
}

export async function readProfile(req, res) {
  res.json({ user: await getUser(req.valid.params.userId) });
}

export async function editMyProfile(req, res) {
  res.json({ user: await updateUser(req.user.id, req.valid.body, req.user) });
}

/** Admin route (or the customer editing their own id — see requireSelfOrAdmin on the route). */
export async function editProfile(req, res) {
  res.json({ user: await updateUser(req.valid.params.userId, req.valid.body, req.user) });
}

export async function myFavourites(req, res) {
  res.json({ favourites: await getFavourites(req.user.id) });
}

/** The frontend sends the whole list, so this replaces it instead of patching one entry. */
export async function replaceMyFavourites(req, res) {
  res.json({ favourites: await setFavourites(req.user.id, req.valid.body.itemIds) });
}

export async function removeAccount(req, res) {
  res.json(await deleteUser(req.valid.params.userId, req.user));
}
