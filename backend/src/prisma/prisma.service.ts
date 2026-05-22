import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { DATABASE_URL } from "../constants";

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: DATABASE_URL,
        },
      },
    });
    super.$connect().then(() => this.logger.log("Connected to the database"));
  }

  async updateUserStorageUsed(userId?: string | null): Promise<number> {
    if (!userId) return 0;
    const userShares = await this.share.findMany({
      where: { creatorId: userId },
      include: { files: true },
    });

    let storageUsed = 0n;
    for (const share of userShares) {
      for (const file of share.files) {
        storageUsed += BigInt(file.size || "0");
      }
    }

    await this.user.update({
      where: { id: userId },
      data: { storageUsed },
    });

    return Number(storageUsed);
  }
}
