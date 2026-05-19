import Config, { AdminConfig, UpdateConfig } from "../types/config.type";
import api from "./api.service";
import { stringToTimespan } from "../utils/date.util";

const list = async (): Promise<Config[]> => {
  return (await api.get("/configs")).data;
};

const getByCategory = async (category: string): Promise<AdminConfig[]> => {
  return (await api.get(`/configs/admin/${category}`)).data;
};

const updateMany = async (data: UpdateConfig[]): Promise<AdminConfig[]> => {
  return (await api.patch("/configs/admin", data)).data;
};

const get = (key: string, configVariables: Config[]): any => {
  if (!configVariables) return null;

  const configVariable = configVariables.filter(
    (variable) => variable.key == key,
  )[0];

  if (!configVariable) throw new Error(`Config variable ${key} not found`);

  const value = configVariable.value ?? configVariable.defaultValue;

  if (configVariable.type == "number" || configVariable.type == "filesize")
    return parseInt(value);
  if (configVariable.type == "boolean") return value == "true";
  if (configVariable.type == "string" || configVariable.type == "text")
    return value;
  if (configVariable.type == "timespan") return stringToTimespan(value);
};

const finishSetup = async (): Promise<AdminConfig[]> => {
  return (await api.post("/configs/admin/finishSetup")).data;
};

const sendTestEmail = async (email: string) => {
  await api.post("/configs/admin/testEmail", { email });
};

const isNewReleaseAvailable = async () => {
  // Temporarily disabled update checks
  return false;
};

const changeLogo = async (file: File) => {
  const form = new FormData();
  form.append("file", file);

  await api.post("/configs/admin/logo", form);
};

const getAdminStats = async (): Promise<{
  totalShares: number;
  activeShares: number;
  expiredShares: number;
  sharesCreatedToday: number;
  totalUsers: number;
  totalFiles: number;
  totalSize: number;
  averageShareSize: number;
  passwordProtectedShares: number;
  totalDownloads: number;
  downloadsToday: number;
  diskTotal: number;
  diskFree: number;
  diskUsed: number;
}> => {
  return (await api.get("/admin/stats")).data;
};

export default {
  list,
  getByCategory,
  updateMany,
  get,
  finishSetup,
  sendTestEmail,
  isNewReleaseAvailable,
  changeLogo,
  getAdminStats,
};
