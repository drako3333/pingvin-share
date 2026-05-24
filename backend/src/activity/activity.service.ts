import { Injectable, Logger } from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import { map } from "rxjs/operators";
import { randomUUID } from "crypto";
import Redis from "ioredis";

export interface ActivityEvent {
  id: string;
  timestamp: Date;
  type: "upload-progress" | "download" | "auth" | "security-alert";
  data: any;
}

export interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  private readonly eventSubject = new Subject<ActivityEvent>();
  
  // Buffer of the last 50 events in-memory (fallback)
  private readonly eventBuffer: ActivityEvent[] = [];
  private readonly maxBufferSize = 50;

  private redisClient: Redis | null = null;
  private redisSubClient: Redis | null = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl);
        this.redisSubClient = new Redis(redisUrl);

        this.redisSubClient.subscribe("activity:channel", (err) => {
          if (err) {
            this.logger.error("Failed to subscribe to Redis channel", err);
          } else {
            this.logger.log("Successfully subscribed to Redis activity channel");
          }
        });

        this.redisSubClient.on("message", (channel, message) => {
          if (channel === "activity:channel") {
            try {
              const event = JSON.parse(message);
              this.eventSubject.next(event);
            } catch (parseErr) {
              this.logger.error("Failed to parse Redis activity message", parseErr);
            }
          }
        });
      } catch (initErr) {
        this.logger.error("Failed to initialize Redis clients in ActivityService", initErr);
      }
    } else {
      this.logger.log("Redis not enabled. ActivityService will run in-memory.");
    }
  }

  async publish(event: Omit<ActivityEvent, "id" | "timestamp">) {
    const fullEvent: ActivityEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    if (this.redisClient) {
      try {
        const payload = JSON.stringify(fullEvent);
        // Push to list and trim to last 50
        await this.redisClient.lpush("activity:buffer", payload);
        await this.redisClient.ltrim("activity:buffer", 0, this.maxBufferSize - 1);
        // Broadcast to all backend instances
        await this.redisClient.publish("activity:channel", payload);
      } catch (redisErr) {
        this.logger.error("Failed to publish event to Redis", redisErr);
      }
    } else {
      // Store in historical buffer in-memory
      this.eventBuffer.push(fullEvent);
      if (this.eventBuffer.length > this.maxBufferSize) {
        this.eventBuffer.shift();
      }
      // Broadcast to active live listeners on this instance
      this.eventSubject.next(fullEvent);
    }
  }

  async getRecentEvents(): Promise<ActivityEvent[]> {
    if (this.redisClient) {
      try {
        const elements = await this.redisClient.lrange("activity:buffer", 0, this.maxBufferSize - 1);
        return elements.map((el) => {
          const parsed = JSON.parse(el);
          parsed.timestamp = new Date(parsed.timestamp);
          return parsed;
        });
      } catch (redisErr) {
        this.logger.error("Failed to get recent events from Redis", redisErr);
        return [];
      }
    }
    return [...this.eventBuffer];
  }

  getStream(): Observable<MessageEvent> {
    return this.eventSubject.asObservable().pipe(
      map((event) => ({
        data: JSON.stringify(event),
      })),
    );
  }
}
