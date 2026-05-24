import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ActivityController } from "./activity.controller";
import { ActivityService } from "./activity.service";
import { ReverseShareModule } from "src/reverseShare/reverseShare.module";

@Module({
  imports: [JwtModule.register({}), ReverseShareModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
