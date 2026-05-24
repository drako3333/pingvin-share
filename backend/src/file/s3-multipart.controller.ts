import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  Req,
} from "@nestjs/common";
import { CreateShareGuard } from "src/share/guard/createShare.guard";
import { ShareOwnerGuard } from "src/share/guard/shareOwner.guard";
import { S3FileService } from "./s3.service";
import { PrismaService } from "src/prisma/prisma.service";
import { ConfigService } from "src/config/config.service";
import { getDiskSpace } from "src/utils/disk-space.util";
import { SHARE_DIRECTORY } from "src/constants";
import * as crypto from "crypto";
import { Request } from "express";
import { User } from "@prisma/client";
import { ActivityService } from "src/activity/activity.service";

@Controller("shares/:shareId/files/multipart")
export class S3MultipartController {
  constructor(
    private s3FileService: S3FileService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private activityService: ActivityService,
  ) {}

  @Post("initiate")
  @UseGuards(CreateShareGuard, ShareOwnerGuard)
  async initiate(
    @Param("shareId") shareId: string,
    @Body() body: { name: string; size: number },
  ) {
    const { name, size } = body;
    if (!name || size === undefined) {
      throw new BadRequestException("Missing name or size");
    }

    const isS3Enabled = this.configService.get("s3.enabled");
    const disableLocalStorage = this.configService.get("s3.disableLocalStorage");
    if (!isS3Enabled && !disableLocalStorage) {
      return { storageProvider: "LOCAL" };
    }

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: { security: true, creator: true },
    });
    if (!share) throw new BadRequestException("Share not found");

    if (share.creator) {
      const currentStorageUsed = Number(share.creator.storageUsed);
      const userQuota = Number(share.creator.storageQuota);
      const defaultQuota = this.configService.get("share.defaultUserQuota") as number;
      const storageQuota = userQuota > 0 ? userQuota : defaultQuota;

      if (currentStorageUsed + size > storageQuota) {
        throw new BadRequestException("Storage quota exceeded");
      }
    }

    // 1. Enforce SSD absolute safety limit
    const disk = await getDiskSpace(SHARE_DIRECTORY);
    const safeLimit = this.configService.get("s3.ssdSecurityThreshold") as number;
    const ssdSpaceSafe = disk.free >= safeLimit;

    // 2. Check SSD Smart Rules
    const isLargeFile = size >= 10 * 1024 * 1024 * 1024; // 10 GB
    const isBurnAfterReading = share.security?.burnAfterReading === true;

    // Expiration checks: if never or life expectancy > 24 hours
    const isNeverExpiration = share.expiration.getTime() === 0;
    const expiresAfter24h = share.expiration.getTime() - Date.now() > 24 * 60 * 60 * 1000;
    const isLongLived = isNeverExpiration || expiresAfter24h;

    let useS3 = false;

    if (disableLocalStorage) {
      // Force S3 if local storage is disabled
      useS3 = true;
    } else if (!ssdSpaceSafe) {
      // Force S3 if SSD is full
      useS3 = true;
    } else if (share.isHighPriority) {
      // Priority shares are always S3 with redundancy
      useS3 = true;
    } else if (isLargeFile) {
      // Large files always S3
      useS3 = true;
    } else if (isLongLived && !isBurnAfterReading) {
      // Long-lived non-ephemeral files always S3
      useS3 = true;
    }

    if (!useS3) {
      await this.prisma.share.update({
        where: { id: shareId },
        data: {
          storageProvider: "LOCAL",
          s3BucketId: null,
        },
      });
      return { storageProvider: "LOCAL" };
    }

    // Set share storageProvider to S3
    await this.prisma.share.update({
      where: { id: shareId },
      data: { storageProvider: "S3" },
    });

    // Select bucket(s) based on priority
    const multiBucketsEnabled = this.configService.get("s3.multiBucketsEnabled");
    let targetBuckets = [];

    if (multiBucketsEnabled) {
      const configStr = this.configService.get("s3.multiBucketsConfig");
      const buckets = JSON.parse(configStr || "[]");
      if (buckets.length > 0) {
        if (share.isHighPriority) {
          // Replicate to first 2 buckets for RAID-1 (Mirroring)
          targetBuckets = buckets.slice(0, 2);
        } else {
          // RAID-0: Filter available MinIO buckets that have > 1 TB free space
          const minioBuckets = buckets.filter((b: any) => b.type === "minio");
          const availableMinioBuckets = [];

          for (const bucket of minioBuckets) {
            if (bucket.physicalPath) {
              try {
                const disk = await getDiskSpace(bucket.physicalPath);
                const criticalLimit = 1000 * 1024 * 1024 * 1024; // 1 TB
                if (disk.free >= criticalLimit) {
                  availableMinioBuckets.push(bucket);
                }
              } catch (err) {
                // If we can't read disk space, assume it has space as a fallback
                availableMinioBuckets.push(bucket);
              }
            } else {
              availableMinioBuckets.push(bucket);
            }
          }

          let candidates = [];
          if (availableMinioBuckets.length > 0) {
            // Use MinIO buckets that still have space
            candidates = availableMinioBuckets;
          } else {
            // Ultimate resort: All MinIOs are saturated, route to B2 cloud
            const b2Bucket = buckets.find((b: any) => b.type === "b2");
            if (b2Bucket) {
              candidates = [b2Bucket];
            } else {
              // Fallback to all buckets if no B2 is configured
              candidates = buckets;
            }
          }

          // Shard (RAID-0) deterministic using hash of shareId among candidate buckets
          let hash = 0;
          for (let i = 0; i < shareId.length; i++) {
            hash = shareId.charCodeAt(i) + ((hash << 5) - hash);
          }
          const index = Math.abs(hash) % candidates.length;
          targetBuckets = [candidates[index]];
        }
      }
    }

    if (targetBuckets.length === 0) {
      // Use default bucket configuration
      targetBuckets = [{ id: "default", name: "Default S3" }];
    }

    // Update share S3 bucket tracking
    const bucketIds = targetBuckets.map((b) => b.id);
    await this.prisma.share.update({
      where: { id: shareId },
      data: { s3BucketId: bucketIds.join(",") },
    });

    // Generate S3 multipart uploads
    const fileId = crypto.randomUUID();
    const uploads = [];

    for (const b of targetBuckets) {
      const { uploadId, bucketName } = await this.s3FileService.initiateMultipartUpload(b.id, fileId, name);
      uploads.push({
        bucketId: b.id,
        uploadId,
        bucketName,
      });
    }

    return {
      storageProvider: "S3",
      raidMode: share.isHighPriority ? "RAID-1" : "RAID-0",
      fileId,
      uploads,
    };
  }

  @Post("sign-part")
  @UseGuards(CreateShareGuard, ShareOwnerGuard)
  async signPart(
    @Body() body: {
      fileId: string;
      partNumber: number;
      uploads: Array<{ bucketId: string; uploadId: string }>;
    },
  ) {
    const { fileId, partNumber, uploads } = body;
    if (!fileId || !partNumber || !uploads || !Array.isArray(uploads)) {
      throw new BadRequestException("Missing sign parameters");
    }

    const urls = [];
    for (const u of uploads) {
      const url = await this.s3FileService.getUploadPartPresignedUrl(u.bucketId, fileId, u.uploadId, partNumber);
      urls.push({
        bucketId: u.bucketId,
        url,
      });
    }

    return { urls };
  }

  @Post("complete")
  @UseGuards(CreateShareGuard, ShareOwnerGuard)
  async complete(
    @Param("shareId") shareId: string,
    @Body() body: {
      fileId: string;
      fileName: string;
      fileSize: number;
      hash: string;
      uploads: Array<{
        bucketId: string;
        uploadId: string;
        parts: Array<{ ETag: string; PartNumber: number }>;
      }>;
    },
    @Req() request: Request,
  ) {
    const { fileId, fileName, fileSize, hash, uploads } = body;
    if (!fileId || !fileName || !fileSize || !hash || !uploads || !Array.isArray(uploads)) {
      throw new BadRequestException("Missing complete parameters");
    }

    let finalSize = fileSize;

    // Complete on S3 buckets
    for (const u of uploads) {
      const { size } = await this.s3FileService.completeMultipartUpload(u.bucketId, fileId, u.uploadId, u.parts, hash);
      finalSize = size || finalSize;
    }

    // Register File in database
    const fileRecord = await this.prisma.file.create({
      data: {
        id: fileId,
        name: fileName,
        size: finalSize.toString(),
        hash: hash,
        share: { connect: { id: shareId } },
      },
    });

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });
    if (share?.creatorId) {
      await this.prisma.updateUserStorageUsed(share.creatorId);
    }

    const creatorUser = request["user"] as User | undefined;
    const username = creatorUser?.username || "Anonyme";
    this.activityService.publish({
      type: "upload-progress",
      data: {
        shareId,
        fileId,
        fileName,
        progress: 100,
        size: finalSize,
        username,
      },
    });

    return fileRecord;
  }
}
