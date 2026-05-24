import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { User } from "@prisma/client";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { CreateFolderDTO } from "./dto/createFolder.dto";
import { UpdateFolderDTO } from "./dto/updateFolder.dto";
import { FolderService } from "./folder.service";

@Controller("folders")
@UseGuards(JwtGuard)
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get()
  async findAll(@GetUser() user: User) {
    return this.folderService.findAll(user.id);
  }

  @Post()
  async create(@GetUser() user: User, @Body() dto: CreateFolderDTO) {
    return this.folderService.create(user.id, dto);
  }

  @Patch(":id")
  async update(
    @GetUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateFolderDTO,
  ) {
    return this.folderService.update(user.id, id, dto);
  }

  @Delete(":id")
  async remove(@GetUser() user: User, @Param("id") id: string) {
    return this.folderService.remove(user.id, id);
  }

  @Post(":id/share")
  async share(
    @GetUser() user: User,
    @Param("id") id: string,
    @Body() body: { usernameOrEmail: string },
  ) {
    return this.folderService.share(user.id, id, body.usernameOrEmail);
  }

  @Delete(":id/share/:userId")
  async unshare(
    @GetUser() user: User,
    @Param("id") id: string,
    @Param("userId") targetUserId: string,
  ) {
    return this.folderService.unshare(user.id, id, targetUserId);
  }

  @Post("move")
  async moveShare(
    @GetUser() user: User,
    @Body() body: { shareId: string; folderId: string | null },
  ) {
    return this.folderService.moveShare(user.id, body.shareId, body.folderId);
  }
}
