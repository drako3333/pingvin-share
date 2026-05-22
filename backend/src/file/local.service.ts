import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { createReadStream } from "fs";
import * as fs from "fs/promises";
import * as mime from "mime-types";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { validate as isValidUUID } from "uuid";
import { SHARE_DIRECTORY } from "../constants";
import { Readable } from "stream";

@Injectable()
export class LocalFileService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async create(
    data: string,
    chunk: { index: number; total: number },
    file: { id?: string; name: string },
    shareId: string,
  ) {
    if (!file.id) {
      file.id = crypto.randomUUID();
    } else if (!isValidUUID(file.id)) {
      throw new BadRequestException("Invalid file ID format");
    }

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: { files: true, reverseShare: true },
    });

    if (share.uploadLocked)
      throw new BadRequestException("Share is already completed");

    let diskFileSize: number;
    try {
      diskFileSize = (
        await fs.stat(`${SHARE_DIRECTORY}/${shareId}/${file.id}.tmp-chunk`)
      ).size;
    } catch {
      diskFileSize = 0;
    }

    // If the sent chunk index and the expected chunk index doesn't match throw an error
    const chunkSize = this.config.get("share.chunkSize");
    const expectedChunkIndex = Math.ceil(diskFileSize / chunkSize);

    if (expectedChunkIndex != chunk.index)
      throw new BadRequestException({
        message: "Unexpected chunk received",
        error: "unexpected_chunk_index",
        expectedChunkIndex,
      });

    const buffer = data
      ? (Buffer.isBuffer(data)
          ? data
          : typeof data === "string"
          ? Buffer.from(data, "base64")
          : Buffer.from(JSON.stringify(data)))
      : Buffer.alloc(0);

    // Check if there is enough space on the server
    try {
      const space = await fs.statfs(SHARE_DIRECTORY);
      const availableSpace = space.bavail * space.bsize;
      if (availableSpace < buffer.byteLength) {
        throw new InternalServerErrorException("Not enough space on the server");
      }
    } catch (e) {
      // If statfs is not supported, restricted, or throws an error, log it but continue the upload
      console.warn("Unable to check disk space with statfs, bypassing space check:", e);
    }

    // Check if share size limit is exceeded
    const fileSizeSum = share.files.reduce(
      (n, { size }) => n + parseInt(size),
      0,
    );

    const shareSizeSum = fileSizeSum + diskFileSize + buffer.byteLength;

    if (
      shareSizeSum > this.config.get("share.maxSize") ||
      (share.reverseShare?.maxShareSize &&
        shareSizeSum > parseInt(share.reverseShare.maxShareSize))
    ) {
      throw new HttpException(
        "Max share size exceeded",
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    await fs.appendFile(
      `${SHARE_DIRECTORY}/${shareId}/${file.id}.tmp-chunk`,
      buffer,
    );

    const isLastChunk = chunk.index == chunk.total - 1;
    if (isLastChunk) {
      const tempPath = `${SHARE_DIRECTORY}/${shareId}/${file.id}`;
      await fs.rename(
        `${SHARE_DIRECTORY}/${shareId}/${file.id}.tmp-chunk`,
        tempPath,
      );
      const fileSize = (await fs.stat(tempPath)).size;

      let fileHash: string | null = null;
      try {
        fileHash = await this.getFileSha256(tempPath);
      } catch {
        fileHash = null;
      }

      if (fileHash) {
        const targetDir = `${SHARE_DIRECTORY}/_files`;
        await fs.mkdir(targetDir, { recursive: true });
        const finalCASPath = `${targetDir}/${fileHash}`;

        try {
          await fs.access(finalCASPath);
          await fs.unlink(tempPath);
        } catch {
          await fs.rename(tempPath, finalCASPath);
        }
      }

      await this.prisma.file.create({
        data: {
          id: file.id,
          name: file.name,
          size: fileSize.toString(),
          hash: fileHash,
          share: { connect: { id: shareId } },
        },
      });

      if (share.creatorId) {
        await this.prisma.updateUserStorageUsed(share.creatorId);
      }
    }

    return file;
  }

  private async getFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = createReadStream(filePath);
      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", (err) => reject(err));
    });
  }

  async get(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    const filePath = fileMetaData.hash
      ? `${SHARE_DIRECTORY}/_files/${fileMetaData.hash}`
      : `${SHARE_DIRECTORY}/${shareId}/${fileId}`;

    const file = createReadStream(filePath);

    return {
      metaData: {
        mimeType: mime.contentType(fileMetaData.name.split(".").pop()) || "application/octet-stream",
        ...fileMetaData,
        size: fileMetaData.size,
      },
      file,
    };
  }

  async remove(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    if (fileMetaData.hash) {
      const otherFilesWithHash = await this.prisma.file.findMany({
        where: {
          hash: fileMetaData.hash,
          id: { not: fileId },
        },
      });

      if (otherFilesWithHash.length === 0) {
        try {
          await fs.unlink(`${SHARE_DIRECTORY}/_files/${fileMetaData.hash}`);
        } catch {
          // Ignore
        }
      }
    } else {
      try {
        await fs.unlink(`${SHARE_DIRECTORY}/${shareId}/${fileId}`);
      } catch {
        // Ignore
      }
    }

    await this.prisma.file.delete({ where: { id: fileId } });

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });
    if (share?.creatorId) {
      await this.prisma.updateUserStorageUsed(share.creatorId);
    }
  }

  async deleteAllFiles(shareId: string) {
    const files = await this.prisma.file.findMany({
      where: { shareId },
    });

    for (const file of files) {
      if (file.hash) {
        const otherFilesWithHash = await this.prisma.file.findMany({
          where: {
            hash: file.hash,
            shareId: { not: shareId },
          },
        });

        if (otherFilesWithHash.length === 0) {
          try {
            await fs.unlink(`${SHARE_DIRECTORY}/_files/${file.hash}`);
          } catch {
            // Ignore
          }
        }
      }
    }

    await fs.rm(`${SHARE_DIRECTORY}/${shareId}`, {
      recursive: true,
      force: true,
    });
  }

  async getZip(shareId: string): Promise<Readable> {
    return new Promise((resolve, reject) => {
      const zipStream = createReadStream(
        `${SHARE_DIRECTORY}/${shareId}/archive.zip`,
      );

      zipStream.on("error", (err) => {
        reject(new InternalServerErrorException(err));
      });

      zipStream.on("open", () => {
        resolve(zipStream);
      });
    });
  }
}
