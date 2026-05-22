import {
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  Space,
  Table,
  Text,
  Title,
  Center,
} from "@mantine/core";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TbArrowLeft,
  TbWorld,
  TbDeviceDesktop,
  TbDownload,
  TbUsers,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../../components/Meta";
import shareService from "../../../services/share.service";
import useTranslate from "../../../hooks/useTranslate.hook";
import moment from "moment";

export function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: { shareId: context.params!.shareId },
  };
}

interface AnalyticEntry {
  id: string;
  createdAt: string;
  shareId: string;
  ip: string;
  country: string | null;
  userAgent: string | null;
  device: string | null;
  browser: string | null;
  fileId: string | null;
}

const ShareAnalytics = ({ shareId }: { shareId: string }) => {
  const t = useTranslate();
  const [logs, setLogs] = useState<AnalyticEntry[]>([]);
  const [shareName, setShareName] = useState<string>("");
  const [filesMap, setFilesMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    // Fetch share metadata to resolve share names and file IDs to their friendly filenames
    shareService
      .getFromOwner(shareId)
      .then((share) => {
        setShareName(share.name || shareId);
        const map: Record<string, string> = {};
        share.files?.forEach((f: any) => {
          map[f.id] = f.name;
        });
        setFilesMap(map);
      })
      .catch(() => {
        setShareName(shareId);
      });

    shareService
      .getAnalytics(shareId)
      .then((res) => {
        setLogs(res);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [shareId]);

  if (isLoading) {
    return (
      <Center style={{ height: "70vh" }}>
        <Loader size="md" />
      </Center>
    );
  }

  // 1. High-level metric computations
  const totalDownloads = logs.length;
  const uniqueIps = new Set(logs.map((l) => l.ip)).size;

  // Most frequent helper
  const getMostFrequent = (arr: (string | null)[]) => {
    const counts: Record<string, number> = {};
    let maxCount = 0;
    let mostFrequent = t("analytics.unknown");

    arr.forEach((val) => {
      if (!val) return;
      counts[val] = (counts[val] || 0) + 1;
      if (counts[val] > maxCount) {
        maxCount = counts[val];
        mostFrequent = val;
      }
    });

    return mostFrequent;
  };

  const topCountry = getMostFrequent(logs.map((l) => l.country));
  const topDevice = getMostFrequent(logs.map((l) => l.device));

  // 2. Breakdowns helper
  const getPercentages = (arr: (string | null)[]) => {
    const counts: Record<string, number> = {};
    arr.forEach((val) => {
      const key = val || t("analytics.unknown");
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage:
          totalDownloads > 0 ? Math.round((count / totalDownloads) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  };

  const countriesBreakdown = getPercentages(logs.map((l) => l.country));
  const devicesBreakdown = getPercentages(logs.map((l) => l.device));
  const browsersBreakdown = getPercentages(logs.map((l) => l.browser));

  return (
    <>
      <Meta title={t("analytics.title-share", { shareName })} />

      <Group justify="space-between" mb={20} align="center">
        <div>
          <Button
            component={Link}
            href="/account/shares"
            variant="subtle"
            leftSection={<TbArrowLeft size={16} />}
            size="xs"
            mb={10}
          >
            <FormattedMessage id="analytics.back-to-shares" />
          </Button>
          <Title order={3}>
            <FormattedMessage
              id="analytics.title-share"
              values={{ shareName }}
            />
          </Title>
          <Text size="sm" color="dimmed">
            <FormattedMessage id="analytics.subtitle-share" />
          </Text>
        </div>
      </Group>

      {/* KPI Cards Grid */}
      <Grid mb={30}>
        <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
          <Paper withBorder p="md" radius="md" style={{ height: "100%" }}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                <FormattedMessage id="analytics.downloads" />
              </Text>
              <TbDownload size={20} color="gray" />
            </Group>
            <Text size="xl" fw={700} mt={5}>
              {totalDownloads}
            </Text>
            <Text size="xs" c="dimmed" mt={5}>
              <FormattedMessage id="analytics.downloads.subtitle" />
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
          <Paper withBorder p="md" radius="md" style={{ height: "100%" }}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                <FormattedMessage id="analytics.visitors" />
              </Text>
              <TbUsers size={20} color="gray" />
            </Group>
            <Text size="xl" fw={700} mt={5}>
              {uniqueIps}
            </Text>
            <Text size="xs" c="dimmed" mt={5}>
              <FormattedMessage id="analytics.visitors.subtitle" />
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
          <Paper withBorder p="md" radius="md" style={{ height: "100%" }}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                <FormattedMessage id="analytics.country" />
              </Text>
              <TbWorld size={20} color="gray" />
            </Group>
            <Text
              size="xl"
              fw={700}
              mt={5}
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {topCountry}
            </Text>
            <Text size="xs" c="dimmed" mt={5}>
              <FormattedMessage id="analytics.country.subtitle" />
            </Text>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, xs: 6, md: 3 }}>
          <Paper withBorder p="md" radius="md" style={{ height: "100%" }}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                <FormattedMessage id="analytics.device" />
              </Text>
              <TbDeviceDesktop size={20} color="gray" />
            </Group>
            <Text size="xl" fw={700} mt={5}>
              {topDevice}
            </Text>
            <Text size="xs" c="dimmed" mt={5}>
              <FormattedMessage id="analytics.device.subtitle" />
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Breakdowns section */}
      {totalDownloads > 0 && (
        <Grid mb={30}>
          {/* Devices & Browsers */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder radius="md" p="lg" style={{ height: "100%" }}>
              <Title order={4} mb={15}>
                <FormattedMessage id="analytics.devices-browsers" />
              </Title>

              <Text size="sm" fw={600} mb={5}>
                <FormattedMessage id="analytics.device-types" />
              </Text>
              <Progress.Root size="xl" radius="xl" mb={20}>
                {devicesBreakdown.map((item, idx) => {
                  const colors = ["victoria", "teal", "orange"];
                  return (
                    <Progress.Section
                      key={item.name}
                      value={item.percentage}
                      color={colors[idx % colors.length]}
                    >
                      <Progress.Label>{`${item.name} (${item.percentage}%)`}</Progress.Label>
                    </Progress.Section>
                  );
                })}
              </Progress.Root>

              <Text size="sm" fw={600} mb={10}>
                <FormattedMessage id="analytics.browsers" />
              </Text>
              {browsersBreakdown.map((browser) => (
                <div key={browser.name} style={{ marginBottom: 12 }}>
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" fw={500}>
                      {browser.name}
                    </Text>
                    <Text size="xs" color="dimmed">
                      {browser.count} ({browser.percentage}%)
                    </Text>
                  </Group>
                  <Progress value={browser.percentage} size="xs" color="teal" />
                </div>
              ))}
            </Card>
          </Grid.Col>

          {/* Countries ranking */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder radius="md" p="lg" style={{ height: "100%" }}>
              <Title order={4} mb={15}>
                <FormattedMessage id="analytics.locations" />
              </Title>
              {countriesBreakdown.slice(0, 5).map((country) => (
                <div key={country.name} style={{ marginBottom: 15 }}>
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" fw={500}>
                      {country.name}
                    </Text>
                    <Text size="sm" fw={600}>
                      {country.percentage}%
                    </Text>
                  </Group>
                  <Progress value={country.percentage} size="sm" color="blue" />
                  <Text size="xs" color="dimmed" mt={2}>
                    <FormattedMessage
                      id="analytics.count-downloads"
                      values={{ count: country.count }}
                    />
                  </Text>
                </div>
              ))}
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {/* Download Activity Table */}
      <Title order={4} mb={15}>
        <FormattedMessage id="analytics.history" />
      </Title>
      <Card radius="md" withBorder p={0} style={{ overflow: "auto" }}>
        {logs.length === 0 ? (
          <Center p={40}>
            <Text color="dimmed">
              <FormattedMessage id="analytics.history.empty" />
            </Text>
          </Center>
        ) : (
          <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
            <thead>
              <tr>
                <th>
                  <FormattedMessage id="analytics.table.date" />
                </th>
                <th>
                  <FormattedMessage id="analytics.table.file" />
                </th>
                <th>
                  <FormattedMessage id="analytics.table.ip" />
                </th>
                <th>
                  <FormattedMessage id="analytics.table.country" />
                </th>
                <th>
                  <FormattedMessage id="analytics.table.device" />
                </th>
                <th>
                  <FormattedMessage id="analytics.table.browser" />
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const fileName = log.fileId
                  ? filesMap[log.fileId] || t("analytics.file-deleted")
                  : t("analytics.zip-complete");
                return (
                  <tr key={log.id}>
                    <td>
                      <Text size="sm" fw={500}>
                        {moment(log.createdAt).format("DD/MM/YYYY HH:mm:ss")}
                      </Text>
                    </td>
                    <td>
                      <Text
                        size="sm"
                        fw={600}
                        color={log.fileId ? "teal" : "blue"}
                      >
                        {fileName.split("/").pop()}
                      </Text>
                    </td>
                    <td>
                      <Text size="sm">{log.ip}</Text>
                    </td>
                    <td>
                      <Text size="sm">
                        {log.country || t("analytics.unknown")}
                      </Text>
                    </td>
                    <td>
                      <Text size="sm">{log.device || "Desktop"}</Text>
                    </td>
                    <td>
                      <Text size="sm" color="dimmed">
                        {log.browser || t("analytics.unknown")}
                      </Text>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Space h="xl" />
    </>
  );
};

export default ShareAnalytics;
