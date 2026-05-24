import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as argon from "argon2";
import * as crypto from "crypto";
import { Entry } from "ldapts";
import { AuthSignInDTO } from "src/auth/dto/authSignIn.dto";
import { EmailService } from "src/email/email.service";
import { PrismaService } from "src/prisma/prisma.service";
import { inspect } from "util";
import { ConfigService } from "../config/config.service";
import { FileService } from "../file/file.service";
import { CreateUserDTO } from "./dto/createUser.dto";
import { UpdateUserDto } from "./dto/updateUser.dto";
import * as moment from "moment";

@Injectable()
export class UserSevice {
  private readonly logger = new Logger(UserSevice.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private fileService: FileService,
    private configService: ConfigService,
  ) {}

  async list() {
    return await this.prisma.user.findMany();
  }

  async get(id: string) {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  async create(dto: CreateUserDTO) {
    let hash: string;

    // The password can be undefined if the user is invited by an admin
    if (!dto.password) {
      const randomPassword = crypto.randomUUID();
      hash = await argon.hash(randomPassword);
      await this.emailService.sendInviteEmail(dto.email, randomPassword);
    } else {
      hash = await argon.hash(dto.password);
    }

    const { storageQuota, ...rest } = dto;

    try {
      return await this.prisma.user.create({
        data: {
          ...rest,
          storageQuota: storageQuota !== undefined ? BigInt(storageQuota) : undefined,
          password: hash,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code == "P2002") {
          const duplicatedField: string = e.meta.target[0];
          throw new BadRequestException(
            `A user with this ${duplicatedField} already exists`,
          );
        }
      }
    }
  }

  async update(id: string, user: UpdateUserDto) {
    try {
      const hash = user.password && (await argon.hash(user.password));
      const { storageQuota, ...rest } = user;

      return await this.prisma.user.update({
        where: { id },
        data: {
          ...rest,
          storageQuota: storageQuota !== undefined ? BigInt(storageQuota) : undefined,
          password: hash,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code == "P2002") {
          const duplicatedField: string = e.meta.target[0];
          throw new BadRequestException(
            `A user with this ${duplicatedField} already exists`,
          );
        }
      }
    }
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { shares: true },
    });
    if (!user) throw new BadRequestException("User not found");

    if (user.isAdmin) {
      const userCount = await this.prisma.user.count({
        where: { isAdmin: true },
      });

      if (userCount === 1) {
        throw new BadRequestException("Cannot delete the last admin user");
      }
    }

    await Promise.all(
      user.shares.map((share) => this.fileService.deleteAllFiles(share.id)),
    );

    return await this.prisma.user.delete({ where: { id } });
  }

  async findOrCreateFromLDAP(
    providedCredentials: AuthSignInDTO,
    ldapEntry: Entry,
  ) {
    const fieldNameMemberOf = this.configService.get("ldap.fieldNameMemberOf");
    const fieldNameEmail = this.configService.get("ldap.fieldNameEmail");

    let isAdmin = false;
    if (fieldNameMemberOf in ldapEntry) {
      const adminGroup = this.configService.get("ldap.adminGroups");
      const entryGroups = Array.isArray(ldapEntry[fieldNameMemberOf])
        ? ldapEntry[fieldNameMemberOf]
        : [ldapEntry[fieldNameMemberOf]];
      isAdmin = entryGroups.includes(adminGroup) ?? false;
    } else {
      this.logger.warn(
        `Trying to create/update a ldap user but the member field ${fieldNameMemberOf} is not present.`,
      );
    }

    let userEmail: string | null = null;
    if (fieldNameEmail in ldapEntry) {
      const value = Array.isArray(ldapEntry[fieldNameEmail])
        ? ldapEntry[fieldNameEmail][0]
        : ldapEntry[fieldNameEmail];
      if (value) {
        userEmail = value.toString();
      }
    } else {
      this.logger.warn(
        `Trying to create/update a ldap user but the email field ${fieldNameEmail} is not present.`,
      );
    }

    if (providedCredentials.email) {
      /* if LDAP does not provides an users email address, take the user provided email address instead */
      userEmail = providedCredentials.email;
    }

    const randomId = crypto.randomUUID();
    const placeholderUsername = `ldap_user_${randomId}`;
    const placeholderEMail = `${randomId}@ldap.local`;

    try {
      const user = await this.prisma.user.upsert({
        create: {
          username: providedCredentials.username ?? placeholderUsername,
          email: userEmail ?? placeholderEMail,
          password: await argon.hash(crypto.randomUUID()),

          isAdmin,
          ldapDN: ldapEntry.dn,
        },
        update: {
          isAdmin,
          ldapDN: ldapEntry.dn,
        },
        where: {
          ldapDN: ldapEntry.dn,
        },
      });

      if (user.username === placeholderUsername) {
        /* Give the user a human readable name if the user has been created with a placeholder username */
        await this.prisma.user
          .update({
            where: {
              id: user.id,
            },
            data: {
              username: `user_${user.id}`,
            },
          })
          .then((newUser) => {
            user.username = newUser.username;
          })
          .catch((error) => {
            this.logger.warn(
              `Failed to update users ${user.id} placeholder username: ${inspect(error)}`,
            );
          });
      }

      if (userEmail && userEmail !== user.email) {
        /* Sync users email if it has changed */
        await this.prisma.user
          .update({
            where: {
              id: user.id,
            },
            data: {
              email: userEmail,
            },
          })
          .then((newUser) => {
            this.logger.log(
              `Updated users ${user.id} email from ldap from ${user.email} to ${userEmail}.`,
            );
            user.email = newUser.email;
          })
          .catch((error) => {
            this.logger.error(
              `Failed to update users ${user.id} email to ${userEmail}: ${inspect(error)}`,
            );
          });
      }

      return user;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code == "P2002") {
          const duplicatedField: string = e.meta.target[0];
          throw new BadRequestException(
            `A user with this ${duplicatedField} already exists`,
          );
        }
      }
    }
  }

  async getDashboardStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new BadRequestException("User not found");

    const userShares = await this.prisma.share.findMany({
      where: { creatorId: userId },
      select: { id: true, name: true, views: true, createdAt: true },
    });

    const shareIds = userShares.map((s) => s.id);

    // 1. Popular shares (most views)
    const popularShares = [...userShares]
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // 2. Storage stats (BigInt converted to numbers to avoid JSON serialization issues)
    const storage = {
      used: Number(user.storageUsed),
      quota: Number(user.storageQuota),
    };

    // 3. Activity Chart (last 7 days uploads and downloads)
    const chartData = [];
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = moment().subtract(i, "days").startOf("day");
      last7Days.push(date);
    }

    // Fetch uploads in last 7 days (Files added to user's shares)
    const filesUploaded = await this.prisma.file.findMany({
      where: {
        shareId: { in: shareIds },
        createdAt: { gte: moment().subtract(7, "days").startOf("day").toDate() },
      },
      select: { createdAt: true },
    });

    // Fetch downloads in last 7 days (ShareAnalytics for user's shares)
    const downloads = await this.prisma.shareAnalytics.findMany({
      where: {
        shareId: { in: shareIds },
        createdAt: { gte: moment().subtract(7, "days").startOf("day").toDate() },
      },
      select: { createdAt: true },
    });

    last7Days.forEach((day) => {
      const label = day.format("dddd"); // e.g. "Lundi", "Mardi" in French
      const start = day.toDate();
      const end = moment(day).endOf("day").toDate();

      const uploadsCount = filesUploaded.filter(
        (f) => f.createdAt >= start && f.createdAt <= end
      ).length;

      const downloadsCount = downloads.filter(
        (d) => d.createdAt >= start && d.createdAt <= end
      ).length;

      chartData.push({
        label,
        date: day.format("YYYY-MM-DD"),
        uploads: uploadsCount,
        downloads: downloadsCount,
      });
    });

    // 4. Recent activity timeline
    const timeline = [];

    // Add last 5 share creations
    const shareCreations = await this.prisma.share.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Add last 10 downloads analytics
    const recentDownloads = await this.prisma.shareAnalytics.findMany({
      where: { shareId: { in: shareIds } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    shareCreations.forEach((sc) => {
      timeline.push({
        id: `create-${sc.id}-${sc.createdAt.getTime()}`,
        timestamp: sc.createdAt,
        type: "upload",
        title: "Partage créé",
        description: `Le partage "${sc.name || sc.id}" a été initialisé avec succès.`,
      });
    });

    recentDownloads.forEach((rd) => {
      const parentShare = userShares.find((s) => s.id === rd.shareId);
      timeline.push({
        id: `download-${rd.id}-${rd.createdAt.getTime()}`,
        timestamp: rd.createdAt,
        type: "download",
        title: "Fichier téléchargé",
        description: `Quelqu'un a téléchargé un fichier du partage "${parentShare?.name || rd.shareId}" depuis l'IP ${rd.ip}.`,
      });
    });

    // Sort combined timeline by timestamp desc
    const sortedTimeline = timeline
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8);

    return {
      storage,
      popularShares,
      chartData,
      recentActivity: sortedTimeline,
    };
  }
}
