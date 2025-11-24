// Verify Credential JavaScript

// Extract credential ID from input
function extractCredentialId(input) {
  input = input.trim();
  
  // If it looks like a URL, extract the ID from it
  if (input.includes('/')) {
    const parts = input.split('/');
    return parts[parts.length - 1];
  }
  
  return input;
}

// Verify credential
async function verifyCredential(event) {
  event.preventDefault();
  
  const input = document.getElementById('credentialInput').value;
  const credentialId = extractCredentialId(input);
  
  if (!credentialId) {
    alert('Please enter a valid credential ID or URL');
    return;
  }
  
  const verifyBtn = document.getElementById('verifyBtn');
  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '<span class="loading"></span> Verifying...';
  
  try {
    const response = await fetch(`/api/credentials/verify/${credentialId}`);
    const data = await response.json();
    
    document.getElementById('resultContainer').classList.remove('hidden');
    
    if (data.valid && data.status === 'active') {
      showSuccessResult(data.credential);
    } else if (data.status === 'expired') {
      showInvalidResult(data.credential, 'Credential Expired', 'This credential has expired and is no longer valid.');
    } else if (data.status === 'revoked') {
      showInvalidResult(data.credential, 'Credential Revoked', 'This credential has been revoked and is no longer valid.');
    } else {
      showErrorResult(data.error || 'Credential not found or invalid');
    }
  } catch (error) {
    document.getElementById('resultContainer').classList.remove('hidden');
    showErrorResult('Failed to verify credential. Please try again.');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify Credential';
  }
}

// Show success result
function showSuccessResult(credential) {
  hideAllResults();
  document.getElementById('successResult').classList.remove('hidden');
  
  const details = credential.details || {};
  
  // Render credential info
  const credentialInfo = `
    <div class="grid grid-cols-2 gap-3">
      <div>
        <span class="text-gray-600">Title:</span>
        <div class="font-medium">${escapeHtml(credential.title)}</div>
      </div>
      <div>
        <span class="text-gray-600">Candidate:</span>
        <div class="font-medium">${escapeHtml(credential.candidateName)}</div>
      </div>
      <div>
        <span class="text-gray-600">Type:</span>
        <div class="font-medium">${formatCredentialType(credential.type)}</div>
      </div>
      <div>
        <span class="text-gray-600">Status:</span>
        <div class="font-medium text-green-600">Active</div>
      </div>
      <div>
        <span class="text-gray-600">Issued Date:</span>
        <div class="font-medium">${formatDate(credential.issuedDate)}</div>
      </div>
      <div>
        <span class="text-gray-600">Expiry Date:</span>
        <div class="font-medium">${formatDate(credential.expiryDate)}</div>
      </div>
    </div>
  `;
  document.getElementById('credentialInfo').innerHTML = credentialInfo;
  
  // Render verification details
  let verificationHtml = '';
  
  if (details.position) {
    verificationHtml += `
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div>
          <span class="text-gray-600">Position:</span>
          <div class="font-medium">${escapeHtml(details.position)}</div>
        </div>
        <div>
          <span class="text-gray-600">Employer:</span>
          <div class="font-medium">${escapeHtml(details.employer || 'N/A')}</div>
        </div>
      </div>
    `;
  }
  
  if (details.checks_completed) {
    verificationHtml += `
      <div class="mb-4">
        <div class="font-medium text-gray-700 mb-2">Background Checks Completed:</div>
        <div class="grid grid-cols-2 gap-2">
          ${Object.entries(details.checks_completed).map(([key, value]) => `
            <div class="flex items-center space-x-2">
              <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <span class="text-sm">${escapeHtml(key)}: ${escapeHtml(value)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  if (details.verifications && details.verifications.length > 0) {
    verificationHtml += `
      <div>
        <div class="font-medium text-gray-700 mb-2">Verifications Performed:</div>
        <ul class="list-disc list-inside space-y-1">
          ${details.verifications.map(v => `<li>${escapeHtml(v)}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  if (details.warnings > 0) {
    verificationHtml += `
      <div class="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3">
        <div class="text-sm text-yellow-800">
          ⚠️ This verification included ${details.warnings} warning(s) that were reviewed and resolved. 
          The overall verification result is: <span class="font-semibold">${details.overall_result}</span>
        </div>
      </div>
    `;
  }
  
  document.getElementById('verificationDetails').innerHTML = verificationHtml;
  
  // Show signature
  document.getElementById('signature').textContent = credential.signature;
}

// Show invalid result (expired/revoked)
function showInvalidResult(credential, title, message) {
  hideAllResults();
  document.getElementById('invalidResult').classList.remove('hidden');
  document.getElementById('invalidTitle').textContent = title;
  document.getElementById('invalidMessage').textContent = message;
  
  const info = `
    <p><strong>Title:</strong> ${escapeHtml(credential.title)}</p>
    <p><strong>Candidate:</strong> ${escapeHtml(credential.candidateName)}</p>
    <p><strong>Issued:</strong> ${formatDate(credential.issuedDate)}</p>
    ${credential.expiryDate ? `<p><strong>Expired:</strong> ${formatDate(credential.expiryDate)}</p>` : ''}
    <p><strong>Credential ID:</strong> <span class="font-mono text-xs">${credential.id}</span></p>
  `;
  document.getElementById('invalidCredentialInfo').innerHTML = info;
}

// Show error result
function showErrorResult(message) {
  hideAllResults();
  document.getElementById('errorResult').classList.remove('hidden');
  document.getElementById('errorMessage').textContent = message;
}

// Hide all result sections
function hideAllResults() {
  document.getElementById('successResult').classList.add('hidden');
  document.getElementById('errorResult').classList.add('hidden');
  document.getElementById('invalidResult').classList.add('hidden');
}

// Reset form
function resetForm() {
  document.getElementById('credentialInput').value = '';
  document.getElementById('resultContainer').classList.add('hidden');
  hideAllResults();
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
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check if credential ID is in URL on page load
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const credId = urlParams.get('id');
  
  if (credId) {
    document.getElementById('credentialInput').value = credId;
    // Auto-verify after a short delay
    setTimeout(() => {
      document.querySelector('form').dispatchEvent(new Event('submit'));
    }, 500);
  }
});
