import { Injectable, Logger } from "@nestjs/common";
import * as NodeClam from "clamscan";
import { FileService } from "src/file/file.service";
import { PrismaService } from "src/prisma/prisma.service";
import { CLAMAV_HOST, CLAMAV_PORT } from "../constants";

const clamscanConfig = {
  clamdscan: {
    host: CLAMAV_HOST,
    port: CLAMAV_PORT,
    localFallback: false,
  },
  preference: "clamdscan",
};
@Injectable()
export class ClamScanService {
  private readonly logger = new Logger(ClamScanService.name);

  constructor(
    private fileService: FileService,
    private prisma: PrismaService,
  ) {}

  private ClamScan: Promise<NodeClam | null> = new NodeClam()
    .init(clamscanConfig)
    .then((res) => {
      this.logger.log("ClamAV is active");
      return res;
    })
    .catch(() => {
      this.logger.log("ClamAV is not active");
      return null;
    });

  async check(shareId: string) {
    const clamScan = await this.ClamScan;

    if (!clamScan) return [];

    const infectedFiles = [];

    const files = await this.prisma.file.findMany({
      where: { shareId },
    });

    for (const file of files) {
      try {
        const fileObj = await this.fileService.get(shareId, file.id);
        if (!fileObj || !fileObj.file) {
          this.logger.warn(`Could not get stream for file ${file.id} in share ${shareId}`);
          continue;
        }

        const { isInfected, viruses } = await clamScan
          .scanStream(fileObj.file)
          .catch((err) => {
            this.logger.log(`ClamAV is not active or failed to scan: ${err.message || err}`);
            return { isInfected: false, viruses: [] };
          }) as any;

        if (isInfected) {
          const virusName = (viruses && viruses.length > 0) ? viruses[0] : "Unknown Threat";
          infectedFiles.push({ id: file.id, name: file.name, virusName });
        }
      } catch (err) {
        this.logger.error(`Error scanning file ${file.id}: ${err.message || err}`);
      }
    }

    return infectedFiles;
  }

  async checkAndRemove(shareId: string) {
    // Exclude scans for registered users / administrators
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: { creatorId: true },
    });

    if (share && share.creatorId !== null) {
      this.logger.log(`Skipping antivirus scan for trusted share ${shareId} (created by user ${share.creatorId})`);
      return;
    }

    const infectedFiles = await this.check(shareId);

    if (infectedFiles.length > 0) {
      // Mark files as suspect in database instead of deleting the share
      for (const inf of infectedFiles) {
        await this.prisma.file.update({
          where: { id: inf.id },
          data: {
            isSuspect: true,
            virusName: inf.virusName,
          },
        });
      }

      this.logger.warn(
        `Share ${shareId} flagged as suspect because it contained ${infectedFiles.length} flagged file(s)`,
      );
    }
  }
}
