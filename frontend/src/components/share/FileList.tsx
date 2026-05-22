import {
  ActionIcon,
  Box,
  Group,
  Skeleton,
  Stack,
  Table,
  TextInput,
  Text,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import {
  TbDownload,
  TbEye,
  TbLink,
  TbFolder,
  TbFolderOpen,
  TbFile,
  TbAlertTriangle,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import { FileMetaData } from "../../types/File.type";
import { Share } from "../../types/share.type";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";
import TableSortIcon, { TableSort } from "../core/SortIcon";
import showFilePreviewModal from "./modals/showFilePreviewModal";

interface TreeFileNode {
  type: "file";
  name: string;
  fullName: string;
  file: FileMetaData;
}

interface TreeFolderNode {
  type: "folder";
  name: string;
  fullName: string;
  children: (TreeFileNode | TreeFolderNode)[];
}

type TreeNode = TreeFileNode | TreeFolderNode;

function buildTree(files: FileMetaData[]): TreeNode[] {
  const root: TreeFolderNode = {
    type: "folder",
    name: "",
    fullName: "",
    children: [],
  };

  for (const file of files) {
    const parts = file.name.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children.push({
          type: "file",
          name: part,
          fullName: file.name,
          file: file,
        });
      } else {
        let folder = current.children.find(
          (child) => child.type === "folder" && child.name === part,
        ) as TreeFolderNode;

        if (!folder) {
          const nestedFullName = current.fullName
            ? `${current.fullName}/${part}`
            : part;
          folder = {
            type: "folder",
            name: part,
            fullName: nestedFullName,
            children: [],
          };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  const sortNode = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    for (const node of nodes) {
      if (node.type === "folder") {
        sortNode(node.children);
      }
    }
  };

  sortNode(root.children);
  return root.children;
}

const FileList = ({
  files,
  setShare,
  share,
  isLoading,
}: {
  files?: FileMetaData[];
  setShare: Dispatch<SetStateAction<Share | undefined>>;
  share: Share;
  isLoading: boolean;
}) => {
  const clipboard = useClipboard();
  const modals = useModals();
  const t = useTranslate();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<TableSort>({
    property: "name",
    direction: "desc",
  });

  const sortFiles = () => {
    if (files && sort.property) {
      const sortedFiles = files.sort((a: any, b: any) => {
        if (sort.direction === "asc") {
          return b[sort.property!].localeCompare(a[sort.property!], undefined, {
            numeric: true,
          });
        } else {
          return a[sort.property!].localeCompare(b[sort.property!], undefined, {
            numeric: true,
          });
        }
      });

      setShare({
        ...share,
        files: sortedFiles,
      });
    }
  };

  const handleDownload = async (file: FileMetaData) => {
    if (file.isSuspect && !file.isApproved) {
      modals.openConfirmModal({
        title: (
          <Group gap="xs">
            <TbAlertTriangle size={22} style={{ color: "var(--mantine-color-red-6)" }} />
            <Text style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--mantine-color-red-6)" }}>
              Avertissement de sécurité
            </Text>
          </Group>
        ),
        children: (
          <Stack gap="xs" p="xs">
            <Text size="sm">
              Ce fichier (<strong>{file.name}</strong>) a été détecté comme suspect par l'analyse antivirus ClamAV.
            </Text>
            {file.virusName && (
              <Box style={{ background: "rgba(224, 49, 49, 0.08)", borderLeft: "4px solid var(--mantine-color-red-6)", padding: "10px", borderRadius: "4px" }}>
                <Text size="xs" style={{ color: "var(--mantine-color-red-6)", fontFamily: "monospace", fontWeight: 700 }}>
                  Menace signalée : {file.virusName}
                </Text>
              </Box>
            )}
            <Text size="xs" color="dimmed" mt="sm">
              Certains outils tiers (cracks, patches, fichiers de configuration de dev) sont parfois considérés faussement comme suspects. Si vous connaissez l'auteur et faites pleinement confiance à ce fichier, vous pouvez ignorer cette alerte. Sinon, annulez immédiatement.
            </Text>
          </Stack>
        ),
        labels: { confirm: "Ignorer et télécharger", cancel: "Annuler" },
        confirmProps: { color: "red", radius: "md" },
        cancelProps: { variant: "subtle", radius: "md" },
        onConfirm: async () => {
          await shareService.downloadFile(share.id, file.id);
        },
      });
    } else {
      await shareService.downloadFile(share.id, file.id);
    }
  };

  const copyFileLink = (file: FileMetaData) => {
    const link = `${window.location.origin}/api/shares/${
      share.id
    }/files/${file.id}`;

    if (window.isSecureContext) {
      clipboard.copy(link);
      toast.success(t("common.notify.copied-link"));
    } else {
      modals.openModal({
        title: t("share.modal.file-link"),
        children: (
          <Stack align="stretch">
            <TextInput variant="filled" value={link} />
          </Stack>
        ),
      });
    }
  };

  useEffect(sortFiles, [sort]);

  const treeData = files ? buildTree(files) : [];

  const renderRows = (nodes: TreeNode[], depth = 0): React.ReactNode[] => {
    let rows: React.ReactNode[] = [];

    for (const node of nodes) {
      if (node.type === "folder") {
        const isExpanded = expanded[node.fullName] !== false; // Expanded by default
        const toggleExpand = () => {
          setExpanded((prev) => ({ ...prev, [node.fullName]: !isExpanded }));
        };

        const getFolderSize = (n: TreeFolderNode): number => {
          let sum = 0;
          for (const child of n.children) {
            if (child.type === "file") {
              sum += parseInt(child.file.size);
            } else {
              sum += getFolderSize(child);
            }
          }
          return sum;
        };
        const folderSize = getFolderSize(node);

        rows.push(
          <tr
            key={node.fullName}
            onClick={toggleExpand}
            style={{ cursor: "pointer", background: "rgba(0,0,0,0.01)" }}
          >
            <td>
              <Group gap="xs" style={{ paddingLeft: depth * 20 }}>
                {isExpanded ? (
                  <TbFolderOpen size={20} style={{ color: "#228be6" }} />
                ) : (
                  <TbFolder size={20} style={{ color: "#228be6" }} />
                )}
                <span style={{ fontWeight: 600 }}>{node.name}</span>
              </Group>
            </td>
            <td>
              <span style={{ color: "gray", fontSize: "0.85rem" }}>
                {byteToHumanSizeString(folderSize)}
              </span>
            </td>
            <td></td>
          </tr>,
        );

        if (isExpanded) {
          rows = rows.concat(renderRows(node.children, depth + 1));
        }
      } else {
        const file = node.file;
        const isFileSuspect = file.isSuspect && !file.isApproved;
        rows.push(
          <tr key={node.fullName}>
            <td>
              <Group gap="xs" style={{ paddingLeft: depth * 20 }}>
                {isFileSuspect ? (
                  <TbAlertTriangle size={18} style={{ color: "var(--mantine-color-red-6)" }} />
                ) : (
                  <TbFile size={18} style={{ color: "gray" }} />
                )}
                <span style={isFileSuspect ? { color: "var(--mantine-color-red-6)", fontWeight: 600 } : undefined}>
                  {node.name}
                </span>
                {isFileSuspect && (
                  <span style={{ fontSize: "0.75rem", color: "var(--mantine-color-red-6)", fontStyle: "italic" }}>
                    (Suspect: {file.virusName || "Menace"})
                  </span>
                )}
              </Group>
            </td>
            <td>{byteToHumanSizeString(parseInt(file.size))}</td>
            <td>
              <Group justify="flex-end">
                {shareService.doesFileSupportPreview(file.name) && (
                  <ActionIcon
                    onClick={() =>
                      showFilePreviewModal(
                        share.id,
                        files || [],
                        file.id,
                        modals,
                      )
                    }
                    size={25}
                  >
                    <TbEye />
                  </ActionIcon>
                )}
                {!share.hasPassword && (
                  <ActionIcon size={25} onClick={() => copyFileLink(file)}>
                    <TbLink />
                  </ActionIcon>
                )}
                <ActionIcon
                  size={25}
                  onClick={() => handleDownload(file)}
                >
                  <TbDownload />
                </ActionIcon>
              </Group>
            </td>
          </tr>,
        );
      }
    }

    return rows;
  };

  return (
    <Box style={{ display: "block", overflowX: "auto" }}>
      <Table>
        <thead>
          <tr>
            <th>
              <Group gap="xs">
                <FormattedMessage id="share.table.name" />
                <TableSortIcon sort={sort} setSort={setSort} property="name" />
              </Group>
            </th>
            <th>
              <Group gap="xs">
                <FormattedMessage id="share.table.size" />
                <TableSortIcon sort={sort} setSort={setSort} property="size" />
              </Group>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>{isLoading ? skeletonRows : renderRows(treeData)}</tbody>
      </Table>
    </Box>
  );
};

const skeletonRows = [...Array(5)].map((c, i) => (
  <tr key={i}>
    <td>
      <Skeleton height={30} width={30} />
    </td>
    <td>
      <Skeleton height={14} />
    </td>
    <td>
      <Skeleton height={14} />
    </td>
    <td>
      <Skeleton height={25} width={25} />
    </td>
  </tr>
));

export default FileList;
