import {
  Alert,
  AppShell,
  Box,
  Button,
  Container,
  Group,
  Stack,
  Text,
  Title,
  Card,
  TextInput,
  SegmentedControl,
  ActionIcon,
  Badge,
  Divider,
  Grid,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TbInfoCircle, TbTrash, TbPlus, TbServer, TbCloud } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../../components/Meta";
import AdminConfigInput from "../../../components/admin/configuration/AdminConfigInput";
import ConfigurationHeader from "../../../components/admin/configuration/ConfigurationHeader";
import ConfigurationNavBar from "../../../components/admin/configuration/ConfigurationNavBar";
import LogoConfigInput from "../../../components/admin/configuration/LogoConfigInput";
import TestEmailButton from "../../../components/admin/configuration/TestEmailButton";
import CenterLoader from "../../../components/core/CenterLoader";
import useConfig from "../../../hooks/config.hook";
import useTranslate from "../../../hooks/useTranslate.hook";
import configService from "../../../services/config.service";
import { AdminConfig, UpdateConfig } from "../../../types/config.type";
import { camelToKebab } from "../../../utils/string.util";
import toast from "../../../utils/toast.util";
import classes from "./category.module.css";

interface Bucket {
  id: string;
  name: string;
  type: "minio" | "b2";
  bucketName: string;
  physicalPath?: string;
}

function MultiBucketsConfigEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (_value: string) => void;
}) {
  let initialBuckets: Bucket[] = [];
  try {
    initialBuckets = JSON.parse(value || "[]");
  } catch (e) {
    // Ignore invalid JSON parsing at startup
  }

  const [buckets, setBuckets] = useState<Bucket[]>(initialBuckets);
  const [newType, setNewType] = useState<"minio" | "b2">("minio");
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newBucketName, setNewBucketName] = useState("");
  const [newPhysicalPath, setNewPhysicalPath] = useState("");

  const handleAdd = () => {
    if (!newId || !newName || !newBucketName) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (buckets.some((b) => b.id === newId)) {
      toast.error("Cet identifiant de stockage existe déjà.");
      return;
    }

    const bucket: Bucket = {
      id: newId,
      name: newName,
      type: newType,
      bucketName: newBucketName,
    };

    if (newType === "minio" && newPhysicalPath) {
      bucket.physicalPath = newPhysicalPath;
    }

    const updated = [...buckets, bucket];
    setBuckets(updated);
    onChange(JSON.stringify(updated));

    // Clear form
    setNewId("");
    setNewName("");
    setNewBucketName("");
    setNewPhysicalPath("");
  };

  const handleRemove = (id: string) => {
    const updated = buckets.filter((b) => b.id !== id);
    setBuckets(updated);
    onChange(JSON.stringify(updated));
  };

  return (
    <Card withBorder p="md" radius="md" style={{ background: "rgba(255,255,255,0.01)" }}>
      <Text size="sm" fw={700} mb="md">Configurations de Stockage Connectés</Text>

      {buckets.length === 0 ? (
        <Text size="xs" c="dimmed" mb="md" style={{ fontStyle: "italic" }}>
          Aucun stockage supplémentaire configuré. Les fichiers utiliseront le bucket par défaut.
        </Text>
      ) : (
        <Stack gap="xs" mb="lg">
          {buckets.map((b) => (
            <Card key={b.id} withBorder p="xs" radius="sm" style={{ background: "rgba(0,0,0,0.05)" }}>
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  {b.type === "minio" ? (
                    <TbServer size={20} color="#228be6" />
                  ) : (
                    <TbCloud size={20} color="#6772e5" />
                  )}
                  <div>
                    <Group gap="xs" align="center">
                      <Text size="sm" fw={600}>{b.name}</Text>
                      <Badge size="xs" variant="light" color={b.type === "minio" ? "blue" : "indigo"}>
                        {b.type === "minio" ? "MinIO LAN" : "B2 Cloud"}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      ID: {b.id} | Bucket S3: {b.bucketName}
                      {b.physicalPath && ` | Chemin: ${b.physicalPath}`}
                    </Text>
                  </div>
                </Group>
                <ActionIcon variant="subtle" color="red" onClick={() => handleRemove(b.id)}>
                  <TbTrash size={16} />
                </ActionIcon>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Divider my="md" label="Ajouter un nouveau stockage" labelPosition="center" />

      <Stack gap="sm">
        <SegmentedControl
          value={newType}
          onChange={(val: any) => setNewType(val)}
          data={[
            { label: "MinIO Local / LAN", value: "minio" },
            { label: "Backblaze B2 Cloud", value: "b2" },
          ]}
          fullWidth
          size="xs"
        />

        <Grid gap="xs">
          <Grid.Col span={6}>
            <TextInput
              label="Identifiant unique"
              placeholder="ex: minio-serveur-1"
              required
              value={newId}
              onChange={(e) => setNewId(e.currentTarget.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Nom d'affichage"
              placeholder="ex: LAN Storage 24 To"
              required
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <TextInput
              label="Nom du Bucket S3 / B2"
              placeholder="ex: ustro-warm-share"
              required
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.currentTarget.value)}
              size="xs"
            />
          </Grid.Col>
          {newType === "minio" && (
            <Grid.Col span={12}>
              <TextInput
                label="Chemin physique local (pour l'espace libre)"
                placeholder="ex: D:\minio-data ou /mnt/storage-1"
                value={newPhysicalPath}
                onChange={(e) => setNewPhysicalPath(e.currentTarget.value)}
                size="xs"
              />
            </Grid.Col>
          )}
        </Grid>

        <Button
          leftSection={<TbPlus size={14} />}
          variant="light"
          size="xs"
          onClick={handleAdd}
          mt="xs"
        >
          Ajouter le Stockage
        </Button>
      </Stack>
    </Card>
  );
}

export default function AppShellDemo() {
  const router = useRouter();
  const t = useTranslate();

  const [isMobileNavBarOpened, setIsMobileNavBarOpened] = useState(false);
  const isMobile = useMediaQuery("(max-width: 560px)");
  const config = useConfig();

  const categoryId = (router.query.category as string | undefined) ?? "general";

  const [configVariables, setConfigVariables] = useState<AdminConfig[]>();
  const [updatedConfigVariables, setUpdatedConfigVariables] = useState<
    UpdateConfig[]
  >([]);

  const [logo, setLogo] = useState<File | null>(null);

  const isEditingAllowed = (): boolean => {
    return !configVariables || configVariables[0].allowEdit;
  };

  const saveConfigVariables = async () => {
    if (logo) {
      configService
        .changeLogo(logo)
        .then(() => {
          setLogo(null);
          toast.success(t("admin.config.notify.logo-success"));
        })
        .catch(toast.axiosError);
    }

    if (updatedConfigVariables.length > 0) {
      await configService
        .updateMany(updatedConfigVariables)
        .then(() => {
          setUpdatedConfigVariables([]);
          toast.success(t("admin.config.notify.success"));
        })
        .catch(toast.axiosError);
      void config.refresh();
    } else {
      toast.success(t("admin.config.notify.no-changes"));
    }
  };

  const updateConfigVariable = (configVariable: UpdateConfig) => {
    if (configVariable.key === "general.appUrl") {
      configVariable.value = sanitizeUrl(configVariable.value);
    }

    const index = updatedConfigVariables.findIndex(
      (item) => item.key === configVariable.key,
    );

    if (index > -1) {
      updatedConfigVariables[index] = {
        ...updatedConfigVariables[index],
        ...configVariable,
      };
    } else {
      setUpdatedConfigVariables([...updatedConfigVariables, configVariable]);
    }
  };

  const sanitizeUrl = (url: string): string => {
    return url.endsWith("/") ? url.slice(0, -1) : url;
  };

  useEffect(() => {
    configService.getByCategory(categoryId).then((configVariables) => {
      setConfigVariables(configVariables);
    });
  }, [categoryId]);

  return (
    <>
      <Meta title={t("admin.config.title")} />
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: { sm: 200, lg: 300 },
          breakpoint: "sm",
          collapsed: { mobile: !isMobileNavBarOpened },
        }}
      >
        <AppShell.Header>
          <ConfigurationHeader
            isMobileNavBarOpened={isMobileNavBarOpened}
            setIsMobileNavBarOpened={setIsMobileNavBarOpened}
          />
        </AppShell.Header>
        <AppShell.Navbar>
          <ConfigurationNavBar
            categoryId={categoryId}
            isMobileNavBarOpened={isMobileNavBarOpened}
            setIsMobileNavBarOpened={setIsMobileNavBarOpened}
          />
        </AppShell.Navbar>
        <AppShell.Main className={classes.mainContent}>
          <Container size="lg" py="xl">
            {!configVariables ? (
              <CenterLoader />
            ) : (
              <>
                <Stack>
                  {!isEditingAllowed() && (
                    <Alert
                      mb={"lg"}
                      variant="light"
                      color="blue"
                      title={t("admin.config.config-file-warning.title")}
                      icon={<TbInfoCircle />}
                    >
                      <FormattedMessage id="admin.config.config-file-warning.description" />
                    </Alert>
                  )}
                  <Title mb="md" order={3}>
                    {t("admin.config.category." + categoryId)}
                  </Title>
                  {configVariables.map((configVariable) => (
                    <Group key={configVariable.key} justify="space-between">
                      <Stack
                        style={{ maxWidth: isMobile ? "100%" : "40%" }}
                        gap={0}
                      >
                        <Title order={6}>
                          <FormattedMessage
                            id={`admin.config.${camelToKebab(
                              configVariable.key,
                            )}`}
                          />
                        </Title>

                        <Text
                          style={{
                            whiteSpace: "pre-line",
                          }}
                          c="dimmed"
                          size="sm"
                          mb="xs"
                        >
                          <FormattedMessage
                            id={`admin.config.${camelToKebab(
                              configVariable.key,
                            )}.description`}
                            values={{ br: <br /> }}
                          />
                        </Text>
                      </Stack>
                      <Stack></Stack>
                      <Box style={{ width: isMobile ? "100%" : "50%" }}>
                        {configVariable.key === "s3.multiBucketsConfig" ? (
                          <MultiBucketsConfigEditor
                            value={
                              updatedConfigVariables.find((item) => item.key === configVariable.key)?.value ??
                              configVariable.value
                            }
                            onChange={(val) =>
                              updateConfigVariable({
                                key: configVariable.key,
                                value: val,
                              })
                            }
                          />
                        ) : (
                          <AdminConfigInput
                            key={configVariable.key}
                            configVariable={configVariable}
                            updateConfigVariable={updateConfigVariable}
                          />
                        )}
                      </Box>
                    </Group>
                  ))}
                  {categoryId == "general" && (
                    <LogoConfigInput logo={logo} setLogo={setLogo} />
                  )}
                </Stack>
                <Group mt="lg" justify="flex-end">
                  {categoryId == "smtp" && (
                    <TestEmailButton
                      configVariablesChanged={
                        updatedConfigVariables.length != 0
                      }
                      saveConfigVariables={saveConfigVariables}
                    />
                  )}
                  <Button onClick={saveConfigVariables}>
                    <FormattedMessage id="common.button.save" />
                  </Button>
                </Group>
              </>
            )}
          </Container>
        </AppShell.Main>
      </AppShell>
    </>
  );
}
