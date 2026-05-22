import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  UploadPartCommand,
  UploadPartCommandOutput,
  CopyObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PrismaService } from "src/prisma/prisma.service";
import { ConfigService } from "src/config/config.service";
import * as crypto from "crypto";
import * as mime from "mime-types";
import { createReadStream } from "fs";
import { File } from "./file.service";
import { Readable } from "stream";
import { validate as isValidUUID } from "uuid";
import * as archiver from "archiver";

@Injectable()
export class S3FileService {
  private readonly logger = new Logger(S3FileService.name);

  private multipartUploads: Record<
    string,
    {
      uploadId: string;
      parts: Array<{ ETag: string | undefined; PartNumber: number }>;
      hashState?: crypto.Hash;
    }
  > = {};

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getS3InstanceAndBucket(shareIdOrBucketId?: string, isBucketId = false): Promise<{ s3Instance: S3Client; bucketName: string }> {
    let targetBucketId: string | null = null;

    if (shareIdOrBucketId) {
      if (isBucketId) {
        targetBucketId = shareIdOrBucketId;
      } else {
        const share = await this.prisma.share.findUnique({
          where: { id: shareIdOrBucketId },
        });
        targetBucketId = share?.s3BucketId || null;
        if (targetBucketId && targetBucketId.includes(",")) {
          targetBucketId = targetBucketId.split(",")[0];
        }
      }
    }

    if (this.config.get("s3.multiBucketsEnabled") && targetBucketId) {
      const configStr = this.config.get("s3.multiBucketsConfig");
      try {
        const buckets = JSON.parse(configStr || "[]");
        const bucketConfig = buckets.find((b: any) => b.id === targetBucketId);
        if (bucketConfig) {
          const checksumCalculation =
            this.config.get("s3.useChecksum") === true ? null : "WHEN_REQUIRED";
          const client = new S3Client({
            endpoint: bucketConfig.endpoint,
            region: bucketConfig.region,
            credentials: {
              accessKeyId: bucketConfig.key,
              secretAccessKey: bucketConfig.secret,
            },
            forcePathStyle: true,
            requestChecksumCalculation: checksumCalculation,
            responseChecksumValidation: checksumCalculation,
          });
          return { s3Instance: client, bucketName: bucketConfig.bucketName };
        }
      } catch (err) {
        this.logger.error(`Error parsing s3.multiBucketsConfig or locating bucket ${targetBucketId}`, err);
      }
    }

    // Fallback to default S3 configuration
    return {
      s3Instance: this.getS3Instance(),
      bucketName: this.config.get("s3.bucketName"),
    };
  }

  async getAllS3InstancesAndBuckets(shareId: string): Promise<Array<{ s3Instance: S3Client; bucketName: string }>> {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });
    if (!share || !share.s3BucketId) {
      const def = await this.getS3InstanceAndBucket(shareId);
      return [def];
    }
    const bucketIds = share.s3BucketId.split(",");
    const list = [];
    for (const bId of bucketIds) {
      const inst = await this.getS3InstanceAndBucket(bId, true);
      list.push(inst);
    }
    return list;
  }

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

    const buffer = data
      ? (Buffer.isBuffer(data)
          ? data
          : typeof data === "string"
          ? Buffer.from(data, "base64")
          : Buffer.from(JSON.stringify(data)))
      : Buffer.alloc(0);

    const uploadKey = `${this.getS3Path()}_tmp/${file.id}`;
    const { s3Instance, bucketName } = await this.getS3InstanceAndBucket(shareId);

    try {
      // Initialize multipart upload if it's the first chunk
      if (chunk.index === 0) {
        const multipartInitResponse = await s3Instance.send(
          new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: uploadKey,
          }),
        );

        const uploadId = multipartInitResponse.UploadId;
        if (!uploadId) {
          throw new Error("Failed to initialize multipart upload.");
        }

        // Store the uploadId, parts, and initialize hash state in memory
        this.multipartUploads[file.id] = {
          uploadId,
          parts: [],
          hashState: crypto.createHash("sha256"),
        };
      }

      // Get the ongoing multipart upload
      const multipartUpload = this.multipartUploads[file.id];
      if (!multipartUpload) {
        throw new InternalServerErrorException(
          "Multipart upload session not found.",
        );
      }

      const uploadId = multipartUpload.uploadId;
      if (!multipartUpload.hashState) {
        multipartUpload.hashState = crypto.createHash("sha256");
      }
      multipartUpload.hashState.update(buffer);

      // Upload the current chunk
      const partNumber = chunk.index + 1; // Part numbers start from 1

      const uploadPartResponse: UploadPartCommandOutput = await s3Instance.send(
        new UploadPartCommand({
          Bucket: bucketName,
          Key: uploadKey,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: buffer,
        }),
      );

      // Store the ETag and PartNumber for later completion
      multipartUpload.parts.push({
        ETag: uploadPartResponse.ETag,
        PartNumber: partNumber,
      });

      // Complete the multipart upload if it's the last chunk
      if (chunk.index === chunk.total - 1) {
        await s3Instance.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: uploadKey,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: multipartUpload.parts,
            },
          }),
        );

        const fileHash = multipartUpload.hashState.digest("hex");
        // Remove the completed upload from memory
        delete this.multipartUploads[file.id];

        const finalCASKey = `${this.getS3Path()}_files/${fileHash}`;
        let existsOnS3 = false;
        let fileSize = 0;

        try {
          const headRes = await s3Instance.send(
            new HeadObjectCommand({
              Bucket: bucketName,
              Key: finalCASKey,
            }),
          );
          existsOnS3 = true;
          fileSize = headRes.ContentLength ?? 0;
        } catch (err) {
          existsOnS3 = false;
        }

        if (existsOnS3) {
          // File already exists under this hash, delete the temporary file
          await s3Instance.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: uploadKey,
            }),
          );
        } else {
          // Copy the temporary file to the final CAS key
          await s3Instance.send(
            new CopyObjectCommand({
              Bucket: bucketName,
              CopySource: `${bucketName}/${uploadKey}`,
              Key: finalCASKey,
            }),
          );

          // Delete the temporary file
          await s3Instance.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: uploadKey,
            }),
          );

          // Get the exact size of the newly written S3 object
          const headRes = await s3Instance.send(
            new HeadObjectCommand({
              Bucket: bucketName,
              Key: finalCASKey,
            }),
          );
          fileSize = headRes.ContentLength ?? 0;
        }

        // Create the file record in the Prisma DB
        await this.prisma.file.create({
          data: {
            id: file.id,
            name: file.name,
            size: fileSize.toString(),
            hash: fileHash,
            share: { connect: { id: shareId } },
          },
        });

        const share = await this.prisma.share.findUnique({
          where: { id: shareId },
        });
        if (share?.creatorId) {
          await this.prisma.updateUserStorageUsed(share.creatorId);
        }
      }
    } catch (error) {
      // Abort the multipart upload if it fails
      const multipartUpload = this.multipartUploads[file.id];
      if (multipartUpload) {
        try {
          await s3Instance.send(
            new AbortMultipartUploadCommand({
              Bucket: bucketName,
              Key: uploadKey,
              UploadId: multipartUpload.uploadId,
            }),
          );
        } catch (abortError) {
          this.logger.error("Error aborting multipart upload:", abortError);
        }
        delete this.multipartUploads[file.id];
      }
      this.logger.error(error);
      throw new Error("Multipart upload failed. The upload has been aborted.");
    }

    return file;
  }

  async get(shareId: string, fileId: string): Promise<File> {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    const { s3Instance, bucketName } = await this.getS3InstanceAndBucket(shareId);
    const key = fileMetaData.hash
      ? `${this.getS3Path()}_files/${fileMetaData.hash}`
      : `${this.getS3Path()}${shareId}/${fileMetaData.name}`;

    const response = await s3Instance.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );

    return {
      metaData: {
        id: fileId,
        size: response.ContentLength?.toString() || "0",
        name: fileMetaData.name,
        shareId: shareId,
        createdAt: response.LastModified || new Date(),
        mimeType:
          mime.contentType(fileMetaData.name.split(".").pop() || "") ||
          "application/octet-stream",
      },
      file: response.Body as Readable,
    } as File;
  }

  async remove(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    const instances = await this.getAllS3InstancesAndBuckets(shareId);

    for (const { s3Instance, bucketName } of instances) {
      if (fileMetaData.hash) {
        const otherFilesWithHash = await this.prisma.file.findMany({
          where: {
            hash: fileMetaData.hash,
            id: { not: fileId },
          },
        });

        if (otherFilesWithHash.length === 0) {
          const key = `${this.getS3Path()}_files/${fileMetaData.hash}`;
          try {
            await s3Instance.send(
              new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key,
              }),
            );
          } catch (error) {
            this.logger.error(`Could not delete file ${key} from S3 bucket ${bucketName}`, error);
          }
        }
      } else {
        const key = `${this.getS3Path()}${shareId}/${fileMetaData.name}`;
        try {
          await s3Instance.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: key,
            }),
          );
        } catch (error) {
          this.logger.error(`Could not delete legacy file ${key} from S3 bucket ${bucketName}`, error);
        }
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

    const instances = await this.getAllS3InstancesAndBuckets(shareId);

    for (const { s3Instance, bucketName } of instances) {
      for (const file of files) {
        if (file.hash) {
          const otherFilesWithHash = await this.prisma.file.findMany({
            where: {
              hash: file.hash,
              shareId: { not: shareId },
            },
          });

          if (otherFilesWithHash.length === 0) {
            const key = `${this.getS3Path()}_files/${file.hash}`;
            try {
              await s3Instance.send(
                new DeleteObjectCommand({
                  Bucket: bucketName,
                  Key: key,
                }),
              );
            } catch (error) {
              this.logger.error(`Could not delete file ${key} from S3 bucket ${bucketName}`, error);
            }
          }
        }
      }

      // Blanket clean sweep of the share prefix to delete legacy files, zip archives, and leftovers
      const prefix = `${this.getS3Path()}${shareId}/`;
      try {
        const listResponse = await s3Instance.send(
          new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
          }),
        );

        if (listResponse.Contents && listResponse.Contents.length > 0) {
          const objectsToDelete = listResponse.Contents.map((file) => ({
            Key: file.Key!,
          }));

          await s3Instance.send(
            new DeleteObjectsCommand({
              Bucket: bucketName,
              Delete: {
                Objects: objectsToDelete,
              },
            }),
          );
        }
      } catch (error) {
        this.logger.error(`Error cleaning up prefix ${prefix} from S3 bucket ${bucketName}`, error);
      }
    }
  }

  async getFileSize(shareId: string, fileName: string): Promise<number> {
    const file = await this.prisma.file.findFirst({
      where: {
        shareId,
        name: fileName,
      },
    });

    const key = file?.hash
      ? `${this.getS3Path()}_files/${file.hash}`
      : `${this.getS3Path()}${shareId}/${fileName}`;

    const { s3Instance, bucketName } = await this.getS3InstanceAndBucket(shareId);

    try {
      const headObjectResponse = await s3Instance.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
      return headObjectResponse.ContentLength ?? 0;
    } catch (error) {
      throw new Error("Could not retrieve file size");
    }
  }

  getS3Instance(): S3Client {
    const checksumCalculation =
      this.config.get("s3.useChecksum") === true ? null : "WHEN_REQUIRED";

    return new S3Client({
      endpoint: this.config.get("s3.endpoint"),
      region: this.config.get("s3.region"),
      credentials: {
        accessKeyId: this.config.get("s3.key"),
        secretAccessKey: this.config.get("s3.secret"),
      },
      forcePathStyle: true,
      requestChecksumCalculation: checksumCalculation,
      responseChecksumValidation: checksumCalculation,
    });
  }

  getZip(shareId: string) {
    return new Promise<Readable>(async (resolve, reject) => {
      try {
        const { s3Instance, bucketName } = await this.getS3InstanceAndBucket(shareId);
        const compressionLevel = this.config.get("share.zipCompressionLevel");

        const files = await this.prisma.file.findMany({
          where: { shareId },
        });

        if (files.length === 0) {
          throw new NotFoundException(`No files found for share ${shareId}`);
        }

        const archive = archiver("zip", {
          zlib: { level: parseInt(compressionLevel) },
        });

        archive.on("error", (err) => {
          this.logger.error("Archive error", err);
          reject(new InternalServerErrorException("Error creating ZIP file"));
        });

        let filesAdded = 0;

        const processNextFile = async (index: number) => {
          if (index >= files.length) {
            archive.finalize();
            return;
          }

          const fileMetadata = files[index];
          const key = fileMetadata.hash
            ? `${this.getS3Path()}_files/${fileMetadata.hash}`
            : `${this.getS3Path()}${shareId}/${fileMetadata.name}`;

          try {
            const response = await s3Instance.send(
              new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
              }),
            );

            if (response.Body instanceof Readable) {
              const fileStream = response.Body;

              fileStream.on("end", () => {
                filesAdded++;
                processNextFile(index + 1);
              });

              fileStream.on("error", (err) => {
                this.logger.error(`Error streaming file ${fileMetadata.name}`, err);
                processNextFile(index + 1);
              });

              archive.append(fileStream, { name: fileMetadata.name });
            } else {
              processNextFile(index + 1);
            }
          } catch (error) {
            this.logger.error(`Error processing file ${fileMetadata.name}`, error);
            processNextFile(index + 1);
          }
        };

        resolve(archive);
        processNextFile(0);
      } catch (error) {
        this.logger.error("Error creating ZIP file", error);
        reject(new InternalServerErrorException("Error creating ZIP file"));
      }
    });
  }

  async migrateLocalFileToS3(
    localPath: string,
    fileId: string,
    fileName: string,
    fileHash: string,
    shareId: string,
  ): Promise<void> {
    const { s3Instance, bucketName } = await this.getS3InstanceAndBucket(shareId);
    const finalCASKey = `${this.getS3Path()}_files/${fileHash}`;

    // Check if the file already exists on S3 at the final CAS key
    let existsOnS3 = false;
    try {
      await s3Instance.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: finalCASKey,
        }),
      );
      existsOnS3 = true;
    } catch {
      existsOnS3 = false;
    }

    if (!existsOnS3) {
      const fileStream = createReadStream(localPath);
      await s3Instance.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: finalCASKey,
          Body: fileStream,
        }),
      );
    }
  }

  async initiateMultipartUpload(bucketId: string, fileId: string, fileName: string): Promise<{ uploadId: string; bucketName: string }> {
    const { s3Instance, bucketName } = await this.getS3InstanceAndBucket(bucketId, true);
    const key = `${this.getS3Path()}_tmp/${fileId}`;
    try {
      const res = await s3Instance.send(
        new CreateMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          ContentType: mime.contentType(fileName.split(".").pop() || "") || "application/octet-stream",
        }),
      );
      if (!res.UploadId) throw new Error("No upload ID returned from S3");
      return { uploadId: res.UploadId, bucketName };
    } catch (err) {
      this.logger.error(`Error initiating S3 multipart upload for ${fileName} on bucket ${bucketId}`, err);
      throw new InternalServerErrorException(`S3 initiate upload failed: ${err.message}`);
    }
  }

  async getUploadPartPresignedUrl(bucketId: string, fileId: string, uploadId: string, partNumber: number): Promise<string> {
    const { s3Instance, bucketName } = await this.getS3InstanceAndBucket(bucketId, true);
    const key = `${this.getS3Path()}_tmp/${fileId}`;
    try {
      const command = new UploadPartCommand({
        Bucket: bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      return await getSignedUrl(s3Instance as any, command as any, { expiresIn: 3600 });
    } catch (err) {
      this.logger.error(`Error signing upload part ${partNumber} for file ${fileId}`, err);
      throw new InternalServerErrorException(`S3 part signing failed: ${err.message}`);
    }
  }

  async completeMultipartUpload(
    bucketId: string,
    fileId: string,
    uploadId: string,
    parts: Array<{ ETag: string; PartNumber: number }>,
    fileHash: string,
  ): Promise<{ size: number }> {
    const { s3Instance, bucketName } = await this.getS3InstanceAndBucket(bucketId, true);
    const tmpKey = `${this.getS3Path()}_tmp/${fileId}`;
    const finalCASKey = `${this.getS3Path()}_files/${fileHash}`;

    try {
      // Complete temporary upload
      await s3Instance.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucketName,
          Key: tmpKey,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
          },
        }),
      );

      // Check if file already exists in S3 CAS
      let existsOnS3 = false;
      let fileSize = 0;
      try {
        const headRes = await s3Instance.send(
          new HeadObjectCommand({
            Bucket: bucketName,
            Key: finalCASKey,
          }),
        );
        existsOnS3 = true;
        fileSize = headRes.ContentLength ?? 0;
      } catch (err) {
        existsOnS3 = false;
      }

      if (existsOnS3) {
        // Already exists, delete the tmp file
        await s3Instance.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: tmpKey,
          }),
        );
      } else {
        // Copy to CAS key
        await s3Instance.send(
          new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: `${bucketName}/${tmpKey}`,
            Key: finalCASKey,
          }),
        );

        // Delete tmp key
        await s3Instance.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: tmpKey,
          }),
        );

        // Get size
        const headRes = await s3Instance.send(
          new HeadObjectCommand({
            Bucket: bucketName,
            Key: finalCASKey,
          }),
        );
        fileSize = headRes.ContentLength ?? 0;
      }

      return { size: fileSize };
    } catch (err) {
      this.logger.error(`Error completing S3 multipart upload for file ${fileId}`, err);
      // Try to abort if error occurred
      try {
        await s3Instance.send(
          new AbortMultipartUploadCommand({
            Bucket: bucketName,
            Key: tmpKey,
            UploadId: uploadId,
          }),
        );
      } catch {}
      throw new InternalServerErrorException(`S3 completion failed: ${err.message}`);
    }
  }

  async getDownloadPresignedUrl(shareId: string, fileId: string): Promise<string> {
    const fileMetaData = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    const { s3Instance, bucketName } = await this.getS3InstanceAndBucket(shareId);
    const key = fileMetaData.hash
      ? `${this.getS3Path()}_files/${fileMetaData.hash}`
      : `${this.getS3Path()}${shareId}/${fileMetaData.name}`;

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileMetaData.name)}"`,
      });
      // Generate a 1-hour valid URL
      return await getSignedUrl(s3Instance as any, command as any, { expiresIn: 3600 });
    } catch (err) {
      this.logger.error(`Error generating download presigned URL for file ${fileId}`, err);
      throw new InternalServerErrorException(`Failed to generate download link: ${err.message}`);
    }
  }

  async migrateS3BucketToS3Bucket(sourceBucketId: string, targetBucketId: string, shareId: string) {
    const { s3Instance: srcS3, bucketName: srcBucket } = await this.getS3InstanceAndBucket(sourceBucketId, true);
    const { s3Instance: dstS3, bucketName: dstBucket } = await this.getS3InstanceAndBucket(targetBucketId, true);

    const files = await this.prisma.file.findMany({ where: { shareId } });

    for (const file of files) {
      const fileHash = file.hash || "";
      const finalCASKey = `${this.getS3Path()}_files/${fileHash}`;

      // Check if already in target bucket
      let existsOnTarget = false;
      try {
        await dstS3.send(new HeadObjectCommand({ Bucket: dstBucket, Key: finalCASKey }));
        existsOnTarget = true;
      } catch {
        existsOnTarget = false;
      }

      if (!existsOnTarget) {
        const getRes = await srcS3.send(new GetObjectCommand({ Bucket: srcBucket, Key: finalCASKey }));
        if (getRes.Body instanceof Readable) {
          await dstS3.send(new PutObjectCommand({
            Bucket: dstBucket,
            Key: finalCASKey,
            Body: getRes.Body,
            ContentType: mime.contentType(file.name.split(".").pop() || "") || "application/octet-stream",
          }));
        }
      }

      // Delete from source bucket if not used by other shares in source bucket
      const otherSharesInSource = await this.prisma.share.findMany({
        where: {
          s3BucketId: sourceBucketId,
          id: { not: shareId },
          files: {
            some: { hash: fileHash }
          }
        }
      });

      if (otherSharesInSource.length === 0) {
        try {
          await srcS3.send(new DeleteObjectCommand({ Bucket: srcBucket, Key: finalCASKey }));
        } catch {}
      }
    }

    // Update share record S3 bucket reference
    await this.prisma.share.update({
      where: { id: shareId },
      data: { s3BucketId: targetBucketId },
    });
  }

  getS3Path(): string {
    const configS3Path = this.config.get("s3.bucketPath");
    return configS3Path ? `${configS3Path}/` : "";
  }
}
