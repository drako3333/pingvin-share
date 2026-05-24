import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ReverseShareModule } from "src/reverseShare/reverseShare.module";
import { ShareModule } from "src/share/share.module";
import { FileController } from "./file.controller";
import { S3MultipartController } from "./s3-multipart.controller";
import { FileService } from "./file.service";
import { LocalFileService } from "./local.service";
import { S3FileService } from "./s3.service";
import { ActivityModule } from "src/activity/activity.module";

@Module({
  imports: [JwtModule.register({}), ReverseShareModule, ShareModule, ActivityModule],
  controllers: [FileController, S3MultipartController],
  providers: [FileService, LocalFileService, S3FileService],
  exports: [FileService, S3FileService, LocalFileService],
})
export class FileModule {}
