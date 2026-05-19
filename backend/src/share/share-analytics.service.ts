import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ShareAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async record(shareId: string, ip: string, userAgent: string, fileId?: string) {
    // Run geolocation asynchronously in the background to ensure download response speed remains ultra-fast
    let country = "Unknown";
    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(`https://ipapi.co/${ip}/json/`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = (await res.json()) as any;
          country = data.country_name || "Unknown";
        }
      } catch {
        country = "Unknown";
      }
    }

    let device = "Desktop";
    let browser = "Other";

    if (userAgent) {
      const ua = userAgent.toLowerCase();
      if (
        ua.includes("mobi") ||
        ua.includes("android") ||
        ua.includes("iphone") ||
        ua.includes("ipad")
      ) {
        device = ua.includes("ipad") || ua.includes("tablet") ? "Tablet" : "Mobile";
      }

      if (ua.includes("firefox")) {
        browser = "Firefox";
      } else if (ua.includes("chrome") && !ua.includes("edge") && !ua.includes("opr")) {
        browser = "Chrome";
      } else if (ua.includes("safari") && !ua.includes("chrome")) {
        browser = "Safari";
      } else if (ua.includes("edge") || ua.includes("edg/")) {
        browser = "Edge";
      } else if (ua.includes("opr") || ua.includes("opera")) {
        browser = "Opera";
      }
    }

    return this.prisma.shareAnalytics.create({
      data: {
        shareId,
        ip,
        country,
        userAgent: userAgent || "Unknown",
        device,
        browser,
        fileId: fileId || null,
      },
    });
  }

  async getForShare(shareId: string) {
    return this.prisma.shareAnalytics.findMany({
      where: { shareId },
      orderBy: { createdAt: "desc" },
    });
  }
}
