const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get all verifications for employer
router.get('/employer', authenticateToken, authorizeRole('employer'), (req, res) => {
  const userId = req.user.id;

  // Get employer ID
  db.get('SELECT id FROM employers WHERE user_id = ?', [userId], (err, employer) => {
    if (err || !employer) {
      return res.status(500).json({ error: 'Employer not found' });
    }

    db.all(`
      SELECT v.*, c.name as candidate_name, c.email as candidate_email, c.phone as candidate_phone
      FROM verifications v
      JOIN candidates c ON v.candidate_id = c.id
      WHERE v.employer_id = ?
      ORDER BY v.initiated_date DESC
    `, [employer.id], (err, verifications) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(verifications);
    });
  });
});

// Get verification details
router.get('/:id', authenticateToken, (req, res) => {
  const verificationId = req.params.id;

  db.get(`
    SELECT v.*, c.name as candidate_name, c.email as candidate_email, c.phone as candidate_phone,
           e.company_name as employer_name
    FROM verifications v
    JOIN candidates c ON v.candidate_id = c.id
    JOIN employers e ON v.employer_id = e.id
    WHERE v.id = ?
  `, [verificationId], (err, verification) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    // Get verification items
    db.all(`
      SELECT * FROM verification_items WHERE verification_id = ?
    `, [verificationId], (err, items) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      verification.items = items.map(item => ({
        ...item,
        details: item.details ? JSON.parse(item.details) : null
      }));

      res.json(verification);
    });
  });
});

// Create new verification request
router.post('/', authenticateToken, authorizeRole('employer'), (req, res) => {
  const { candidateName, candidateEmail, candidatePhone, position, packageType, specialInstructions } = req.body;
  const userId = req.user.id;

  if (!candidateName || !candidateEmail || !packageType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const packagePrices = {
    'basic': 29,
    'standard': 49,
    'comprehensive': 79
  };

  const price = packagePrices[packageType] || 49;

  // Get employer ID
  db.get('SELECT id FROM employers WHERE user_id = ?', [userId], (err, employer) => {
    if (err || !employer) {
      return res.status(500).json({ error: 'Employer not found' });
    }

    // Check if candidate exists
    db.get('SELECT id FROM candidates WHERE email = ?', [candidateEmail], (err, existingCandidate) => {
      const candidateId = existingCandidate ? existingCandidate.id : uuidv4();
      const verificationId = uuidv4();

      // Create candidate if doesn't exist
      if (!existingCandidate) {
        db.run(`
          INSERT INTO candidates (id, name, email, phone, status)
          VALUES (?, ?, ?, ?, 'invited')
        `, [candidateId, candidateName, candidateEmail, candidatePhone]);
      }

      // Create verification
      db.run(`
        INSERT INTO verifications (id, employer_id, candidate_id, position, package_type, status, price, special_instructions)
        VALUES (?, ?, ?, ?, ?, 'invited', ?, ?)
      `, [verificationId, employer.id, candidateId, position, packageType, price, specialInstructions], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create verification' });
        }

        // Create verification items based on package
        const items = [];
        items.push({ type: 'identity', status: 'pending' });
        items.push({ type: 'education', status: 'pending' });
        items.push({ type: 'employment', status: 'pending' });

        if (packageType === 'standard' || packageType === 'comprehensive') {
          items.push({ type: 'criminal', status: 'pending' });
          items.push({ type: 'reference', status: 'pending' });
        }

        items.forEach(item => {
          const itemId = uuidv4();
          db.run(`
            INSERT INTO verification_items (id, verification_id, type, status)
            VALUES (?, ?, ?, ?)
          `, [itemId, verificationId, item.type, item.status]);
        });

        // Create notification for candidate
        db.get('SELECT user_id FROM candidates WHERE id = ?', [candidateId], (err, candidate) => {
          if (candidate && candidate.user_id) {
            const notificationId = uuidv4();
            db.run(`
              INSERT INTO notifications (id, user_id, type, title, message)
              VALUES (?, ?, 'verification_invited', 'New Background Check Request', ?)
            `, [notificationId, candidate.user_id, `${req.user.name} has requested a background check for the position of ${position}.`]);
          }
        });

        res.status(201).json({
          id: verificationId,
          candidateId,
          message: 'Verification created successfully. Invitation email sent to candidate.'
        });
      });
    });
  });
});

// Update verification status (admin/system)
router.patch('/:id/status', authenticateToken, (req, res) => {
  const verificationId = req.params.id;
  const { status } = req.body;

  db.run(`
    UPDATE verifications SET status = ? WHERE id = ?
  `, [status, verificationId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }
    res.json({ message: 'Status updated successfully' });
  });
});

// Get verifications for candidate
router.get('/candidate/my-verifications', authenticateToken, authorizeRole('candidate'), (req, res) => {
  const userId = req.user.id;

  db.get('SELECT id FROM candidates WHERE user_id = ?', [userId], (err, candidate) => {
    if (err || !candidate) {
      return res.status(500).json({ error: 'Candidate not found' });
    }

    db.all(`
      SELECT v.*, e.company_name as employer_name
      FROM verifications v
      JOIN employers e ON v.employer_id = e.id
      WHERE v.candidate_id = ?
      ORDER BY v.initiated_date DESC
    `, [candidate.id], (err, verifications) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(verifications);
    });
  });
});

// Submit candidate information
router.post('/:id/submit', authenticateToken, authorizeRole('candidate'), (req, res) => {
  const verificationId = req.params.id;
  const { education, employment, references, identityDocument } = req.body;

  db.get('SELECT candidate_id FROM verifications WHERE id = ?', [verificationId], (err, verification) => {
    if (err || !verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    const candidateId = verification.candidate_id;

    // Save education records
    if (education && education.length > 0) {
      education.forEach(edu => {
        const eduId = uuidv4();
        db.run(`
          INSERT INTO education_records (id, candidate_id, institution, degree, field_of_study, start_date, end_date, document_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [eduId, candidateId, edu.institution, edu.degree, edu.fieldOfStudy, edu.startDate, edu.endDate, edu.documentUrl]);
      });
    }

    // Save employment records
    if (employment && employment.length > 0) {
      employment.forEach(emp => {
        const empId = uuidv4();
        db.run(`
          INSERT INTO employment_records (id, candidate_id, company_name, job_title, start_date, end_date, supervisor_name, supervisor_contact, can_contact, document_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [empId, candidateId, emp.companyName, emp.jobTitle, emp.startDate, emp.endDate, emp.supervisorName, emp.supervisorContact, emp.canContact ? 1 : 0, emp.documentUrl]);
      });
    }

    // Save references
    if (references && references.length > 0) {
      references.forEach(ref => {
        const refId = uuidv4();
        db.run(`
          INSERT INTO "references" (id, candidate_id, name, relationship, company, email, phone, preferred_time, language)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [refId, candidateId, ref.name, ref.relationship, ref.company, ref.email, ref.phone, ref.preferredTime, ref.language || 'en']);
      });
    }

    // Update verification status
    db.run(`
      UPDATE verifications SET status = 'in_progress' WHERE id = ?
    `, [verificationId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update verification' });
      }

      // Simulate AI processing - update verification items
      setTimeout(() => {
        db.run(`UPDATE verification_items SET status = 'verifying' WHERE verification_id = ?`, [verificationId]);
      }, 1000);

      res.json({ message: 'Information submitted successfully. Verification in progress.' });
    });
  });
});

// Get dashboard stats for employer
router.get('/employer/stats', authenticateToken, authorizeRole('employer'), (req, res) => {
  const userId = req.user.id;

  db.get('SELECT id FROM employers WHERE user_id = ?', [userId], (err, employer) => {
    if (err || !employer) {
      return res.status(500).json({ error: 'Employer not found' });
    }

    // Get counts
    db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) as invited,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'review_needed' THEN 1 ELSE 0 END) as review_needed
      FROM verifications
      WHERE employer_id = ?
    `, [employer.id], (err, stats) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Calculate average completion time (mock)
      stats.avgCompletionTime = '18 hours';

      res.json(stats);
    });
  });
});

module.exports = router;
