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

  // Additional completed candidates with verification history
  db.run(`INSERT OR IGNORE INTO candidates (id, name, email, phone, status) 
    VALUES ('cand-3', 'Mohammed Ibrahim', 'mohammed.i@email.com', '+971505678901', 'active')`);

  db.run(`INSERT OR IGNORE INTO candidates (id, name, email, phone, status) 
    VALUES ('cand-4', 'Sara Abdullah', 'sara.abd@email.com', '+971506789012', 'active')`);

  // Completed verification with warnings - Digital diploma edit detected
  db.run(`INSERT OR IGNORE INTO verifications (id, employer_id, candidate_id, position, package_type, status, price, special_instructions, initiated_date, completion_date) 
    VALUES ('ver-completed-1', 'emp-1', 'cand-3', 'Senior Software Engineer', 'standard', 'completed', 50, 'Rush verification needed', datetime('now', '-5 days'), datetime('now', '-2 days'))`);

  // Completed verification with warnings - Employment date mismatch
  db.run(`INSERT OR IGNORE INTO verifications (id, employer_id, candidate_id, position, package_type, status, price, special_instructions, initiated_date, completion_date) 
    VALUES ('ver-completed-2', 'emp-1', 'cand-4', 'Marketing Manager', 'comprehensive', 'completed', 150, '', datetime('now', '-10 days'), datetime('now', '-3 days'))`);

  // Verification items for completed verification 1 (Mohammed Ibrahim)
  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-1', 'ver-completed-1', 'identity', 'verified', 'verified', '{"method":"biometric","confidence":0.98,"document_type":"Emirates ID","document_number":"784-****-*******-1","verified_by":"AI System"}', datetime('now', '-4 days'))`);

  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-2', 'ver-completed-1', 'education', 'verified', 'warning', '{"institution":"Dubai University","degree":"Bachelor of Computer Science","graduation_year":"2018","verification_method":"Institution Portal","warnings":[{"type":"digital_alteration","severity":"medium","description":"Digital modifications detected in submitted diploma document. Metadata analysis shows image editing software traces dated 2023, while document claims to be from 2018.","recommendation":"Institution has confirmed graduation and degree details match records. Warning is noted but verification passes based on official institution confirmation."}],"verified_contact":"registrar@du.ac.ae","response_time":"48 hours"}', datetime('now', '-4 days'))`);

  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-3', 'ver-completed-1', 'employment', 'verified', 'verified', '{"company":"TechCorp Dubai","position":"Software Developer","claimed_duration":"Jan 2019 - Dec 2022","verified_duration":"Jan 2019 - Dec 2022","verified_by":"HR Department","contact_person":"Ahmad Hassan","contact_email":"hr@techcorp.ae","responsibilities_confirmed":true,"performance_rating":"Good","eligible_for_rehire":true}', datetime('now', '-3 days'))`);

  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-4', 'ver-completed-1', 'criminal', 'verified', 'verified', '{"jurisdiction":"UAE","scope":"Federal and Local","result":"No records found","databases_checked":["UAE Federal","Dubai Police","Abu Dhabi Police"],"search_period":"Past 7 years","verified_date":"' || datetime('now', '-3 days') || '"}', datetime('now', '-3 days'))`);

  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-5', 'ver-completed-1', 'reference', 'verified', 'verified', '{"references_contacted":2,"references_completed":2,"overall_sentiment":"positive","ratings":{"technical_skills":4.5,"teamwork":5,"professionalism":4.5,"reliability":5},"highlights":["Strong technical abilities","Excellent team player","Meets deadlines consistently"],"verified_by":"AI Phone System + Manual Review"}', datetime('now', '-2 days'))`);

  // Verification items for completed verification 2 (Sara Abdullah)
  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-6', 'ver-completed-2', 'identity', 'verified', 'verified', '{"method":"document_verification","confidence":0.99,"document_type":"Passport","document_number":"N*******","verified_by":"AI System + Manual Review"}', datetime('now', '-9 days'))`);

  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-7', 'ver-completed-2', 'education', 'verified', 'verified', '{"institution":"American University of Sharjah","degree":"MBA Marketing","graduation_year":"2016","verification_method":"Direct Contact","verified_contact":"registrar@aus.edu","response_time":"24 hours","gpa":"3.7"}', datetime('now', '-8 days'))`);

  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-8', 'ver-completed-2', 'employment', 'verified', 'warning', '{"company":"Global Marketing Solutions","position":"Marketing Specialist","claimed_duration":"Mar 2017 - Jun 2023","verified_duration":"Jun 2017 - Jun 2023","warnings":[{"type":"date_mismatch","severity":"low","description":"Candidate claimed employment start date of March 2017, but employer records show start date of June 2017. 3-month discrepancy detected.","verified_date":"June 1, 2017","claimed_date":"March 2017","explanation":"Candidate may have included notice period from previous employer or contract negotiation period."}],"verified_by":"HR Department","contact_person":"Sarah Johnson","contact_email":"hr@gms.com","responsibilities_confirmed":true,"performance_rating":"Excellent","eligible_for_rehire":true,"promotion_history":["Senior Marketing Specialist - Jan 2020"]}', datetime('now', '-7 days'))`);

  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-9', 'ver-completed-2', 'criminal', 'verified', 'verified', '{"jurisdiction":"UAE + International","scope":"Federal, Local, and International","result":"No records found","databases_checked":["UAE Federal","Dubai Police","Abu Dhabi Police","Interpol","GCC Criminal Database"],"search_period":"Past 10 years","verified_date":"' || datetime('now', '-6 days') || '"}', datetime('now', '-6 days'))`);

  db.run(`INSERT OR IGNORE INTO verification_items (id, verification_id, type, status, result, details, verified_date) 
    VALUES ('vi-10', 'ver-completed-2', 'reference', 'verified', 'verified', '{"references_contacted":3,"references_completed":3,"overall_sentiment":"very_positive","ratings":{"leadership":4.8,"creativity":5,"strategic_thinking":4.7,"communication":5},"highlights":["Exceptional campaign strategist","Natural leader","Excellent stakeholder management","Drives measurable results"],"concerns":[],"verified_by":"AI Phone System + Manual Review"}', datetime('now', '-4 days'))`);

  // Education records
  db.run(`INSERT OR IGNORE INTO education_records (id, candidate_id, institution, degree, field_of_study, start_date, end_date, verification_status) 
    VALUES ('edu-1', 'cand-3', 'Dubai University', 'Bachelor of Science', 'Computer Science', '2014', '2018', 'verified')`);

  db.run(`INSERT OR IGNORE INTO education_records (id, candidate_id, institution, degree, field_of_study, start_date, end_date, verification_status) 
    VALUES ('edu-2', 'cand-4', 'American University of Sharjah', 'MBA', 'Marketing', '2014', '2016', 'verified')`);

  // Employment records
  db.run(`INSERT OR IGNORE INTO employment_records (id, candidate_id, company_name, job_title, start_date, end_date, supervisor_name, supervisor_contact, verification_status) 
    VALUES ('emp-rec-1', 'cand-3', 'TechCorp Dubai', 'Software Developer', '2019-01', '2022-12', 'Ahmad Hassan', 'hr@techcorp.ae', 'verified')`);

  db.run(`INSERT OR IGNORE INTO employment_records (id, candidate_id, company_name, job_title, start_date, end_date, supervisor_name, supervisor_contact, verification_status) 
    VALUES ('emp-rec-2', 'cand-4', 'Global Marketing Solutions', 'Marketing Specialist', '2017-03', '2023-06', 'Sarah Johnson', 'hr@gms.com', 'verified')`);

  // Create verifiable credentials for completed verifications
  const credentialDetails1 = JSON.stringify({
    verification_id: 'ver-completed-1',
    candidate_name: 'Mohammed Ibrahim',
    position: 'Senior Software Engineer',
    employer: 'Tech Solutions LLC',
    package_type: 'Standard Background Check',
    completion_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    checks_completed: {
      'Identity Verification': 'Pass',
      'Education Verification': 'Pass (with warning)',
      'Employment Verification': 'Pass',
      'Criminal Record Check': 'Pass',
      'Reference Checks': 'Pass'
    },
    verifications: [
      'Identity verified via Emirates ID',
      'Education confirmed by Dubai University',
      'Employment history verified',
      'No criminal records found',
      '2 professional references verified'
    ],
    warnings: 1,
    overall_result: 'VERIFIED'
  });

  const credentialDetails2 = JSON.stringify({
    verification_id: 'ver-completed-2',
    candidate_name: 'Sara Abdullah',
    position: 'Marketing Manager',
    employer: 'Tech Solutions LLC',
    package_type: 'Comprehensive Background Check',
    completion_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    checks_completed: {
      'Identity Verification': 'Pass',
      'Education Verification': 'Pass',
      'Employment Verification': 'Pass (with warning)',
      'Criminal Record Check': 'Pass',
      'Reference Checks': 'Pass'
    },
    verifications: [
      'Identity verified via Passport',
      'MBA confirmed by American University of Sharjah',
      'Employment history verified',
      'International criminal records checked',
      '3 professional references verified'
    ],
    warnings: 1,
    overall_result: 'VERIFIED'
  });

  // Note: In a real system, these would have actual QR codes generated
  db.run(`INSERT OR IGNORE INTO credentials (id, candidate_id, type, title, details, issued_date, expiry_date, status, verification_url, qr_code, signature) 
    VALUES (
      'cred-1', 
      'cand-3', 
      'comprehensive', 
      'Background Check Certificate - Senior Software Engineer',
      ?,
      datetime('now', '-2 days'),
      datetime('now', '+365 days'),
      'active',
      'https://ameencheck.com/verify/cred-1',
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE2IiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UVIgQ29kZTwvdGV4dD48L3N2Zz4=',
      'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0'
    )`, [credentialDetails1]);

  db.run(`INSERT OR IGNORE INTO credentials (id, candidate_id, type, title, details, issued_date, expiry_date, status, verification_url, qr_code, signature) 
    VALUES (
      'cred-2', 
      'cand-4', 
      'comprehensive', 
      'Background Check Certificate - Marketing Manager',
      ?,
      datetime('now', '-3 days'),
      datetime('now', '+365 days'),
      'active',
      'https://ameencheck.com/verify/cred-2',
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE2IiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UVIgQ29kZTwvdGV4dD48L3N2Zz4=',
      'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0'
    )`, [credentialDetails2]);

  console.log('Sample data inserted including completed verifications, warnings, and credentials');
}

module.exports = { db, initializeDatabase };
