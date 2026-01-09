const { PublicKey } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default || require('bs58');

// PulseKit initialization
let pulsekit = null;
try {
  const { PulseKit } = require('@120356aa/pulsekit-sdk');
  const apiKey = process.env.PULSEKIT_SIGNATURE_VERIFICATION_SERVICE;
  const endpoint = process.env.PULSEKIT_ENDPOINT || 'https://pulsekit.fly.dev';
  
  if (apiKey) {
    pulsekit = new PulseKit({
      endpoint,
      apiKey,
      environment: process.env.NODE_ENV || 'development',
    });
  }
} catch (e) {
  // PulseKit not available, continue without it
}

function pulseCapture(event) {
  if (pulsekit) {
    try {
      pulsekit.capture(event);
    } catch (e) {
      // Ignore PulseKit errors
    }
  }
}

/**
 * Verify a Solana wallet signature
 * @param {string} message - The message that was signed
 * @param {string} signatureBase64 - The signature in base64 format
 * @param {string} publicKeyBase58 - The public key in base58 format
 * @returns {boolean} - True if signature is valid, false otherwise
 */
function verifySignature(message, signatureBase64, publicKeyBase58) {
  pulseCapture({
    type: 'signature.verify.start',
    level: 'info',
    message: `Verifying signature for public key: ${publicKeyBase58}`,
    metadata: { publicKey: publicKeyBase58, messageLength: message.length },
    tags: { service: 'signature', action: 'verify_start' }
  });
  
  try {
    // Decode the signature from base64
    const signature = Buffer.from(signatureBase64, 'base64');
    
    // Decode the public key from base58
    const publicKey = bs58.decode(publicKeyBase58);
    
    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);
    
    // Verify the signature using nacl
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signature,
      publicKey
    );
    
    pulseCapture({
      type: isValid ? 'signature.verify.success' : 'signature.verify.invalid',
      level: isValid ? 'info' : 'warning',
      message: isValid ? `Signature valid for: ${publicKeyBase58}` : `Signature invalid for: ${publicKeyBase58}`,
      metadata: { publicKey: publicKeyBase58, isValid },
      tags: { service: 'signature', action: isValid ? 'verify_success' : 'verify_invalid' }
    });
    
    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
    pulseCapture({
      type: 'signature.verify.error',
      level: 'error',
      message: `Failed to verify signature: ${error.message}`,
      metadata: { publicKey: publicKeyBase58, error: error.message, stack: error.stack },
      tags: { service: 'signature', action: 'verify_error' }
    });
    return false;
  }
}

// CLI interface - read from stdin or file
if (require.main === module) {
  const fs = require('fs');
  
  // Check if file path is provided as argument
  if (process.argv[2]) {
    try {
      const input = fs.readFileSync(process.argv[2], 'utf8');
      const data = JSON.parse(input);
      const { message, signature, public_key } = data;
      
      if (!message || !signature || !public_key) {
        console.log(JSON.stringify({ 
          error: 'Missing required fields: message, signature, public_key' 
        }));
        process.exit(1);
      }
      
      const isValid = verifySignature(message, signature, public_key);
      
      console.log(JSON.stringify({ 
        valid: isValid,
        message: isValid ? 'Signature is valid' : 'Signature is invalid'
      }));
      
      process.exit(isValid ? 0 : 1);
    } catch (error) {
      console.log(JSON.stringify({ 
        error: error.message 
      }));
      process.exit(1);
    }
  } else {
    // Read from stdin
    let input = '';
    
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    
    process.stdin.on('end', () => {
      try {
        const data = JSON.parse(input);
        const { message, signature, public_key } = data;
        
        if (!message || !signature || !public_key) {
          console.log(JSON.stringify({ 
            error: 'Missing required fields: message, signature, public_key' 
          }));
          process.exit(1);
        }
        
        const isValid = verifySignature(message, signature, public_key);
        
        console.log(JSON.stringify({ 
          valid: isValid,
          message: isValid ? 'Signature is valid' : 'Signature is invalid'
        }));
        
        process.exit(isValid ? 0 : 1);
      } catch (error) {
        console.log(JSON.stringify({ 
          error: error.message 
        }));
        process.exit(1);
      }
    });
  }
}

module.exports = { verifySignature };
