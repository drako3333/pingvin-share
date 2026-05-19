import api from "./api.service";

export interface AuditLog {
  id: string;
  createdAt: string;
  action: string;
  ip: string;
  details: string;
  userId: string | null;
  username: string | null;
}

const getAll = async (): Promise<AuditLog[]> => {
  return (await api.get("/admin/audit-logs")).data;
};

const service = {
  getAll,
};

export default service;
