import User from "./user.type";

export interface FolderAccess {
  id: string;
  createdAt: string;
  folderId: string;
  userId: string;
  user: User;
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  creatorId: string;
  creator: User;
  createdAt: string;
  accesses?: FolderAccess[];
}
