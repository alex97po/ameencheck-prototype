// Employer Portal JavaScript

let currentUser = null;
let token = null;
let verifications = [];

// Check authentication
function checkAuth() {
  token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    window.location.href = '/login';
    return false;
  }
  
  currentUser = JSON.parse(userStr);
  
  if (currentUser.role !== 'employer') {
    alert('Access denied. Employer account required.');
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

// Show section
function showSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.add('hidden');
  });
  document.getElementById(sectionId).classList.remove('hidden');
  
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelector(`[onclick="showSection('${sectionId}')"]`)?.classList.add('active');
  
  // Load data for section
  if (sectionId === 'dashboard') {
    loadDashboard();
  } else if (sectionId === 'verifications') {
    loadVerifications();
  }
}

// Load dashboard stats
async function loadDashboard() {
  try {
    const stats = await apiCall('/api/verifications/employer/stats');
    
    document.getElementById('totalVerifications').textContent = stats.total || 0;
    document.getElementById('pendingVerifications').textContent = stats.in_progress || 0;
    document.getElementById('completedThisMonth').textContent = stats.completed || 0;
    document.getElementById('avgCompletionTime').textContent = stats.avgCompletionTime || 'N/A';
    
    // Load recent verifications
    await loadVerifications();
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// Load verifications
async function loadVerifications() {
  try {
    verifications = await apiCall('/api/verifications/employer');
    renderVerifications(verifications);
  } catch (error) {
    console.error('Error loading verifications:', error);
  }
}

// Render verifications table
function renderVerifications(data) {
  const tbody = document.getElementById('verificationsTable');
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-gray-500">
          No background checks yet. 
          <button onclick="openNewVerificationModal()" class="text-blue-600 hover:text-blue-800 font-medium">
            Create your first one →
          </button>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = data.map(v => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="font-medium text-gray-900">${escapeHtml(v.candidate_name)}</div>
        <div class="text-sm text-gray-500">${escapeHtml(v.candidate_email)}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${escapeHtml(v.position || 'N/A')}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="text-sm font-medium text-gray-900">${escapeHtml(v.package_type)}</span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="status-badge status-${v.status.replace('_', '-')}">${formatStatus(v.status)}</span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatDate(v.initiated_date)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button onclick="viewVerification('${v.id}')" class="text-blue-600 hover:text-blue-900">View</button>
      </td>
    </tr>
  `).join('');
}

// Open new verification modal
function openNewVerificationModal() {
  document.getElementById('newVerificationModal').classList.remove('hidden');
}

// Close modal
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// Submit new verification
async function submitNewVerification(e) {
  e.preventDefault();
  
  const formData = {
    candidateName: document.getElementById('candidateName').value,
    candidateEmail: document.getElementById('candidateEmail').value,
    candidatePhone: document.getElementById('candidatePhone').value,
    position: document.getElementById('position').value,
    packageType: document.getElementById('packageType').value,
    specialInstructions: document.getElementById('specialInstructions').value
  };
  
  const submitBtn = document.getElementById('submitVerificationBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading"></span> Creating...';
  
  try {
    await apiCall('/api/verifications', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    closeModal('newVerificationModal');
    document.getElementById('newVerificationForm').reset();
    showNotification('Background check created successfully! Invitation sent to candidate.');
    loadVerifications();
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Background Check';
  }
}

// View verification details
async function viewVerification(verificationId) {
  try {
    const verification = await apiCall(`/api/verifications/${verificationId}`);
    
    // Show verification details modal
    const modal = document.getElementById('verificationDetailsModal');
    document.getElementById('detailCandidateName').textContent = verification.candidate_name;
    document.getElementById('detailPosition').textContent = verification.position || 'N/A';
    document.getElementById('detailPackage').textContent = verification.package_type;
    document.getElementById('detailStatus').innerHTML = `<span class="status-badge status-${verification.status.replace('_', '-')}">${formatStatus(verification.status)}</span>`;
    document.getElementById('detailInitiated').textContent = formatDate(verification.initiated_date);
    
    // Render verification items
    const itemsHtml = verification.items.map(item => `
      <div class="flex items-center justify-between py-3 border-b">
        <div>
          <div class="font-medium">${formatVerificationType(item.type)}</div>
          <div class="text-sm text-gray-500">${formatStatus(item.status)}</div>
        </div>
        <div>
          ${item.status === 'verified' ? '<span class="text-green-600">✓</span>' : 
            item.status === 'verifying' ? '<span class="text-blue-600">⏳</span>' : 
            '<span class="text-gray-400">○</span>'}
        </div>
      </div>
    `).join('');
    
    document.getElementById('verificationItems').innerHTML = itemsHtml;
    
    modal.classList.remove('hidden');
  } catch (error) {
    alert('Error loading verification details: ' + error.message);
  }
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
function formatStatus(status) {
  const statusMap = {
    'invited': 'Invited',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'review_needed': 'Review Needed',
    'pending': 'Pending',
    'verifying': 'Verifying',
    'verified': 'Verified'
  };
  return statusMap[status] || status;
}

function formatVerificationType(type) {
  const typeMap = {
    'identity': 'Identity Verification',
    'education': 'Education Verification',
    'employment': 'Employment Verification',
    'criminal': 'Criminal Record Check',
    'reference': 'Reference Checks'
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (checkAuth()) {
    document.getElementById('userName').textContent = currentUser.name;
    if (currentUser.employer) {
      document.getElementById('companyName').textContent = currentUser.employer.company_name;
    }
    loadDashboard();
  }
});
