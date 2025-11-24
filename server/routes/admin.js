const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get review queue
router.get('/review-queue', authenticateToken, authorizeRole('admin'), (req, res) => {
  const { status = 'pending' } = req.query;

  db.all(`
    SELECT rq.*, v.position, c.name as candidate_name, e.company_name as employer_name
    FROM review_queue rq
    JOIN verifications v ON rq.verification_id = v.id
    JOIN candidates c ON v.candidate_id = c.id
    JOIN employers e ON v.employer_id = e.id
    WHERE rq.status = ?
    ORDER BY 
      CASE rq.priority
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
      END,
      rq.created_date ASC
  `, [status], (err, items) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(items);
  });
});

// Resolve review item
router.post('/review-queue/:id/resolve', authenticateToken, authorizeRole('admin'), (req, res) => {
  const itemId = req.params.id;
  const { resolution, notes } = req.body;

  db.run(`
    UPDATE review_queue 
    SET status = 'resolved', resolved_date = CURRENT_TIMESTAMP, resolution_notes = ?, assigned_to = ?
    WHERE id = ?
  `, [notes, req.user.id, itemId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Review item not found' });
    }
    res.json({ message: 'Review item resolved successfully' });
  });
});

// Get analytics/dashboard stats
router.get('/analytics', authenticateToken, authorizeRole('admin'), (req, res) => {
  // Total verifications
  db.get('SELECT COUNT(*) as total FROM verifications', (err, totalResult) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Verifications by status
    db.all(`
      SELECT status, COUNT(*) as count
      FROM verifications
      GROUP BY status
    `, (err, statusCounts) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Total employers
      db.get('SELECT COUNT(*) as total FROM employers', (err, employersResult) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Total candidates
        db.get('SELECT COUNT(*) as total FROM candidates', (err, candidatesResult) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Total credentials issued
          db.get('SELECT COUNT(*) as total FROM credentials WHERE status = "active"', (err, credentialsResult) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            // Pending review items
            db.get('SELECT COUNT(*) as total FROM review_queue WHERE status = "pending"', (err, reviewResult) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              // Recent verifications (last 7 days)
              db.all(`
                SELECT DATE(initiated_date) as date, COUNT(*) as count
                FROM verifications
                WHERE initiated_date >= datetime('now', '-7 days')
                GROUP BY DATE(initiated_date)
                ORDER BY date DESC
              `, (err, recentVerifications) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error' });
                }

                res.json({
                  totalVerifications: totalResult.total,
                  totalEmployers: employersResult.total,
                  totalCandidates: candidatesResult.total,
                  activeCredentials: credentialsResult.total,
                  pendingReviews: reviewResult.total,
                  verificationsByStatus: statusCounts,
                  recentVerifications: recentVerifications,
                  avgCompletionTime: '18 hours', // Mock
                  accuracyRate: '92%' // Mock
                });
              });
            });
          });
        });
      });
    });
  });
});

// Get all employers
router.get('/employers', authenticateToken, authorizeRole('admin'), (req, res) => {
  db.all(`
    SELECT e.*, u.email, u.name as contact_name, u.phone
    FROM employers e
    JOIN users u ON e.user_id = u.id
    ORDER BY e.company_name
  `, (err, employers) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(employers);
  });
});

// Get all candidates
router.get('/candidates', authenticateToken, authorizeRole('admin'), (req, res) => {
  db.all(`
    SELECT c.*, u.email as user_email
    FROM candidates c
    LEFT JOIN users u ON c.user_id = u.id
    ORDER BY c.name
  `, (err, candidates) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(candidates);
  });
});

// Update employer status
router.patch('/employers/:id/status', authenticateToken, authorizeRole('admin'), (req, res) => {
  const employerId = req.params.id;
  const { status } = req.body;

  db.run(`
    UPDATE employers SET status = ? WHERE id = ?
  `, [status, employerId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Employer not found' });
    }
    res.json({ message: 'Status updated successfully' });
  });
});

// Manually complete verification (for demo/testing)
router.post('/verifications/:id/complete', authenticateToken, authorizeRole('admin'), (req, res) => {
  const verificationId = req.params.id;

  // Update verification status
  db.run(`
    UPDATE verifications SET status = 'completed', completion_date = CURRENT_TIMESTAMP WHERE id = ?
  `, [verificationId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Update all verification items to verified
    db.run(`
      UPDATE verification_items SET status = 'verified', verified_date = CURRENT_TIMESTAMP WHERE verification_id = ?
    `, [verificationId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Get candidate ID
      db.get('SELECT candidate_id FROM verifications WHERE id = ?', [verificationId], (err, verification) => {
        if (verification) {
          // Issue demo credentials
          const credentialId = uuidv4();
          db.run(`
            INSERT INTO credentials (id, candidate_id, type, title, details, status, verification_url, signature)
            VALUES (?, ?, 'comprehensive', 'Comprehensive Background Check', '{"verified": true}', 'active', '/verify/${credentialId}', 'demo-signature-${credentialId}')
          `, [credentialId, verification.candidate_id]);
        }
      });

      res.json({ message: 'Verification completed successfully' });
    });
  });
});

// Get all notifications
router.get('/notifications', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(`
    SELECT * FROM notifications 
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `, [userId], (err, notifications) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(notifications);
  });
});

// Mark notification as read
router.patch('/notifications/:id/read', authenticateToken, (req, res) => {
  const notificationId = req.params.id;

  db.run(`
    UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?
  `, [notificationId, req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Notification marked as read' });
  });
});

module.exports = router;
