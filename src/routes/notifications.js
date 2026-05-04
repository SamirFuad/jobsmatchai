const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireAuth } = require('../middleware/auth');

// GET /api/notifications — Get current user's notifications
router.get('/', requireAuth, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id);

    // Parse metadata JSON for each notification
    const result = notifications.map(n => ({
      ...n,
      metadata: n.metadata ? JSON.parse(n.metadata) : null
    }));

    res.json(result);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ detail: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count — Get unread count
router.get('/unread-count', requireAuth, (req, res) => {
  try {
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.user.id);

    res.json({ count: row.count });
  } catch (err) {
    res.status(500).json({ detail: 'Failed to fetch unread count' });
  }
});

// PUT /api/notifications/:id/read — Mark a notification as read
router.put('/:id/read', requireAuth, (req, res) => {
  const notifId = parseInt(req.params.id, 10);

  try {
    const notif = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?')
      .get(notifId, req.user.id);

    if (!notif) return res.status(404).json({ detail: 'Notification not found' });

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notifId);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ detail: 'Failed to update notification' });
  }
});

// PUT /api/notifications/read-all — Mark all notifications as read
router.put('/read-all', requireAuth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ detail: 'Failed to mark notifications as read' });
  }
});

module.exports = router;
