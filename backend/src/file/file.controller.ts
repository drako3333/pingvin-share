import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import * as contentDisposition from "content-disposition";
import { Response, Request } from "express";
import { CreateShareGuard } from "src/share/guard/createShare.guard";
import { ShareOwnerGuard } from "src/share/guard/shareOwner.guard";
import { FileService } from "./file.service";
import { FileSecurityGuard } from "./guard/fileSecurity.guard";
import * as mime from "mime-types";
import { ConfigService } from "src/config/config.service";
import { Transform, TransformCallback } from "stream";
import { AuditLogService } from "src/audit/audit.service";
import { ShareAnalyticsService } from "src/share/share-analytics.service";
import { User } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { NotificationService } from "src/notification/notification.service";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { ActivityService } from "src/activity/activity.service";

export class ThrottleStream extends Transform {
  private bps: number;
  private totalBytesSent = 0;
  private startTime = Date.now();

  constructor(bps: number) {
    super();
    this.bps = bps;
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
    if (this.bps <= 0) {
      this.push(chunk);
      return callback();
    }

    this.totalBytesSent += chunk.length;
    const elapsedTime = (Date.now() - this.startTime) / 1000;
    const expectedTime = this.totalBytesSent / this.bps;
    const delay = (expectedTime - elapsedTime) * 1000;

    if (delay > 10) {
      setTimeout(() => {
        this.push(chunk);
        callback();
      }, delay);
    } else {
      this.push(chunk);
      callback();
    }
  }
}

@Controller("shares/:shareId/files")
export class FileController {
  constructor(
    private fileService: FileService,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
    private shareAnalyticsService: ShareAnalyticsService,
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private activityService: ActivityService,
  ) {}

  @Post()
  @SkipThrottle()
  @UseGuards(CreateShareGuard, ShareOwnerGuard)
  async create(
    @Query()
    query: {
      id: string;
      name: string;
      chunkIndex: string;
      totalChunks: string;
      size?: string;
    },
    @Body() body: string,
    @Param("shareId") shareId: string,
    @Req() request: Request,
  ) {
    const { id, name, chunkIndex, totalChunks } = query;

    const chunkIdxVal = parseInt(chunkIndex);
    const totalChunksVal = parseInt(totalChunks);
    const progress = Math.round(((chunkIdxVal + 1) / totalChunksVal) * 100);

    // Throttle progress events (emit at 0%, 100%, or multiples of 10% progress)
    if (chunkIdxVal === 0 || chunkIdxVal === totalChunksVal - 1 || progress % 10 === 0) {
      const creatorUser = request["user"] as User | undefined;
      const username = creatorUser?.username || "Anonyme";
      this.activityService.publish({
        type: "upload-progress",
        data: {
          shareId,
          fileId: id,
          fileName: name,
          progress,
          size: query.size ? parseInt(query.size) : 0,
          username,
        },
      });
    }

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: { creator: true },
    });

    if (share && share.creator) {
      const fileSize = query.size ? parseInt(query.size) : 0;
      const currentStorageUsed = Number(share.creator.storageUsed);
      const userQuota = Number(share.creator.storageQuota);
      const defaultQuota = this.configService.get("share.defaultUserQuota") as number;
      const storageQuota = userQuota > 0 ? userQuota : defaultQuota;

      if (currentStorageUsed + fileSize > storageQuota) {
        throw new BadRequestException("Storage quota exceeded");
      }
    }

    const globalUploadRateLimit = parseInt(
      this.configService.get("share.globalUploadRateLimit") || "0",
    );

    if (globalUploadRateLimit > 0) {
      const rawBuffer = body
        ? (Buffer.isBuffer(body)
            ? body
            : typeof body === "string"
            ? Buffer.from(body, "base64")
            : Buffer.from(JSON.stringify(body)))
        : Buffer.alloc(0);
      const bufferSize = rawBuffer.byteLength;
      const expectedTimeMs = (bufferSize / globalUploadRateLimit) * 1000;

      const startTime = Date.now();
      const result = await this.fileService.create(
        body,
        { index: parseInt(chunkIndex), total: parseInt(totalChunks) },
        { id, name },
        shareId,
      );
      const elapsed = Date.now() - startTime;
      const delay = expectedTimeMs - elapsed;

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return result;
    }

    return await this.fileService.create(
      body,
      { index: parseInt(chunkIndex), total: parseInt(totalChunks) },
      { id, name },
      shareId,
    );
  }

  @Get("zip")
  @UseGuards(FileSecurityGuard)
  async getZip(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
    @Req() request: Request,
  ) {
    const zipStream = await this.fileService.getZip(shareId);

    const user = request["user"] as User;
    const username = user?.username || "Anonyme";
    const userId = user?.id || undefined;

    await this.auditLogService.create(
      "TELECHARGEMENT_ZIP",
      request.ip,
      { shareId },
      userId,
      username,
    );

    this.activityService.publish({
      type: "download",
      data: {
        shareId,
        fileId: "ZIP",
        fileName: `${shareId}.zip`,
        ip: request.ip,
        username,
      },
    });

    // Asynchronously log analytics
    const ua = request.headers["user-agent"] || "";
    void this.shareAnalyticsService.record(shareId, request.ip, ua);

    // Trigger push notification
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });
    if (share && share.creatorId) {
      const shareName = share.name || share.id;
      void this.notificationService.sendPushNotification(
        share.creatorId,
        "Archive ZIP téléchargée",
        `Quelqu'un a téléchargé l'archive ZIP de votre partage "${shareName}".`,
        `/share/${shareId}/analytics`,
      );
    }

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(`${shareId}.zip`),
    });

    const globalDownloadRateLimit = parseInt(
      this.configService.get("share.globalDownloadRateLimit") || "0",
    );

    if (globalDownloadRateLimit > 0) {
      const throttleStream = new ThrottleStream(globalDownloadRateLimit);
      const throttledZipStream = zipStream.pipe(throttleStream) as any;
      return new StreamableFile(throttledZipStream);
    }

    return new StreamableFile(zipStream);
  }

  @Delete(":fileId")
  @UseGuards(FileSecurityGuard, ShareOwnerGuard)
  async remove(
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
  ) {
    await this.fileService.remove(shareId, fileId);
    return;
  }

  @Get(":fileId")
  @UseGuards(FileSecurityGuard)
  async getFile(
    @Res({ passthrough: true }) res: Response,
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
    @Query("download") download = "true",
    @Req() request: Request,
  ) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    if (share && share.storageProvider === "S3") {
      const presignedUrl = await this.fileService.getDownloadPresignedUrl(shareId, fileId);

      const user = request["user"] as User;
      const username = user?.username || "Anonyme";
      const userId = user?.id || undefined;

      // Fetch the file name asynchronously to publish a precise name in the Live Feed
      this.prisma.file.findUnique({ where: { id: fileId } }).then((f) => {
        this.activityService.publish({
          type: "download",
          data: {
            shareId,
            fileId,
            fileName: f?.name || "S3 Direct Presigned URL",
            ip: request.ip,
            username,
          },
        });
      }).catch(() => {});

      await this.auditLogService.create(
        "TELECHARGEMENT",
        request.ip,
        { shareId, fileId, fileName: "S3 Direct Presigned URL" },
        userId,
        username,
      );

      const ua = request.headers["user-agent"] || "";
      void this.shareAnalyticsService.record(shareId, request.ip, ua, fileId);

      if (share.creatorId) {
        const shareName = share.name || share.id;
        void this.notificationService.sendPushNotification(
          share.creatorId,
          "Fichier téléchargé",
          `Quelqu'un a téléchargé un fichier de votre partage "${shareName}".`,
          `/share/${shareId}/analytics`,
        );
      }

      res.redirect(presignedUrl);
      return;
    }

    const file = await this.fileService.get(shareId, fileId);

    const user = request["user"] as User;
    const username = user?.username || "Anonyme";
    const userId = user?.id || undefined;

    await this.auditLogService.create(
      "TELECHARGEMENT",
      request.ip,
      { shareId, fileId, fileName: file.metaData.name },
      userId,
      username,
    );

    this.activityService.publish({
      type: "download",
      data: {
        shareId,
        fileId,
        fileName: file.metaData.name,
        ip: request.ip,
        username,
      },
    });

    // Asynchronously log analytics
    const ua = request.headers["user-agent"] || "";
    void this.shareAnalyticsService.record(shareId, request.ip, ua, fileId);

    // Trigger push notification
    if (share && share.creatorId) {
      const shareName = share.name || share.id;
      void this.notificationService.sendPushNotification(
        share.creatorId,
        "Fichier téléchargé",
        `Quelqu'un a téléchargé le fichier "${file.metaData.name}" de votre partage "${shareName}".`,
        `/share/${shareId}/analytics`,
      );
    }

    const headers = {
      "Content-Type":
        mime?.lookup?.(file.metaData.name) || "application/octet-stream",
      "Content-Length": file.metaData.size,
      "Content-Security-Policy": "sandbox",
    };

    const fileName = file.metaData.name.split("/").pop();

    if (download === "true") {
      headers["Content-Disposition"] = contentDisposition(fileName);
    } else {
      headers["Content-Disposition"] = contentDisposition(fileName, {
        type: "inline",
      });
    }

    res.set(headers);

    const globalDownloadRateLimit = parseInt(
      this.configService.get("share.globalDownloadRateLimit") || "0",
    );

    if (globalDownloadRateLimit > 0) {
      const throttleStream = new ThrottleStream(globalDownloadRateLimit);
      const throttledFileStream = file.file.pipe(throttleStream) as any;
      return new StreamableFile(throttledFileStream);
    }

    return new StreamableFile(file.file);
  }

  @Post(":fileId/approve")
  @UseGuards(JwtGuard, AdministratorGuard)
  async approve(
    @Param("shareId") shareId: string,
    @Param("fileId") fileId: string,
  ) {
    return await this.fileService.approve(shareId, fileId);
  }
}
