import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Config } from "@prisma/client";
import * as argon from "argon2";
import { EventEmitter } from "events";
import * as fs from "fs";
import { PrismaService } from "src/prisma/prisma.service";
import { stringToTimespan } from "src/utils/date.util";
import { parse as yamlParse } from "yaml";
import { YamlConfig } from "../../prisma/seed/config.seed";
import { CONFIG_FILE } from "src/constants";
import Redis from "ioredis";

/**
 * ConfigService extends EventEmitter to allow listening for config updates,
 * now only `update` event will be emitted.
 */
@Injectable()
export class ConfigService extends EventEmitter {
  yamlConfig?: YamlConfig;
  logger = new Logger(ConfigService.name);

  private redisClient: Redis | null = null;
  private redisSubClient: Redis | null = null;

  constructor(
    @Inject("CONFIG_VARIABLES") private configVariables: Config[],
    private prisma: PrismaService,
  ) {
    super();
  }

  // Initialize gets called by the ConfigModule
  async initialize() {
    await this.loadYamlConfig();

    if (this.yamlConfig) {
      await this.migrateInitUser();
    }

    // Initialize Redis configuration synchronization if Redis is enabled
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl);
        this.redisSubClient = new Redis(redisUrl);

        await this.redisSubClient.subscribe("config:channel", (err) => {
          if (err) {
            this.logger.error("Failed to subscribe to Redis config channel", err);
          } else {
            this.logger.log("Successfully subscribed to Redis config channel");
          }
        });

        this.redisSubClient.on("message", async (channel, message) => {
          if (channel === "config:channel") {
            try {
              const data = JSON.parse(message);
              // Avoid loading if this instance triggered it, though reloading is quick and safe
              this.configVariables = await this.prisma.config.findMany();
              this.logger.log(`Config cache synchronized locally after remote update of ${data.key}`);
            } catch (parseErr) {
              this.logger.error("Failed to parse Redis config message", parseErr);
            }
          }
        });
      } catch (redisErr) {
        this.logger.error("Failed to initialize Redis clients in ConfigService", redisErr);
      }
    }
  }

  private async loadYamlConfig() {
    let configFile: string = "";
    try {
      configFile = fs.readFileSync(CONFIG_FILE, "utf8");
    } catch (e) {
      this.logger.log(
        "Config.yaml is not set. Falling back to UI configuration.",
      );
    }
    try {
      this.yamlConfig = yamlParse(configFile);

      if (this.yamlConfig) {
        for (const configVariable of this.configVariables) {
          const category = this.yamlConfig[configVariable.category];
          if (!category) continue;
          configVariable.value = category[configVariable.name];
          this.emit("update", configVariable.name, configVariable.value);
        }
      }
    } catch (e) {
      this.logger.error(
        "Failed to parse config.yaml. Falling back to UI configuration: ",
        e,
      );
    }
  }

  private async migrateInitUser(): Promise<void> {
    if (!this.yamlConfig.initUser.enabled) return;

    const userCount = await this.prisma.user.count({
      where: { isAdmin: true },
    });
    if (userCount === 1) {
      this.logger.log(
        "Skip initial user creation. Admin user is already existent.",
      );
      return;
    }
    await this.prisma.user.create({
      data: {
        email: this.yamlConfig.initUser.email,
        username: this.yamlConfig.initUser.username,
        password: this.yamlConfig.initUser.password
          ? await argon.hash(this.yamlConfig.initUser.password)
          : null,
        isAdmin: this.yamlConfig.initUser.isAdmin,
      },
    });
  }

  private getValue(variable: Config): string {
    const key = `${variable.category}.${variable.name}`;
    if (variable.value === null || variable.value === undefined) {
      if (key === "cache.redis-url" && process.env.REDIS_URL) {
        return process.env.REDIS_URL;
      }
      if (key === "cache.redis-enabled" && process.env.REDIS_URL) {
        return "true";
      }
      return variable.defaultValue;
    }
    return variable.value;
  }

  get(key: `${string}.${string}`): any {
    const configVariable = this.configVariables.filter(
      (variable) => `${variable.category}.${variable.name}` == key,
    )[0];

    if (!configVariable) throw new Error(`Config variable ${key} not found`);

    const value = this.getValue(configVariable);

    if (configVariable.type == "number" || configVariable.type == "filesize")
      return parseInt(value);
    if (configVariable.type == "boolean") return value == "true";
    if (configVariable.type == "string" || configVariable.type == "text")
      return value;
    if (configVariable.type == "timespan") return stringToTimespan(value);
  }

  async getByCategory(category: string) {
    const configVariables = this.configVariables
      .filter((c) => !c.locked && category == c.category)
      .sort((a, b) => a.order - b.order);

    return configVariables.map((variable) => {
      return {
        ...variable,
        key: `${variable.category}.${variable.name}`,
        value: this.getValue(variable),
        allowEdit: this.isEditAllowed(),
      };
    });
  }

  async list() {
    const configVariables = this.configVariables.filter((c) => !c.secret);

    return configVariables.map((variable) => {
      return {
        ...variable,
        key: `${variable.category}.${variable.name}`,
        value: this.getValue(variable),
      };
    });
  }

  async updateMany(data: { key: string; value: string | number | boolean }[]) {
    if (!this.isEditAllowed())
      throw new BadRequestException(
        "You are only allowed to update config variables via the config.yaml file",
      );

    const s3EnabledUpdate = data.find(item => item.key === 's3.enabled');
    const s3DisableLocalStorageUpdate = data.find(item => item.key === 's3.disableLocalStorage');
    const s3MultiBucketsEnabledUpdate = data.find(item => item.key === 's3.multiBucketsEnabled');

    const finalS3Enabled = s3EnabledUpdate 
      ? (s3EnabledUpdate.value === true || s3EnabledUpdate.value === 'true')
      : this.get('s3.enabled');

    const finalS3MultiBucketsEnabled = s3MultiBucketsEnabledUpdate
      ? (s3MultiBucketsEnabledUpdate.value === true || s3MultiBucketsEnabledUpdate.value === 'true')
      : this.get('s3.multiBucketsEnabled');

    const finalS3DisableLocalStorage = s3DisableLocalStorageUpdate
      ? (s3DisableLocalStorageUpdate.value === true || s3DisableLocalStorageUpdate.value === 'true')
      : this.get('s3.disableLocalStorage');

    if (finalS3DisableLocalStorage && !finalS3Enabled && !finalS3MultiBucketsEnabled) {
      throw new BadRequestException("S3 must be enabled to disable local storage.");
    }

    const response: Config[] = [];

    for (const variable of data) {
      response.push(await this.update(variable.key, variable.value));
    }

    return response;
  }

  async update(key: string, value: string | number | boolean) {
    if (!this.isEditAllowed())
      throw new BadRequestException(
        "You are only allowed to update config variables via the config.yaml file",
      );

    const configVariable = await this.prisma.config.findUnique({
      where: {
        name_category: {
          category: key.split(".")[0],
          name: key.split(".")[1],
        },
      },
    });

    if (!configVariable || configVariable.locked)
      throw new NotFoundException("Config variable not found");

    if (value === "") {
      value = null;
    } else if (
      typeof value != configVariable.type &&
      typeof value == "string" &&
      configVariable.type != "text" &&
      configVariable.type != "timespan"
    ) {
      throw new BadRequestException(
        `Config variable must be of type ${configVariable.type}`,
      );
    }

    this.validateConfigVariable(key, value);

    const updatedVariable = await this.prisma.config.update({
      where: {
        name_category: {
          category: key.split(".")[0],
          name: key.split(".")[1],
        },
      },
      data: { value: value === null ? null : value.toString() },
    });

    this.configVariables = await this.prisma.config.findMany();

    // Broadcast config update to other load-balanced instances
    if (this.redisClient) {
      try {
        await this.redisClient.publish("config:channel", JSON.stringify({ key, value }));
      } catch (redisErr) {
        this.logger.error("Failed to publish config update to Redis", redisErr);
      }
    }

    this.emit("update", key, value);

    return updatedVariable;
  }

  validateConfigVariable(key: string, value: string | number | boolean) {
    const validations = [
      {
        key: "share.shareIdLength",
        condition: (value: number) => value >= 2 && value <= 50,
        message: "Share ID length must be between 2 and 50",
      },
      {
        key: "share.zipCompressionLevel",
        condition: (value: number) => value >= 0 && value <= 9,
        message: "Zip compression level must be between 0 and 9",
      },
      // TODO add validation for timespan type
    ];

    const validation = validations.find((validation) => validation.key == key);
    if (validation && !validation.condition(value as any)) {
      throw new BadRequestException(validation.message);
    }
  }

  isEditAllowed(): boolean {
    return this.yamlConfig === undefined || this.yamlConfig === null;
  }
}
