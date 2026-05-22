export type FileUpload = File & { uploadingProgress: number };

export type FileUploadResponse = { id: string; name: string };

export type FileMetaData = {
  id: string;
  name: string;
  size: string;
  isSuspect?: boolean;
  virusName?: string;
  isApproved?: boolean;
};

export type FileListItem = FileUpload | (FileMetaData & { deleted?: boolean });
