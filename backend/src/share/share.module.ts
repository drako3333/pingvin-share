import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ClamScanModule } from "src/clamscan/clamscan.module";
import { EmailModule } from "src/email/email.module";
import { FileModule } from "src/file/file.module";
import { ReverseShareModule } from "src/reverseShare/reverseShare.module";
import { ShareController } from "./share.controller";
import { ShareService } from "./share.service";
import { ShareAnalyticsService } from "./share-analytics.service";
import { ActivityModule } from "src/activity/activity.module";

@Module({
  imports: [
    JwtModule.register({}),
    EmailModule,
    forwardRef(() => ClamScanModule),
    ReverseShareModule,
    forwardRef(() => FileModule),
    ActivityModule,
  ],
  controllers: [ShareController],
  providers: [ShareService, ShareAnalyticsService],
  exports: [ShareService, ShareAnalyticsService],
})
export class ShareModule {}
