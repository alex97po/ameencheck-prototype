const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./server/database');

// Initialize database
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/verifications', require('./server/routes/verifications'));
app.use('/api/credentials', require('./server/routes/credentials'));
app.use('/api/admin', require('./server/routes/admin'));

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/employer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'employer.html'));
});

app.get('/candidate', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'candidate.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/verify/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║           🔒 AmeenCheck Platform Started 🔒          ║
║                                                       ║
║   AI-Powered Background Verification Platform        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝

🌐 Server running at: http://localhost:${PORT}

📱 Access Points:
   • Landing Page:      http://localhost:${PORT}/
   • Employer Portal:   http://localhost:${PORT}/employer
   • Candidate Portal:  http://localhost:${PORT}/candidate
   • Admin Panel:       http://localhost:${PORT}/admin
   • Login:             http://localhost:${PORT}/login
   • Register:          http://localhost:${PORT}/register

🔑 Demo Credentials:
   Employer: hr@techsolutions.com / password123
   Candidate: ahmed.ali@email.com / password123
   Admin: admin@ameencheck.com / password123

💡 Database initialized with sample data
   
✨ Ready to verify backgrounds in <24 hours!
  `);
});
