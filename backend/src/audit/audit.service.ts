import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async create(
    action: string,
    ip: string,
    details: any,
    userId?: string,
    username?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        action,
        ip,
        details: JSON.stringify(details),
        userId: userId || null,
        username: username || null,
      },
    });
  }

  async getAll() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
    });
  }
}
