import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import * as webpush from "web-push";

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    let publicKey = this.configService.get("push.vapidPublicKey");
    let privateKey = this.configService.get("push.vapidPrivateKey");

    if (!publicKey || !privateKey) {
      try {
        const keys = webpush.generateVAPIDKeys();
        
        await this.prisma.config.update({
          where: { name_category: { name: "vapidPublicKey", category: "push" } },
          data: { value: keys.publicKey },
        });
        await this.prisma.config.update({
          where: { name_category: { name: "vapidPrivateKey", category: "push" } },
          data: { value: keys.privateKey },
        });

        // Update in-memory cache of ConfigService
        const configVariables = this.configService["configVariables"];
        const pubVar = configVariables.find(
          (v) => v.category === "push" && v.name === "vapidPublicKey",
        );
        if (pubVar) pubVar.value = keys.publicKey;

        const privVar = configVariables.find(
          (v) => v.category === "push" && v.name === "vapidPrivateKey",
        );
        if (privVar) privVar.value = keys.privateKey;

        publicKey = keys.publicKey;
        privateKey = keys.privateKey;

        this.logger.log("Successfully generated and saved new VAPID keys for Web Push.");
      } catch (err) {
        this.logger.error("Failed to generate and save VAPID keys:", err);
      }
    }

    if (publicKey && privateKey) {
      const appUrl = this.configService.get("general.appUrl") || "http://localhost:3000";
      webpush.setVapidDetails(
        `mailto:support@${new URL(appUrl).hostname}`,
        publicKey,
        privateKey,
      );
    }
  }

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    urlPath = "/",
  ) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title,
      body,
      url: urlPath,
    });

    const appUrl = this.configService.get("general.appUrl") || "http://localhost:3000";
    const fullUrl = `${appUrl.replace(/\/$/, "")}${urlPath}`;

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title,
            body,
            url: fullUrl,
          }),
        );
      } catch (err: any) {
        // If the subscription has expired or is no longer active, clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.prisma.pushSubscription.delete({
            where: { id: sub.id },
          }).catch(() => {});
          this.logger.log(`Cleaned up expired push subscription for user ${userId}`);
        } else {
          this.logger.error(
            `Failed to send push notification to subscription ${sub.id}:`,
            err,
          );
        }
      }
    });

    // Execute push sends in the background
    Promise.all(sendPromises).catch((err) => {
      this.logger.error("Error in background push notification execution:", err);
    });
  }

  async sendWebhook(message: string, title = "Ustrohosting Share") {
    const discordUrl = this.configService.get("notifications.webhookDiscord");
    const slackUrl = this.configService.get("notifications.webhookSlack");
    const telegramToken = this.configService.get("notifications.webhookTelegramToken");
    const telegramChatId = this.configService.get("notifications.webhookTelegramChatId");

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

