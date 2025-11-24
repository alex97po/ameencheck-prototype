const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../data/ameencheck.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
function initializeDatabase() {
  db.serialize(() => {
    // Users table (shared for employers, candidates, admins)
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL, -- 'employer', 'candidate', 'admin'
      name TEXT NOT NULL,
      phone TEXT,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Employers table
    db.run(`CREATE TABLE IF NOT EXISTS employers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      company_size TEXT,
      industry TEXT,
      location TEXT,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Candidates table
    db.run(`CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Verification requests table
    db.run(`CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      employer_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      position TEXT,
      package_type TEXT NOT NULL,
      status TEXT DEFAULT 'invited',
      price REAL NOT NULL,
      special_instructions TEXT,
      initiated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      completion_date DATETIME,
      FOREIGN KEY (employer_id) REFERENCES employers(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )`);

    // Verification items (individual checks within a verification)
    db.run(`CREATE TABLE IF NOT EXISTS verification_items (
      id TEXT PRIMARY KEY,
      verification_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'identity', 'education', 'employment', 'criminal', 'reference'
      status TEXT DEFAULT 'pending',
      result TEXT,
      details TEXT, -- JSON
      verified_date DATETIME,
      FOREIGN KEY (verification_id) REFERENCES verifications(id)
    )`);

    // Education records
    db.run(`CREATE TABLE IF NOT EXISTS education_records (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      institution TEXT NOT NULL,
      degree TEXT NOT NULL,
      field_of_study TEXT,
      start_date TEXT,
      end_date TEXT,
      document_url TEXT,
      verification_status TEXT DEFAULT 'pending',
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )`);

    // Employment records
    db.run(`CREATE TABLE IF NOT EXISTS employment_records (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      job_title TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      supervisor_name TEXT,
      supervisor_contact TEXT,
      can_contact BOOLEAN DEFAULT 1,
      document_url TEXT,
      verification_status TEXT DEFAULT 'pending',
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )`);

    // References (using quotes because 'references' is a reserved word in SQLite)
    db.run(`CREATE TABLE IF NOT EXISTS "references" (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      preferred_time TEXT,
      language TEXT DEFAULT 'en',
      status TEXT DEFAULT 'pending',
      feedback TEXT,
      sentiment TEXT,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )`);

    // Digital credentials
    db.run(`CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT, -- JSON
      issued_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiry_date DATETIME,
      status TEXT DEFAULT 'active',
      verification_url TEXT,
      qr_code TEXT,
      signature TEXT,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )`);

    // Credential shares (tracking)
    db.run(`CREATE TABLE IF NOT EXISTS credential_shares (
      id TEXT PRIMARY KEY,
      credential_id TEXT NOT NULL,
      shared_with_email TEXT,
      share_link TEXT NOT NULL,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_date DATETIME,
      access_count INTEGER DEFAULT 0,
      last_accessed DATETIME,
      FOREIGN KEY (credential_id) REFERENCES credentials(id)
    )`);

    // Manual review queue
    db.run(`CREATE TABLE IF NOT EXISTS review_queue (
      id TEXT PRIMARY KEY,
      verification_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      issue_description TEXT,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      assigned_to TEXT,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_date DATETIME,
      resolution_notes TEXT,
      FOREIGN KEY (verification_id) REFERENCES verifications(id)
    )`);

    // Notifications
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    console.log('Database schema initialized');
    insertSampleData();
  });
}

// Insert sample data
function insertSampleData() {
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('password123', salt);

  // Sample admin user
  db.run(`INSERT OR IGNORE INTO users (id, email, password, role, name, phone) 
    VALUES ('admin-1', 'admin@ameencheck.com', ?, 'admin', 'System Admin', '+971501234567')`, 
    [hashedPassword]);

  // Sample employer user
  db.run(`INSERT OR IGNORE INTO users (id, email, password, role, name, phone) 
    VALUES ('user-emp-1', 'hr@techsolutions.com', ?, 'employer', 'Sarah Ahmed', '+971502345678')`, 
    [hashedPassword]);

  db.run(`INSERT OR IGNORE INTO employers (id, user_id, company_name, company_size, industry, location) 
    VALUES ('emp-1', 'user-emp-1', 'Tech Solutions LLC', '50-100', 'Technology', 'Dubai, UAE')`);

  // Sample candidate user
  db.run(`INSERT OR IGNORE INTO users (id, email, password, role, name, phone) 
    VALUES ('user-cand-1', 'ahmed.ali@email.com', ?, 'candidate', 'Ahmed Ali', '+971503456789')`, 
    [hashedPassword]);

  db.run(`INSERT OR IGNORE INTO candidates (id, user_id, name, email, phone, status) 
    VALUES ('cand-1', 'user-cand-1', 'Ahmed Ali', 'ahmed.ali@email.com', '+971503456789', 'active')`);

  // Sample candidate without user account (invited)
  db.run(`INSERT OR IGNORE INTO candidates (id, name, email, phone, status) 
    VALUES ('cand-2', 'Fatima Hassan', 'fatima.hassan@email.com', '+971504567890', 'invited')`);

  console.log('Sample data inserted');
}

module.exports = { db, initializeDatabase };
