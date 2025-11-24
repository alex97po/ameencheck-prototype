# AmeenCheck - AI-Powered Background Verification Platform

A high-fidelity prototype of an AI-powered background verification platform that reduces verification time from weeks to hours while issuing reusable, cryptographically-secured digital credentials.

## 🌟 Features

### Employer Portal
- **Dashboard**: Real-time statistics and metrics for all background checks
- **Verification Management**: Create and track background check requests
- **Package Selection**: Basic ($20), Standard ($50), and Comprehensive ($150) packages
- **Status Tracking**: Monitor verification progress in real-time
- **Detailed Reports**: View comprehensive verification results

### Candidate Portal
- **Verification Dashboard**: Track active and completed background checks
- **Digital Credential Wallet**: Store and manage cryptographically-verified credentials
- **Credential Sharing**: Share credentials with future employers
- **Status Updates**: Real-time notifications on verification progress

### Admin Panel
- **Analytics Dashboard**: Platform-wide statistics and metrics
- **Verification Management**: Oversee all verifications across the platform
- **Review Queue**: Manual review system for flagged verifications
- **User Management**: Manage employers and candidates

### Digital Credentials System
- **W3C Verifiable Credentials**: Standards-compliant digital credentials
- **Cryptographic Signatures**: SHA-256 hashing for tamper-evident credentials
- **QR Code Generation**: Easy sharing via QR codes
- **Blockchain-Ready**: Architecture supports blockchain anchoring
- **Credential Sharing**: Time-limited share links with access tracking

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or navigate to the project directory:**
```bash
cd ~/IdeaProjects/ameencheck-prototype
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the server:**
```bash
npm start
```

4. **Access the application:**
Open your browser and navigate to: `http://localhost:3000`

## 📱 Demo Credentials

### Employer Account
- **Email:** hr@techsolutions.com
- **Password:** password123

### Candidate Account
- **Email:** ahmed.ali@email.com
- **Password:** password123

### Admin Account
- **Email:** admin@ameencheck.com
- **Password:** password123

## 🏗️ Project Structure

```
ameencheck-prototype/
├── server/
│   ├── database.js              # SQLite database setup & initialization
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   └── routes/
│       ├── auth.js              # Authentication endpoints
│       ├── verifications.js     # Verification management APIs
│       ├── credentials.js       # Digital credentials APIs
│       └── admin.js             # Admin panel APIs
├── public/
│   ├── css/
│   │   └── styles.css           # Custom styles
│   ├── js/
│   │   └── employer.js          # Employer portal JavaScript
│   ├── index.html               # Landing page
│   ├── login.html               # Login page
│   ├── register.html            # Registration page
│   ├── employer.html            # Employer portal
│   ├── candidate.html           # Candidate portal
│   └── admin.html               # Admin panel
├── data/
│   └── ameencheck.db            # SQLite database (auto-created)
├── server.js                    # Express server entry point
├── package.json                 # Project dependencies
└── README.md                    # This file
```

## 🔧 Technology Stack

### Backend
- **Node.js & Express**: RESTful API server
- **SQLite3**: Lightweight database for prototype
- **JWT**: Token-based authentication
- **bcryptjs**: Password hashing
- **QRCode**: QR code generation for credentials

### Frontend
- **HTML5/CSS3/JavaScript**: Core web technologies
- **Tailwind CSS**: Utility-first CSS framework
- **Responsive Design**: Mobile-first approach

### Key Libraries
- `uuid`: Unique ID generation
- `date-fns`: Date manipulation
- `crypto`: Cryptographic signatures

## 📊 Database Schema

### Tables
- **users**: Shared user accounts (employers, candidates, admins)
- **employers**: Employer profiles and company information
- **candidates**: Candidate profiles
- **verifications**: Background check requests
- **verification_items**: Individual verification components
- **education_records**: Candidate education history
- **employment_records**: Candidate employment history
- **references**: Professional references
- **credentials**: Digital credentials issued to candidates
- **credential_shares**: Credential sharing history
- **review_queue**: Manual review queue for admins
- **notifications**: User notifications

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register/employer` - Employer registration
- `POST /api/auth/register/candidate` - Candidate registration

### Verifications
- `GET /api/verifications/employer` - Get employer's verifications
- `GET /api/verifications/:id` - Get verification details
- `POST /api/verifications` - Create new verification
- `GET /api/verifications/employer/stats` - Get employer statistics
- `GET /api/verifications/candidate/my-verifications` - Get candidate's verifications
- `POST /api/verifications/:id/submit` - Submit candidate information

### Credentials
- `GET /api/credentials/my-credentials` - Get candidate's credentials
- `POST /api/credentials/issue` - Issue new credential (admin)
- `POST /api/credentials/:id/share` - Share credential
- `GET /api/credentials/verify/:id` - Verify credential (public)
- `POST /api/credentials/:id/revoke` - Revoke credential

### Admin
- `GET /api/admin/analytics` - Platform analytics
- `GET /api/admin/review-queue` - Manual review queue
- `GET /api/admin/employers` - All employers
- `GET /api/admin/candidates` - All candidates
- `POST /api/admin/verifications/:id/complete` - Complete verification (demo)

## 🎨 Key Features Implemented

### ✅ Complete
- User authentication (JWT-based)
- Role-based access control (Employer, Candidate, Admin)
- Verification package system (Basic, Standard, Comprehensive)
- Dashboard with real-time statistics
- Digital credential issuance and management
- Credential sharing with QR codes
- Admin analytics panel
- Responsive UI design
- Sample data pre-loaded

### 🚧 Prototype Limitations (Mock/Simplified)
- AI document OCR (would use Google Vision/AWS Textract in production)
- AI voice agent for reference checks (would use Twilio + LLM)
- Actual criminal record checks (would integrate with licensed providers)
- Email notifications (console logging only)
- Payment processing (mock)
- File upload handling (simplified)
- Blockchain anchoring (architecture ready, not implemented)

## 🌍 Internationalization

- English (primary language)
- Arabic support (UI placeholders included)
- RTL support in CSS
- Language toggle in navigation

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Protected API routes
- SQL injection prevention (parameterized queries)
- XSS protection (HTML escaping)
- CORS enabled for API access
- Credential cryptographic signatures

## 📈 Future Enhancements

1. **Real AI Integration**
   - Google Cloud Vision API for document OCR
   - Twilio Voice + GPT-4 for reference checks
   - Sentiment analysis on reference feedback

2. **Blockchain Integration**
   - Ethereum/Polygon for credential anchoring
   - Immutable verification records
   - Decentralized credential storage

3. **Enhanced Features**
   - Real-time WebSocket updates
   - Email/SMS notifications
   - Document upload with storage
   - Advanced analytics and reporting
   - API rate limiting
   - Redis caching
   - Multi-language support (full Arabic translation)

4. **Production Readiness**
   - PostgreSQL/MySQL database
   - Docker containerization
   - CI/CD pipeline
   - Comprehensive testing
   - API documentation (Swagger)
   - Monitoring and logging

## 📝 Notes

This is a **high-fidelity prototype** designed to demonstrate the core functionality and user experience of the AmeenCheck platform. It includes:

- Fully functional authentication and authorization
- Complete database schema with relationships
- Interactive UI for all three user roles
- RESTful API architecture
- Digital credentials with cryptographic signatures
- Sample data for immediate testing

The prototype is ready for:
- User acceptance testing
- Stakeholder demonstrations
- MVP validation
- Technical feasibility assessment
- Investment presentations

## 🤝 Support

For questions or issues with this prototype:
- Review the code comments for implementation details
- Check the browser console for debugging information
- Examine the server logs for API errors
- Review the database schema in `server/database.js`

## 📄 License

This is a prototype/demonstration project.

---

**Built with ❤️ for the MENA market**

*Background verification in <24 hours | AI-Powered | Digital Credentials*
