const { PublicKey } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default || require('bs58');

/**
 * Verify a Solana wallet signature
 * @param {string} message - The message that was signed
 * @param {string} signatureBase64 - The signature in base64 format
 * @param {string} publicKeyBase58 - The public key in base58 format
 * @returns {boolean} - True if signature is valid, false otherwise
 */
function verifySignature(message, signatureBase64, publicKeyBase58) {
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
    
    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
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
