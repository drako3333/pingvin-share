import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { Share, User } from "@prisma/client";
import * as archiver from "archiver";
import * as argon from "argon2";
import * as fs from "fs";
import * as moment from "moment";
import * as qrcode from "qrcode-svg";
import { ClamScanService } from "src/clamscan/clamscan.service";
import { ConfigService } from "src/config/config.service";
import { EmailService } from "src/email/email.service";
import { FileService } from "src/file/file.service";
import { PrismaService } from "src/prisma/prisma.service";
import { ReverseShareService } from "src/reverseShare/reverseShare.service";
import { parseRelativeDateToAbsolute } from "src/utils/date.util";
import { SHARE_DIRECTORY } from "../constants";
import { CreateShareDTO } from "./dto/createShare.dto";
import { NotificationService } from "src/notification/notification.service";
import { ActivityService } from "src/activity/activity.service";

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private fileService: FileService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private reverseShareService: ReverseShareService,
    private clamScanService: ClamScanService,
    private notificationService: NotificationService,
    private activityService: ActivityService,
  ) {}

  async create(share: CreateShareDTO, user?: User, reverseShareToken?: string, clientIp?: string) {
    if (!(await this.isShareIdAvailable(share.id)).isAvailable)
      throw new BadRequestException("Share id already in use");

    if (!share.security || Object.keys(share.security).length == 0)
      share.security = undefined;

    if (share.security?.password) {
      share.security.password = await argon.hash(share.security.password);
    }

    let expirationDate: Date;

    // If share is created by a reverse share token override the expiration date
    const reverseShare =
      await this.reverseShareService.getByToken(reverseShareToken);
    if (reverseShare) {
      expirationDate = reverseShare.shareExpiration;
    } else {
      const parsedExpiration = parseRelativeDateToAbsolute(share.expiration);

      const expiresNever = moment(0).toDate() == parsedExpiration;

      const maxExpiration = this.configService.get("share.maxExpiration");
      if (
        maxExpiration.value !== 0 &&
        (expiresNever ||
          parsedExpiration >
            moment().add(maxExpiration.value, maxExpiration.unit).toDate())
      ) {
        throw new BadRequestException(
          "Expiration date exceeds maximum expiration date",
        );
      }

      expirationDate = parsedExpiration;
    }

    await fs.promises.mkdir(`${SHARE_DIRECTORY}/${share.id}`, {
      recursive: true,
    });

    const isS3Enabled = this.configService.get("s3.enabled") === "true" || this.configService.get("s3.enabled") === true;
    const disableLocalStorage = this.configService.get("s3.disableLocalStorage") === "true" || this.configService.get("s3.disableLocalStorage") === true;
    const isMultiBucketsEnabled = this.configService.get("s3.multiBucketsEnabled") === "true" || this.configService.get("s3.multiBucketsEnabled") === true;
    const useS3 = isS3Enabled || isMultiBucketsEnabled || disableLocalStorage;
    let s3BucketId: string | null = null;

    if (isMultiBucketsEnabled && clientIp) {
      // Normalize IPv6 mapped IPv4 or local loopback
      const normalizedIp = clientIp.replace(/^::ffff:/, "");
      if (normalizedIp !== "127.0.0.1" && normalizedIp !== "::1") {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2-second timeout

          const res = await fetch(`https://ipapi.co/${normalizedIp}/json/`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const geoData = (await res.json()) as any;
            const country = geoData.country_name;      // e.g. "France" or "United States"
            const continent = geoData.continent_code;  // e.g. "EU", "NA", "AS"
            const region = geoData.region;             // e.g. "Île-de-France"

            const bucketsConfigStr = this.configService.get("s3.multiBucketsConfig");
            const buckets = JSON.parse(bucketsConfigStr || "[]");

            for (const bucket of buckets) {
              if (Array.isArray(bucket.regionsMatched)) {
                const match = bucket.regionsMatched.some((r: string) => {
                  const rLower = r.toLowerCase();
                  return (
                    (country && country.toLowerCase().includes(rLower)) ||
                    (continent && continent.toLowerCase() === rLower) ||
                    (region && region.toLowerCase().includes(rLower)) ||
                    (rLower === "europe" && continent === "EU") ||
                    (rLower === "north america" && continent === "NA") ||
                    (rLower === "asia" && continent === "AS")
                  );
                });

                if (match) {
                  s3BucketId = bucket.id;
                  this.logger.log(`Routed share ${share.id} to S3 bucket ${s3BucketId} for IP ${normalizedIp} (${country || "unknown country"})`);
                  break;
                }
              }
            }
          }
        } catch (err: any) {
          this.logger.warn(`Could not resolve IP location for ${normalizedIp}: ${err.message}`);
        }
      }
    }

    if (isMultiBucketsEnabled && !s3BucketId) {
      const bucketsConfigStr = this.configService.get("s3.multiBucketsConfig");
      try {
        const buckets = JSON.parse(bucketsConfigStr || "[]");
        if (buckets.length > 0) {
          s3BucketId = buckets[0].id;
          this.logger.log(`Routed share ${share.id} to S3 fallback bucket ${s3BucketId}`);
        }
      } catch (err: any) {
        this.logger.warn(`Could not parse s3.multiBucketsConfig for fallback: ${err.message}`);
      }
    }

    const shareTuple = await this.prisma.share.create({
      data: {
        ...share,
        expiration: expirationDate,
        creator: { connect: user ? { id: user.id } : undefined },
        security: { create: share.security },
        recipients: {
          create: share.recipients
            ? share.recipients.map((email) => ({ email }))
            : [],
        },
        storageProvider: useS3 ? "S3" : "LOCAL",
        s3BucketId,
      },
    });

    if (reverseShare) {
      // Assign share to reverse share token
      await this.prisma.reverseShare.update({
        where: { token: reverseShareToken },
        data: {
          shares: {
            connect: { id: shareTuple.id },
          },
        },
      });
    }

    return shareTuple;
  }

  async createZip(shareId: string) {
    if (this.configService.get("s3.enabled") || this.configService.get("s3.disableLocalStorage")) return;

    const path = `${SHARE_DIRECTORY}/${shareId}`;

    const files = await this.prisma.file.findMany({ where: { shareId } });
    const archive = archiver("zip", {
      zlib: { level: this.configService.get("share.zipCompressionLevel") },
    });
    const writeStream = fs.createWriteStream(`${path}/archive.zip`);

    for (const file of files) {
      const filePath = file.hash
        ? `${SHARE_DIRECTORY}/_files/${file.hash}`
        : `${path}/${file.id}`;
      archive.append(fs.createReadStream(filePath), {
        name: file.name,
      });
    }

    archive.pipe(writeStream);
    await archive.finalize();
  }

  async complete(id: string, reverseShareToken?: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
      include: {
        files: true,
        recipients: true,
        creator: true,
        reverseShare: { include: { creator: true } },
      },
    });

    if (await this.isShareCompleted(id))
      throw new BadRequestException("Share already completed");

    if (share.files.length == 0)
      throw new BadRequestException(
        "You need at least on file in your share to complete it.",
      );

    // Asynchronously create a zip of all files
    if (share.files.length > 1)
      this.createZip(id).then(() =>
        this.prisma.share.update({ where: { id }, data: { isZipReady: true } }),
      );

    // Send email for each recipient
    for (const recipient of share.recipients) {
      await this.emailService.sendMailToShareRecipients(
        recipient.email,
        share.id,
        share.creator,
        share.description,
        share.expiration,
      );
    }

    const notifyReverseShareCreator = share.reverseShare
      ? this.configService.get("smtp.enabled") &&
        share.reverseShare.sendEmailNotification
      : undefined;

    if (notifyReverseShareCreator) {
      await this.emailService.sendMailToReverseShareCreator(
        share.reverseShare.creator.email,
        share.id,
      );
    }

    // Check if any file is malicious with ClamAV
    void this.clamScanService.checkAndRemove(share.id);

    if (share.reverseShare) {
      await this.prisma.reverseShare.update({
        where: { token: reverseShareToken },
        data: { remainingUses: { decrement: 1 } },
      });

      // Send push notification to reverse share creator
      const shareName = share.name || share.id;
      void this.notificationService.sendPushNotification(
        share.reverseShare.creatorId,
        "Nouveau partage reçu",
        `Un utilisateur a déposé un partage "${shareName}" via votre lien de partage inversé.`,
        `/share/${share.id}`,
      );
    }

    const updatedShare = await this.prisma.share.update({
      where: { id },
      data: { uploadLocked: true },
      include: { files: true },
    });

    return {
      ...updatedShare,
      notifyReverseShareCreator,
    };
  }

  async revertComplete(id: string) {
    return this.prisma.share.update({
      where: { id },
      data: { uploadLocked: false, isZipReady: false },
    });
  }

  private enrichShareWithS3Info(share: any): any {
    if (share.storageProvider !== "S3") {
      return {
        ...share,
        s3BucketType: null,
        s3BucketName: null,
      };
    }

    const configStr = this.configService.get("s3.multiBucketsConfig");
    let buckets: any[] = [];
    try {
      buckets = JSON.parse(configStr || "[]");
    } catch (e) {
      // Ignore
    }

    let s3BucketType: string | null = null;
    let s3BucketName: string | null = null;

    if (share.s3BucketId) {
      const bucket = buckets.find((b: any) => b.id === share.s3BucketId);
      if (bucket) {
        s3BucketType = bucket.type || null;
        s3BucketName = bucket.name || bucket.bucketName || null;
      }
    }

    // Fallback if s3BucketId was not found or not set
    if (!s3BucketType) {
      // Check default S3 configuration or endpoint
      const defaultEndpoint = this.configService.get("s3.endpoint") || "";
      if (defaultEndpoint.toLowerCase().includes("minio")) {
        s3BucketType = "minio";
        s3BucketName = this.configService.get("s3.bucketName") || "MinIO";
      } else {
        s3BucketType = "s3";
        s3BucketName = this.configService.get("s3.bucketName") || "S3 Cloud";
      }
    }

    return {
      ...share,
      s3BucketType,
      s3BucketName,
    };
  }

  async getShares() {
    const shares = await this.prisma.share.findMany({
      orderBy: {
        expiration: "desc",
      },
      include: { files: true, creator: true },
    });

    return shares.map((share) => {
      return this.enrichShareWithS3Info({
        ...share,
        size: share.files.reduce((acc, file) => acc + parseInt(file.size), 0),
      });
    });
  }

  async getSharesByUser(userId: string) {
    const shares = await this.prisma.share.findMany({
      where: {
        uploadLocked: true,
        // We want to grab any shares that are not expired or have their expiration date set to "never" (unix 0)
        OR: [
          { expiration: { gt: new Date() } },
          { expiration: { equals: moment(0).toDate() } },
        ],
        // Access rules: either created by the user, or part of a shared collaborative folder
        AND: {
          OR: [
            { creatorId: userId },
            { folder: { accesses: { some: { userId } } } },
          ],
        },
      },
      orderBy: {
        expiration: "desc",
      },
      include: { recipients: true, files: true, security: true },
    });

    return shares.map((share) => {
      return this.enrichShareWithS3Info({
        ...share,
        size: share.files.reduce((acc, file) => acc + parseInt(file.size), 0),
        recipients: share.recipients.map((recipients) => recipients.email),
        security: {
          maxViews: share.security?.maxViews,
          passwordProtected: !!share.security?.password,
          burnAfterReading: share.security?.burnAfterReading ?? false,
        },
      });
    });
  }

  async get(id: string): Promise<any> {
    const share = await this.prisma.share.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: {
            name: "asc",
          },
        },
        creator: true,
        security: true,
      },
    });

    if (!share || !share.uploadLocked)
      throw new NotFoundException("Share not found");

    if (share.removedReason)
      throw new NotFoundException(share.removedReason, "share_removed");
    return this.enrichShareWithS3Info({
      ...share,
      hasPassword: !!share.security?.password,
      burnAfterReading: share.security?.burnAfterReading ?? false,
    });
  }

  async getMetaData(id: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
    });

    if (!share || !share.uploadLocked)
      throw new NotFoundException("Share not found");

    return share;
  }

  async remove(shareId: string, isDeleterAdmin = false) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    if (!share) throw new NotFoundException("Share not found");

    if (!share.creatorId && !isDeleterAdmin && share.uploadLocked)
      throw new ForbiddenException("Anonymous shares can't be deleted");

    await this.fileService.deleteAllFiles(shareId);
    await this.prisma.share.delete({ where: { id: shareId } });

    if (share.creatorId) {
      await this.prisma.updateUserStorageUsed(share.creatorId);
    }
  }

  async isShareCompleted(id: string) {
    return (await this.prisma.share.findUnique({ where: { id } })).uploadLocked;
  }

  async isShareIdAvailable(id: string) {
    const share = await this.prisma.share.findUnique({ where: { id } });
    return { isAvailable: !share };
  }

  async increaseViewCount(share: Share) {
    await this.prisma.share.update({
      where: { id: share.id },
      data: { views: share.views + 1 },
    });
  }

  async getShareToken(shareId: string, password: string, ip?: string) {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      include: {
        security: true,
      },
    });

    if (share?.security?.password) {
      if (!password) {
        throw new ForbiddenException(
          "This share is password protected",
          "share_password_required",
        );
      }

      const isPasswordValid = await argon.verify(
        share.security.password,
        password,
      );
      if (!isPasswordValid) {
        this.activityService.publish({
          type: "security-alert",
          data: { alertType: "failed-share-password", ip: ip || "N/A", target: shareId },
        });
        throw new ForbiddenException("Wrong password", "wrong_password");
      }
    }

    if (share.security?.maxViews && share.security.maxViews <= share.views) {
      throw new ForbiddenException(
        "Maximum views exceeded",
        "share_max_views_exceeded",
      );
    }

    const token = await this.generateShareToken(shareId);
    await this.increaseViewCount(share);

    // Burn After Reading: schedule auto-destruction after first access
    if (share.security?.burnAfterReading) {
      setTimeout(async () => {
        try {
          await this.fileService.deleteAllFiles(shareId);
          await this.prisma.share.delete({ where: { id: shareId } });
        } catch (e) {
          // Share may have already been deleted
        }
      }, 30000); // 30 second delay to allow download to complete

      // Notify creator by email if SMTP is enabled
      if (share.creatorId && this.configService.get("smtp.enabled")) {
        const creator = await this.prisma.user.findUnique({
          where: { id: share.creatorId },
        });
        if (creator?.email) {
          this.emailService
            .sendBurnAfterReadingNotification(creator.email, shareId)
            .catch(() => {}); // Fire and forget
        }
      }
    }

    return token;
  }

  async generateShareToken(shareId: string) {
    const { expiration, createdAt } = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    const tokenPayload = {
      shareId,
      shareCreatedAt: moment(createdAt).unix(),
      iat: moment().unix(),
    };

    const tokenOptions: JwtSignOptions = {
      secret: this.configService.get("internal.jwtSecret"),
    };

    if (!moment(expiration).isSame(0)) {
      tokenOptions.expiresIn = moment(expiration).diff(new Date(), "seconds");
    }

    return this.jwtService.sign(tokenPayload, tokenOptions);
  }

  async verifyShareToken(shareId: string, token: string) {
    const { expiration, createdAt } = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    try {
      const claims = this.jwtService.verify(token, {
        secret: this.configService.get("internal.jwtSecret"),
        // Ignore expiration if expiration is 0
        ignoreExpiration: moment(expiration).isSame(0),
      });

      return (
        claims.shareId == shareId &&
        claims.shareCreatedAt == moment(createdAt).unix()
      );
    } catch {
      return false;
    }
  }

  async getQrCode(id: string): Promise<string> {
    const appUrl = this.configService.get("general.appUrl");
    const shareUrl = `${appUrl}/s/${id}`;
    const qr = new qrcode({
      content: shareUrl,
      container: "svg-viewbox",
      join: true,
      color: "#2563eb",
      background: "#ffffff",
      ecl: "H",
    });
    return qr.svg();
  }
}
