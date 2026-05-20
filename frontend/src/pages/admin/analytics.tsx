import {
  Button,
  Center,
  Col,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMantineTheme } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TbArrowLeft,
  TbDatabase,
  TbLink,
  TbUsers,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import configService from "../../services/config.service";
import useTranslate from "../../hooks/useTranslate.hook";
import { byteToHumanSizeString } from "../../utils/fileSize.util";

interface AdminStats {
  totalShares: number;
  activeShares: number;
  expiredShares: number;
  sharesCreatedToday: number;
  totalUsers: number;
  totalFiles: number;
  totalSize: number;
  averageShareSize: number;
  passwordProtectedShares: number;
  totalDownloads: number;
  downloadsToday: number;
  diskTotal: number;
  diskFree: number;
  diskUsed: number;
}

const AdminAnalytics = () => {
  const theme = useMantineTheme();
  const t = useTranslate();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    configService
      .getAdminStats()
      .then(setStats)
      .catch(console.error);
  }, []);

  if (!stats) {
    return (
      <Center style={{ height: "70vh" }}>
        <Loader size="md" />
      </Center>
    );
  }

  return (
    <>
      <Meta title={t("analytics.title")} />

      <Group position="apart" mb={20} align="center">
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
          <Title order={3}>
            <FormattedMessage id="analytics.title" />
          </Title>
          <Text size="sm" color="dimmed">
            <FormattedMessage id="analytics.subtitle" />
          </Text>
        </div>
      </Group>

      <Stack spacing="lg">
        {/* Section 1: Stockage Disque */}
        {stats.diskTotal > 0 ? (
          <Paper withBorder p="xl" radius="lg" style={{ background: "rgba(255,255,255,0.01)" }}>
            <Group position="apart" mb="xs">
              <div>
                <Text size="sm" weight={700}>
                  <FormattedMessage id="analytics.disk.title" />
                </Text>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.disk.subtitle" />
                </Text>
              </div>
              <Text size="sm" weight={700} color="teal">
                <FormattedMessage
                  id="analytics.disk.free"
                  values={{ percentage: Math.round((stats.diskFree / stats.diskTotal) * 100) }}
                />
              </Text>
            </Group>

            <Progress
              sections={[
                { value: (stats.diskUsed / stats.diskTotal) * 100, color: "blue", label: t("analytics.disk.used-label") },
                { value: (stats.diskFree / stats.diskTotal) * 100, color: "teal", label: t("analytics.disk.free-label") },
              ]}
              size="xl"
              radius="xl"
              striped
              animate
              mb="md"
            />

            <Grid>
              <Col span={4}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.disk.total-space" />
                </Text>
                <Text size="md" weight={700}>{byteToHumanSizeString(stats.diskTotal)}</Text>
              </Col>
              <Col span={4}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.disk.used-space" />
                </Text>
                <Text size="md" weight={700} color="blue">{byteToHumanSizeString(stats.diskUsed)}</Text>
              </Col>
              <Col span={4}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.disk.free-space" />
                </Text>
                <Text size="md" weight={700} color="teal">{byteToHumanSizeString(stats.diskFree)}</Text>
              </Col>
            </Grid>
          </Paper>
        ) : (
          <Paper withBorder p="xl" radius="lg" style={{ background: "rgba(255,255,255,0.01)" }}>
            <Group position="apart" mb="xs">
              <div>
                <Text size="sm" weight={700}>
                  <FormattedMessage id="analytics.storage.title" />
                </Text>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.storage.subtitle" />
                </Text>
              </div>
              <Text size="sm" weight={700} color="indigo">
                <FormattedMessage id="analytics.storage.files" values={{ count: stats.totalFiles }} />
              </Text>
            </Group>

            <Progress
              value={100}
              color="indigo"
              size="xl"
              radius="xl"
              striped
              animate
              mb="md"
            />

            <Grid>
              <Col span={6}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.storage.consumed" />
                </Text>
                <Text size="md" weight={700} color="indigo">{byteToHumanSizeString(stats.totalSize)}</Text>
              </Col>
              <Col span={6}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.storage.average" />
                </Text>
                <Text size="md" weight={700}>{byteToHumanSizeString(stats.averageShareSize)}</Text>
              </Col>
            </Grid>
          </Paper>
        )}

        {/* Section 2: Chiffres clés en Grille */}
        <Grid gutter="md">
          {/* Card 1: Partages */}
          <Col xs={12} md={4}>
            <Paper withBorder p="xl" radius="lg" style={{ height: "100%" }}>
              <Group spacing="md" mb="md" noWrap>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(99, 102, 241, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.colors.indigo[6]
                }}>
                  <TbLink size={22} />
                </div>
                <div>
                  <Text size="sm" weight={700}>
                    <FormattedMessage id="analytics.card.hosting.title" />
                  </Text>
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.subtitle" />
                  </Text>
                </div>
              </Group>

              <Stack spacing="xs">
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.total" />
                  </Text>
                  <Text size="sm" weight={700}>{stats.totalShares}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.active" />
                  </Text>
                  <Text size="sm" weight={700} color="teal">{stats.activeShares}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.expired" />
                  </Text>
                  <Text size="sm" weight={700} color="red">{stats.expiredShares}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.today" />
                  </Text>
                  <Text size="sm" weight={700} color="indigo">{stats.sharesCreatedToday}</Text>
                </Group>
              </Stack>
            </Paper>
          </Col>

          {/* Card 2: Fichiers & Volume */}
          <Col xs={12} md={4}>
            <Paper withBorder p="xl" radius="lg" style={{ height: "100%" }}>
              <Group spacing="md" mb="md" noWrap>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(249, 115, 22, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.colors.orange[6]
                }}>
                  <TbDatabase size={22} />
                </div>
                <div>
                  <Text size="sm" weight={700}>
                    <FormattedMessage id="analytics.card.data.title" />
                  </Text>
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.subtitle" />
                  </Text>
                </div>
              </Group>

              <Stack spacing="xs">
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.total-files" />
                  </Text>
                  <Text size="sm" weight={700}>{stats.totalFiles}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.total-size" />
                  </Text>
                  <Text size="sm" weight={700} color="orange">{byteToHumanSizeString(stats.totalSize)}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.average-size" />
                  </Text>
                  <Text size="sm" weight={700}>{byteToHumanSizeString(stats.averageShareSize)}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.password" />
                  </Text>
                  <Text size="sm" weight={700} color="blue">{stats.passwordProtectedShares}</Text>
                </Group>
              </Stack>
            </Paper>
          </Col>

          {/* Card 3: Utilisateurs & Activité */}
          <Col xs={12} md={4}>
            <Paper withBorder p="xl" radius="lg" style={{ height: "100%" }}>
              <Group spacing="md" mb="md" noWrap>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(34, 197, 94, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.colors.green[6]
                }}>
                  <TbUsers size={22} />
                </div>
                <div>
                  <Text size="sm" weight={700}>
                    <FormattedMessage id="analytics.card.members.title" />
                  </Text>
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.subtitle" />
                  </Text>
                </div>
              </Group>

              <Stack spacing="xs">
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.users" />
                  </Text>
                  <Text size="sm" weight={700}>{stats.totalUsers}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.downloads" />
                  </Text>
                  <Text size="sm" weight={700} color="green">{stats.totalDownloads}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.downloads-today" />
                  </Text>
                  <Text size="sm" weight={700} color="teal">{stats.downloadsToday}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.ratio" />
                  </Text>
                  <Text size="sm" weight={700}>
                    <FormattedMessage
                      id="analytics.card.members.ratio-value"
                      values={{
                        ratio: stats.totalShares > 0 ? (stats.totalDownloads / stats.totalShares).toFixed(1) : 0
                      }}
                    />
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </Col>
        </Grid>
      </Stack>
    </>
  );
};

export default AdminAnalytics;
