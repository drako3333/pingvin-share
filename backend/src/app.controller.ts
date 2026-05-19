import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { PrismaService } from "./prisma/prisma.service";
import { JwtGuard } from "./auth/guard/jwt.guard";
import { AdministratorGuard } from "./auth/guard/isAdmin.guard";
import { DATA_DIRECTORY } from "./constants";
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
  constructor(private prismaService: PrismaService) {}

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

    const files = await this.prismaService.file.findMany({
      select: { size: true },
    });
    const totalSize = files.reduce(
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

    const diskInfo = await getDiskSpace(DATA_DIRECTORY);

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
      diskTotal: diskInfo.total,
      diskFree: diskInfo.free,
      diskUsed: diskInfo.total - diskInfo.free,
    };
  }
}
