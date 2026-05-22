import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as fs from "fs";
import * as moment from "moment";
import { FileService } from "src/file/file.service";
import { S3FileService } from "src/file/s3.service";
import { LocalFileService } from "src/file/local.service";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { ReverseShareService } from "src/reverseShare/reverseShare.service";
import { SHARE_DIRECTORY } from "../constants";
import { NotificationService } from "src/notification/notification.service";
import { getDiskSpace } from "src/utils/disk-space.util";

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private prisma: PrismaService,
    private reverseShareService: ReverseShareService,
    private fileService: FileService,
    private s3FileService: S3FileService,
    private localFileService: LocalFileService,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {}

  onModuleInit() {
    this.configService.on("update", (key: string, value: any) => {
      if (key === "s3.disableLocalStorage" && (value === true || value === "true")) {
        this.migrateAllLocalFilesToS3().catch((error) => {
          this.logger.error("Failed to migrate all local files to S3 on config toggle:", error);
        });
      }
    });
  }

  @Cron("0 * * * *")
  async deleteExpiredShares() {
    const expiredShares = await this.prisma.share.findMany({
      where: {
        // We want to remove only shares that have an expiration date less than the current date, but not 0
        AND: [
          { expiration: { lt: new Date() } },
          { expiration: { not: moment(0).toDate() } },
        ],
      },
    });

    for (const expiredShare of expiredShares) {
      await this.fileService.deleteAllFiles(expiredShare.id);

      await this.prisma.share.delete({
        where: { id: expiredShare.id },
      });

      if (expiredShare.creatorId) {
        await this.prisma.updateUserStorageUsed(expiredShare.creatorId);
      }
    }

    if (expiredShares.length > 0) {
      this.logger.log(`Deleted ${expiredShares.length} expired shares`);
    }
  }

  @Cron("0 * * * *")
  async deleteExpiredReverseShares() {
    const expiredReverseShares = await this.prisma.reverseShare.findMany({
      where: {
        shareExpiration: { lt: new Date() },
      },
    });

    for (const expiredReverseShare of expiredReverseShares) {
      await this.reverseShareService.remove(expiredReverseShare.id);
    }

    if (expiredReverseShares.length > 0) {
      this.logger.log(
        `Deleted ${expiredReverseShares.length} expired reverse shares`,
      );
    }
  }

  @Cron("0 */6 * * *")
  async deleteUnfinishedShares() {
    const unfinishedShares = await this.prisma.share.findMany({
      where: {
        createdAt: { lt: moment().subtract(1, "day").toDate() },
        uploadLocked: false,
      },
    });

    for (const unfinishedShare of unfinishedShares) {
      await this.prisma.share.delete({
        where: { id: unfinishedShare.id },
      });

      await this.fileService.deleteAllFiles(unfinishedShare.id);

      if (unfinishedShare.creatorId) {
        await this.prisma.updateUserStorageUsed(unfinishedShare.creatorId);
      }
    }

    if (unfinishedShares.length > 0) {
      this.logger.log(`Deleted ${unfinishedShares.length} unfinished shares`);
    }
  }

  @Cron("0 0 * * *")
  async deleteTemporaryFiles() {
    let filesDeleted = 0;

    const dirents = await fs.promises.readdir(SHARE_DIRECTORY, { withFileTypes: true });
    const shareDirectories = dirents
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const shareDirectory of shareDirectories) {
      const files = await fs.promises.readdir(`${SHARE_DIRECTORY}/${shareDirectory}`);
      const temporaryFiles = files.filter((file) => file.endsWith(".tmp-chunk"));

      for (const file of temporaryFiles) {
        const filePath = `${SHARE_DIRECTORY}/${shareDirectory}/${file}`;
        const stats = await fs.promises.stat(filePath);
        const isOlderThanOneDay = moment(stats.mtime)
          .add(1, "day")
          .isBefore(moment());

        if (isOlderThanOneDay) {
          await fs.promises.rm(filePath);
          filesDeleted++;
        }
      }
    }

    this.logger.log(`Deleted ${filesDeleted} temporary files`);
  }

  @Cron("1 * * * *")
  async deleteExpiredTokens() {
    const { count: refreshTokenCount } =
      await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

    const { count: loginTokenCount } = await this.prisma.loginToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const { count: resetPasswordTokenCount } =
      await this.prisma.resetPasswordToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

    const deletedTokensCount =
      refreshTokenCount + loginTokenCount + resetPasswordTokenCount;

    if (deletedTokensCount > 0) {
      this.logger.log(
        `Deleted ${deletedTokensCount} expired tokens (Refresh: ${refreshTokenCount}, Login: ${loginTokenCount}, ResetPassword: ${resetPasswordTokenCount})`,
      );
    }
  }

  @Cron("0 * * * *")
  async warnExpiringShares() {
    const now = new Date();
    const limit = moment().add(1, "day").toDate();

    const expiringShares = await this.prisma.share.findMany({
      where: {
        AND: [
          { expiration: { gt: now } },
          { expiration: { lt: limit } },
          { expiration: { not: moment(0).toDate() } },
          { warnedAboutExpiration: false },
          { creatorId: { not: null } },
          { uploadLocked: true },
        ],
      },
    });

    for (const share of expiringShares) {
      if (share.creatorId) {
        const shareName = share.name || share.id;
        void this.notificationService.sendPushNotification(
          share.creatorId,
          "Partage expirant bientôt",
          `Votre partage "${shareName}" va expirer dans moins de 24 heures.`,
          `/share/${share.id}`,
        );

        await this.prisma.share.update({
          where: { id: share.id },
          data: { warnedAboutExpiration: true },
        });
      }
    }

    if (expiringShares.length > 0) {
      this.logger.log(`Sent ${expiringShares.length} expiration warning push notifications`);
    }
  }

  @Cron("0 2 * * *")
  async autoTierShares() {
    const tieringEnabled = this.configService.get("s3.tieringEnabled");
    if (!tieringEnabled) return;

    const tieringDays = this.configService.get("s3.tieringDays");
    const cutoffDate = moment().subtract(tieringDays, "days").toDate();

    this.logger.log(
      `Starting auto-tiering job. Cutoff date: ${cutoffDate.toISOString()}`,
    );

    const sharesToMigrate = await this.prisma.share.findMany({
      where: {
        storageProvider: "LOCAL",
        uploadLocked: true,
        createdAt: { lt: cutoffDate },
      },
      include: {
        files: true,
      },
    });

    if (sharesToMigrate.length === 0) {
      this.logger.log("No shares found for auto-tiering migration.");
      return;
    }

    this.logger.log(
      `Found ${sharesToMigrate.length} shares to migrate to S3 cold storage.`,
    );

    for (const share of sharesToMigrate) {
      this.logger.log(
        `Migrating share ${share.id} (${share.files.length} files) to cloud storage...`,
      );

      try {
        for (const file of share.files) {
          const localPath = file.hash
            ? `${SHARE_DIRECTORY}/_files/${file.hash}`
            : `${SHARE_DIRECTORY}/${share.id}/${file.id}`;

          // Check if local file exists
          try {
            await fs.promises.access(localPath);
          } catch {
            this.logger.warn(
              `Local file for ${file.name} (${localPath}) does not exist. Skipping file migration...`,
            );
            continue;
          }

          // Migrate file to S3 CAS
          await this.s3FileService.migrateLocalFileToS3(
            localPath,
            file.id,
            file.name,
            file.hash || "",
            share.id,
          );
        }

        // Now update the Share record in database to target "S3" storage provider
        await this.prisma.share.update({
          where: { id: share.id },
          data: { storageProvider: "S3" },
        });

        // Clean up the local files safely
        for (const file of share.files) {
          if (file.hash) {
            const otherLocalFilesWithHash = await this.prisma.file.findMany({
              where: {
                hash: file.hash,
                id: { not: file.id },
                share: {
                  storageProvider: "LOCAL",
                },
              },
            });

            if (otherLocalFilesWithHash.length === 0) {
              try {
                await fs.promises.unlink(`${SHARE_DIRECTORY}/_files/${file.hash}`);
              } catch (err) {
                // Ignore
              }
            }
          } else {
            try {
              await fs.promises.unlink(`${SHARE_DIRECTORY}/${share.id}/${file.id}`);
            } catch (err) {
              // Ignore
            }
          }
        }

        // Clean up share directory
        try {
          await fs.promises.rm(`${SHARE_DIRECTORY}/${share.id}`, {
            recursive: true,
            force: true,
          });
        } catch (err) {
          // Ignore
        }

        this.logger.log(`Successfully migrated share ${share.id} to S3.`);
      } catch (error) {
        this.logger.error(
          `Failed to migrate share ${share.id} to S3 cold storage:`,
          error,
        );
      }
    }
  }

  @Cron("0 * * * *")
  async enforceSSDSpaceSafeguard() {
    const disk = await getDiskSpace(SHARE_DIRECTORY);
    const safeLimit = 100 * 1024 * 1024 * 1024; // 100 GB
    const targetLimit = 150 * 1024 * 1024 * 1024; // 150 GB

    if (disk.free < safeLimit) {
      this.logger.warn(`SSD free space is critical (${(disk.free / 1024 / 1024 / 1024).toFixed(2)} GB free). Starting aggressive S3 migration to recover space...`);

      // Find shares to migrate
      const sharesToMigrate = await this.prisma.share.findMany({
        where: {
          storageProvider: "LOCAL",
          uploadLocked: true,
        },
        include: { files: true },
        orderBy: { createdAt: "asc" },
      });

      let currentFree = disk.free;

      for (const share of sharesToMigrate) {
        if (currentFree >= targetLimit) {
          this.logger.log("Aggressive SSD migration target reached (> 150 GB free space). Stopping.");
          break;
        }

        this.logger.log(`Migrating share ${share.id} to S3 for space recovery...`);
        try {
          for (const file of share.files) {
            const localPath = file.hash
              ? `${SHARE_DIRECTORY}/_files/${file.hash}`
              : `${SHARE_DIRECTORY}/${share.id}/${file.id}`;

            try {
              await fs.promises.access(localPath);
            } catch {
              continue;
            }

            await this.s3FileService.migrateLocalFileToS3(
              localPath,
              file.id,
              file.name,
              file.hash || "",
              share.id,
            );
          }

          await this.prisma.share.update({
            where: { id: share.id },
            data: { storageProvider: "S3" },
          });

          // Clean up local files
          for (const file of share.files) {
            if (file.hash) {
              const otherLocal = await this.prisma.file.findMany({
                where: {
                  hash: file.hash,
                  id: { not: file.id },
                  share: { storageProvider: "LOCAL" },
                },
              });
              if (otherLocal.length === 0) {
                try {
                  await fs.promises.unlink(`${SHARE_DIRECTORY}/_files/${file.hash}`);
                } catch {}
              }
            } else {
              try {
                await fs.promises.unlink(`${SHARE_DIRECTORY}/${share.id}/${file.id}`);
              } catch {}
            }
          }

          try {
            await fs.promises.rm(`${SHARE_DIRECTORY}/${share.id}`, { recursive: true, force: true });
          } catch {}

          const updatedDisk = await getDiskSpace(SHARE_DIRECTORY);
          currentFree = updatedDisk.free;
        } catch (err) {
          this.logger.error(`Error aggressively migrating share ${share.id} to S3:`, err);
        }
      }
    }
  }

  @Cron("0 * * * *")
  async checkMinIOCapacityAndCascade() {
    const isMultiBucketsEnabled = this.configService.get("s3.multiBucketsEnabled");
    if (!isMultiBucketsEnabled) return;

    const configStr = this.configService.get("s3.multiBucketsConfig");
    let buckets = [];
    try {
      buckets = JSON.parse(configStr || "[]");
    } catch {
      return;
    }

    const minioBuckets = buckets.filter((b: any) => b.type === "minio" && b.physicalPath);
    const b2Bucket = buckets.find((b: any) => b.type === "b2");

    if (minioBuckets.length === 0 || !b2Bucket) return;

    for (const mBucket of minioBuckets) {
      try {
        const disk = await getDiskSpace(mBucket.physicalPath);
        const criticalLimit = 1000 * 1024 * 1024 * 1024; // 1 TB
        if (disk.free < criticalLimit) {
          this.logger.warn(`MinIO bucket ${mBucket.name} space is critical (${(disk.free / 1024 / 1024 / 1024).toFixed(2)} GB free). Cascade migrating to B2 (${b2Bucket.name})...`);

          const shares = await this.prisma.share.findMany({
            where: { s3BucketId: mBucket.id },
          });

          if (shares.length === 0) continue;

          for (const share of shares) {
            this.logger.log(`Cascade migrating share ${share.id} from MinIO to B2...`);
            try {
              await this.s3FileService.migrateS3BucketToS3Bucket(mBucket.id, b2Bucket.id, share.id);
            } catch (err) {
              this.logger.error(`Failed cascade migrating share ${share.id}:`, err);
            }
          }
        }
      } catch (err) {
        this.logger.error(`Error checking MinIO capacity for ${mBucket.name}:`, err);
      }
    }
  }

  async migrateAllLocalFilesToS3() {
    this.logger.log("Triggered global migration of all local shares to S3 because local storage was disabled.");

    // Find all shares currently using LOCAL storage provider
    const sharesToMigrate = await this.prisma.share.findMany({
      where: {
        storageProvider: "LOCAL",
      },
      include: {
        files: true,
      },
    });

    if (sharesToMigrate.length === 0) {
      this.logger.log("No local shares found to migrate to S3.");
      return;
    }

    this.logger.log(`Found ${sharesToMigrate.length} local shares to migrate to S3.`);

    for (const share of sharesToMigrate) {
      this.logger.log(
        `Migrating share ${share.id} (${share.files.length} files) to cloud storage...`,
      );

      try {
        for (const file of share.files) {
          const localPath = file.hash
            ? `${SHARE_DIRECTORY}/_files/${file.hash}`
            : `${SHARE_DIRECTORY}/${share.id}/${file.id}`;

          // Check if local file exists
          try {
            await fs.promises.access(localPath);
          } catch {
            this.logger.warn(
              `Local file for ${file.name} (${localPath}) does not exist. Skipping file migration...`,
            );
            continue;
          }

          // Migrate file to S3
          await this.s3FileService.migrateLocalFileToS3(
            localPath,
            file.id,
            file.name,
            file.hash || "",
            share.id,
          );
        }

        // Now update the Share record in database to target "S3" storage provider
        await this.prisma.share.update({
          where: { id: share.id },
          data: { storageProvider: "S3" },
        });

        // Clean up the local files safely
        for (const file of share.files) {
          if (file.hash) {
            const otherLocalFilesWithHash = await this.prisma.file.findMany({
              where: {
                hash: file.hash,
                id: { not: file.id },
                share: {
                  storageProvider: "LOCAL",
                },
              },
            });

            if (otherLocalFilesWithHash.length === 0) {
              try {
                await fs.promises.unlink(`${SHARE_DIRECTORY}/_files/${file.hash}`);
              } catch (err) {
                // Ignore
              }
            }
          } else {
            try {
              await fs.promises.unlink(`${SHARE_DIRECTORY}/${share.id}/${file.id}`);
            } catch (err) {
              // Ignore
            }
          }
        }

        // Clean up share directory
        try {
          await fs.promises.rm(`${SHARE_DIRECTORY}/${share.id}`, {
            recursive: true,
            force: true,
          });
        } catch (err) {
          // Ignore
        }

        this.logger.log(`Successfully migrated share ${share.id} to S3.`);
      } catch (error) {
        this.logger.error(
          `Failed to migrate share ${share.id} to S3 during global migration:`,
          error,
        );
      }
    }
  }
}
