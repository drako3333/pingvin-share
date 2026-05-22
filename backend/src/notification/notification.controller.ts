import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";

@Controller("notifications")
@UseGuards(JwtGuard)
export class NotificationController {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  @Get("vapid-public-key")
  async getVapidPublicKey() {
    const publicKey = this.configService.get("push.vapidPublicKey");
    return { publicKey };
  }

  @Post("subscribe")
  @HttpCode(201)
  async subscribe(
    @GetUser() user: User,
    @Body() body: { endpoint: string; p256dh: string; auth: string },
  ) {
    const { endpoint, p256dh, auth } = body;
    if (!endpoint || !p256dh || !auth) {
      throw new Error("Missing required subscription fields");
    }

    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        p256dh,
        auth,
        userId: user.id,
      },
      update: {
        p256dh,
        auth,
        userId: user.id,
      },
    });

    return { success: true };
  }

  @Post("unsubscribe")
  @HttpCode(200)
  async unsubscribe(
    @GetUser() user: User,
    @Body() body: { endpoint: string },
  ) {
    const { endpoint } = body;
    if (!endpoint) {
      throw new Error("Missing required endpoint field");
    }

    await this.prisma.pushSubscription.deleteMany({
      where: {
        endpoint,
        userId: user.id,
      },
    });

    return { success: true };
  }
}
