import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { User } from "@prisma/client";
import { Request, Response } from "express";
import * as moment from "moment";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { AdminShareDTO } from "./dto/adminShare.dto";
import { CreateShareDTO } from "./dto/createShare.dto";
import { MyShareDTO } from "./dto/myShare.dto";
import { ShareDTO } from "./dto/share.dto";
import { ShareMetaDataDTO } from "./dto/shareMetaData.dto";
import { SharePasswordDto } from "./dto/sharePassword.dto";
import { CreateShareGuard } from "./guard/createShare.guard";
import { ShareOwnerGuard } from "./guard/shareOwner.guard";
import { ShareSecurityGuard } from "./guard/shareSecurity.guard";
import { ShareTokenSecurity } from "./guard/shareTokenSecurity.guard";
import { ShareService } from "./share.service";
import { ShareAnalyticsService } from "./share-analytics.service";
import { CompletedShareDTO } from "./dto/shareComplete.dto";
import { AuditLogService } from "src/audit/audit.service";
import { NotificationService } from "src/notification/notification.service";

@Controller("shares")
export class ShareController {
  constructor(
    private shareService: ShareService,
    private jwtService: JwtService,
    private auditLogService: AuditLogService,
    private notificationService: NotificationService,
    private shareAnalyticsService: ShareAnalyticsService,
  ) {}

  @Get("all")
  @UseGuards(JwtGuard, AdministratorGuard)
  async getAllShares() {
    return new AdminShareDTO().fromList(await this.shareService.getShares());
  }

  @Get()
  @UseGuards(JwtGuard)
  async getMyShares(@GetUser() user: User) {
    return new MyShareDTO().fromList(
      await this.shareService.getSharesByUser(user.id),
    );
  }

  @Get(":id")
  @UseGuards(ShareSecurityGuard)
  async get(@Param("id") id: string) {
    return new ShareDTO().from(await this.shareService.get(id));
  }

  @Get(":id/from-owner")
  @UseGuards(ShareOwnerGuard)
  async getFromOwner(@Param("id") id: string) {
    return new ShareDTO().from(await this.shareService.get(id));
  }

  @Get(":id/metaData")
  @UseGuards(ShareSecurityGuard)
  async getMetaData(@Param("id") id: string) {
    return new ShareMetaDataDTO().from(await this.shareService.getMetaData(id));
  }

  @Post()
  @UseGuards(CreateShareGuard)
  async create(
    @Body() body: CreateShareDTO,
    @Req() request: Request,
    @GetUser() user: User,
  ) {
    const { reverse_share_token } = request.cookies;
    return new ShareDTO().from(
      await this.shareService.create(body, user, reverse_share_token, request.ip),
    );
  }

  @Post(":id/complete")
  @HttpCode(202)
  @UseGuards(CreateShareGuard, ShareOwnerGuard)
  async complete(@Param("id") id: string, @Req() request: Request) {
    const { reverse_share_token } = request.cookies;
    const share = await this.shareService.complete(id, reverse_share_token);

    const ip = request.ip;
    const creatorUser = request["user"] as User;
    const username = creatorUser?.username || "Anonyme";
    const userId = creatorUser?.id || undefined;

    await this.auditLogService.create(
      "PARTAGE_CREE",
      ip,
      { shareId: id, filesCount: share.files?.length || 0 },
      userId,
      username,
    );

    await this.notificationService.sendWebhook(
      `Le partage *${id}* contenant ${share.files?.length || 0} fichier(s) a été créé avec succès par *${username}*.`,
      "Nouveau Partage Créé",
    );

    return new CompletedShareDTO().from(share as any);
  }

  @Delete(":id/complete")
  @UseGuards(ShareOwnerGuard)
  async revertComplete(@Param("id") id: string) {
    return new ShareDTO().from(await this.shareService.revertComplete(id));
  }

  @Delete(":id")
  @UseGuards(ShareOwnerGuard)
  async remove(@Param("id") id: string, @GetUser() user: User, @Req() request: Request) {
    const isDeleterAdmin = user?.isAdmin === true;
    await this.shareService.remove(id, isDeleterAdmin);

    const ip = request.ip;
    const username = user?.username || "Anonyme";
    const userId = user?.id || undefined;

    await this.auditLogService.create(
      "PARTAGE_SUPPRIME",
      ip,
      { shareId: id },
      userId,
      username,
    );

    await this.notificationService.sendWebhook(
      `Le partage *${id}* a été supprimé par *${username}*.`,
      "Partage Supprimé",
    );
  }

  @Throttle({
    default: {
      limit: 10,
      ttl: 60,
    },
  })
  @Get("isShareIdAvailable/:id")
  async isShareIdAvailable(@Param("id") id: string) {
    return this.shareService.isShareIdAvailable(id);
  }

  @HttpCode(200)
  @Throttle({
    default: {
      limit: 20,
      ttl: 5 * 60,
    },
  })
  @UseGuards(ShareTokenSecurity)
  @Post(":id/token")
  async getShareToken(
    @Param("id") id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: SharePasswordDto,
  ) {
    const token = await this.shareService.getShareToken(id, body.password, request.ip);

    this.clearShareTokenCookies(request, response);
    response.cookie(`share_${id}_token`, token, {
      path: "/",
      httpOnly: true,
    });

    return { token };
  }

  @Get(":id/qrcode")
  @UseGuards(ShareSecurityGuard)
  async getQrCode(
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const qrCodeSvg = await this.shareService.getQrCode(id);
    response.setHeader("Content-Type", "image/svg+xml");
    response.setHeader("Content-Disposition", `inline; filename="qrcode-${id}.svg"`);
    response.send(qrCodeSvg);
  }

  @Get(":id/analytics")
  @UseGuards(ShareOwnerGuard)
  async getAnalytics(@Param("id") id: string) {
    return this.shareAnalyticsService.getForShare(id);
  }

  /**
   * Keeps the 10 most recent share token cookies and deletes the rest and all expired ones
   */
  private clearShareTokenCookies(request: Request, response: Response) {
    const shareTokenCookies = Object.entries(request.cookies)
      .filter(([key]) => key.startsWith("share_") && key.endsWith("_token"))
      .map(([key, value]) => {
        let payload: any = null;
        try {
          payload = this.jwtService.decode(value);
        } catch {}
        return { key, payload };
      });

    const malformedCookies = shareTokenCookies.filter(
      (cookie) => !cookie.payload || typeof cookie.payload.exp !== "number",
    );
    malformedCookies.forEach((cookie) => response.clearCookie(cookie.key));

    const activeCookies = shareTokenCookies.filter(
      (cookie) => cookie.payload && typeof cookie.payload.exp === "number",
    );

    const expiredTokens = activeCookies.filter(
      (cookie) => cookie.payload.exp < moment().unix(),
    );
    const validTokens = activeCookies.filter(
      (cookie) => cookie.payload.exp >= moment().unix(),
    );

    expiredTokens.forEach((cookie) => response.clearCookie(cookie.key));

    if (validTokens.length > 10) {
      validTokens
        .sort((a, b) => a.payload.exp - b.payload.exp)
        .slice(0, -10)
        .forEach((cookie) => response.clearCookie(cookie.key));
    }
  }
}
