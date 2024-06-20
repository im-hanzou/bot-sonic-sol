let chalk;
import('chalk').then(module => {
  chalk = module.default || module;

  const colors = {
    info: chalk.cyan,
    success: chalk.green.bold,
    warning: chalk.yellow.bold,
    error: chalk.red.bold,
  };

  function printBanner() {
    console.log(chalk.magenta('   ____          _     _____              '));
    console.log(chalk.magenta('  / __/__  ___  (_)___/ ___/__ ___ _  ___ '));
    console.log(chalk.magenta(' _\\ \\/ _ \\/ _ \\/ / __/ (_ / _ `/  \' \\/ -_)'));
    console.log(chalk.magenta('/___/\\___/_//_/_/\\__/\\___/\\_,_/_/_/_/\\__/ '));
    console.log('');
  }
  printBanner();

  const {
    Connection,
    PublicKey,
    LAMPORTS_PER_SOL,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    Keypair,
    SendTransactionError,
  } = require('@solana/web3.js');
  const bip39 = require('bip39');
  const { derivePath } = require('ed25519-hd-key');
  require('dotenv').config();

  const DEVNET_URL = 'https://devnet.sonic.game/';
  const connection = new Connection(DEVNET_URL, 'confirmed');

  function getRandomAmount(min, max) {
    return Math.random() * (max - min) + min;
  }

  async function sendSol(fromKeypair, toPublicKey, amount) {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      })
    );

    try {
      const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
      console.log(colors.success('Transaction confirmed with signature:'), colors.warning(signature));
    } catch (error) {
      if (error instanceof SendTransactionError) {
        const logs = error.transactionLogs || [];
        console.error(colors.error('Transaction simulation failed:'), error.message);
        console.error(colors.error('Logs:'), logs);
      } else {
        console.error(colors.error('Failed to send transaction:'), error);
      }
      throw error;
    }
  }

  async function getKeypairFromSeed(seedPhrase) {
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
    return Keypair.fromSeed(derivedSeed.slice(0, 32));
  }

  async function getAccountBalance(pubkey) {
    return connection.getBalance(pubkey);
  }

  (async () => {
    const seedPhrase = process.env.SEED_PHRASE;
    if (!seedPhrase) {
      throw new Error(colors.error('SEED_PHRASE is not set in the .env file'));
    }
    const fromKeypair = await getKeypairFromSeed(seedPhrase);

    const minAmountToSend = 0.0009;
    const maxAmountToSend = 0.001;
    let currentBalance = await getAccountBalance(fromKeypair.publicKey);

    console.log(colors.info(`Starting balance of the sender: ${(currentBalance / LAMPORTS_PER_SOL).toFixed(8)} SOL`));

    for (let i = 0; i < 100; i++) {
      const toKeypair = Keypair.generate();
      const toPublicKey = toKeypair.publicKey;
      const amountToSend = getRandomAmount(minAmountToSend, maxAmountToSend);

      if (currentBalance < amountToSend * LAMPORTS_PER_SOL) {
        console.warn(colors.warning(`Insufficient funds for the next transfer. Current balance: ${(currentBalance / LAMPORTS_PER_SOL).toFixed(8)} SOL`));
        break;
      }

      try {
        await sendSol(fromKeypair, toPublicKey, amountToSend);
        console.log(colors.success(`Successfully sent ${amountToSend.toFixed(8)} SOL to ${toPublicKey.toString()}`));

        currentBalance -= amountToSend * LAMPORTS_PER_SOL;
        console.log(colors.info(`Updated balance of the sender: ${(currentBalance / LAMPORTS_PER_SOL).toFixed(8)} SOL`));
      } catch (error) {
        console.error(colors.error(`Failed to send SOL to ${toPublicKey.toString()}:`), error);
      }
    }

    console.log(colors.info('Finished sending SOL to 100 addresses.'));
  })();
}).catch(error => {
  console.error(error);
});
