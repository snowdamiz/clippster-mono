const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { fetchMetadata, findMetadataPda } = require('@metaplex-foundation/mpl-token-metadata');
const { publicKey } = require('@metaplex-foundation/umi');

// PulseKit initialization
let pulsekit = null;
try {
  const { PulseKit } = require('@120356aa/pulsekit-sdk');
  const apiKey = process.env.PULSEKIT_METADATA_SERVICE_KEY;
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
 * Fetch token metadata using Metaplex
 * @param {string} mintAddress - The mint address of the token
 * @param {string} rpcUrl - Solana RPC URL
 * @returns {Promise<object>} - Metadata result
 */
async function getMetadata(mintAddress, rpcUrl) {
  // Use provided RPC URL or fallback to environment variable or default
  const solanaRpcUrl = rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  
  pulseCapture({
    type: 'metadata.fetch.start',
    level: 'info',
    message: `Fetching metadata for mint: ${mintAddress}`,
    metadata: { mintAddress, rpcUrl: solanaRpcUrl },
    tags: { service: 'metadata', action: 'fetch_start' }
  });
  
  try {
    const umi = createUmi(solanaRpcUrl);
    const mint = publicKey(mintAddress);
    const metadataPda = findMetadataPda(umi, { mint });
    
    const metadata = await fetchMetadata(umi, metadataPda);
    
    // Fetch the off-chain JSON if uri is present
    let jsonMetadata = {};
    let image = '';
    
    if (metadata.uri) {
      try {
        // Remove null bytes if any
        const cleanUri = metadata.uri.replace(/\0/g, '');
        if (cleanUri) {
            const response = await fetch(cleanUri);
            if (response.ok) {
            jsonMetadata = await response.json();
            image = jsonMetadata.image || '';
            }
        }
      } catch (e) {
        console.error('Failed to fetch off-chain metadata:', e);
        pulseCapture({
          type: 'metadata.offchain.error',
          level: 'warning',
          message: `Failed to fetch off-chain metadata: ${e.message}`,
          metadata: { mintAddress, uri: metadata.uri, error: e.message },
          tags: { service: 'metadata', action: 'offchain_error' }
        });
      }
    }
    
    pulseCapture({
      type: 'metadata.fetch.success',
      level: 'info',
      message: `Successfully fetched metadata for mint: ${mintAddress}`,
      metadata: { mintAddress, name: metadata.name, symbol: metadata.symbol },
      tags: { service: 'metadata', action: 'fetch_success' }
    });
    
    return {
      valid: true,
      metadata: {
        name: metadata.name.replace(/\0/g, ''),
        symbol: metadata.symbol.replace(/\0/g, ''),
        uri: metadata.uri.replace(/\0/g, ''),
        image: image,
        description: jsonMetadata.description || ''
      }
    };
  } catch (error) {
    pulseCapture({
      type: 'metadata.fetch.error',
      level: 'error',
      message: `Failed to fetch metadata: ${error.message}`,
      metadata: { mintAddress, error: error.message, stack: error.stack },
      tags: { service: 'metadata', action: 'fetch_error' }
    });
    
    return {
      valid: false,
      error: error.message
    };
  }
}

// CLI interface
if (require.main === module) {
  const fs = require('fs');
  
  // Check if file path is provided as argument
  if (process.argv[2]) {
    (async () => {
      try {
        const input = fs.readFileSync(process.argv[2], 'utf8');
        const data = JSON.parse(input);
        const { mint_address, rpc_url } = data;
        
        if (!mint_address) {
          console.log(JSON.stringify({ 
            valid: false,
            error: 'Missing required field: mint_address' 
          }));
          process.exit(1);
        }
        
        const result = await getMetadata(mint_address, rpc_url);
        
        console.log(JSON.stringify(result));
        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        console.log(JSON.stringify({ 
          valid: false,
          error: error.message 
        }));
        process.exit(1);
      }
    })();
  } else {
    console.log(JSON.stringify({
      valid: false,
      error: 'Usage: node fetch_metadata.js <input_file.json>'
    }));
    process.exit(1);
  }
}

module.exports = { getMetadata };

