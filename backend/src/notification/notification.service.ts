import { Injectable } from "@nestjs/common";
import { ConfigService } from "src/config/config.service";

@Injectable()
export class NotificationService {
  constructor(private configService: ConfigService) {}

  async sendWebhook(message: string, title = "Ustrohosting Share") {
    const discordUrl = this.configService.get("share.webhookDiscord");
    const slackUrl = this.configService.get("share.webhookSlack");
    const telegramToken = this.configService.get("share.webhookTelegramToken");
    const telegramChatId = this.configService.get("share.webhookTelegramChatId");

    // 1. Discord Webhook
    if (discordUrl) {
      try {
        await fetch(discordUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "Ustrohosting Share",
            embeds: [
              {
                title: title,
                description: message,
                color: 2264550, // blue hex equivalent #228be6
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
      } catch (err) {
        console.error("Discord webhook notification failed", err);
      }
    }

    // 2. Slack Webhook
    if (slackUrl) {
      try {
        await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `*${title}*\n${message}`,
          }),
        });
      } catch (err) {
        console.error("Slack webhook notification failed", err);
      }
    }

    // 3. Telegram Bot API
    if (telegramToken && telegramChatId) {
      try {
        const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: `*${title}*\n${message}`,
            parse_mode: "Markdown",
          }),
        });
      } catch (err) {
        console.error("Telegram notification failed", err);
      }
    }
  }
}
