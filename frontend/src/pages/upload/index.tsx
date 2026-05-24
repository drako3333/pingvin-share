import {
  Button,
  Card,
  Group,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { cleanNotifications } from "@mantine/notifications";
import axios, { AxiosError } from "axios";
import pLimit from "p-limit";
import { useEffect, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import Dropzone from "../../components/upload/Dropzone";
import FileList from "../../components/upload/FileList";
import showCompletedUploadModal from "../../components/upload/modals/showCompletedUploadModal";
import showCreateUploadModal from "../../components/upload/modals/showCreateUploadModal";
import useConfig from "../../hooks/config.hook";
import useConfirmLeave from "../../hooks/confirm-leave.hook";
import { TbBan } from "react-icons/tb";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import shareService from "../../services/share.service";
import { FileUpload } from "../../types/File.type";
import { CreateShare, Share } from "../../types/share.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import { useRouter } from "next/router";

const promiseLimit = pLimit(3);

const Upload = ({
  maxShareSize,
  isReverseShare = false,
  simplified,
}: {
  maxShareSize?: number;
  isReverseShare: boolean;
  simplified: boolean;
}) => {
  const modals = useModals();
  const router = useRouter();
  const t = useTranslate();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const { user } = useUser();
  const config = useConfig();
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isUploading, setisUploading] = useState(false);

  // Speed and sparkline tracking states
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const bytesUploadedRef = useRef<Record<number, number>>({});
  const lastBytesRef = useRef(0);
  const errorToastShownRef = useRef(false);
  const createdShareRef = useRef<Share | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useConfirmLeave({
    message: t("upload.notify.confirm-leave"),
    enabled: isUploading,
  });

  const chunkSize = useRef(parseInt(config.get("share.chunkSize")));

  maxShareSize ??= parseInt(config.get("share.maxSize"));
  const autoOpenCreateUploadModal = config.get("share.autoOpenShareModal");

  // Track upload speed in real time (every 1 second)
  useEffect(() => {
    if (!isUploading) {
      setCurrentSpeed(0);
      setSpeedHistory([]);
      lastBytesRef.current = 0;
      return;
    }

    const interval = setInterval(() => {
      const totalBytesUploaded = Object.values(bytesUploadedRef.current).reduce(
        (a, b) => a + b,
        0,
      );
      const deltaBytes = Math.max(0, totalBytesUploaded - lastBytesRef.current);
      lastBytesRef.current = totalBytesUploaded;

      setCurrentSpeed(deltaBytes);
      setSpeedHistory((prev) => {
        const next = [...prev, deltaBytes];
        if (next.length > 20) next.shift(); // Keep last 20 records
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isUploading]);

  // Prompt to resume pending upload on file selection if matching
  useEffect(() => {
    if (files.length > 0 && !isUploading) {
      const pendingShareStr = localStorage.getItem("pingvin_pending_share");
      if (pendingShareStr) {
        const pendingShare = JSON.parse(pendingShareStr);
        const filesMatch =
          files.length === pendingShare.files.length &&
          files.every(
            (f, idx) =>
              f.name === pendingShare.files[idx].name &&
              f.size === pendingShare.files[idx].size,
          );

        if (filesMatch) {
          // Verify if the share still exists on the server
          shareService
            .isShareIdAvailable(pendingShare.id)
            .then((isAvailable) => {
              if (isAvailable) {
                // The share ID is available, meaning the share DOES NOT exist on the server (expired/deleted).
                // Clean up localStorage immediately.
                localStorage.removeItem("pingvin_pending_share");
                files.forEach((_, idx) => {
                  localStorage.removeItem(
                    `pingvin_pending_share_progress_${pendingShare.id}_${idx}`,
                  );
                });
              } else {
                modals.openConfirmModal({
                  title: t("analytics.resume.title"),
                  children: t("analytics.resume.description"),
                  labels: {
                    confirm: t("analytics.resume.confirm"),
                    cancel: t("analytics.resume.cancel"),
                  },
                  onConfirm: () => {
                    const restoredFiles = files.map((f, idx) => {
                      const savedProgress = localStorage.getItem(
                        `pingvin_pending_share_progress_${pendingShare.id}_${idx}`,
                      );
                      f.uploadingProgress = savedProgress
                        ? parseFloat(savedProgress)
                        : 0;
                      return f;
                    });
                    setFiles(restoredFiles);
                    uploadFiles({} as any, restoredFiles, pendingShare.id);
                  },
                  onCancel: () => {
                    localStorage.removeItem("pingvin_pending_share");
                    files.forEach((_, idx) => {
                      localStorage.removeItem(
                        `pingvin_pending_share_progress_${pendingShare.id}_${idx}`,
                      );
                    });
                  },
                });
              }
            })
            .catch(() => {
              // Offline/error fallback: show resume prompt
              modals.openConfirmModal({
                title: t("analytics.resume.title"),
                children: t("analytics.resume.description"),
                labels: {
                  confirm: t("analytics.resume.confirm"),
                  cancel: t("analytics.resume.cancel"),
                },
                onConfirm: () => {
                  const restoredFiles = files.map((f, idx) => {
                    const savedProgress = localStorage.getItem(
                      `pingvin_pending_share_progress_${pendingShare.id}_${idx}`,
                    );
                    f.uploadingProgress = savedProgress
                      ? parseFloat(savedProgress)
                      : 0;
                    return f;
                  });
                  setFiles(restoredFiles);
                  uploadFiles({} as any, restoredFiles, pendingShare.id);
                },
                onCancel: () => {
                  localStorage.removeItem("pingvin_pending_share");
                  files.forEach((_, idx) => {
                    localStorage.removeItem(
                      `pingvin_pending_share_progress_${pendingShare.id}_${idx}`,
                    );
                  });
                },
              });
            });
        }
      }
    }
  }, [files]);

  const uploadFiles = async (
    share: CreateShare,
    files: FileUpload[],
    existingShareId?: string,
  ) => {
    setisUploading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Initialize all files to progress = 0 so they show as "Queued" instead of having undefined progress
    setFiles((oldFiles) =>
      oldFiles.map((f) => {
        f.uploadingProgress = 0;
        return f;
      })
    );

    try {
      const isReverseShare = router.pathname != "/upload";
      if (existingShareId) {
        createdShareRef.current = { id: existingShareId } as any;
      } else {
        createdShareRef.current = await shareService.create(
          share,
          isReverseShare,
        );
      }

      // Save upload states to localStorage
      localStorage.setItem(
        "pingvin_pending_share",
        JSON.stringify({
          id: createdShareRef.current!.id,
          files: files.map((f) => ({ name: f.name, size: f.size })),
        }),
      );
    } catch (e) {
      toast.axiosError(e);
      setisUploading(false);
      return;
    }

    const fileUploadPromises = files.map(async (file, fileIndex) =>
      promiseLimit(async () => {
        let fileId;

        const setFileProgress = (progress: number) => {
          setFiles((files) =>
            files.map((file, callbackIndex) => {
              if (fileIndex == callbackIndex) {
                file.uploadingProgress = progress;
              }
              return file;
            }),
          );
          // Persist progress per file
          localStorage.setItem(
            `pingvin_pending_share_progress_${createdShareRef.current!.id}_${fileIndex}`,
            String(progress),
          );
        };

        const currentSavedProgress = parseFloat(
          localStorage.getItem(
            `pingvin_pending_share_progress_${createdShareRef.current!.id}_${fileIndex}`,
          ) || "0",
        );

        // Check if we should use S3/B2 multipart direct upload
        let s3UploadInfo = null;
        const savedS3Str = localStorage.getItem(`pingvin_pending_s3_${createdShareRef.current!.id}_${fileIndex}`);
        if (savedS3Str) {
          s3UploadInfo = JSON.parse(savedS3Str);
        } else {
          try {
            const initiateRes = await shareService.initiateMultipart(
              createdShareRef.current!.id,
              file.name,
              file.size
            );
            if (initiateRes && initiateRes.storageProvider === "S3") {
              s3UploadInfo = initiateRes;
              localStorage.setItem(
                `pingvin_pending_s3_${createdShareRef.current!.id}_${fileIndex}`,
                JSON.stringify(s3UploadInfo)
              );
            }
          } catch (initErr) {
            console.error("Failed to initiate S3 multipart upload, falling back to LOCAL:", initErr);
          }
        }

        if (s3UploadInfo && s3UploadInfo.storageProvider === "S3") {
          const { fileId: s3FileId, uploads } = s3UploadInfo;

          // 1. Calculate / read file hash
          setFileProgress(Math.max(1, currentSavedProgress));
          let fileHash = "";
          try {
            const arrayBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
          } catch (e) {
            fileHash = Math.random().toString(36).substring(2) + Date.now().toString(36);
          }

          // 2. Override chunk size (S3 requires minimum 5MB per chunk)
          const s3ChunkSize = Math.max(5 * 1024 * 1024, chunkSize.current);
          let chunks = Math.ceil(file.size / s3ChunkSize);
          if (chunks === 0) chunks++;

          let startChunkIndex = 0;
          if (currentSavedProgress > 0 && currentSavedProgress < 100) {
            startChunkIndex = Math.floor((currentSavedProgress / 100) * chunks);
          }

          // 3. Setup or resume bucket parts ETags
          let bucketParts: Record<string, Array<{ ETag: string; PartNumber: number }>> = {};
          const savedPartsStr = localStorage.getItem(`pingvin_pending_s3_parts_${createdShareRef.current!.id}_${fileIndex}`);
          if (savedPartsStr) {
            bucketParts = JSON.parse(savedPartsStr);
          } else {
            uploads.forEach((u: any) => {
              bucketParts[u.bucketId] = [];
            });
          }

          // 4. Upload loop
          for (let chunkIndex = startChunkIndex; chunkIndex < chunks; chunkIndex++) {
            const from = chunkIndex * s3ChunkSize;
            const to = Math.min(from + s3ChunkSize, file.size);
            const blob = file.slice(from, to);

            bytesUploadedRef.current[fileIndex] = from;

            try {
              // Sign this part across all upload destinations
              const signRes = await shareService.signPart(
                createdShareRef.current!.id,
                s3FileId,
                chunkIndex + 1,
                uploads.map((u: any) => ({ bucketId: u.bucketId, uploadId: u.uploadId }))
              );

              // Upload chunk to each presigned S3/B2 URL
              const putPromises = signRes.urls.map(async ({ bucketId, url }: any, idx: number) => {
                const response = await axios.put(url, blob, {
                  headers: { "Content-Type": "application/octet-stream" },
                  signal: abortController.signal,
                  onUploadProgress: idx === 0 ? (progressEvent) => {
                    const chunkUploaded = progressEvent.loaded;
                    const totalUploadedSoFar = from + chunkUploaded;
                    const fileProgress = (totalUploadedSoFar / file.size) * 100;
                    setFileProgress(Math.min(99, fileProgress));
                    bytesUploadedRef.current[fileIndex] = totalUploadedSoFar;
                  } : undefined
                });
                const etag = response.headers["etag"] || response.headers["ETag"];
                if (!etag) {
                  throw new Error("Missing ETag header from S3 upload response");
                }
                
                // Keep only one entry per PartNumber for this bucket
                bucketParts[bucketId] = bucketParts[bucketId].filter(
                  (p: any) => p.PartNumber !== chunkIndex + 1
                );
                bucketParts[bucketId].push({
                  ETag: etag.replace(/"/g, ""), // Remove surrounding quotes
                  PartNumber: chunkIndex + 1,
                });
              });

              await Promise.all(putPromises);

              // Persist ETag states to handle browser crash or network cut resumes
              localStorage.setItem(
                `pingvin_pending_s3_parts_${createdShareRef.current!.id}_${fileIndex}`,
                JSON.stringify(bucketParts)
              );

              bytesUploadedRef.current[fileIndex] = to;
              let nextProgress = 0;
              if (chunkIndex === chunks - 1) {
                nextProgress = 99;
                setFileProgress(99);
              } else {
                nextProgress = Math.min(99, Math.round(((chunkIndex + 1) / chunks) * 100));
                setFileProgress(nextProgress);
              }

              if (chunkIndex === 0 || chunkIndex === chunks - 1 || nextProgress % 10 === 0) {
                try {
                  void shareService.reportProgress(
                    createdShareRef.current!.id,
                    s3FileId,
                    file.name,
                    nextProgress,
                    file.size
                  );
                } catch (e) {
                  console.debug("Silent S3 progress report fail:", e);
                }
              }
            } catch (err) {
              if (axios.isCancel(err)) {
                break;
              }
              setFileProgress(-1);
              // Wait 5 seconds and retry the SAME chunk
              await new Promise((resolve) => setTimeout(resolve, 5000));
              chunkIndex--;
              continue;
            }
          }

          // 5. Finalize the multipart upload in the backend
          const completeUploads = uploads.map((u: any) => ({
            bucketId: u.bucketId,
            uploadId: u.uploadId,
            parts: bucketParts[u.bucketId],
          }));

          await shareService.completeMultipart(
            createdShareRef.current!.id,
            s3FileId,
            file.name,
            file.size,
            fileHash,
            completeUploads
          );

          // Clear S3 temporary keys
          localStorage.removeItem(`pingvin_pending_s3_${createdShareRef.current!.id}_${fileIndex}`);
          localStorage.removeItem(`pingvin_pending_s3_parts_${createdShareRef.current!.id}_${fileIndex}`);
          setFileProgress(100);
          return;
        }

        let chunks = Math.ceil(file.size / chunkSize.current);
        if (chunks == 0) chunks++;

        let startChunkIndex = 0;
        if (currentSavedProgress > 0 && currentSavedProgress < 100) {
          startChunkIndex = Math.floor((currentSavedProgress / 100) * chunks);
        }

        setFileProgress(Math.max(1, currentSavedProgress));

        for (
          let chunkIndex = startChunkIndex;
          chunkIndex < chunks;
          chunkIndex++
        ) {
          const from = chunkIndex * chunkSize.current;
          const to = from + chunkSize.current;
          const blob = file.slice(from, to);

          // Update speed counter bytes
          bytesUploadedRef.current[fileIndex] = from;

          try {
            await shareService
              .uploadFile(
                createdShareRef.current!.id,
                blob,
                {
                  id: fileId,
                  name: file.name,
                  size: file.size,
                },
                chunkIndex,
                chunks,
                (progressEvent) => {
                  const chunkUploaded = progressEvent.loaded;
                  const totalUploadedSoFar = from + chunkUploaded;
                  const fileProgress = (totalUploadedSoFar / file.size) * 100;
                  setFileProgress(Math.min(99, fileProgress));
                  bytesUploadedRef.current[fileIndex] = totalUploadedSoFar;
                },
                abortController.signal
              )
              .then((response) => {
                fileId = response.id;
              });

            bytesUploadedRef.current[fileIndex] = to;
            setFileProgress(((chunkIndex + 1) / chunks) * 100);
          } catch (e) {
            if (axios.isCancel(e)) {
              break;
            }
            if (
              e instanceof AxiosError &&
              e.response?.data.error == "unexpected_chunk_index"
            ) {
              chunkIndex = e.response!.data!.expectedChunkIndex - 1;
              continue;
            } else {
              setFileProgress(-1);
              // Wait 5 seconds and retry the SAME chunk instead of restarting from index 0!
              await new Promise((resolve) => setTimeout(resolve, 5000));
              chunkIndex--; // Decr to counter loop increment
              continue;
            }
          }
        }
      }),
    );

    await Promise.all(fileUploadPromises);
  };

  const cancelUpload = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const shareId = createdShareRef.current?.id;

    setisUploading(false);
    setFiles([]);
    setCurrentSpeed(0);
    setSpeedHistory([]);
    bytesUploadedRef.current = {};
    lastBytesRef.current = 0;

    if (shareId) {
      localStorage.removeItem("pingvin_pending_share");
      files.forEach((_, idx) => {
        localStorage.removeItem(`pingvin_pending_share_progress_${shareId}_${idx}`);
        localStorage.removeItem(`pingvin_pending_s3_${shareId}_${idx}`);
        localStorage.removeItem(`pingvin_pending_s3_parts_${shareId}_${idx}`);
      });

      try {
        await shareService.remove(shareId);
      } catch (err) {
        console.error("Failed to delete cancelled share on backend:", err);
      }
    }

    createdShareRef.current = null;
    toast.success(t("upload.notify.cancelled"));
  };

  const showCreateUploadModalCallback = (files: FileUpload[]) => {
    showCreateUploadModal(
      modals,
      {
        isUserSignedIn: user ? true : false,
        isReverseShare,
        allowUnauthenticatedShares: config.get(
          "share.allowUnauthenticatedShares",
        ),
        enableEmailRecepients: config.get("notifications.enableShareEmailRecipients"),
        maxExpiration: config.get("share.maxExpiration"),
        shareIdLength: config.get("share.shareIdLength"),
        simplified,
      },
      files,
      uploadFiles,
    );
  };

  const handleDropzoneFilesChanged = (files: FileUpload[]) => {
    if (autoOpenCreateUploadModal) {
      setFiles(files);
      showCreateUploadModalCallback(files);
    } else {
      setFiles((oldArr) => [...oldArr, ...files]);
    }
  };

  useEffect(() => {
    const fileErrorCount = files.filter(
      (file) => file.uploadingProgress == -1,
    ).length;

    if (fileErrorCount > 0) {
      if (!errorToastShownRef.current) {
        toast.error(
          t("upload.notify.count-failed", { count: fileErrorCount }),
          {
            withCloseButton: false,
            autoClose: false,
          },
        );
      }
      errorToastShownRef.current = true;
    } else {
      cleanNotifications();
      errorToastShownRef.current = false;
    }

    if (
      files.length > 0 &&
      files.every((file) => file.uploadingProgress >= 100) &&
      fileErrorCount == 0 &&
      createdShareRef.current
    ) {
      shareService
        .completeShare(createdShareRef.current.id)
        .then((share) => {
          setisUploading(false);
          showCompletedUploadModal(modals, share);
          setFiles([]);
          // Clean localStorage keys
          localStorage.removeItem("pingvin_pending_share");
          files.forEach((_, idx) => {
            localStorage.removeItem(
              `pingvin_pending_share_progress_${createdShareRef.current!.id}_${idx}`,
            );
          });
        })
        .catch(() => toast.error(t("upload.notify.generic-error")));
    }
  }, [files]);

  const renderSparkline = () => {
    if (speedHistory.length < 2) return null;
    const width = 350;
    const height = 45;
    const maxVal = Math.max(...speedHistory, 1000);
    const points = speedHistory
      .map((val, idx) => {
        const x = (idx / (speedHistory.length - 1)) * width;
        const y = height - (val / maxVal) * height + 2;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg width="100%" height={height} style={{ overflow: "visible" }}>
        <polyline
          fill="none"
          stroke="#228be6"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  const formatSeconds = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return "--";
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const totalFilesSize = files.reduce((n, { size }) => n + size, 0);
  const totalUploaded = Object.values(bytesUploadedRef.current).reduce(
    (a, b) => a + b,
    0,
  );
  const remainingBytes = Math.max(0, totalFilesSize - totalUploaded);
  const etaSeconds = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;

  return (
    <>
      <Meta title={t("upload.title")} />
      <Group justify="flex-end" mb={20}>
        <Button
          loading={isUploading}
          disabled={files.length <= 0}
          onClick={() => showCreateUploadModalCallback(files)}
        >
          <FormattedMessage id="common.button.share" />
        </Button>
      </Group>

      {isUploading && (
        <Card
          shadow="sm"
          p="md"
          radius="md"
          mb={20}
          withBorder
          style={{
            backdropFilter: "blur(8px)",
            background: isDark
              ? "rgba(26, 27, 30, 0.75)"
              : "rgba(255, 255, 255, 0.75)",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.06)",
          }}
        >
          <Group justify="space-between" align="center">
            <div>
              <Text
                size="xs"
                c="dimmed"
                fw={600}
                tt="uppercase"
                style={{ letterSpacing: "0.05em" }}
              >
                {t("analytics.upload-speed")}
              </Text>
              <Text size="xl" fw={800} color="blue">
                {byteToHumanSizeString(currentSpeed)}/s
              </Text>
            </div>
            <Group gap="xl" align="center">
              <div style={{ textAlign: "right" }}>
                <Text
                  size="xs"
                  c="dimmed"
                  fw={600}
                  tt="uppercase"
                  style={{ letterSpacing: "0.05em" }}
                >
                  {t("analytics.time-remaining")}
                </Text>
                <Text size="xl" fw={800}>
                  {formatSeconds(etaSeconds)}
                </Text>
                <Text size="xs" c="dimmed" fw={600} style={{ marginTop: 2 }}>
                  {byteToHumanSizeString(totalUploaded)} / {byteToHumanSizeString(totalFilesSize)}
                </Text>
              </div>
              <Button
                variant="light"
                color="red"
                size="xs"
                radius="xl"
                leftSection={<TbBan size={14} />}
                onClick={cancelUpload}
              >
                {t("upload.cancel-button")}
              </Button>
            </Group>
          </Group>
          <div style={{ marginTop: 15, opacity: 0.85 }}>
            {renderSparkline()}
          </div>
        </Card>
      )}

      <Dropzone
        title={
          !autoOpenCreateUploadModal && files.length > 0
            ? t("share.edit.append-upload")
            : undefined
        }
        maxShareSize={maxShareSize}
        onFilesChanged={handleDropzoneFilesChanged}
        isUploading={isUploading}
      />
      {files.length > 0 && (
        <FileList<FileUpload> files={files} setFiles={setFiles} isUploading={isUploading} />
      )}
    </>
  );
};
export default Upload;
