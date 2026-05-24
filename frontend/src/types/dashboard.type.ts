export interface DashboardStats {
  storage: {
    used: number;
    quota: number;
  };
  popularShares: {
    id: string;
    name?: string;
    views: number;
    createdAt: string;
  }[];
  chartData: {
    label: string;
    date: string;
    uploads: number;
    downloads: number;
  }[];
  recentActivity: {
    id: string;
    timestamp: string;
    type: "upload" | "download";
    title: string;
    description: string;
  }[];
}
