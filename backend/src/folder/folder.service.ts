import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateFolderDTO } from "./dto/createFolder.dto";
import { UpdateFolderDTO } from "./dto/updateFolder.dto";

@Injectable()
export class FolderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFolderDTO) {
    return this.prisma.folder.create({
      data: {
        name: dto.name,
        color: dto.color || "blue",
        icon: dto.icon || "TbFolder",
        creator: { connect: { id: userId } },
      },
      include: {
        creator: true,
        accesses: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async update(userId: string, folderId: string, dto: UpdateFolderDTO) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundException("Folder not found");
    }

    if (folder.creatorId !== userId) {
      throw new ForbiddenException("You don't own this folder");
    }

    return this.prisma.folder.update({
      where: { id: folderId },
      data: {
        name: dto.name,
        color: dto.color,
        icon: dto.icon,
      },
      include: {
        creator: true,
        accesses: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async remove(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundException("Folder not found");
    }

    if (folder.creatorId !== userId) {
      throw new ForbiddenException("You don't own this folder");
    }

    await this.prisma.folder.delete({
      where: { id: folderId },
    });

    return { success: true };
  }

  async findAll(userId: string) {
    return this.prisma.folder.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { accesses: { some: { userId } } },
        ],
      },
      include: {
        creator: true,
        accesses: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async share(userId: string, folderId: string, targetUsernameOrEmail: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundException("Folder not found");
    }

    if (folder.creatorId !== userId) {
      throw new ForbiddenException("You don't own this folder");
    }

    // Find the target user by username or email
    const targetUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: targetUsernameOrEmail },
          { email: targetUsernameOrEmail },
        ],
      },
    });

    if (!targetUser) {
      throw new NotFoundException("Target user not found");
    }

    if (targetUser.id === userId) {
      throw new BadRequestException("You cannot invite yourself");
    }

    // Check if access already exists
    const existingAccess = await this.prisma.folderAccess.findUnique({
      where: {
        folderId_userId: {
          folderId,
          userId: targetUser.id,
        },
      },
    });

    if (existingAccess) {
      throw new BadRequestException("User already has access to this folder");
    }

    await this.prisma.folderAccess.create({
      data: {
        folder: { connect: { id: folderId } },
        user: { connect: { id: targetUser.id } },
      },
    });

    return this.prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        creator: true,
        accesses: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async unshare(userId: string, folderId: string, targetUserId: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundException("Folder not found");
    }

    if (folder.creatorId !== userId) {
      throw new ForbiddenException("You don't own this folder");
    }

    await this.prisma.folderAccess.deleteMany({
      where: {
        folderId,
        userId: targetUserId,
      },
    });

    return this.prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        creator: true,
        accesses: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async moveShare(userId: string, shareId: string, folderId: string | null) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException("Share not found");
    }

    // Verify ownership of the share
    if (share.creatorId !== userId) {
      throw new ForbiddenException("You do not own this share");
    }

    if (folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: folderId },
        include: { accesses: true },
      });

      if (!folder) {
        throw new NotFoundException("Folder not found");
      }

      // Verify that user is either folder creator or collaborator
      const hasAccess =
        folder.creatorId === userId ||
        folder.accesses.some((acc) => acc.userId === userId);

      if (!hasAccess) {
        throw new ForbiddenException("You don't have access to this folder");
      }
    }

    return this.prisma.share.update({
      where: { id: shareId },
      data: {
        folderId: folderId || null,
      },
    });
  }
}
