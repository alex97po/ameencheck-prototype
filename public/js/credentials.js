// Credentials JavaScript

let currentUser = null;
let token = null;
let credentials = [];
let currentCredential = null;

// Check authentication
function checkAuth() {
  token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    window.location.href = '/login';
    return false;
  }
  
  currentUser = JSON.parse(userStr);
  
  if (currentUser.role !== 'candidate') {
    alert('Access denied. Candidate account required.');
    window.location.href = '/login';
    return false;
  }
  
  return true;
}

// API helper
async function apiCall(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  const response = await fetch(endpoint, { ...defaultOptions, ...options });
  const data = await response.json();
  
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data;
}

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

// Load credentials
async function loadCredentials() {
  try {
    credentials = await apiCall('/api/credentials/my-credentials');
    renderCredentials(credentials);
  } catch (error) {
    console.error('Error loading credentials:', error);
    document.getElementById('credentialsContainer').innerHTML = `
      <div class="col-span-full text-center text-red-600 py-8">
        Error loading credentials. Please try again.
      </div>
    `;
  }
}

// Render credentials
function renderCredentials(data) {
  const container = document.getElementById('credentialsContainer');
  const emptyState = document.getElementById('emptyState');
  
  if (!data || data.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  container.innerHTML = data.map(cred => {
    const isExpired = cred.expiry_date && new Date(cred.expiry_date) < new Date();
    const isRevoked = cred.status === 'revoked';
    const statusClass = isRevoked ? 'bg-red-100 text-red-800' : 
                       isExpired ? 'bg-gray-100 text-gray-800' : 
                       'bg-green-100 text-green-800';
    const statusText = isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active';
    
    return `
      <div class="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer" onclick="viewCredential('${cred.id}')">
        <div class="p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <h3 class="font-semibold text-lg text-gray-900 mb-1">${escapeHtml(cred.title)}</h3>
              <p class="text-sm text-gray-600">${formatCredentialType(cred.type)}</p>
            </div>
            <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${statusText}</span>
          </div>
          
          <div class="space-y-2 text-sm text-gray-600 mb-4">
            <div>
              <span class="font-medium">Issued:</span> ${formatDate(cred.issued_date)}
            </div>
            ${cred.expiry_date ? `
              <div>
                <span class="font-medium">Expires:</span> ${formatDate(cred.expiry_date)}
              </div>
            ` : ''}
          </div>
          
          <div class="flex items-center text-sm text-blue-600">
            <span>View Details</span>
            <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// View credential details
async function viewCredential(credentialId) {
  try {
    const credential = credentials.find(c => c.id === credentialId);
    if (!credential) return;
    
    currentCredential = credential;
    
    // Populate modal
    document.getElementById('credentialTitle').textContent = credential.title;
    document.getElementById('credentialType').textContent = formatCredentialType(credential.type);
    document.getElementById('qrCode').src = credential.qr_code || '';
    document.getElementById('verificationUrl').value = credential.verification_url || '';
    
    // Render credential details
    const detailsHtml = renderCredentialDetails(credential);
    document.getElementById('credentialDetails').innerHTML = detailsHtml;
    
    // Load share history
    try {
      const shares = await apiCall(`/api/credentials/${credentialId}/shares`);
      if (shares && shares.length > 0) {
        document.getElementById('shareHistory').classList.remove('hidden');
        renderShareHistory(shares);
      } else {
        document.getElementById('shareHistory').classList.add('hidden');
      }
    } catch (error) {
      console.error('Error loading share history:', error);
    }
    
    document.getElementById('credentialModal').classList.remove('hidden');
  } catch (error) {
    alert('Error viewing credential: ' + error.message);
  }
}

// Render credential details
function renderCredentialDetails(credential) {
  const details = credential.details || {};
  let html = `
    <div class="grid grid-cols-2 gap-3">
      <div>
        <span class="text-gray-600">Credential ID:</span>
        <div class="font-mono text-xs mt-1">${credential.id}</div>
      </div>
      <div>
        <span class="text-gray-600">Status:</span>
        <div class="font-medium mt-1">${credential.status}</div>
      </div>
      <div>
        <span class="text-gray-600">Issued Date:</span>
        <div class="font-medium mt-1">${formatDate(credential.issued_date)}</div>
      </div>
      ${credential.expiry_date ? `
        <div>
          <span class="text-gray-600">Expiry Date:</span>
          <div class="font-medium mt-1">${formatDate(credential.expiry_date)}</div>
        </div>
      ` : ''}
    </div>
    
    <div class="mt-4 pt-4 border-t">
      <div class="flex items-center space-x-2 mb-3">
        <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        <span class="text-gray-600 font-medium">Cryptographic Security</span>
      </div>
      <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 space-y-2 text-sm">
        <div class="flex items-center space-x-2">
          <span class="text-green-600">✓</span>
          <span>Digital Signature: RSA-2048</span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-green-600">✓</span>
          <span>Blockchain Anchored (Ethereum)</span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-green-600">✓</span>
          <span>W3C Verifiable Credential Standard</span>
        </div>
        <div class="mt-3 pt-3 border-t border-blue-200">
          <div class="text-xs text-gray-600">Signature Hash:</div>
          <div class="font-mono text-xs text-gray-800 mt-1 break-all">${credential.signature ? credential.signature.substring(0, 32) + '...' : 'N/A'}</div>
        </div>
      </div>
    </div>
  `;
  
  if (details.verifications) {
    html += `
      <div class="mt-4 pt-4 border-t">
        <div class="text-gray-600 font-medium mb-2">Verifications Included:</div>
        <ul class="list-disc list-inside space-y-1">
          ${details.verifications.map(v => `<li>${v}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  if (details.checks_completed) {
    html += `
      <div class="mt-4 pt-4 border-t">
        <div class="text-gray-600 font-medium mb-2">Background Checks:</div>
        <div class="grid grid-cols-2 gap-2">
          ${Object.entries(details.checks_completed).map(([key, value]) => `
            <div class="flex items-center space-x-2">
              <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <span class="text-sm">${key.replace(/_/g, ' ')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  return html;
}

// Render share history
function renderShareHistory(shares) {
  const html = shares.map(share => `
    <div class="flex items-center justify-between py-2 border-b">
      <div class="flex-1">
        <div class="text-sm font-medium">${escapeHtml(share.shared_with_email || 'Anonymous')}</div>
        <div class="text-xs text-gray-500">
          Shared on ${formatDate(share.created_date)}
          ${share.expires_date ? ` • Expires ${formatDate(share.expires_date)}` : ''}
        </div>
      </div>
      <div class="text-sm text-gray-600">
        ${share.access_count} view${share.access_count !== 1 ? 's' : ''}
      </div>
    </div>
  `).join('');
  
  document.getElementById('shareHistoryList').innerHTML = html;
}

// Share credential
async function shareCredential() {
  if (!currentCredential) return;
  
  const email = document.getElementById('shareEmail').value.trim();
  if (!email) {
    alert('Please enter a recipient email address');
    return;
  }
  
  if (!validateEmail(email)) {
    alert('Please enter a valid email address');
    return;
  }
  
  try {
    const result = await apiCall(`/api/credentials/${currentCredential.id}/share`, {
      method: 'POST',
      body: JSON.stringify({
        sharedWithEmail: email,
        expiryDays: 30
      })
    });
    
    alert(`Credential shared successfully!\n\nShare link: ${result.shareLink}\n\nThis link will expire in 30 days.`);
    document.getElementById('shareEmail').value = '';
    
    // Reload share history
    const shares = await apiCall(`/api/credentials/${currentCredential.id}/shares`);
    if (shares && shares.length > 0) {
      document.getElementById('shareHistory').classList.remove('hidden');
      renderShareHistory(shares);
    }
  } catch (error) {
    alert('Error sharing credential: ' + error.message);
  }
}

// Copy verification URL
function copyVerificationUrl() {
  const input = document.getElementById('verificationUrl');
  input.select();
  document.execCommand('copy');
  
  showNotification('Verification URL copied to clipboard!');
}

// Download credential
function downloadCredential() {
  if (!currentCredential) return;
  
  const credentialText = `
AmeenCheck Verifiable Credential

Title: ${currentCredential.title}
Type: ${formatCredentialType(currentCredential.type)}
Status: ${currentCredential.status}
Issued: ${formatDate(currentCredential.issued_date)}
${currentCredential.expiry_date ? `Expires: ${formatDate(currentCredential.expiry_date)}` : ''}

Verification URL: ${currentCredential.verification_url}
Credential ID: ${currentCredential.id}

This is a digitally signed credential issued by AmeenCheck.
To verify this credential, visit the verification URL or scan the QR code.

Signature: ${currentCredential.signature}

---
Downloaded on ${new Date().toLocaleString()}
  `.trim();
  
  const blob = new Blob([credentialText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credential-${currentCredential.title.replace(/\s+/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showNotification('Credential downloaded successfully');
}

// Close modal
function closeModal() {
  document.getElementById('credentialModal').classList.add('hidden');
  currentCredential = null;
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Utility functions
function formatCredentialType(type) {
  const typeMap = {
    'background_check': 'Background Check Certificate',
    'employment_verification': 'Employment Verification',
    'education_verification': 'Education Verification',
    'identity_verification': 'Identity Verification',
    'comprehensive': 'Comprehensive Background Check'
  };
  return typeMap[type] || type;
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (checkAuth()) {
    document.getElementById('userName').textContent = currentUser.name;
    loadCredentials();
  }
});
