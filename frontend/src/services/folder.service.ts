import { Folder } from "../types/folder.type";
import api from "./api.service";

const list = async (): Promise<Folder[]> => {
  return (await api.get("folders")).data;
};

const create = async (name: string, color?: string, icon?: string): Promise<Folder> => {
  return (await api.post("folders", { name, color, icon })).data;
};

const update = async (
  id: string,
  name?: string,
  color?: string,
  icon?: string,
): Promise<Folder> => {
  return (await api.patch(`folders/${id}`, { name, color, icon })).data;
};

const remove = async (id: string): Promise<void> => {
  await api.delete(`folders/${id}`);
};

const share = async (id: string, usernameOrEmail: string): Promise<Folder> => {
  return (await api.post(`folders/${id}/share`, { usernameOrEmail })).data;
};

const unshare = async (id: string, userId: string): Promise<Folder> => {
  return (await api.delete(`folders/${id}/share/${userId}`)).data;
};

const moveShare = async (shareId: string, folderId: string | null): Promise<void> => {
  await api.post("folders/move", { shareId, folderId });
};

export default {
  list,
  create,
  update,
  remove,
  share,
  unshare,
  moveShare,
};
