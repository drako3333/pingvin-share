import { ActionIcon, Loader, Table } from "@mantine/core";
import { TbTrash, TbAlertCircle } from "react-icons/tb";
import { GrUndo } from "react-icons/gr";
import { FileListItem } from "../../types/File.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import UploadProgressIndicator from "./UploadProgressIndicator";
import { FormattedMessage } from "react-intl";

const FileListRow = ({
  file,
  onRemove,
  onRestore,
  isUploading = false,
}: {
  file: FileListItem;
  onRemove?: () => void;
  onRestore?: () => void;
  isUploading?: boolean;
}) => {
  const uploadable = "uploadingProgress" in file;
  const progress = uploadable ? file.uploadingProgress : undefined;
  const deleted = !uploadable && !!file.deleted;

  let sizeContent;
  let actionContent;

  if (isUploading && uploadable && (progress === 0 || progress === undefined)) {
    // Queued
    sizeContent = (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 600, color: "gray" }}>
          0%
        </span>
        <span style={{ fontSize: "11px", color: "gray" }}>
          <FormattedMessage id="upload.filelist.queued" defaultMessage="Queued..." />
        </span>
      </div>
    );
    actionContent = <Loader color="blue" size={19} />;
  } else if (uploadable && progress === -1) {
    // Failed
    sizeContent = (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 600, color: "#fa5252" }}>
          <FormattedMessage id="upload.filelist.failed" defaultMessage="Failed" />
        </span>
        <span style={{ fontSize: "11px", color: "gray" }}>
          {byteToHumanSizeString(+file.size)}
        </span>
      </div>
    );
    actionContent = <TbAlertCircle color="#fa5252" size={22} />;
  } else if (uploadable && progress !== undefined && progress > 0 && progress < 100) {
    // Uploading
    sizeContent = (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 600, color: "#228be6" }}>
          {Math.round(progress)}%
        </span>
        <span style={{ fontSize: "11px", color: "gray" }}>
          {byteToHumanSizeString((progress / 100) * +file.size)} / {byteToHumanSizeString(+file.size)}
        </span>
      </div>
    );
    actionContent = <UploadProgressIndicator progress={progress} />;
  } else if (uploadable && progress !== undefined && progress >= 100) {
    // Completed
    sizeContent = byteToHumanSizeString(+file.size);
    actionContent = <UploadProgressIndicator progress={progress} />;
  } else {
    // Standard static state (Before clicking Share, or existing file)
    sizeContent = byteToHumanSizeString(+file.size);

    if (deleted) {
      actionContent = onRestore && (
        <ActionIcon
          color="primary"
          variant="light"
          size={25}
          onClick={onRestore}
        >
          <GrUndo />
        </ActionIcon>
      );
    } else {
      actionContent = !isUploading && onRemove && (
        <ActionIcon
          color="red"
          variant="light"
          size={25}
          onClick={onRemove}
        >
          <TbTrash />
        </ActionIcon>
      );
    }
  }

  return (
    <tr
      style={{
        color: deleted ? "rgba(120, 120, 120, 0.5)" : "inherit",
        textDecoration: deleted ? "line-through" : "none",
      }}
    >
      <td>{file.name}</td>
      <td>{sizeContent}</td>
      <td>{actionContent}</td>
    </tr>
  );
};

const FileList = <T extends FileListItem = FileListItem>({
  files,
  setFiles,
  isUploading = false,
}: {
  files: T[];
  // eslint-disable-next-line no-unused-vars
  setFiles: (files: T[]) => void;
  isUploading?: boolean;
}) => {
  const remove = (index: number) => {
    const file = files[index];

    if ("uploadingProgress" in file) {
      files.splice(index, 1);
    } else {
      files[index] = { ...file, deleted: true };
    }

    setFiles([...files]);
  };

  const restore = (index: number) => {
    const file = files[index];

    if ("uploadingProgress" in file) {
      return;
    } else {
      files[index] = { ...file, deleted: false };
    }

    setFiles([...files]);
  };

  const rows = files.map((file, i) => (
    <FileListRow
      key={i}
      file={file}
      onRemove={() => remove(i)}
      onRestore={() => restore(i)}
      isUploading={isUploading}
    />
  ));

  return (
    <Table>
      <thead>
        <tr>
          <th>
            <FormattedMessage id="upload.filelist.name" />
          </th>
          <th>
            <FormattedMessage id="upload.filelist.size" />
          </th>
          <th></th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </Table>
  );
};

export default FileList;
