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
    document.getElementById('detailCompleted').textContent = verification.completion_date ? formatDate(verification.completion_date) : 'N/A';
    
    // Check for warnings
    const warnings = [];
    verification.items.forEach(item => {
      if (item.details) {
        const details = item.details;
        if (details.warnings && details.warnings.length > 0) {
          details.warnings.forEach(warning => {
            warnings.push({
              type: item.type,
              ...warning
            });
          });
        }
      }
    });
    
    // Show warnings alert if any
    const warningsAlert = document.getElementById('warningsAlert');
    if (warnings.length > 0) {
      warningsAlert.classList.remove('hidden');
      const warningsSummary = document.getElementById('warningsSummary');
      warningsSummary.innerHTML = `
        <div class="font-medium mb-2">${warnings.length} warning(s) detected in this verification:</div>
        <ul class="list-disc list-inside space-y-1">
          ${warnings.map(w => `<li><span class="font-medium">${formatVerificationType(w.type)}:</span> ${w.type}</li>`).join('')}
        </ul>
      `;
    } else {
      warningsAlert.classList.add('hidden');
    }
    
    // Render verification items with detailed information
    const itemsHtml = verification.items.map(item => {
      const details = item.details || {};
      const hasWarnings = details.warnings && details.warnings.length > 0;
      const result = item.result || 'pending';
      
      return `
        <div class="bg-white border rounded-lg p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <div class="flex items-center space-x-2">
                <h4 class="font-semibold text-lg">${formatVerificationType(item.type)}</h4>
                ${hasWarnings ? '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">Warning</span>' : ''}
              </div>
              <div class="text-sm text-gray-500 mt-1">${formatStatus(item.status)}</div>
            </div>
            <div>
              ${item.status === 'verified' ? 
                `<span class="text-${hasWarnings ? 'yellow' : 'green'}-600 text-2xl">${hasWarnings ? '⚠️' : '✓'}</span>` : 
                item.status === 'verifying' ? '<span class="text-blue-600 text-2xl">⏳</span>' : 
                '<span class="text-gray-400 text-2xl">○</span>'}
            </div>
          </div>
          
          ${item.verified_date ? `<div class="text-xs text-gray-500 mb-3">Verified on ${formatDate(item.verified_date)}</div>` : ''}
          
          ${renderItemDetails(item.type, details, hasWarnings)}
        </div>
      `;
    }).join('');
    
    document.getElementById('verificationItems').innerHTML = itemsHtml;
    
    // Store current verification for potential download
    window.currentVerification = verification;
    
    modal.classList.remove('hidden');
  } catch (error) {
    alert('Error loading verification details: ' + error.message);
  }
}

// Render specific details for each verification type
function renderItemDetails(type, details, hasWarnings) {
  let html = '<div class="space-y-2 text-sm">';
  
  switch(type) {
    case 'identity':
      if (details.document_type) {
        html += `
          <div class="grid grid-cols-2 gap-2">
            <div><span class="text-gray-600">Document Type:</span> <span class="font-medium">${details.document_type}</span></div>
            <div><span class="text-gray-600">Confidence:</span> <span class="font-medium">${(details.confidence * 100).toFixed(0)}%</span></div>
            ${details.document_number ? `<div class="col-span-2"><span class="text-gray-600">Document #:</span> <span class="font-medium">${details.document_number}</span></div>` : ''}
          </div>
        `;
      }
      break;
      
    case 'education':
      html += `
        <div class="grid grid-cols-2 gap-2">
          <div><span class="text-gray-600">Institution:</span> <span class="font-medium">${details.institution || 'N/A'}</span></div>
          <div><span class="text-gray-600">Degree:</span> <span class="font-medium">${details.degree || 'N/A'}</span></div>
          <div><span class="text-gray-600">Year:</span> <span class="font-medium">${details.graduation_year || 'N/A'}</span></div>
          <div><span class="text-gray-600">Method:</span> <span class="font-medium">${details.verification_method || 'N/A'}</span></div>
          ${details.gpa ? `<div><span class="text-gray-600">GPA:</span> <span class="font-medium">${details.gpa}</span></div>` : ''}
          ${details.verified_contact ? `<div class="col-span-2"><span class="text-gray-600">Verified Contact:</span> <span class="font-medium">${details.verified_contact}</span></div>` : ''}
        </div>
      `;
      break;
      
    case 'employment':
      html += `
        <div class="grid grid-cols-2 gap-2">
          <div><span class="text-gray-600">Company:</span> <span class="font-medium">${details.company || 'N/A'}</span></div>
          <div><span class="text-gray-600">Position:</span> <span class="font-medium">${details.position || 'N/A'}</span></div>
          <div><span class="text-gray-600">Claimed Duration:</span> <span class="font-medium">${details.claimed_duration || 'N/A'}</span></div>
          <div><span class="text-gray-600">Verified Duration:</span> <span class="font-medium">${details.verified_duration || 'N/A'}</span></div>
          ${details.performance_rating ? `<div><span class="text-gray-600">Performance:</span> <span class="font-medium">${details.performance_rating}</span></div>` : ''}
          ${details.eligible_for_rehire !== undefined ? `<div><span class="text-gray-600">Rehire Eligible:</span> <span class="font-medium">${details.eligible_for_rehire ? 'Yes' : 'No'}</span></div>` : ''}
          ${details.contact_person ? `<div class="col-span-2"><span class="text-gray-600">Verified By:</span> <span class="font-medium">${details.contact_person}</span></div>` : ''}
        </div>
      `;
      break;
      
    case 'criminal':
      html += `
        <div class="grid grid-cols-2 gap-2">
          <div><span class="text-gray-600">Jurisdiction:</span> <span class="font-medium">${details.jurisdiction || 'N/A'}</span></div>
          <div><span class="text-gray-600">Result:</span> <span class="font-medium text-green-600">${details.result || 'N/A'}</span></div>
          <div class="col-span-2"><span class="text-gray-600">Databases Checked:</span> <span class="font-medium">${details.databases_checked ? details.databases_checked.join(', ') : 'N/A'}</span></div>
          <div class="col-span-2"><span class="text-gray-600">Search Period:</span> <span class="font-medium">${details.search_period || 'N/A'}</span></div>
        </div>
      `;
      break;
      
    case 'reference':
      if (details.references_contacted) {
        html += `
          <div class="grid grid-cols-2 gap-2">
            <div><span class="text-gray-600">References Contacted:</span> <span class="font-medium">${details.references_contacted}</span></div>
            <div><span class="text-gray-600">Completed:</span> <span class="font-medium">${details.references_completed}</span></div>
            <div class="col-span-2"><span class="text-gray-600">Overall Sentiment:</span> <span class="font-medium capitalize">${details.overall_sentiment?.replace('_', ' ') || 'N/A'}</span></div>
          </div>
        `;
        
        if (details.ratings) {
          html += `
            <div class="mt-2">
              <div class="text-gray-600 font-medium mb-1">Ratings:</div>
              <div class="grid grid-cols-2 gap-1 text-xs">
                ${Object.entries(details.ratings).map(([key, value]) => 
                  `<div>${key.replace(/_/g, ' ')}: <span class="font-medium">${value}/5</span></div>`
                ).join('')}
              </div>
            </div>
          `;
        }
        
        if (details.highlights && details.highlights.length > 0) {
          html += `
            <div class="mt-2">
              <div class="text-gray-600 font-medium mb-1">Highlights:</div>
              <ul class="list-disc list-inside text-xs space-y-1">
                ${details.highlights.map(h => `<li>${h}</li>`).join('')}
              </ul>
            </div>
          `;
        }
      }
      break;
  }
  
  // Add warnings if present
  if (hasWarnings && details.warnings) {
    html += `
      <div class="mt-3 pt-3 border-t border-yellow-200">
        <div class="text-yellow-800 font-medium mb-2">⚠️ Warnings:</div>
        ${details.warnings.map(warning => `
          <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mb-2">
            <div class="font-medium text-yellow-900 mb-1">${warning.type?.replace(/_/g, ' ').toUpperCase()}</div>
            <div class="text-xs text-yellow-800 mb-2">${warning.description}</div>
            ${warning.recommendation ? `
              <div class="text-xs text-yellow-700 mt-2">
                <span class="font-medium">Recommendation:</span> ${warning.recommendation}
              </div>
            ` : ''}
            ${warning.explanation ? `
              <div class="text-xs text-yellow-700 mt-1">
                <span class="font-medium">Explanation:</span> ${warning.explanation}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

// Download report (mock implementation)
function downloadReport() {
  if (!window.currentVerification) return;
  
  const verification = window.currentVerification;
  const reportText = `
AmeenCheck Background Verification Report

Candidate: ${verification.candidate_name}
Position: ${verification.position}
Package: ${verification.package_type}
Status: ${verification.status}
Initiated: ${verification.initiated_date}
Completed: ${verification.completion_date || 'In Progress'}

Verification Items:
${verification.items.map(item => {
  const details = item.details || {};
  return `
- ${formatVerificationType(item.type)}: ${formatStatus(item.status)}
  ${details.warnings ? `⚠️ ${details.warnings.length} warning(s) detected` : '✓ No issues'}
`;
}).join('')}

---
Generated by AmeenCheck on ${new Date().toLocaleString()}
  `.trim();
  
  const blob = new Blob([reportText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `verification-report-${verification.candidate_name.replace(/\s+/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showNotification('Report downloaded successfully');
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
