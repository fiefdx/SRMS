/**
 * Admin endpoints: the dashboard figures and the customer feedback list. Every route is mounted behind
 * authenticate + requireAdmin, so a customer never sees another customer's trading figures.
 */
import { dashboard, feedbackStats, listFeedback, popularItems, reservationStats, revenueSeries, statusBreakdown } from '../services/adminService.js';

export async function readDashboard(req, res) {
  res.json(await dashboard(req.valid.query));
}

export async function readRevenue(req, res) {
  res.json(await revenueSeries(req.valid.query));
}

export async function readPopular(req, res) {
  res.json({ items: await popularItems(req.valid.query) });
}

export async function readStatuses(req, res) {
  res.json({ statuses: await statusBreakdown() });
}

export async function readReservations(req, res) {
  res.json(await reservationStats());
}

export async function readFeedbackStats(req, res) {
  res.json(await feedbackStats());
}

export async function readFeedback(req, res) {
  res.json(await listFeedback(req.valid.query));
}
