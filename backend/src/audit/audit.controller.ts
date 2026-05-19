import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { AuditLogService } from "./audit.service";

@Controller("admin/audit-logs")
@UseGuards(JwtGuard, AdministratorGuard)
export class AuditController {
  constructor(private auditLogService: AuditLogService) {}

  @Get()
  async getAll() {
    return this.auditLogService.getAll();
  }
}
