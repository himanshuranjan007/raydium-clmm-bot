import axios from 'axios';
import { config } from '../config';
import logger from '../logger';

export async function sendDiscordNotification(message: string, isError: boolean = false): Promise<void> {
    if (!config.discordWebhookUrl) {
        if (isError) logger.error(`Discord Webhook URL not set. Cannot send error: ${message}`);
        else logger.warn(`Discord Webhook URL not set. Cannot send message: ${message}`);
        return;
    }

    try {
        const content = isError ? `🚨 **ERROR** 🚨\n${message}` : `ℹ️ **INFO** ℹ️\n${message}`;
        await axios.post(config.discordWebhookUrl, {
            content: content,
            username: 'Raydium CLMM Bot',
        });
        logger.info(`Sent Discord notification: ${message.substring(0,50)}...`);
    } catch (error) {
        logger.error('Failed to send Discord notification:', error);
    }
}