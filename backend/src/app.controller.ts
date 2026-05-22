import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { PrismaService } from "./prisma/prisma.service";
import { JwtGuard } from "./auth/guard/jwt.guard";
import { AdministratorGuard } from "./auth/guard/isAdmin.guard";
import { DATA_DIRECTORY, SHARE_DIRECTORY } from "./constants";
import { ConfigService } from "./config/config.service";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";
import * as path from "path";

const execPromise = promisify(exec);

async function getDiskSpace(dirPath: string): Promise<{ total: number; free: number }> {
  try {
    const resolvedPath = path.resolve(dirPath);
    if (os.platform() === "win32") {
      const drive = resolvedPath.substring(0, 2);
      const cmd = `powershell -Command "Get-CimInstance -ClassName Win32_LogicalDisk -Filter \\"DeviceID='${drive}'\\" | Select-Object Size, FreeSpace | ConvertTo-Json"`;
      const { stdout } = await execPromise(cmd);
      const data = JSON.parse(stdout.trim());
      return {
        total: parseInt(data.Size || "0"),
        free: parseInt(data.FreeSpace || "0"),
      };
    } else {
      const { stdout } = await execPromise(`df -B1 "${resolvedPath}"`);
      const lines = stdout.trim().split("\n");
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        const total = parseInt(parts[1]);
        const free = parseInt(parts[3]);
        return { total, free };
      }
    }
  } catch (e) {
    console.error("Error getting disk space:", e);
  }
  return { total: 0, free: 0 };
}

@Controller("/")
export class AppController {
  constructor(
    private prismaService: PrismaService,
    private configService: ConfigService,
  ) {}

  @Get("health")
  async health(@Res({ passthrough: true }) res: Response) {
    try {
      await this.prismaService.config.findMany();
      return "OK";
    } catch {
      res.statusCode = 500;
      return "ERROR";
    }
  }

  @Get("admin/stats")
  @UseGuards(JwtGuard, AdministratorGuard)
  async getAdminStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totalShares = await this.prismaService.share.count({
      where: { uploadLocked: true },
    });

    const activeShares = await this.prismaService.share.count({
      where: {
        uploadLocked: true,
        expiration: { gt: now },
      },
    });

    const expiredShares = await this.prismaService.share.count({
      where: {
        uploadLocked: true,
        expiration: { lte: now, not: new Date(0) },
      },
    });

    const sharesCreatedToday = await this.prismaService.share.count({
      where: {
        uploadLocked: true,
        createdAt: { gte: startOfToday },
      },
    });

    const totalUsers = await this.prismaService.user.count();

    const totalFiles = await this.prismaService.file.count();

    // Query files and their shares to calculate precise multi-storage consumption
    const allFiles = await this.prismaService.file.findMany({
      include: {
        share: true,
      },
    });

    const totalSize = allFiles.reduce(
      (acc, file) => acc + parseInt(file.size || "0"),
      0,
    );
    const averageShareSize = totalShares > 0 ? Math.round(totalSize / totalShares) : 0;

    const passwordProtectedShares = await this.prismaService.share.count({
      where: {
        uploadLocked: true,
        security: {
          password: { not: null },
        },
      },
    });

    const sharesViews = await this.prismaService.share.findMany({
      select: { views: true },
    });
    const totalDownloads = sharesViews.reduce(
      (acc, share) => acc + (share.views || 0),
      0,
    );

    const downloadsToday = await this.prismaService.auditLog.count({
      where: {
        action: { in: ["TELECHARGEMENT", "TELECHARGEMENT_ZIP"] },
        createdAt: { gte: startOfToday },
      },
    });

    // 1. Calculate physical local SSD metrics (Hot Storage - Tier 1)
    const localSSDSpace = await getDiskSpace(SHARE_DIRECTORY);
    const localConsumed = allFiles
      .filter((f) => !f.share || f.share.storageProvider === "LOCAL" || !f.share.storageProvider)
      .reduce((acc, f) => acc + parseInt(f.size || "0"), 0);

    // 2. Parse multi-buckets (MinIO Tier 2 & B2 Tier 3)
    const isMultiBucketsEnabled = this.configService.get("s3.multiBucketsEnabled") === "true" || this.configService.get("s3.multiBucketsEnabled") === true;
    const multiBucketsConfigStr = this.configService.get("s3.multiBucketsConfig") || "[]";
    let bucketsConfig = [];
    try {
      bucketsConfig = JSON.parse(multiBucketsConfigStr);
    } catch {}

    const buckets = [];
    for (const b of bucketsConfig) {
      let bTotal = null;
      let bFree = null;
      let bUsed = null;

      if (b.type === "minio" && b.physicalPath) {
        try {
          const bDisk = await getDiskSpace(b.physicalPath);
          bTotal = bDisk.total;
          bFree = bDisk.free;
          bUsed = bTotal - bFree;
        } catch {}
      }

      const bConsumed = allFiles
        .filter(
          (f) =>
            f.share &&
            f.share.storageProvider === "S3" &&
            f.share.s3BucketId &&
            f.share.s3BucketId.split(",").includes(b.id),
        )
        .reduce((acc, f) => acc + parseInt(f.size || "0"), 0);

      buckets.push({
        id: b.id,
        name: b.name,
        type: b.type,
        total: bTotal,
        free: bFree,
        used: bUsed,
        consumed: bConsumed,
      });
    }

    return {
      totalShares,
      activeShares,
      expiredShares,
      sharesCreatedToday,
      totalUsers,
      totalFiles,
      totalSize,
      averageShareSize,
      passwordProtectedShares,
      totalDownloads,
      downloadsToday,
      diskTotal: localSSDSpace.total,
      diskFree: localSSDSpace.free,
      diskUsed: localSSDSpace.total - localSSDSpace.free,
      storageStats: {
        local: {
          name: "SSD Local (Hot - Tier 1)",
          total: localSSDSpace.total,
          free: localSSDSpace.free,
          used: localSSDSpace.total - localSSDSpace.free,
          consumed: localConsumed,
        },
        buckets,
      },
    };
  }
}
