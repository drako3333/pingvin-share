import { ActionIcon, Box, Group, Skeleton, Table, Text, Badge, Button, Stack } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import moment from "moment";
import Link from "next/link";
import { TbChartBar, TbLink, TbTrash, TbAlertTriangle } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import useTranslate from "../../../hooks/useTranslate.hook";
import { MyShare } from "../../../types/share.type";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";
import toast from "../../../utils/toast.util";
import showShareLinkModal from "../../account/showShareLinkModal";
import shareService from "../../../services/share.service";

const ManageShareTable = ({
  shares,
  deleteShare,
  isLoading,
  refreshShares,
}: {
  shares: MyShare[];
  // eslint-disable-next-line no-unused-vars
  deleteShare: (share: MyShare) => void;
  isLoading: boolean;
  refreshShares?: () => void;
}) => {
  const modals = useModals();
  const clipboard = useClipboard();
  const t = useTranslate();

  const handleApprove = (shareId: string, fileId: string, fileName: string) => {
    shareService
      .approveFile(shareId, fileId)
      .then(() => {
        toast.success(`Le fichier "${fileName}" a été approuvé avec succès.`);
        if (refreshShares) refreshShares();
      })
      .catch(toast.axiosError);
  };

  return (
    <Box style={{ display: "block", overflowX: "auto" }}>
      <Table verticalSpacing="sm">
        <thead>
          <tr>
            <th>
              <FormattedMessage id="account.shares.table.id" />
            </th>
            <th>
              <FormattedMessage id="account.shares.table.name" />
            </th>
            <th>
              <FormattedMessage id="admin.shares.table.username" />
            </th>
            <th>
              <FormattedMessage id="account.shares.table.visitors" />
            </th>
            <th>
              <FormattedMessage id="account.shares.table.size" />
            </th>
            <th>
              Stockage
            </th>
            <th>
              <FormattedMessage id="account.shares.table.expiresAt" />
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? skeletonRows
            : shares.map((share) => (
                <tr key={share.id}>
                  <td>{share.id}</td>
                  <td>
                    <Group gap="xs" align="center">
                      <Text fw={500}>{share.name || share.id}</Text>
                    </Group>
                    {share.files && share.files.some((f: any) => f.isSuspect && !f.isApproved) && (
                      <Stack gap={4} mt={6} style={{ maxWidth: "450px" }}>
                        {share.files.filter((f: any) => f.isSuspect && !f.isApproved).map((file: any) => (
                          <Group
                            key={file.id}
                            gap="xs"
                            wrap="nowrap"
                            style={{
                              background: "rgba(250, 82, 82, 0.08)",
                              border: "1px dashed var(--mantine-color-red-3)",
                              borderRadius: "6px",
                              padding: "4px 8px",
                              justifyContent: "space-between",
                              width: "100%"
                            }}
                          >
                            <Group gap={6} wrap="nowrap">
                              <TbAlertTriangle size={14} style={{ color: "var(--mantine-color-red-6)", flexShrink: 0 }} />
                              <Text size="xs" color="red" fw={500} style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "220px" }}>
                                {file.name}
                              </Text>
                              <Badge color="red" variant="light" size="xs" style={{ flexShrink: 0 }}>
                                {file.virusName || "Suspect"}
                              </Badge>
                            </Group>
                            <Button
                              size="xs"
                              color="teal"
                              variant="light"
                              style={{ height: 20, padding: "0 8px", fontSize: "0.7rem", flexShrink: 0 }}
                              onClick={() => handleApprove(share.id, file.id, file.name)}
                            >
                              Approuver
                            </Button>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </td>
                  <td>
                    {share.creator ? (
                      share.creator.username
                    ) : (
                      <Text color="dimmed">Anonymous</Text>
                    )}
                  </td>
                  <td>{share.views}</td>
                  <td>{byteToHumanSizeString(share.size)}</td>
                  <td>
                    {share.storageProvider === "LOCAL" ? (
                      <Badge color="blue" variant="light">SSD Local</Badge>
                    ) : share.storageProvider === "S3" ? (
                      share.s3BucketType === "minio" ? (
                        <Badge color="orange" variant="light">{share.s3BucketName || "MinIO"}</Badge>
                      ) : share.s3BucketType === "b2" ? (
                        <Badge color="indigo" variant="light">{share.s3BucketName || "B2 Cloud"}</Badge>
                      ) : (
                        <Badge color="teal" variant="light">
                          {share.s3BucketName || "S3 Cloud"}
                        </Badge>
                      )
                    ) : (
                      <Badge color="blue" variant="light">SSD Local</Badge>
                    )}
                  </td>
                  <td>
                    {moment(share.expiration).unix() === 0
                      ? "Never"
                      : moment(share.expiration).format("LLL")}
                  </td>
                  <td>
                    <Group justify="flex-end">
                      <ActionIcon
                        component={Link}
                        href={`/share/${share.id}/analytics`}
                        variant="light"
                        color="victoria"
                        size={25}
                        title="Statistiques & Analyses"
                      >
                        <TbChartBar />
                      </ActionIcon>
                      <ActionIcon
                        color="victoria"
                        variant="light"
                        size={25}
                        onClick={() => {
                          if (window.isSecureContext) {
                            clipboard.copy(
                              `${window.location.origin}/s/${share.id}`,
                            );
                            toast.success(t("common.notify.copied-link"));
                          } else {
                            showShareLinkModal(modals, share.id);
                          }
                        }}
                      >
                        <TbLink />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="sm"
                        onClick={() => deleteShare(share)}
                      >
                        <TbTrash />
                      </ActionIcon>
                    </Group>
                  </td>
                </tr>
              ))}
        </tbody>
      </Table>
    </Box>
  );
};

const skeletonRows = [...Array(10)].map((v, i) => (
  <tr key={i}>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <Box component="td" visibleFrom="md">
      <Skeleton key={i} height={20} />
    </Box>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
    <td>
      <Skeleton key={i} height={20} />
    </td>
  </tr>
));

export default ManageShareTable;
