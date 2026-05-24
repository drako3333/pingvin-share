import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Sse,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { ShareOwnerGuard } from "src/share/guard/shareOwner.guard";
import { CreateShareGuard } from "src/share/guard/createShare.guard";
import { ActivityService, MessageEvent } from "./activity.service";
import { Observable } from "rxjs";
import { Request } from "express";
import { User } from "@prisma/client";

@Controller("activity")
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Sse("stream")
  @UseGuards(JwtGuard, AdministratorGuard)
  stream(): Observable<MessageEvent> {
    return this.activityService.getStream();
  }

  @Get("recent")
  @UseGuards(JwtGuard, AdministratorGuard)
  async getRecent() {
    return await this.activityService.getRecentEvents();
  }

  @Post(":shareId/upload-progress")
  @UseGuards(CreateShareGuard, ShareOwnerGuard)
  reportProgress(
    @Param("shareId") shareId: string,
    @Body() body: { fileId: string; fileName: string; progress: number; size: number },
    @Req() request: Request,
  ) {
    const creatorUser = request["user"] as User | undefined;
    const username = creatorUser?.username || "Anonyme";

    this.activityService.publish({
      type: "upload-progress",
      data: {
        shareId,
        fileId: body.fileId,
        fileName: body.fileName,
        progress: body.progress,
        size: body.size,
        username,
      },
    });

    return { success: true };
  }
}
