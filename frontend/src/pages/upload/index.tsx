import { Button, Card, Group, Text, useMantineTheme } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { cleanNotifications } from "@mantine/notifications";
import { AxiosError } from "axios";
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
  const theme = useMantineTheme();
  const isDark = theme.colorScheme === "dark";

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
      const totalBytesUploaded = Object.values(bytesUploadedRef.current).reduce((a, b) => a + b, 0);
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
          shareService.isShareIdAvailable(pendingShare.id).then((isAvailable) => {
            if (isAvailable) {
              // The share ID is available, meaning the share DOES NOT exist on the server (expired/deleted).
              // Clean up localStorage immediately.
              localStorage.removeItem("pingvin_pending_share");
              files.forEach((_, idx) => {
                localStorage.removeItem(`pingvin_pending_share_progress_${pendingShare.id}_${idx}`);
              });
            } else {
              modals.openConfirmModal({
                title: t("analytics.resume.title"),
                children: t("analytics.resume.description"),
                labels: { confirm: t("analytics.resume.confirm"), cancel: t("analytics.resume.cancel") },
                onConfirm: () => {
                  const restoredFiles = files.map((f, idx) => {
                    const savedProgress = localStorage.getItem(
                      `pingvin_pending_share_progress_${pendingShare.id}_${idx}`,
                    );
                    f.uploadingProgress = savedProgress ? parseFloat(savedProgress) : 0;
                    return f;
                  });
                  setFiles(restoredFiles);
                  uploadFiles({} as any, restoredFiles, pendingShare.id);
                },
                onCancel: () => {
                  localStorage.removeItem("pingvin_pending_share");
                  files.forEach((_, idx) => {
                    localStorage.removeItem(`pingvin_pending_share_progress_${pendingShare.id}_${idx}`);
                  });
                },
              });
            }
          }).catch(() => {
            // Offline/error fallback: show resume prompt
            modals.openConfirmModal({
              title: t("analytics.resume.title"),
              children: t("analytics.resume.description"),
              labels: { confirm: t("analytics.resume.confirm"), cancel: t("analytics.resume.cancel") },
              onConfirm: () => {
                const restoredFiles = files.map((f, idx) => {
                  const savedProgress = localStorage.getItem(
                    `pingvin_pending_share_progress_${pendingShare.id}_${idx}`,
                  );
                  f.uploadingProgress = savedProgress ? parseFloat(savedProgress) : 0;
                  return f;
                });
                setFiles(restoredFiles);
                uploadFiles({} as any, restoredFiles, pendingShare.id);
              },
              onCancel: () => {
                localStorage.removeItem("pingvin_pending_share");
                files.forEach((_, idx) => {
                  localStorage.removeItem(`pingvin_pending_share_progress_${pendingShare.id}_${idx}`);
                });
              },
            });
          });
        }
      }
    }
  }, [files]);

  const uploadFiles = async (share: CreateShare, files: FileUpload[], existingShareId?: string) => {
    setisUploading(true);

    try {
      const isReverseShare = router.pathname != "/upload";
      if (existingShareId) {
        createdShareRef.current = { id: existingShareId } as any;
      } else {
        createdShareRef.current = await shareService.create(share, isReverseShare);
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
          localStorage.getItem(`pingvin_pending_share_progress_${createdShareRef.current!.id}_${fileIndex}`) || "0",
        );

        let chunks = Math.ceil(file.size / chunkSize.current);
        if (chunks == 0) chunks++;

        let startChunkIndex = 0;
        if (currentSavedProgress > 0 && currentSavedProgress < 100) {
          startChunkIndex = Math.floor((currentSavedProgress / 100) * chunks);
        }

        setFileProgress(Math.max(1, currentSavedProgress));

        for (let chunkIndex = startChunkIndex; chunkIndex < chunks; chunkIndex++) {
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
                },
                chunkIndex,
                chunks,
              )
              .then((response) => {
                fileId = response.id;
              });

            bytesUploadedRef.current[fileIndex] = to;
            setFileProgress(((chunkIndex + 1) / chunks) * 100);
          } catch (e) {
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

  const showCreateUploadModalCallback = (files: FileUpload[]) => {
    showCreateUploadModal(
      modals,
      {
        isUserSignedIn: user ? true : false,
        isReverseShare,
        allowUnauthenticatedShares: config.get(
          "share.allowUnauthenticatedShares",
        ),
        enableEmailRecepients: config.get("email.enableShareEmailRecipients"),
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
            localStorage.removeItem(`pingvin_pending_share_progress_${createdShareRef.current!.id}_${idx}`);
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
  const totalUploaded = Object.values(bytesUploadedRef.current).reduce((a, b) => a + b, 0);
  const remainingBytes = Math.max(0, totalFilesSize - totalUploaded);
  const etaSeconds = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;

  return (
    <>
      <Meta title={t("upload.title")} />
      <Group position="right" mb={20}>
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
            background: isDark ? "rgba(26, 27, 30, 0.75)" : "rgba(255, 255, 255, 0.75)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
          }}
        >
          <Group position="apart" align="center">
            <div>
              <Text size="xs" color="dimmed" weight={600} transform="uppercase" style={{ letterSpacing: "0.05em" }}>
                {t("analytics.upload-speed")}
              </Text>
              <Text size="xl" weight={800} color="blue">
                {byteToHumanSizeString(currentSpeed)}/s
              </Text>
            </div>
            <div>
              <Text size="xs" color="dimmed" weight={600} transform="uppercase" style={{ letterSpacing: "0.05em" }}>
                {t("analytics.time-remaining")}
              </Text>
              <Text size="xl" weight={800}>
                {formatSeconds(etaSeconds)}
              </Text>
            </div>
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
        <FileList<FileUpload> files={files} setFiles={setFiles} />
      )}
    </>
  );
};
export default Upload;
