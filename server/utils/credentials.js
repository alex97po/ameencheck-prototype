const crypto = require('crypto');

// W3C Verifiable Credentials compliant structure
class VerifiableCredential {
  constructor(data) {
    this.credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.ameencheck.com/credentials/v1'
      ],
      id: data.id,
      type: ['VerifiableCredential', data.credentialType],
      issuer: {
        id: 'did:ameencheck:platform',
        name: 'AmeenCheck Platform',
        url: 'https://ameencheck.com'
      },
      issuanceDate: data.issuanceDate || new Date().toISOString(),
      expirationDate: data.expirationDate,
      credentialSubject: data.subject,
      evidence: data.evidence || [],
      credentialStatus: {
        id: `https://ameencheck.com/status/${data.id}`,
        type: 'CredentialStatusList2021'
      }
    };
  }

  // Generate cryptographic proof using digital signature
  sign(privateKey = null) {
    // For prototype: simulate RSA signature
    // In production: use proper PKI with private keys
    
    const dataToSign = JSON.stringify({
      id: this.credential.id,
      issuer: this.credential.issuer.id,
      issuanceDate: this.credential.issuanceDate,
      subject: this.credential.credentialSubject
    });

    // Generate signature hash
    const signature = crypto
      .createHash('sha256')
      .update(dataToSign + (privateKey || 'AMEENCHECK_PLATFORM_KEY'))
      .digest('hex');

    // Create blockchain anchor (simulated hash for prototype)
    const blockchainAnchor = this.generateBlockchainAnchor(signature);

    this.credential.proof = {
      type: 'RsaSignature2018',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: 'did:ameencheck:platform#key-1',
      jws: signature,
      blockchainAnchor: blockchainAnchor
    };

    return this.credential;
  }

  // Simulate blockchain anchoring
  generateBlockchainAnchor(signature) {
    const blockchainHash = crypto
      .createHash('sha256')
      .update(signature + Date.now().toString())
      .digest('hex');

    return {
      type: 'EthereumAnchor2021',
      chain: 'Ethereum Mainnet',
      blockNumber: Math.floor(Math.random() * 10000000) + 18000000,
      blockHash: '0x' + blockchainHash,
      transactionHash: '0x' + crypto.randomBytes(32).toString('hex'),
      timestamp: new Date().toISOString(),
      anchored: true
    };
  }

  // Verify credential signature
  static verify(credential, publicKey = null) {
    try {
      if (!credential.proof || !credential.proof.jws) {
        return { valid: false, error: 'Missing cryptographic proof' };
      }

      // Reconstruct the signed data
      const dataToVerify = JSON.stringify({
        id: credential.id,
        issuer: credential.issuer.id,
        issuanceDate: credential.issuanceDate,
        subject: credential.credentialSubject
      });

      // Verify signature (simplified for prototype)
      const expectedSignature = crypto
        .createHash('sha256')
        .update(dataToVerify + (publicKey || 'AMEENCHECK_PLATFORM_KEY'))
        .digest('hex');

      const signatureValid = credential.proof.jws === expectedSignature;

      // Check expiration
      const isExpired = credential.expirationDate && 
        new Date(credential.expirationDate) < new Date();

      // Check blockchain anchor
      const blockchainVerified = credential.proof.blockchainAnchor && 
        credential.proof.blockchainAnchor.anchored;

      return {
        valid: signatureValid && !isExpired,
        signatureValid,
        isExpired,
        blockchainVerified,
        issuer: credential.issuer.name,
        issuanceDate: credential.issuanceDate,
        expirationDate: credential.expirationDate,
        blockchainDetails: credential.proof.blockchainAnchor
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Generate tamper-evident fingerprint
  static generateFingerprint(credential) {
    const data = JSON.stringify({
      id: credential.id,
      subject: credential.credentialSubject,
      issuanceDate: credential.issuanceDate,
      proof: credential.proof
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// Create employment verification credential
function createEmploymentCredential(data) {
  const vc = new VerifiableCredential({
    id: data.id,
    credentialType: 'EmploymentVerificationCredential',
    issuanceDate: data.issuanceDate,
    expirationDate: data.expirationDate,
    subject: {
      id: `did:ameencheck:candidate:${data.candidateId}`,
      name: data.candidateName,
      employment: {
        employer: data.employer,
        position: data.position,
        startDate: data.startDate,
        endDate: data.endDate,
        verified: true,
        verificationMethod: data.verificationMethod || 'Direct Contact'
      }
    },
    evidence: [
      {
        type: 'DocumentVerification',
        verifier: 'AmeenCheck AI System',
        evidenceDocument: 'Employment Letter',
        verificationDate: data.issuanceDate
      }
    ]
  });

  return vc.sign();
}

// Create education verification credential
function createEducationCredential(data) {
  const vc = new VerifiableCredential({
    id: data.id,
    credentialType: 'EducationVerificationCredential',
    issuanceDate: data.issuanceDate,
    expirationDate: data.expirationDate,
    subject: {
      id: `did:ameencheck:candidate:${data.candidateId}`,
      name: data.candidateName,
      education: {
        institution: data.institution,
        degree: data.degree,
        fieldOfStudy: data.fieldOfStudy,
        graduationYear: data.graduationYear,
        verified: true,
        verificationMethod: data.verificationMethod || 'Institution Portal'
      }
    },
    evidence: [
      {
        type: 'EducationalCredential',
        verifier: 'AmeenCheck Platform',
        evidenceDocument: 'Diploma/Certificate',
        verificationDate: data.issuanceDate
      }
    ]
  });

  return vc.sign();
}

// Create comprehensive background check credential
function createComprehensiveCredential(data) {
  const vc = new VerifiableCredential({
    id: data.id,
    credentialType: 'BackgroundCheckCredential',
    issuanceDate: data.issuanceDate,
    expirationDate: data.expirationDate,
    subject: {
      id: `did:ameencheck:candidate:${data.candidateId}`,
      name: data.candidateName,
      backgroundCheck: {
        verificationId: data.verificationId,
        employer: data.employer,
        position: data.position,
        packageType: data.packageType,
        checksCompleted: data.checksCompleted || {},
        overallResult: data.overallResult || 'VERIFIED',
        warnings: data.warnings || 0,
        completionDate: data.completionDate
      }
    },
    evidence: data.evidence || []
  });

  return vc.sign();
}

module.exports = {
  VerifiableCredential,
  createEmploymentCredential,
  createEducationCredential,
  createComprehensiveCredential
};
