const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    // Get additional info based on role
    if (user.role === 'employer') {
      db.get('SELECT * FROM employers WHERE user_id = ?', [user.id], (err, employer) => {
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            phone: user.phone,
            language: user.language,
            employer: employer
          }
        });
      });
    } else if (user.role === 'candidate') {
      db.get('SELECT * FROM candidates WHERE user_id = ?', [user.id], (err, candidate) => {
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            phone: user.phone,
            language: user.language,
            candidate: candidate
          }
        });
      });
    } else {
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          phone: user.phone,
          language: user.language
        }
      });
    }
  });
});

// Register employer
router.post('/register/employer', async (req, res) => {
  const { email, password, name, phone, companyName, companySize, industry, location, language } = req.body;

  if (!email || !password || !name || !companyName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if email exists
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const userId = uuidv4();
    const employerId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    db.run(
      `INSERT INTO users (id, email, password, role, name, phone, language) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, hashedPassword, 'employer', name, phone, language || 'en'],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create user' });
        }

        // Insert employer
        db.run(
          `INSERT INTO employers (id, user_id, company_name, company_size, industry, location) VALUES (?, ?, ?, ?, ?, ?)`,
          [employerId, userId, companyName, companySize, industry, location],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to create employer profile' });
            }

            const user = { id: userId, email, role: 'employer', name };
            const token = generateToken(user);

            res.status(201).json({
              token,
              user: {
                id: userId,
                email,
                role: 'employer',
                name,
                phone,
                language: language || 'en',
                employer: {
                  id: employerId,
                  company_name: companyName,
                  company_size: companySize,
                  industry,
                  location
                }
              }
            });
          }
        );
      }
    );
  });
});

// Register candidate (from invitation or self-registration)
router.post('/register/candidate', async (req, res) => {
  const { email, password, name, phone, candidateId, language } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const userId = uuidv4();
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if email exists
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Insert user
    db.run(
      `INSERT INTO users (id, email, password, role, name, phone, language) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, hashedPassword, 'candidate', name, phone, language || 'en'],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create user' });
        }

        // If candidateId provided (from invitation), update the candidate record
        if (candidateId) {
          db.run(
            `UPDATE candidates SET user_id = ?, status = 'active' WHERE id = ?`,
            [userId, candidateId],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to link candidate' });
              }

              const user = { id: userId, email, role: 'candidate', name };
              const token = generateToken(user);

              res.status(201).json({
                token,
                user: {
                  id: userId,
                  email,
                  role: 'candidate',
                  name,
                  phone,
                  language: language || 'en',
                  candidateId
                }
              });
            }
          );
        } else {
          // Create new candidate record
          const newCandidateId = uuidv4();
          db.run(
            `INSERT INTO candidates (id, user_id, name, email, phone, status) VALUES (?, ?, ?, ?, ?, 'active')`,
            [newCandidateId, userId, name, email, phone],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to create candidate profile' });
              }

              const user = { id: userId, email, role: 'candidate', name };
              const token = generateToken(user);

              res.status(201).json({
                token,
                user: {
                  id: userId,
                  email,
                  role: 'candidate',
                  name,
                  phone,
                  language: language || 'en',
                  candidateId: newCandidateId
                }
              });
            }
          );
        }
      }
    );
  });
});

module.exports = router;
