import { deleteCookie, setCookie } from "cookies-next";
import mime from "mime-types";
import { FileUploadResponse } from "../types/File.type";

import {
  CreateShare,
  MyReverseShare,
  MyShare,
  Share,
  ShareMetaData,
} from "../types/share.type";
import api from "./api.service";

const list = async (): Promise<MyShare[]> => {
  return (await api.get(`shares/all`)).data;
};

const create = async (share: CreateShare, isReverseShare = false) => {
  if (!isReverseShare) {
    deleteCookie("reverse_share_token");
  }
  return (await api.post("shares", share)).data;
};

const completeShare = async (id: string) => {
  const response = (await api.post(`shares/${id}/complete`)).data;
  deleteCookie("reverse_share_token");
  return response;
};

const revertComplete = async (id: string) => {
  return (await api.delete(`shares/${id}/complete`)).data;
};

const get = async (id: string): Promise<Share> => {
  return (await api.get(`shares/${id}`)).data;
};

const getFromOwner = async (id: string): Promise<Share> => {
  return (await api.get(`shares/${id}/from-owner`)).data;
};

const getMetaData = async (id: string): Promise<ShareMetaData> => {
  return (await api.get(`shares/${id}/metaData`)).data;
};

const remove = async (id: string) => {
  await api.delete(`shares/${id}`);
};

const getMyShares = async (): Promise<MyShare[]> => {
  return (await api.get("shares")).data;
};

const getShareToken = async (id: string, password?: string) => {
  await api.post(`/shares/${id}/token`, { password });
};

const isShareIdAvailable = async (id: string): Promise<boolean> => {
  return (await api.get(`/shares/isShareIdAvailable/${id}`)).data.isAvailable;
};

const doesFileSupportPreview = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext) {
    const codeExts = [
      "ts",
      "tsx",
      "js",
      "jsx",
      "json",
      "py",
      "rs",
      "go",
      "cpp",
      "c",
      "h",
      "cs",
      "html",
      "css",
      "scss",
      "sh",
      "yml",
      "yaml",
      "xml",
      "sql",
      "md",
      "txt",
      "ini",
      "conf",
      "env",
    ];
    if (codeExts.includes(ext)) return true;
  }

  const mimeType = (mime.contentType(fileName) || "").split(";")[0];

  if (!mimeType) return false;

  const supportedMimeTypes = [
    mimeType.startsWith("video/"),
    mimeType.startsWith("image/"),
    mimeType.startsWith("audio/"),
    mimeType.startsWith("text/"),
    mimeType == "application/pdf",
    mimeType == "application/json",
    mimeType == "application/javascript",
  ];

  return supportedMimeTypes.some((isSupported) => isSupported);
};

const downloadFile = async (shareId: string, fileId: string) => {
  window.location.href = `${window.location.origin}/api/shares/${shareId}/files/${fileId}`;
};

const removeFile = async (shareId: string, fileId: string) => {
  await api.delete(`shares/${shareId}/files/${fileId}`);
};

const uploadFile = async (
  shareId: string,
  chunk: Blob,
  file: {
    id?: string;
    name: string;
    size?: number;
  },
  chunkIndex: number,
  totalChunks: number,
  onUploadProgress?: (progressEvent: any) => void,
  signal?: AbortSignal,
): Promise<FileUploadResponse> => {
  return (
    await api.post(`shares/${shareId}/files`, chunk, {
      headers: { "Content-Type": "application/octet-stream" },
      params: {
        id: file.id,
        name: file.name,
        chunkIndex,
        totalChunks,
        size: file.size,
      },
      onUploadProgress,
      signal,
    })
  ).data;
};

const createReverseShare = async (
  shareExpiration: string,
  maxShareSize: number,
  maxUseCount: number,
  sendEmailNotification: boolean,
  simplified: boolean,
  publicAccess: boolean,
) => {
  return (
    await api.post("reverseShares", {
      shareExpiration,
      maxShareSize: maxShareSize.toString(),
      maxUseCount,
      sendEmailNotification,
      simplified,
      publicAccess,
    })
  ).data;
};

const getMyReverseShares = async (): Promise<MyReverseShare[]> => {
  return (await api.get("reverseShares")).data;
};

const setReverseShare = async (reverseShareToken: string) => {
  const { data } = await api.get(`/reverseShares/${reverseShareToken}`);
  setCookie("reverse_share_token", reverseShareToken);
  return data;
};

const removeReverseShare = async (id: string) => {
  await api.delete(`/reverseShares/${id}`);
};

const getAnalytics = async (shareId: string): Promise<any[]> => {
  return (await api.get(`/shares/${shareId}/analytics`)).data;
};

const initiateMultipart = async (shareId: string, name: string, size: number) => {
  return (await api.post(`shares/${shareId}/files/multipart/initiate`, { name, size })).data;
};

const signPart = async (
  shareId: string,
  fileId: string,
  partNumber: number,
  uploads: Array<{ bucketId: string; uploadId: string }>,
) => {
  return (await api.post(`shares/${shareId}/files/multipart/sign-part`, { fileId, partNumber, uploads })).data;
};

const completeMultipart = async (
  shareId: string,
  fileId: string,
  fileName: string,
  fileSize: number,
  hash: string,
  uploads: Array<{
    bucketId: string;
    uploadId: string;
    parts: Array<{ ETag: string; PartNumber: number }>;
  }>,
) => {
  return (
    await api.post(`shares/${shareId}/files/multipart/complete`, {
      fileId,
      fileName,
      fileSize,
      hash,
      uploads,
    })
  ).data;
};

const approveFile = async (shareId: string, fileId: string) => {
  return (await api.post(`shares/${shareId}/files/${fileId}/approve`)).data;
};

const reportProgress = async (
  shareId: string,
  fileId: string,
  fileName: string,
  progress: number,
  size: number,
) => {
  await api.post(`activity/${shareId}/upload-progress`, {
    fileId,
    fileName,
    progress,
    size,
  });
};

export default {
  list,
  create,
  completeShare,
  revertComplete,
  getShareToken,
  get,
  getFromOwner,
  remove,
  getMetaData,
  doesFileSupportPreview,
  getMyShares,
  isShareIdAvailable,
  downloadFile,
  removeFile,
  uploadFile,
  setReverseShare,
  createReverseShare,
  getMyReverseShares,
  removeReverseShare,
  getAnalytics,
  initiateMultipart,
  signPart,
  completeMultipart,
  approveFile,
  reportProgress,
};

