const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { db } = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { 
  VerifiableCredential, 
  createComprehensiveCredential,
  createEmploymentCredential,
  createEducationCredential
} = require('../utils/credentials');

const router = express.Router();

// Generate credential signature (legacy support)
function generateSignature(credentialData) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(credentialData));
  return hash.digest('hex');
}

// Get all credentials for candidate
router.get('/my-credentials', authenticateToken, authorizeRole('candidate'), (req, res) => {
  const userId = req.user.id;

  db.get('SELECT id FROM candidates WHERE user_id = ?', [userId], (err, candidate) => {
    if (err || !candidate) {
      return res.status(500).json({ error: 'Candidate not found' });
    }

    db.all(`
      SELECT * FROM credentials WHERE candidate_id = ? ORDER BY issued_date DESC
    `, [candidate.id], (err, credentials) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const credentialsWithDetails = credentials.map(cred => ({
        ...cred,
        details: cred.details ? JSON.parse(cred.details) : null
      }));

      res.json(credentialsWithDetails);
    });
  });
});

// Issue credential (system/admin)
router.post('/issue', authenticateToken, (req, res) => {
  const { candidateId, type, title, details, expiryMonths } = req.body;

  if (!candidateId || !type || !title) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const credentialId = uuidv4();
  const verificationUrl = `${req.protocol}://${req.get('host')}/verify/${credentialId}`;
  
  const credentialData = {
    id: credentialId,
    type,
    title,
    details,
    issued: new Date().toISOString()
  };

  const signature = generateSignature(credentialData);

  // Calculate expiry date
  let expiryDate = null;
  if (expiryMonths) {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + expiryMonths);
    expiryDate = expiry.toISOString();
  }

  // Generate QR code
  QRCode.toDataURL(verificationUrl, (err, qrCode) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to generate QR code' });
    }

    db.run(`
      INSERT INTO credentials (id, candidate_id, type, title, details, expiry_date, status, verification_url, qr_code, signature)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `, [credentialId, candidateId, type, title, JSON.stringify(details), expiryDate, verificationUrl, qrCode, signature], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to issue credential' });
      }

      // Create notification for candidate
      db.get('SELECT user_id FROM candidates WHERE id = ?', [candidateId], (err, candidate) => {
        if (candidate && candidate.user_id) {
          const notificationId = uuidv4();
          db.run(`
            INSERT INTO notifications (id, user_id, type, title, message)
            VALUES (?, ?, 'credential_issued', 'New Credential Issued', ?)
          `, [notificationId, candidate.user_id, `Your ${title} credential has been issued and is ready to share.`]);
        }
      });

      res.status(201).json({
        id: credentialId,
        verificationUrl,
        qrCode,
        message: 'Credential issued successfully'
      });
    });
  });
});

// Share credential
router.post('/:id/share', authenticateToken, authorizeRole('candidate'), (req, res) => {
  const credentialId = req.params.id;
  const { sharedWithEmail, expiryDays } = req.body;

  const shareId = uuidv4();
  const shareLink = `${req.protocol}://${req.get('host')}/shared/${shareId}`;

  let expiresDate = null;
  if (expiryDays) {
    const expires = new Date();
    expires.setDate(expires.getDate() + expiryDays);
    expiresDate = expires.toISOString();
  }

  db.run(`
    INSERT INTO credential_shares (id, credential_id, shared_with_email, share_link, expires_date)
    VALUES (?, ?, ?, ?, ?)
  `, [shareId, credentialId, sharedWithEmail, shareLink, expiresDate], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create share link' });
    }

    res.json({
      shareLink,
      expiresDate,
      message: 'Share link created successfully'
    });
  });
});

// Get credential sharing history
router.get('/:id/shares', authenticateToken, authorizeRole('candidate'), (req, res) => {
  const credentialId = req.params.id;

  db.all(`
    SELECT * FROM credential_shares 
    WHERE credential_id = ?
    ORDER BY created_date DESC
  `, [credentialId], (err, shares) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(shares);
  });
});

// Verify credential (public endpoint)
router.get('/verify/:id', (req, res) => {
  const credentialId = req.params.id;

  db.get(`
    SELECT c.*, cand.name as candidate_name
    FROM credentials c
    JOIN candidates cand ON c.candidate_id = cand.id
    WHERE c.id = ?
  `, [credentialId], (err, credential) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!credential) {
      return res.status(404).json({ 
        valid: false,
        error: 'Credential not found' 
      });
    }

    // Check if expired
    const isExpired = credential.expiry_date && new Date(credential.expiry_date) < new Date();
    const isRevoked = credential.status === 'revoked';

    res.json({
      valid: !isExpired && !isRevoked,
      status: isRevoked ? 'revoked' : isExpired ? 'expired' : 'active',
      credential: {
        id: credential.id,
        type: credential.type,
        title: credential.title,
        candidateName: credential.candidate_name,
        details: credential.details ? JSON.parse(credential.details) : null,
        issuedDate: credential.issued_date,
        expiryDate: credential.expiry_date,
        signature: credential.signature
      }
    });
  });
});

// Revoke credential
router.post('/:id/revoke', authenticateToken, (req, res) => {
  const credentialId = req.params.id;
  const { reason } = req.body;

  db.run(`
    UPDATE credentials SET status = 'revoked' WHERE id = ?
  `, [credentialId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    res.json({ message: 'Credential revoked successfully' });
  });
});

// Track share link access (when someone views a shared credential)
router.post('/shared/:shareId/track', (req, res) => {
  const shareId = req.params.shareId;

  db.run(`
    UPDATE credential_shares 
    SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [shareId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to track access' });
    }
    res.json({ message: 'Access tracked' });
  });
});

module.exports = router;
