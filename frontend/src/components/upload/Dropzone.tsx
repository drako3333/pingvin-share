/* eslint-disable no-undef */
import { Button, Center, Group, Text } from "@mantine/core";
import { Dropzone as MantineDropzone } from "@mantine/dropzone";
import { useRef } from "react";
import { TbCloudUpload, TbUpload } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import { FileUpload } from "../../types/File.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import classes from "./Dropzone.module.css";

// Recursively scan a FileSystemEntry (file or directory) and return flat File[]
const scanEntry = async (
  entry: FileSystemEntry,
  path = "",
): Promise<File[]> => {
  if (entry.isFile) {
    return new Promise<File[]>((resolve) => {
      (entry as FileSystemFileEntry).file((file: File) => {
        const relativePath = path ? `${path}/${file.name}` : file.name;
        // Create a copy with the relative path as the name
        const renamedFile = new File([file], relativePath, {
          type: file.type,
          lastModified: file.lastModified,
        });
        resolve([renamedFile]);
      });
    });
  } else if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const readEntries = (): Promise<FileSystemEntry[]> =>
      new Promise((resolve) =>
        dirReader.readEntries((entries) => resolve(entries)),
      );

    let allEntries: FileSystemEntry[] = [];
    let batch = await readEntries();
    while (batch.length > 0) {
      allEntries = allEntries.concat(batch);
      batch = await readEntries();
    }

    const nextPath = path ? `${path}/${entry.name}` : entry.name;
    const nested = await Promise.all(
      allEntries.map((e) => scanEntry(e, nextPath)),
    );
    return nested.flat();
  }
  return [];
};

// Custom file extractor that supports both folder drag-and-drop AND normal file selection
const getFilesFromEvent = async (
  event: any,
): Promise<(File | DataTransferItem)[]> => {
  // --- Case 1: Drag-and-drop event (has dataTransfer) ---
  if (event.dataTransfer) {
    const items: DataTransferItemList | undefined = event.dataTransfer.items;
    if (items) {
      const scanPromises: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const entry =
            typeof item.webkitGetAsEntry === "function"
              ? item.webkitGetAsEntry()
              : null;
          if (entry) {
            scanPromises.push(scanEntry(entry));
          }
        }
      }
      if (scanPromises.length > 0) {
        const results = await Promise.all(scanPromises);
        const files = results.flat();
        if (files.length > 0) return files;
      }
    }

    // Fallback: use dataTransfer.files
    const dtFiles: File[] = [];
    if (event.dataTransfer.files) {
      for (let i = 0; i < event.dataTransfer.files.length; i++) {
        dtFiles.push(event.dataTransfer.files[i]);
      }
    }
    return dtFiles;
  }

  // --- Case 2: File input click event (has target.files) ---
  const files: File[] = [];
  if (event.target?.files) {
    for (let i = 0; i < event.target.files.length; i++) {
      files.push(event.target.files[i]);
    }
  }
  return files;
};

const Dropzone = ({
  title,
  isUploading,
  maxShareSize,
  onFilesChanged,
}: {
  title?: string;
  isUploading: boolean;
  maxShareSize: number;
  // eslint-disable-next-line no-unused-vars
  onFilesChanged: (files: FileUpload[]) => void;
}) => {
  const t = useTranslate();
  const openRef = useRef<() => void>(null);

  return (
    <div className={classes.wrapper}>
      <MantineDropzone
        onReject={(e) => {
          toast.error(e[0].errors[0].message);
        }}
        disabled={isUploading}
        openRef={openRef as any}
        useFsAccessApi={true}
        getFilesFromEvent={getFilesFromEvent as any}
        onDrop={(files) => {
          const fileSizeSum = files.reduce((n, { size }) => n + size, 0);

          if (fileSizeSum > maxShareSize) {
            toast.error(
              t("upload.dropzone.notify.file-too-big", {
                maxSize: byteToHumanSizeString(maxShareSize),
              }),
            );
          } else {
            const mappedFiles = files.map((newFile) => {
              (newFile as any).uploadingProgress = 0;
              return newFile as unknown as FileUpload;
            });
            onFilesChanged(mappedFiles);
          }
        }}
        className={classes.dropzone}
        radius="md"
      >
        <div style={{ pointerEvents: "none" }}>
          <Group justify="center">
            <TbCloudUpload size={50} />
          </Group>
          <Text ta="center" fw={700} size="lg" mt="xl">
            {title || <FormattedMessage id="upload.dropzone.title" />}
          </Text>
          <Text ta="center" size="sm" mt="xs" c="dimmed">
            <FormattedMessage
              id="upload.dropzone.description"
              values={{ maxSize: byteToHumanSizeString(maxShareSize) }}
            />
          </Text>
        </div>
      </MantineDropzone>
      <Center>
        <Button
          className={classes.control}
          variant="light"
          size="sm"
          radius="xl"
          disabled={isUploading}
          onClick={() => openRef.current && openRef.current()}
        >
          {<TbUpload />}
        </Button>
      </Center>
    </div>
  );
};
export default Dropzone;
