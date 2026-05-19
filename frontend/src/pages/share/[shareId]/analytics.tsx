import {
  Button,
  Card,
  Col,
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
import { TbArrowLeft, TbWorld, TbDeviceDesktop, TbDownload, TbUsers } from "react-icons/tb";
import Meta from "../../../components/Meta";
import shareService from "../../../services/share.service";
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
    let mostFrequent = "Aucun";

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
      const key = val || "Autre";
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalDownloads > 0 ? Math.round((count / totalDownloads) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  };

  const countriesBreakdown = getPercentages(logs.map((l) => l.country));
  const devicesBreakdown = getPercentages(logs.map((l) => l.device));
  const browsersBreakdown = getPercentages(logs.map((l) => l.browser));

  return (
    <>
      <Meta title={`Analyses - ${shareName}`} />
      
      <Group position="apart" mb={20} align="center">
        <div>
          <Button
            component={Link}
            href="/account/shares"
            variant="subtle"
            leftIcon={<TbArrowLeft size={16} />}
            compact
            mb={10}
          >
            Retour à mes partages
          </Button>
          <Title order={3}>Statistiques & Analyses : {shareName}</Title>
          <Text size="sm" color="dimmed">
            Suivi des téléchargements, visiteurs uniques et provenance géographique.
          </Text>
        </div>
      </Group>

      {/* KPI Cards Grid */}
      <Grid mb={30}>
        <Col span={12} xs={6} md={3}>
          <Paper withBorder p="md" radius="md" style={{ height: "100%" }}>
            <Group position="apart">
              <Text size="xs" color="dimmed" weight={700} transform="uppercase">
                Téléchargements
              </Text>
              <TbDownload size={20} color="gray" />
            </Group>
            <Text size="xl" weight={700} mt={5}>
              {totalDownloads}
            </Text>
            <Text size="xs" color="dimmed" mt={5}>
              Volume total de fichiers récupérés
            </Text>
          </Paper>
        </Col>

        <Col span={12} xs={6} md={3}>
          <Paper withBorder p="md" radius="md" style={{ height: "100%" }}>
            <Group position="apart">
              <Text size="xs" color="dimmed" weight={700} transform="uppercase">
                Visiteurs Uniques
              </Text>
              <TbUsers size={20} color="gray" />
            </Group>
            <Text size="xl" weight={700} mt={5}>
              {uniqueIps}
            </Text>
            <Text size="xs" color="dimmed" mt={5}>
              Adresses IP distinctes enregistrées
            </Text>
          </Paper>
        </Col>

        <Col span={12} xs={6} md={3}>
          <Paper withBorder p="md" radius="md" style={{ height: "100%" }}>
            <Group position="apart">
              <Text size="xs" color="dimmed" weight={700} transform="uppercase">
                Pays Principal
              </Text>
              <TbWorld size={20} color="gray" />
            </Group>
            <Text size="xl" weight={700} mt={5} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {topCountry}
            </Text>
            <Text size="xs" color="dimmed" mt={5}>
              Provenance la plus fréquente
            </Text>
          </Paper>
        </Col>

        <Col span={12} xs={6} md={3}>
          <Paper withBorder p="md" radius="md" style={{ height: "100%" }}>
            <Group position="apart">
              <Text size="xs" color="dimmed" weight={700} transform="uppercase">
                Appareil Principal
              </Text>
              <TbDeviceDesktop size={20} color="gray" />
            </Group>
            <Text size="xl" weight={700} mt={5}>
              {topDevice}
            </Text>
            <Text size="xs" color="dimmed" mt={5}>
              Type d'écran le plus utilisé
            </Text>
          </Paper>
        </Col>
      </Grid>

      {/* Breakdowns section */}
      {totalDownloads > 0 && (
        <Grid mb={30}>
          {/* Devices & Browsers */}
          <Col span={12} md={6}>
            <Card withBorder radius="md" p="lg" style={{ height: "100%" }}>
              <Title order={4} mb={15}>
                Appareils & Navigateurs
              </Title>
              
              <Text size="sm" weight={600} mb={5}>Types d'appareils</Text>
              <Progress
                size="xl"
                radius="xl"
                sections={devicesBreakdown.map((item, idx) => {
                  const colors = ["victoria", "teal", "orange"];
                  return {
                    value: item.percentage,
                    color: colors[idx % colors.length],
                    label: `${item.name} (${item.percentage}%)`,
                  };
                })}
                mb={20}
              />

              <Text size="sm" weight={600} mb={10}>Navigateurs</Text>
              {browsersBreakdown.map((browser, idx) => (
                <div key={browser.name} style={{ marginBottom: 12 }}>
                  <Group position="apart" mb={4}>
                    <Text size="xs" weight={500}>{browser.name}</Text>
                    <Text size="xs" color="dimmed">{browser.count} ({browser.percentage}%)</Text>
                  </Group>
                  <Progress value={browser.percentage} size="xs" color="teal" />
                </div>
              ))}
            </Card>
          </Col>

          {/* Countries ranking */}
          <Col span={12} md={6}>
            <Card withBorder radius="md" p="lg" style={{ height: "100%" }}>
              <Title order={4} mb={15}>
                Top Localisations
              </Title>
              {countriesBreakdown.slice(0, 5).map((country) => (
                <div key={country.name} style={{ marginBottom: 15 }}>
                  <Group position="apart" mb={4}>
                    <Text size="sm" weight={500}>{country.name}</Text>
                    <Text size="sm" weight={600}>{country.percentage}%</Text>
                  </Group>
                  <Progress value={country.percentage} size="sm" color="blue" />
                  <Text size="xs" color="dimmed" mt={2}>
                    {country.count} téléchargement(s)
                  </Text>
                </div>
              ))}
            </Card>
          </Col>
        </Grid>
      )}

      {/* Download Activity Table */}
      <Title order={4} mb={15}>Historique des Téléchargements</Title>
      <Card radius="md" withBorder p={0} style={{ overflow: "auto" }}>
        {logs.length === 0 ? (
          <Center p={40}>
            <Text color="dimmed">Aucune activité de téléchargement enregistrée pour le moment.</Text>
          </Center>
        ) : (
          <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Fichier</th>
                <th>IP</th>
                <th>Pays</th>
                <th>Appareil</th>
                <th>Navigateur</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const fileName = log.fileId ? filesMap[log.fileId] || "Fichier Supprimé" : "Archive ZIP Complète";
                return (
                  <tr key={log.id}>
                    <td>
                      <Text size="sm" weight={500}>
                        {moment(log.createdAt).format("DD/MM/YYYY HH:mm:ss")}
                      </Text>
                    </td>
                    <td>
                      <Text size="sm" weight={600} color={log.fileId ? "teal" : "blue"}>
                        {fileName.split("/").pop()}
                      </Text>
                    </td>
                    <td>
                      <Text size="sm">{log.ip}</Text>
                    </td>
                    <td>
                      <Text size="sm">{log.country || "Inconnu"}</Text>
                    </td>
                    <td>
                      <Text size="sm">{log.device || "Desktop"}</Text>
                    </td>
                    <td>
                      <Text size="sm" color="dimmed">
                        {log.browser || "Inconnu"}
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
