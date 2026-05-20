// Polyfill: SlowBuffer was removed in Node 25.0.0
// safe-buffer@5.2.1 (used by jsonwebtoken, express, archiver) still references it.
// Official migration: SlowBuffer(size) → Buffer.allocUnsafeSlow(size)
import * as bufferModule from "buffer";
if (!(bufferModule as any).SlowBuffer) {
  (bufferModule as any).SlowBuffer = function SlowBuffer(size: number) {
    return Buffer.allocUnsafeSlow(size);
  };
}
if (typeof (global as any).SlowBuffer === "undefined") {
  (global as any).SlowBuffer = (bufferModule as any).SlowBuffer;
}

import {
  ClassSerializerInterceptor,
  Logger,
  LogLevel,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import { NextFunction, Request, Response } from "express";
import * as fs from "fs";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import {
  DATA_DIRECTORY,
  LOG_LEVEL_AVAILABLE,
  LOG_LEVEL_DEFAULT,
  LOG_LEVEL_ENV,
} from "./constants";

function generateNestJsLogLevels(): LogLevel[] {
  if (LOG_LEVEL_ENV) {
    const levelIndex = LOG_LEVEL_AVAILABLE.indexOf(LOG_LEVEL_ENV as any);
    if (levelIndex === -1) {
      throw new Error(`log level ${LOG_LEVEL_ENV} unknown`);
    }

    return LOG_LEVEL_AVAILABLE.slice(levelIndex, LOG_LEVEL_AVAILABLE.length);
  } else {
    const levelIndex = LOG_LEVEL_AVAILABLE.indexOf(LOG_LEVEL_DEFAULT);
    return LOG_LEVEL_AVAILABLE.slice(levelIndex, LOG_LEVEL_AVAILABLE.length);
  }
}

async function bootstrap() {
  const logLevels = generateNestJsLogLevels();
  Logger.log(`Showing ${logLevels.join(", ")} messages`);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const config = app.get<ConfigService>(ConfigService);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const chunkSize = config.get("share.chunkSize");
    bodyParser.raw({
      type: "application/octet-stream",
      limit: `${chunkSize * 2}B`,
    })(req, res, next);
  });

  app.use(cookieParser());
  app.set("trust proxy", true);

  await fs.promises.mkdir(`${DATA_DIRECTORY}/uploads/_temp`, {
    recursive: true,
  });

  app.setGlobalPrefix("api");

  // Setup Swagger in development mode
  if (process.env.NODE_ENV == "development") {
    const config = new DocumentBuilder()
      .setTitle("Ustrohosting Share API")
      .setVersion("1.0")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/swagger", app, document);
  }

  await app.listen(
    parseInt(process.env.BACKEND_PORT || process.env.PORT || "8080"),
  );

  const logger = new Logger("UnhandledAsyncError");
  process.on("unhandledRejection", (e) => logger.error(e));
}
bootstrap();
