import { Button, Group, Space, Text, Title, Grid, Paper, createStyles } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { TbArrowLeft, TbLink, TbUsers, TbDatabase, TbDownload } from "react-icons/tb";
import Meta from "../../components/Meta";
import ManageShareTable from "../../components/admin/shares/ManageShareTable";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import { MyShare } from "../../types/share.type";
import toast from "../../utils/toast.util";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import Link from "next/link";


const useStyles = createStyles((theme) => ({
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
    border: `1px solid ${theme.colorScheme === "dark" ? theme.colors.dark[6] : theme.colors.gray[2]
      }`,
    boxShadow: theme.shadows.xs,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows.md,
    },
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      theme.colorScheme === "dark"
        ? theme.fn.rgba(theme.colors[theme.primaryColor][9], 0.2)
        : theme.colors[theme.primaryColor][0],
    color: theme.colors[theme.primaryColor][theme.colorScheme === "dark" ? 4 : 7],
  },
}));

const Shares = () => {
  const { classes } = useStyles();
  const [shares, setShares] = useState<MyShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const modals = useModals();
  const t = useTranslate();

  const getShares = () => {
    setIsLoading(true);
    shareService.list().then((shares) => {
      setShares(shares);
      setIsLoading(false);
    });
  };

  const deleteShare = (share: MyShare) => {
    modals.openConfirmModal({
      title: t("admin.shares.edit.delete.title", {
        id: share.id,
      }),
      children: (
        <Text size="sm">
          <FormattedMessage id="admin.shares.edit.delete.description" />
        </Text>
      ),
      labels: {
        confirm: t("common.button.delete"),
        cancel: t("common.button.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        shareService
          .remove(share.id)
          .then(() => setShares(shares.filter((v) => v.id != share.id)))
          .catch(toast.axiosError);
      },
    });
  };

  useEffect(() => {
    getShares();
  }, []);

  // Dynamic real-time statistics
  const totalShares = shares.length;
  const totalViews = shares.reduce((acc, curr) => acc + (curr.views || 0), 0);
  const totalSize = shares.reduce((acc, curr) => acc + (curr.size || 0), 0);
  const averageSize = totalShares > 0 ? totalSize / totalShares : 0;

  return (
    <>
      <Meta title={t("admin.shares.title")} />
      <Group position="apart" align="baseline" mb={20}>
        <div>
          <Button
            component={Link}
            href="/admin"
            variant="subtle"
            leftIcon={<TbArrowLeft size={16} />}
            compact
            mb={10}
          >
            <FormattedMessage id="analytics.back-to-admin" />
          </Button>
          <Title mb={20} order={3}>
            <FormattedMessage id="admin.shares.title" />
          </Title>
        </div>
      </Group>

      {/* Grid of Dynamic Premium Statistics */}
      <Grid mb={30}>
        <Grid.Col xs={6} sm={3}>
          <Paper className={classes.card}>
            <Group position="apart">
              <div>
                <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                  <FormattedMessage id="analytics.shares.totals" />
                </Text>
                <Title order={3} mt={5}>
                  {totalShares}
                </Title>
              </div>
              <div className={classes.iconContainer}>
                <TbLink size={24} />
              </div>
            </Group>
          </Paper>
        </Grid.Col>

        <Grid.Col xs={6} sm={3}>
          <Paper className={classes.card}>
            <Group position="apart">
              <div>
                <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                  <FormattedMessage id="analytics.shares.views" />
                </Text>
                <Title order={3} mt={5}>
                  {totalViews}
                </Title>
              </div>
              <div className={classes.iconContainer}>
                <TbUsers size={24} />
              </div>
            </Group>
          </Paper>
        </Grid.Col>

        <Grid.Col xs={6} sm={3}>
          <Paper className={classes.card}>
            <Group position="apart">
              <div>
                <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                  <FormattedMessage id="analytics.shares.totalsize" />
                </Text>
                <Title order={3} mt={5}>
                  {byteToHumanSizeString(totalSize)}
                </Title>
              </div>
              <div className={classes.iconContainer}>
                <TbDatabase size={24} />
              </div>
            </Group>
          </Paper>
        </Grid.Col>

        <Grid.Col xs={6} sm={3}>
          <Paper className={classes.card}>
            <Group position="apart">
              <div>
                <Text color="dimmed" size="xs" transform="uppercase" weight={700}>
                  <FormattedMessage id="analytics.shares.averagesize" />
                </Text>
                <Title order={3} mt={5}>
                  {byteToHumanSizeString(averageSize)}
                </Title>
              </div>
              <div className={classes.iconContainer}>
                <TbDownload size={24} />
              </div>
            </Group>
          </Paper>
        </Grid.Col>
      </Grid>

      <ManageShareTable
        shares={shares}
        deleteShare={deleteShare}
        isLoading={isLoading}
      />
      <Space h="xl" />
    </>
  );
};

export default Shares;
