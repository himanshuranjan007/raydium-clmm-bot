# Raydium SOL-USDC CLMM Liquidity Management Bot

This bot automates the process of providing and managing liquidity in a SOL-USDC Concentrated Liquidity Market Maker (CLMM) pool on the Raydium platform (Solana mainnet). It aims to keep liquidity provisioned within a dynamic percentage range (e.g., 5%) around the current market price, automatically withdrawing out-of-range positions and re-depositing funds into new, correctly ranged positions.

## Features

*   **Dynamic Liquidity Range:** Provides liquidity within a user-defined percentage range around the current SOL/USDC price.
*   **Automated Position Management:**
    *   Constantly monitors active liquidity positions.
    *   Withdraws liquidity if the current price moves outside the position's range or if the position becomes "stale" (mid-point significantly differs from current optimal).
    *   Uses withdrawn funds to open a new position within the updated target price range.
*   **Token Rebalancing:** If the wallet doesn't have the optimal ratio of SOL and USDC to create a new position, it can (optionally) attempt to rebalance by swapping tokens using the Jupiter aggregator for best rates.
*   **Real-time Data:**
    *   Fetches real-time SOL/USDC price updates from Pyth Network.
    *   Dynamically fetches token balances from the connected wallet.
*   **Notifications:** Sends notifications for key events (LP deposits, withdrawals, rebalancing, errors) to a Discord channel via webhook.
*   **Configuration:** All user-editable variables (private key, RPC URL, pool ID, strategy parameters, etc.) are managed in a `.env` file.
*   **Error Handling & Logging:** Robust error handling with detailed logging to console and log files (`bot.log`, `error.log`).

## Prerequisites

*   **Node.js:** Version 18.x or later. (We recommend using [NVM](https://github.com/nvm-sh/nvm) to manage Node.js versions).
*   **npm** or **yarn:** Package manager for Node.js.
*   **Solana Wallet:** A Solana wallet (e.g., Phantom, Solflare) with its **private key in BS58 format**.
    *   **Funds:** The wallet must have:
        *   Sufficient SOL for transaction fees (gas).
        *   SOL (Wrapped SOL - wSOL) and/or USDC to provide as liquidity.
*   **Discord Webhook URL:** (Optional, for notifications) Create a webhook in your desired Discord channel.
*   **Git:** For cloning the repository.

## Local Installation and Setup

1.  **Clone the Repository:**
    ```bash
    git clone <your-repository-url> raydium-clmm-bot
    cd raydium-clmm-bot
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```
    Alternatively, if you prefer yarn:
    ```bash
    yarn install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project by copying the example file:
    ```bash
    cp .env.example .env
    ```
    Now, open the `.env` file with a text editor and **fill in your specific details**:

    ```dotenv
    # Solana Settings
    RPC_URL=https://api.mainnet-beta.solana.com # Or your preferred mainnet RPC
    PRIVATE_KEY_BS58=YOUR_WALLET_PRIVATE_KEY_BS58_STRING # Exported from Phantom/Solflare, KEEP THIS SECRET!
    MIN_SOL_BALANCE_FOR_GAS=0.05 # Min native SOL to keep for gas (e.g., 0.05 SOL)

    # Raydium Pool Settings
    # IMPORTANT: Find the correct CLMM Pool ID for SOL-USDC on Raydium.
    # Example (THIS IS A RANDOM EXAMPLE, NOT REAL FOR SOL-USDC): 2QdcyrFMPcfnS6E6u52JM362Yp1SRe3QG8G5L3M921gE
    POOL_ID=YOUR_SOL_USDC_CLMM_POOL_ID
    TARGET_POOL_PROGRAM_ID=CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK # Raydium CLMM Program ID (usually fixed)

    # Bot Strategy Settings
    PRICE_RANGE_PERCENTAGE=0.05 # e.g., 0.05 for 5% range around current price
    CHECK_INTERVAL_MS=300000    # How often to check position (e.g., 300000ms = 5 minutes)
    SLIPPAGE_BPS=50             # Slippage for swaps/LP actions in Basis Points (50 = 0.5%)
    MAX_TOKEN_DEPLOY_PERCENTAGE=0.95 # Max % of available SOL/USDC to deploy (0.95 = 95%)

    # Token Mint Addresses (Mainnet-beta)
    SOL_MINT_ADDRESS=So11111111111111111111111111111111111111112 # Wrapped SOL
    USDC_MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v # USDC

    # Pyth Price Feed IDs (Mainnet-beta)
    # Verify at: https://pyth.network/developers/price-feed-ids
    PYTH_SOL_USD_PRICE_FEED_ID=H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQ9hs # SOL/USD

    # Notifications
    DISCORD_WEBHOOK_URL=YOUR_DISCORD_WEBHOOK_URL # Optional: Paste your Discord webhook URL here
    ```

    **CRITICAL NOTES on `.env`:**
    *   **`PRIVATE_KEY_BS58`**: This is extremely sensitive. Keep it secret. **DO NOT commit your `.env` file with the private key to a public repository.**
    *   **`POOL_ID`**: You **MUST** find the correct CLMM Pool ID for the SOL-USDC pair on Raydium's official interface or documentation. Using an incorrect ID will cause the bot to fail.
    *   **`RPC_URL`**: The default Solana RPC can be rate-limited. For serious use, consider a private RPC provider (e.g., QuickNode, Triton, Helius).

## Running the Bot Locally

1.  **Compile TypeScript (if you made changes or first time):**
    ```bash
    npm run build
    ```

2.  **Start the Bot:**
    *   For development (with auto-reloading on file changes):
        ```bash
        npm run dev
        ```
    *   To run the compiled JavaScript (production-like):
        ```bash
        npm start
        ```

The bot will start logging its actions to the console and to `bot.log` and `error.log` files in the project root. Check these logs for detailed information and troubleshooting.

## Deploying to a DigitalOcean Server

This guide assumes you want to run the bot continuously on a server. PM2, a process manager for Node.js, is highly recommended.

1.  **Create a DigitalOcean Droplet:**
    *   Go to your DigitalOcean dashboard and create a new Droplet.
    *   **Image:** Choose an OS. **Ubuntu 22.04 LTS** is recommended.
    *   **Plan:** A basic plan (e.g., "Basic Droplets" with 1 GB RAM / 1 CPU) should be sufficient for a single bot instance. Monitor resource usage and upgrade if needed.
    *   **Region:** Choose a region geographically close to you or Solana validators.
    *   **Authentication:** **SSH keys** are strongly recommended over passwords for better security. Add your public SSH key.
    *   Set a hostname (e.g., `raydium-bot-server`).
    *   Click "Create Droplet".

2.  **Connect to Your Server via SSH:**
    Once the Droplet is created, find its IP address.
    ```bash
    ssh root@YOUR_DROPLET_IP_ADDRESS
    ```
    (If you set up a non-root user during creation or later, use that username).

3.  **Install Server Dependencies:**
    *   **Update System Packages:**
        ```bash
        sudo apt update && sudo apt upgrade -y
        ```
    *   **Install Node.js using NVM (Node Version Manager - Recommended):**
        ```bash
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash # Check for latest nvm version
        # Source nvm to use it in the current session
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
        # Verify nvm installation (close and reopen terminal or source .bashrc/.zshrc if command not found)
        # source ~/.bashrc # or source ~/.zshrc
        # nvm --version
        # Install the latest LTS version of Node.js
        nvm install --lts
        nvm use --lts
        nvm alias default lts
        # Verify Node.js and npm installation
        node -v
        npm -v
        ```
    *   **Install Git:**
        ```bash
        sudo apt install git -y
        ```

4.  **Deploy Bot Code to Server:**
    *   Clone your repository onto the server:
        ```bash
        git clone <your-repository-url> raydium-clmm-bot
        cd raydium-clmm-bot
        ```

5.  **Configure Bot on Server:**
    *   Copy the example environment file and edit it with your production settings:
        ```bash
        cp .env.example .env
        nano .env
        ```
        **Paste your actual `PRIVATE_KEY_BS58`, `POOL_ID`, `DISCORD_WEBHOOK_URL`, etc., into this file on the server.**
        Save and exit (`Ctrl+X`, then `Y`, then `Enter` in `nano`).

6.  **Install Bot Dependencies on Server:**
    ```bash
    npm install
    ```

7.  **Build the Bot:**
    ```bash
    npm run build
    ```
    This creates the `dist` directory with the compiled JavaScript.

8.  **Install and Use PM2 (Process Manager):**
    PM2 will keep your bot running in the background, restart it on crashes, and manage logs.
    *   **Install PM2 globally:**
        ```bash
        sudo npm install pm2 -g
        ```
    *   **Start your bot with PM2:**
        From your project directory (`~/raydium-clmm-bot`):
        ```bash
        pm2 start dist/bot.js --name raydium-clmm-bot
        ```
    *   **Ensure PM2 starts on server reboot:**
        PM2 will generate a command you need to run. Execute it:
        ```bash
        pm2 startup
        # It will output a command like:
        # sudo env PATH=$PATH:/home/user/.nvm/versions/node/vXX.X.X/bin /home/user/.nvm/versions/node/vXX.X.X/lib/node_modules/pm2/bin/pm2 startup systemd -u user --hp /home/user
        # Copy and run the command it gives you.
        ```
    *   **Save the current PM2 process list:**
        ```bash
        pm2 save
        ```
    *   **Useful PM2 Commands:**
        *   List all running processes: `pm2 list`
        *   View logs for your bot: `pm2 logs raydium-clmm-bot` or `pm2 logs raydium-clmm-bot --lines 100`
        *   Monitor processes: `pm2 monit`
        *   Restart bot: `pm2 restart raydium-clmm-bot`
        *   Stop bot: `pm2 stop raydium-clmm-bot`
        *   Delete bot from PM2: `pm2 delete raydium-clmm-bot`

Your bot should now be running continuously on your DigitalOcean server.

## Important Considerations & Disclaimer

*   **SECURITY:** Your wallet's private key (`PRIVATE_KEY_BS58`) grants full control over your funds. Protect it diligently. Never share it, and ensure the `.env` file on your server has restrictive permissions.
*   **FINANCIAL RISK:** Interacting with DeFi protocols and automated trading bots carries significant financial risk, including the risk of impermanent loss and potential loss of all invested capital due to smart contract vulnerabilities, market volatility, or bot errors. This bot is experimental. **Use at your own risk.**
*   **TESTING:** Thoroughly test the bot with small amounts on mainnet before deploying significant capital. Understand its behavior in various market conditions.
*   **SDK & API CHANGES:** The Raydium SDK, Jupiter API, and Pyth Network can have updates or breaking changes. The bot might require code adjustments to remain compatible.
*   **POOL_ID ACCURACY:** Double-check the `POOL_ID` for the SOL-USDC CLMM pool. Using an incorrect ID will lead to errors.
*   **GAS FEES:** All blockchain transactions incur SOL gas fees. Ensure your wallet maintains a sufficient SOL balance for operations.
*   **LOG MONITORING:** Regularly check the bot's logs (via PM2 or log files) on the server to ensure it's operating as expected and to catch any errors.

---

This README should provide a good starting point for users and for setting up the bot. Remember to replace `<your-repository-url>` with the actual URL of your Git repository.