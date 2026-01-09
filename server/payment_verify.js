const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// PulseKit initialization
let pulsekit = null;
try {
  const { PulseKit } = require('@120356aa/pulsekit-sdk');
  const apiKey = process.env.PULSEKIT_PAYMENT_VERIFICATION_SERVICE;
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
 * Verify a Solana payment transaction
 * @param {string} txSignature - The transaction signature
 * @param {string} fromAddress - The sender's wallet address (user)
 * @param {string} toAddress - The recipient's wallet address (company)
 * @param {number} expectedSolAmount - Expected SOL amount
 * @param {string} rpcUrl - Solana RPC URL (defaults to mainnet)
 * @returns {Promise<object>} - Verification result
 */
async function verifyPayment(txSignature, fromAddress, toAddress, expectedSolAmount, rpcUrl) {
  // Use provided RPC URL or fallback to environment variable or default
  const solanaRpcUrl = rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  
  pulseCapture({
    type: 'payment.verify.start',
    level: 'info',
    message: `Verifying payment: ${txSignature}`,
    metadata: { txSignature, fromAddress, toAddress, expectedSolAmount },
    tags: { service: 'payment', action: 'verify_start' }
  });
  
  try {
    // Connect to Solana
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    
    // Get transaction details
    const transaction = await connection.getTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    
    if (!transaction) {
      pulseCapture({
        type: 'payment.verify.not_found',
        level: 'warning',
        message: `Transaction not found: ${txSignature}`,
        metadata: { txSignature },
        tags: { service: 'payment', action: 'tx_not_found' }
      });
      return {
        valid: false,
        error: 'Transaction not found'
      };
    }

    // Check if transaction was successful
    if (transaction.meta.err) {
      pulseCapture({
        type: 'payment.verify.tx_failed',
        level: 'warning',
        message: `Transaction failed on-chain: ${txSignature}`,
        metadata: { txSignature, error: transaction.meta.err },
        tags: { service: 'payment', action: 'tx_failed' }
      });
      return {
        valid: false,
        error: 'Transaction failed on-chain',
        details: transaction.meta.err
      };
    }

    // Get pre and post balances
    const accountKeys = transaction.transaction.message.getAccountKeys();
    
    // Find sender and receiver indices
    let senderIndex = -1;
    let receiverIndex = -1;

    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys.get(i).toBase58();
      if (key === fromAddress) senderIndex = i;
      if (key === toAddress) receiverIndex = i;
    }

    if (senderIndex === -1) {
      return {
        valid: false,
        error: 'Sender address not found in transaction'
      };
    }

    if (receiverIndex === -1) {
      return {
        valid: false,
        error: 'Receiver address not found in transaction'
      };
    }

    // Calculate actual transferred amount
    const preBalanceSender = transaction.meta.preBalances[senderIndex];
    const postBalanceSender = transaction.meta.postBalances[senderIndex];
    const preBalanceReceiver = transaction.meta.preBalances[receiverIndex];
    const postBalanceReceiver = transaction.meta.postBalances[receiverIndex];

    const receiverChange = postBalanceReceiver - preBalanceReceiver;
    const actualSolAmount = receiverChange / LAMPORTS_PER_SOL;

    // Allow 0.001 SOL tolerance for fees/rounding
    const tolerance = 0.001;
    const amountMatch = Math.abs(actualSolAmount - expectedSolAmount) <= tolerance;

    if (!amountMatch) {
      pulseCapture({
        type: 'payment.verify.mismatch',
        level: 'warning',
        message: `Payment amount mismatch for ${txSignature}`,
        metadata: { txSignature, expected: expectedSolAmount, actual: actualSolAmount },
        tags: { service: 'payment', action: 'verify_mismatch' }
      });
      return {
        valid: false,
        error: 'Amount mismatch',
        expected: expectedSolAmount,
        actual: actualSolAmount
      };
    }

    // Get block time for the transaction
    const blockTime = transaction.blockTime;

    pulseCapture({
      type: 'payment.verify.success',
      level: 'info',
      message: `Payment verified successfully: ${txSignature}`,
      metadata: { txSignature, fromAddress, toAddress, amount: actualSolAmount, slot: transaction.slot },
      tags: { service: 'payment', action: 'verify_success' }
    });

    return {
      valid: true,
      transaction: {
        signature: txSignature,
        from: fromAddress,
        to: toAddress,
        amount_sol: actualSolAmount,
        block_time: blockTime,
        slot: transaction.slot
      }
    };

  } catch (error) {
    console.error('Error verifying payment:', error);
    pulseCapture({
      type: 'payment.verify.error',
      level: 'error',
      message: `Failed to verify payment: ${error.message}`,
      metadata: { txSignature, fromAddress, toAddress, error: error.message, stack: error.stack },
      tags: { service: 'payment', action: 'verify_error' }
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
        const { tx_signature, from_address, to_address, expected_sol_amount, rpc_url } = data;
        
        if (!tx_signature || !from_address || !to_address || expected_sol_amount === undefined) {
          console.log(JSON.stringify({ 
            valid: false,
            error: 'Missing required fields: tx_signature, from_address, to_address, expected_sol_amount' 
          }));
          process.exit(1);
        }
        
        const result = await verifyPayment(
          tx_signature,
          from_address,
          to_address,
          expected_sol_amount,
          rpc_url
        );
        
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
      error: 'Usage: node payment_verify.js <input_file.json>'
    }));
    process.exit(1);
  }
}

module.exports = { verifyPayment };
