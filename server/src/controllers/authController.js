/**
 * Sign-in endpoints. The controller only maps the HTTP request to the service and shapes the response;
 * every rule (unique email, password hashing, credential checking) lives in src/services/authService.js.
 */
import { login, register } from '../services/authService.js';

export async function registerAccount(req, res) {
  const { user, token } = await register(req.valid.body);
  res.status(201).json({ user, token });
}

export async function signIn(req, res) {
  const { user, token } = await login(req.valid.body);
  res.json({ user, token });
}

/** Returns the account behind the bearer token; the frontend uses this to restore a session. */
export async function currentAccount(req, res) {
  res.json({ user: req.user });
}
