import { ModalsContextProps } from "@mantine/modals/lib/context";
import { FileMetaData } from "../../../types/File.type";
import FilePreview from "../FilePreview";

const showFilePreviewModal = (
  shareId: string,
  files: FileMetaData[],
  initialFileId: string,
  modals: ModalsContextProps,
) => {
  return modals.openModal({
    size: "85vw",
    styles: {
      content: {
        maxWidth: "1200px",
        width: "85vw",
      },
    },
    withCloseButton: true,
    children: (
      <FilePreview
        shareId={shareId}
        files={files}
        initialFileId={initialFileId}
      />
    ),
  });
};

export default showFilePreviewModal;
