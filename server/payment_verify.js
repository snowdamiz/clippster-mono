const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

/**
 * Verify a Solana payment transaction
 * @param {string} txSignature - The transaction signature
 * @param {string} fromAddress - The sender's wallet address (user)
 * @param {string} toAddress - The recipient's wallet address (company)
 * @param {number} expectedSolAmount - Expected SOL amount
 * @param {string} rpcUrl - Solana RPC URL (defaults to mainnet)
 * @returns {Promise<object>} - Verification result
 */
async function verifyPayment(txSignature, fromAddress, toAddress, expectedSolAmount, rpcUrl = 'https://api.mainnet-beta.solana.com') {
  try {
    // Connect to Solana
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Get transaction details
    const transaction = await connection.getTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    
    if (!transaction) {
      return {
        valid: false,
        error: 'Transaction not found'
      };
    }

    // Check if transaction was successful
    if (transaction.meta.err) {
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
      return {
        valid: false,
        error: 'Amount mismatch',
        expected: expectedSolAmount,
        actual: actualSolAmount
      };
    }

    // Get block time for the transaction
    const blockTime = transaction.blockTime;

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
