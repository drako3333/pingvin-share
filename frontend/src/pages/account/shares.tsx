import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Space,
  Stack,
  Table,
  Text,
  Title,
  Modal,
  TextInput,
  SimpleGrid,
  Card,
  Badge,
  Menu,
  Progress,
  Paper,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import moment from "moment";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  TbEdit,
  TbFlame,
  TbInfoCircle,
  TbLink,
  TbLock,
  TbTrash,
  TbChartBar,
  TbFolder,
  TbFolderPlus,
  TbFolderShare,
  TbUsers,
  TbHeart,
  TbStar,
  TbDatabase,
  TbCloud,
  TbPlus,
  TbShare,
  TbFolderOpen,
  TbArrowRight,
  TbBriefcase,
  TbCheck,
  TbLayoutDashboard,
  TbActivity,
  TbDownload,
  TbUpload,
  TbArrowUpRight,
  TbClock,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import showShareInformationsModal from "../../components/account/showShareInformationsModal";
import showShareLinkModal from "../../components/account/showShareLinkModal";
import CenterLoader from "../../components/core/CenterLoader";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import shareService from "../../services/share.service";
import folderService from "../../services/folder.service";
import userService from "../../services/user.service";
import { MyShare } from "../../types/share.type";
import { Folder } from "../../types/folder.type";
import { DashboardStats } from "../../types/dashboard.type";
import toast from "../../utils/toast.util";
import { byteToHumanSizeString } from "../../utils/fileSize.util";

const ICON_MAPPING: Record<string, any> = {
  TbFolder: TbFolder,
  TbBriefcase: TbBriefcase,
  TbUsers: TbUsers,
  TbHeart: TbHeart,
  TbStar: TbStar,
  TbDatabase: TbDatabase,
  TbCloud: TbCloud,
  TbLock: TbLock,
};

const COLORS = [
  { name: "blue", label: "Bleu", value: "#228be6" },
  { name: "green", label: "Vert", value: "#40c057" },
  { name: "red", label: "Rouge", value: "#fa5252" },
  { name: "orange", label: "Orange", value: "#fd7e14" },
  { name: "grape", label: "Grape", value: "#be4bdb" },
  { name: "pink", label: "Rose", value: "#e64980" },
  { name: "teal", label: "Teal", value: "#12b886" },
  { name: "indigo", label: "Indigo", value: "#4c6ef5" },
];

const MyShares = () => {
  const modals = useModals();
  const clipboard = useClipboard();
  const config = useConfig();
  const t = useTranslate();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  // Tab State: 'dashboard' | 'folders'
  const [activeTab, setActiveTab] = useState<"dashboard" | "folders">("dashboard");

  const [shares, setShares] = useState<MyShare[]>();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");

  // Modals state
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showShareFolder, setShowShareFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("blue");
  const [folderIcon, setFolderIcon] = useState("TbFolder");
  const [invitee, setInvitee] = useState("");

  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [sharingFolder, setSharingFolder] = useState<Folder | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);

  const refreshAll = () => {
    shareService.getMyShares().then((shares) => setShares(shares));
    folderService.list().then((folders) => setFolders(folders));
    userService.getDashboardStats().then((stats) => setDashboardStats(stats));
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pingvin_user");
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch (e) {
      console.warn("Failed to parse local pingvin_user storage:", e);
    }

    refreshAll();
  }, []);

  if (!shares || !dashboardStats) return <CenterLoader />;

  // Calculate stats
  const totalCount = shares.length;
  const unassignedCount = shares.filter((s) => !s.folderId).length;

  const folderCounts: Record<string, number> = {};
  shares.forEach((s) => {
    if (s.folderId) {
      folderCounts[s.folderId] = (folderCounts[s.folderId] || 0) + 1;
    }
  });

  const handleCreateOrUpdateFolder = async () => {
    if (!folderName.trim()) {
      toast.error("Veuillez saisir un nom pour le dossier");
      return;
    }

    try {
      if (editingFolder) {
        const updated = await folderService.update(
          editingFolder.id,
          folderName,
          folderColor,
          folderIcon
        );
        setFolders(folders.map((f) => (f.id === editingFolder.id ? updated : f)));
        toast.success("Dossier mis à jour !");
      } else {
        const created = await folderService.create(folderName, folderColor, folderIcon);
        setFolders([...folders, created]);
        toast.success("Dossier créé avec succès !");
      }
      handleCloseFolderModal();
      refreshAll();
    } catch (e) {
      toast.axiosError(e);
    }
  };

  const handleCloseFolderModal = () => {
    setShowCreateFolder(false);
    setEditingFolder(null);
    setFolderName("");
    setFolderColor("blue");
    setFolderIcon("TbFolder");
  };

  const handleOpenEditFolder = (f: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(f);
    setFolderName(f.name);
    setFolderColor(f.color || "blue");
    setFolderIcon(f.icon || "TbFolder");
    setShowCreateFolder(true);
  };

  const handleDeleteFolder = async (f: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    modals.openConfirmModal({
      title: `Supprimer le dossier "${f.name}" ?`,
      children: (
        <Text size="sm">
          Êtes-vous sûr de vouloir supprimer ce dossier ? Les partages qu'il contient ne seront pas supprimés, mais deviendront "Non classés".
        </Text>
      ),
      confirmProps: { color: "red" },
      labels: { confirm: "Supprimer", cancel: "Annuler" },
      onConfirm: async () => {
        try {
          await folderService.remove(f.id);
          setFolders(folders.filter((item) => item.id !== f.id));
          if (selectedFolderId === f.id) {
            setSelectedFolderId("all");
          }
          setShares(shares.map((s) => (s.folderId === f.id ? { ...s, folderId: null } : s)));
          toast.success("Dossier supprimé !");
          refreshAll();
        } catch (err) {
          toast.axiosError(err);
        }
      },
    });
  };

  const handleMoveShare = async (shareId: string, folderId: string | null) => {
    try {
      setShares((prev) =>
        prev?.map((s) => (s.id === shareId ? { ...s, folderId } : s))
      );
      await folderService.moveShare(shareId, folderId);
      toast.success("Partage déplacé !");
      refreshAll();
    } catch (err) {
      toast.axiosError(err);
      shareService.getMyShares().then((shares) => setShares(shares));
    }
  };

  const handleOpenShareFolder = (f: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setSharingFolder(f);
    setShowShareFolder(true);
  };

  const handleInviteCollaborator = async () => {
    if (!invitee.trim() || !sharingFolder) return;
    try {
      const updated = await folderService.share(sharingFolder.id, invitee);
      setFolders(folders.map((f) => (f.id === sharingFolder.id ? updated : f)));
      setSharingFolder(updated);
      setInvitee("");
      toast.success(`Utilisateur invité avec succès !`);
      refreshAll();
    } catch (err) {
      toast.axiosError(err);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!sharingFolder) return;
    try {
      const updated = await folderService.unshare(sharingFolder.id, userId);
      setFolders(folders.map((f) => (f.id === sharingFolder.id ? updated : f)));
      setSharingFolder(updated);
      toast.success("Collaborateur retiré !");
      refreshAll();
    } catch (err) {
      toast.axiosError(err);
    }
  };

  const displayedShares = (shares || []).filter((share) => {
    if (selectedFolderId === "all") return true;
    if (selectedFolderId === "unassigned") return !share.folderId;
    return share.folderId === selectedFolderId;
  });

  // Calculate chart max values to scale SVG chart correctly
  const chartMax = Math.max(
    ...dashboardStats.chartData.map((d) => Math.max(d.uploads, d.downloads)),
    1 // fallback to 1 to avoid division by zero
  );

  return (
    <>
      <Meta title={t("account.shares.title")} />
      
      <style dangerouslySetInnerHTML={{ __html: `
        .switcher-tabs-container {
          background-color: ${isDark ? "rgba(13, 15, 23, 0.6)" : "rgba(0, 0, 0, 0.03)"};
          border: 1px solid ${isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(15, 23, 42, 0.05)"};
          border-radius: 8px;
          padding: 4px;
          display: inline-flex;
          gap: 4px;
        }
        .switcher-tab-btn {
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          transition: background-color 0.15s ease, color 0.15s ease;
          border: none;
          background: transparent;
          color: ${isDark ? "#8b949e" : "#5c6b73"};
        }
        .switcher-tab-btn.active {
          background-color: ${isDark ? "#228be6" : "#ffffff"};
          color: ${isDark ? "#ffffff" : "#228be6"};
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .shortcut-card {
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          background: ${isDark ? "linear-gradient(135deg, rgba(13,15,23,0.85), rgba(20,22,33,0.9))" : "#ffffff"} !important;
          border: 1px solid ${isDark ? "rgba(148,163,184,0.1)" : "rgba(15, 23, 42, 0.06)"} !important;
        }
        .shortcut-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(34, 139, 230, 0.12);
        }
        .folder-card {
          cursor: pointer;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          border: 1px solid ${isDark ? "rgba(148, 163, 184, 0.1)" : "rgba(15, 23, 42, 0.08)"};
        }
        .folder-card:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 4px 12px ${isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(15, 23, 42, 0.05)"};
        }
        .folder-card.active {
          border-color: #228be6 !important;
          background-color: ${isDark ? "rgba(34, 139, 230, 0.08) !important" : "rgba(34, 139, 230, 0.03) !important"};
        }
        .color-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease;
        }
        .color-dot:hover {
          transform: scale(1.15);
        }
        .icon-select-btn {
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid ${isDark ? "rgba(148, 163, 184, 0.15)" : "rgba(15, 23, 42, 0.12)"};
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease;
        }
        .icon-select-btn:hover {
          background-color: ${isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"};
        }
        .icon-select-btn.active {
          border-color: #228be6;
          background-color: rgba(34, 139, 230, 0.1);
        }
        .draggable-row {
          cursor: grab;
          transition: background-color 0.15s ease;
        }
        .draggable-row:active {
          cursor: grabbing;
          background-color: ${isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)"};
        }
        .glow-chart-line {
          filter: drop-shadow(0px 2px 6px rgba(34, 139, 230, 0.4));
        }
        .glow-chart-uploads {
          filter: drop-shadow(0px 2px 6px rgba(20, 200, 150, 0.4));
        }
      ` }} />

      {/* Main Title and View Switcher */}
      <Group justify="space-between" mb={25} align="center">
        <div>
          <Title order={3} style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            Espace Personnel
          </Title>
          <Text size="xs" c="dimmed">
            Gérez vos partages, dossiers collaboratifs et visualisez vos statistiques.
          </Text>
        </div>

        <div className="switcher-tabs-container">
          <button
            className={`switcher-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <Group gap="xs">
              <TbLayoutDashboard size={16} />
              <span>Tableau de Bord</span>
            </Group>
          </button>
          <button
            className={`switcher-tab-btn ${activeTab === "folders" ? "active" : ""}`}
            onClick={() => setActiveTab("folders")}
          >
            <Group gap="xs">
              <TbFolderOpen size={16} />
              <span>Dossiers & Fichiers</span>
            </Group>
          </button>
        </div>
      </Group>

      {/* TAB 1: USER DASHBOARD */}
      {activeTab === "dashboard" && (
        <Stack gap="lg">
          {/* Quick Shortcuts */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Card
              p="md"
              radius="md"
              className="shortcut-card"
              component={Link}
              href="/upload"
            >
              <Group justify="space-between" mb="xs">
                <TbPlus size={24} style={{ color: "#40c057" }} />
                <TbArrowUpRight size={16} style={{ color: "#8b949e" }} />
              </Group>
              <Text fw={700} size="md">Nouveau Partage</Text>
              <Text size="xs" c="dimmed">Envoyez des fichiers et générez un lien sécurisé.</Text>
            </Card>

            <Card
              p="md"
              radius="md"
              className="shortcut-card"
              component={Link}
              href="/account/reverseShares"
            >
              <Group justify="space-between" mb="xs">
                <TbShare size={24} style={{ color: "#7950f2" }} />
                <TbArrowUpRight size={16} style={{ color: "#8b949e" }} />
              </Group>
              <Text fw={700} size="md">Partage Inversé</Text>
              <Text size="xs" c="dimmed">Générez un lien pour laisser des tiers vous envoyer des fichiers.</Text>
            </Card>

            <Card
              p="md"
              radius="md"
              className="shortcut-card"
              onClick={() => setShowCreateFolder(true)}
            >
              <Group justify="space-between" mb="xs">
                <TbFolderPlus size={24} style={{ color: "#fd7e14" }} />
                <TbArrowUpRight size={16} style={{ color: "#8b949e" }} />
              </Group>
              <Text fw={700} size="md">Nouveau Dossier</Text>
              <Text size="xs" c="dimmed">Créez un dossier thématique pour ranger vos fichiers.</Text>
            </Card>
          </SimpleGrid>

          {/* Storage Meter & Activity Graph */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {/* Storage Quota Panel */}
            <Paper p="md" radius="md" withBorder>
              <Title order={5} mb="sm" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TbDatabase size={18} style={{ color: "#228be6" }} />
                Quota de Stockage
              </Title>
              
              <Box py="sm">
                <Group justify="space-between" mb={8}>
                  <Text size="xs" c="dimmed">Espace utilisé</Text>
                  <Text size="sm" fw={700}>
                    {byteToHumanSizeString(dashboardStats.storage.used)} /{" "}
                    {dashboardStats.storage.quota > 0
                      ? byteToHumanSizeString(dashboardStats.storage.quota)
                      : "Illimité"}
                  </Text>
                </Group>
                
                <Progress
                  value={
                    dashboardStats.storage.quota > 0
                      ? (dashboardStats.storage.used / dashboardStats.storage.quota) * 100
                      : 0
                  }
                  color="teal"
                  size="xl"
                  radius="md"
                  striped
                  animated
                />

                <Group mt="md" gap="xl" grow>
                  <Paper p="xs" radius="sm" withBorder style={{ textAlign: "center" }}>
                    <Text size="xl" fw={800} style={{ color: "#228be6" }}>{totalCount}</Text>
                    <Text size="xs" c="dimmed">Partages Actifs</Text>
                  </Paper>
                  <Paper p="xs" radius="sm" withBorder style={{ textAlign: "center" }}>
                    <Text size="xl" fw={800} style={{ color: "#fd7e14" }}>{folders.length}</Text>
                    <Text size="xs" c="dimmed">Dossiers</Text>
                  </Paper>
                </Group>
              </Box>
            </Paper>

            {/* Custom Responsive SVG Activity Graph */}
            <Paper p="md" radius="md" withBorder>
              <Title order={5} mb="xs" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TbActivity size={18} style={{ color: "#12b886" }} />
                Activité des 7 derniers jours
              </Title>

              {/* Chart Legend */}
              <Group gap="md" mb="md" justify="flex-end">
                <Group gap={6}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#14c896" }} />
                  <Text size="xs" c="dimmed">Ajout Fichiers (Uploads)</Text>
                </Group>
                <Group gap={6}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#228be6" }} />
                  <Text size="xs" c="dimmed">Téléchargements</Text>
                </Group>
              </Group>

              {/* Custom SVG Drawing Area */}
              <Box style={{ width: "100%", height: "135px" }}>
                <svg viewBox="0 0 500 135" width="100%" height="100%" style={{ overflow: "visible" }}>
                  <defs>
                    <linearGradient id="gradientUploads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14c896" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#14c896" stopOpacity="0"/>
                    </linearGradient>
                    <linearGradient id="gradientDownloads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#228be6" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#228be6" stopOpacity="0"/>
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  <line x1="0" y1="20" x2="480" y2="20" stroke={isDark ? "#2d3748" : "#e5e7eb"} strokeWidth="1" strokeDasharray="4,4" />
                  <line x1="0" y1="65" x2="480" y2="65" stroke={isDark ? "#2d3748" : "#e5e7eb"} strokeWidth="1" strokeDasharray="4,4" />
                  <line x1="0" y1="110" x2="480" y2="110" stroke={isDark ? "#2d3748" : "#e5e7eb"} strokeWidth="1" />

                  {/* SVG Paths for Area & Lines */}
                  {(() => {
                    const paddingX = 70;
                    const chartH = 90; // height from 20 to 110
                    const startY = 110;

                    // Calculate point arrays
                    const pointsUploads = dashboardStats.chartData.map((d, i) => {
                      const x = i * paddingX + 20;
                      const y = startY - (d.uploads / chartMax) * chartH;
                      return { x, y };
                    });

                    const pointsDownloads = dashboardStats.chartData.map((d, i) => {
                      const x = i * paddingX + 20;
                      const y = startY - (d.downloads / chartMax) * chartH;
                      return { x, y };
                    });

                    // Build SVG path commands
                    const lineUploads = pointsUploads.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
                    const areaUploads = `${lineUploads} L ${pointsUploads[pointsUploads.length - 1].x} ${startY} L ${pointsUploads[0].x} ${startY} Z`;

                    const lineDownloads = pointsDownloads.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
                    const areaDownloads = `${lineDownloads} L ${pointsDownloads[pointsDownloads.length - 1].x} ${startY} L ${pointsDownloads[0].x} ${startY} Z`;

                    return (
                      <>
                        {/* Area Gradients */}
                        <path d={areaUploads} fill="url(#gradientUploads)" />
                        <path d={areaDownloads} fill="url(#gradientDownloads)" />

                        {/* Line Strokes */}
                        <path d={lineUploads} fill="none" stroke="#14c896" strokeWidth="2.5" className="glow-chart-uploads" />
                        <path d={lineDownloads} fill="none" stroke="#228be6" strokeWidth="2.5" className="glow-chart-line" />

                        {/* Interactive Nodes and Text labels */}
                        {dashboardStats.chartData.map((d, i) => {
                          const x = i * paddingX + 20;
                          return (
                            <g key={i}>
                              {/* Dots for uploads */}
                              <circle cx={x} cy={pointsUploads[i].y} r="3.5" fill="#14c896" />
                              {/* Dots for downloads */}
                              <circle cx={x} cy={pointsDownloads[i].y} r="3.5" fill="#228be6" />

                              {/* Tooltip value on hover simulated by standard title */}
                              <title>{`${d.label}: ${d.uploads} uploads, ${d.downloads} downloads`}</title>

                              {/* X Axis labels */}
                              <text x={x} y="127" fontSize="10" fill="#8b949e" textAnchor="middle" fontWeight="600">
                                {d.label.substring(0, 3)}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </Box>
            </Paper>
          </SimpleGrid>

          {/* Popular Shares & Recent Activity Timeline */}
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
            {/* Popular Shares Table */}
            <Paper p="md" radius="md" withBorder>
              <Title order={5} mb="sm" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TbStar size={18} style={{ color: "#f59f00" }} />
                Partages Populaires (Top Vues)
              </Title>

              {dashboardStats.popularShares.length === 0 ? (
                <Text size="sm" c="dimmed" py="xl" style={{ textAlign: "center" }}>
                  Aucun partage classé populaire. Envoyez vos premiers fichiers !
                </Text>
              ) : (
                <Box style={{ overflowX: "auto" }}>
                  <Table verticalSpacing="xs">
                    <thead>
                      <tr>
                        <th>Nom / ID</th>
                        <th>Vues</th>
                        <th>Date de création</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardStats.popularShares.map((share) => (
                        <tr key={share.id}>
                          <td>
                            <Text size="sm" fw={600} lineClamp={1}>
                              {share.name || share.id}
                            </Text>
                          </td>
                          <td>
                            <Badge color="yellow" variant="light">{share.views} vues</Badge>
                          </td>
                          <td>
                            <Text size="xs" c="dimmed">
                              {moment(share.createdAt).format("LL")}
                            </Text>
                          </td>
                          <td>
                            <Group gap={4} justify="flex-end">
                              <Tooltip label="Copier le lien">
                                <ActionIcon
                                  size="sm"
                                  color="blue"
                                  variant="light"
                                  onClick={() => {
                                    clipboard.copy(`${window.location.origin}/s/${share.id}`);
                                    toast.success(t("common.notify.copied-link"));
                                  }}
                                >
                                  <TbLink size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Analyses">
                                <Link href={`/share/${share.id}/analytics`}>
                                  <ActionIcon size="sm" color="teal" variant="light">
                                    <TbChartBar size={14} />
                                  </ActionIcon>
                                </Link>
                              </Tooltip>
                            </Group>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Box>
              )}
            </Paper>

            {/* Timeline for Recent Activity */}
            <Paper p="md" radius="md" withBorder>
              <Title order={5} mb="sm" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TbClock size={18} style={{ color: "#be4bdb" }} />
                Activité Récente
              </Title>

              {dashboardStats.recentActivity.length === 0 ? (
                <Text size="sm" c="dimmed" py="xl" style={{ textAlign: "center" }}>
                  Aucune activité récente pour le moment.
                </Text>
              ) : (
                <Stack gap="xs" style={{ maxHeight: "250px", overflowY: "auto", paddingRight: "4px" }}>
                  {dashboardStats.recentActivity.map((act) => {
                    const isUpload = act.type === "upload";
                    const relativeTime = moment(act.timestamp).fromNow();
                    return (
                      <Group
                        key={act.id}
                        p="xs"
                        wrap="nowrap"
                        style={{
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}`,
                          borderRadius: "6px",
                          backgroundColor: isDark ? "rgba(13,15,23,0.3)" : "#ffffff",
                        }}
                      >
                        <Box
                          p={6}
                          style={{
                            borderRadius: "50%",
                            backgroundColor: isUpload ? "rgba(20,200,150,0.15)" : "rgba(34,139,230,0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isUpload ? (
                            <TbUpload size={14} style={{ color: "#14c896" }} />
                          ) : (
                            <TbDownload size={14} style={{ color: "#228be6" }} />
                          )}
                        </Box>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Group justify="space-between" gap="sm">
                            <Text size="xs" fw={700}>
                              {act.title}
                            </Text>
                            <Text size="9px" c="dimmed">
                              {relativeTime}
                            </Text>
                          </Group>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {act.description}
                          </Text>
                        </div>
                      </Group>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </SimpleGrid>
        </Stack>
      )}

      {/* TAB 2: FOLDERS & FILES GRID (FEAT-021) */}
      {activeTab === "folders" && (
        <>
          {/* Folders Header & Action */}
          <Group justify="space-between" align="center" mb="md">
            <Text fw={600} size="md" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Vos Dossiers
            </Text>
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<TbFolderPlus size={14} />}
              onClick={() => setShowCreateFolder(true)}
            >
              Nouveau dossier
            </Button>
          </Group>

          {/* Folders Selection Bar */}
          <SimpleGrid cols={{ base: 1, sm: 3, md: 4 }} spacing="sm" mb={30}>
            {/* All Shares Tab */}
            <Card
              p="sm"
              radius="md"
              className={`folder-card ${selectedFolderId === "all" ? "active" : ""}`}
              onClick={() => setSelectedFolderId("all")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleMoveShare((window as any).draggedShareId, null)}
            >
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <TbFolderOpen size={20} style={{ color: "#8b949e" }} />
                  <Text fw={600} size="sm">Tous les partages</Text>
                </Group>
                <Badge color="gray" variant="light">{totalCount}</Badge>
              </Group>
            </Card>

            {/* Uncategorized Tab */}
            <Card
              p="sm"
              radius="md"
              className={`folder-card ${selectedFolderId === "unassigned" ? "active" : ""}`}
              onClick={() => setSelectedFolderId("unassigned")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleMoveShare((window as any).draggedShareId, null)}
            >
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <TbFolder size={20} style={{ color: "#d1d5db" }} />
                  <Text fw={600} size="sm">Non classés</Text>
                </Group>
                <Badge color="yellow" variant="light">{unassignedCount}</Badge>
              </Group>
            </Card>

            {/* User custom folders */}
            {folders.map((folder) => {
              const IconComponent = ICON_MAPPING[folder.icon || "TbFolder"] || TbFolder;
              const isShared = folder.creatorId !== currentUser?.id;
              const folderColorValue = COLORS.find((c) => c.name === folder.color)?.value || "#228be6";

              return (
                <Card
                  key={folder.id}
                  p="sm"
                  radius="md"
                  className={`folder-card ${selectedFolderId === folder.id ? "active" : ""}`}
                  onClick={() => setSelectedFolderId(folder.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleMoveShare((window as any).draggedShareId, folder.id)}
                >
                  <Group justify="space-between" align="center" mb={4}>
                    <Group gap="xs" style={{ overflow: "hidden", flex: 1 }}>
                      <IconComponent size={20} style={{ color: folderColorValue, flexShrink: 0 }} />
                      <Text fw={600} size="sm" lineClamp={1}>
                        {folder.name}
                      </Text>
                    </Group>
                    <Badge color={folder.color || "blue"} variant="light">
                      {folderCounts[folder.id] || 0}
                    </Badge>
                  </Group>

                  <Group justify="space-between" mt="xs">
                    {isShared ? (
                      <Badge size="xs" color="violet" variant="outline">
                        Collab: {folder.creator?.username}
                      </Badge>
                    ) : (
                      <Badge size="xs" color="teal" variant="light">
                        Perso
                      </Badge>
                    )}

                    {!isShared && (
                      <Group gap={4}>
                        <Tooltip label="Collaborateurs">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="indigo"
                            onClick={(e) => handleOpenShareFolder(folder, e)}
                          >
                            <TbFolderShare size={12} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Modifier">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="orange"
                            onClick={(e) => handleOpenEditFolder(folder, e)}
                          >
                            <TbEdit size={12} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Supprimer">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={(e) => handleDeleteFolder(folder, e)}
                          >
                            <TbTrash size={12} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    )}
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>

          {/* Main Shares Table */}
          {shares.length == 0 ? (
            <Center style={{ height: "40vh" }}>
              <Stack align="center" gap={10}>
                <Title order={3}>
                  <FormattedMessage id="account.shares.title.empty" />
                </Title>
                <Text>
                  <FormattedMessage id="account.shares.description.empty" />
                </Text>
                <Space h={5} />
                <Button component={Link} href="/upload" variant="light">
                  <FormattedMessage id="account.shares.button.create" />
                </Button>
              </Stack>
            </Center>
          ) : displayedShares.length === 0 ? (
            <Paper
              p="xl"
              radius="md"
              style={{
                textAlign: "center",
                backgroundColor: isDark ? "rgba(13, 15, 23, 0.4)" : "rgba(0, 0, 0, 0.01)",
                border: "1px dashed rgba(148, 163, 184, 0.2)",
              }}
            >
              <Text c="dimmed">Aucun partage dans cette catégorie. Faites-y glisser des fichiers pour les classer !</Text>
            </Paper>
          ) : (
            <Box style={{ display: "block", overflowX: "auto" }}>
              <Table>
                <thead>
                  <tr>
                    <th>
                      <FormattedMessage id="account.shares.table.id" />
                    </th>
                    <th>
                      <FormattedMessage id="account.shares.table.name" />
                    </th>
                    <th>Dossier</th>
                    <th>
                      <FormattedMessage id="account.shares.table.visitors" />
                    </th>
                    <th>
                      <FormattedMessage id="account.shares.table.expiresAt" />
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedShares.map((share) => {
                    const folder = folders.find((f) => f.id === share.folderId);
                    const isCollaborative = folder && folder.creatorId !== currentUser?.id;

                    return (
                      <tr
                        key={share.id}
                        className="draggable-row"
                        draggable={true}
                        onDragStart={() => {
                          (window as any).draggedShareId = share.id;
                        }}
                      >
                        <td>
                          <Group gap="xs">
                            {share.id}{" "}
                            {share.security.passwordProtected && (
                              <TbLock
                                color="orange"
                                title={t("account.shares.table.password-protected")}
                              />
                            )}
                            {share.security.burnAfterReading && (
                              <TbFlame
                                color="red"
                                title={t(
                                  "upload.modal.accordion.security.burn-after-reading.label",
                                )}
                              />
                            )}
                          </Group>
                        </td>
                        <td>{share.name}</td>
                        <td>
                          {folder ? (
                            <Badge
                              color={folder.color || "blue"}
                              variant={isCollaborative ? "outline" : "light"}
                            >
                              {folder.name}
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">Non classé</Text>
                          )}
                        </td>
                        <td>
                          {share.security.maxViews ? (
                            <FormattedMessage
                              id="account.shares.table.visitor-count"
                              values={{
                                count: share.views,
                                max: share.security.maxViews,
                              }}
                            />
                          ) : (
                            share.views
                          )}
                        </td>
                        <td>
                          {moment(share.expiration).unix() === 0 ? (
                            <FormattedMessage id="account.shares.table.expiry-never" />
                          ) : (
                            moment(share.expiration).format("LLL")
                          )}
                        </td>
                        <td>
                          <Group justify="flex-end">
                            {/* Mobile / Accessibility Move Share Dropdown */}
                            <Menu shadow="md" width={200}>
                              <Menu.Target>
                                <Tooltip label="Déplacer vers un dossier">
                                  <ActionIcon color="victoria" variant="outline" size={25}>
                                    <TbArrowRight size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Menu.Target>

                              <Menu.Dropdown>
                                <Menu.Label>Déplacer vers...</Menu.Label>
                                <Menu.Item
                                  leftSection={<TbFolder size={14} />}
                                  onClick={() => handleMoveShare(share.id, null)}
                                >
                                  Non classé
                                </Menu.Item>
                                {folders.map((f) => (
                                  <Menu.Item
                                    key={f.id}
                                    leftSection={
                                      <span
                                        style={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: "50%",
                                          backgroundColor: COLORS.find((c) => c.name === f.color)?.value || "#228be6",
                                        }}
                                      />
                                    }
                                    onClick={() => handleMoveShare(share.id, f.id)}
                                  >
                                    {f.name}
                                  </Menu.Item>
                                ))}
                              </Menu.Dropdown>
                            </Menu>

                            <Link href={`/share/${share.id}/analytics`}>
                              <ActionIcon
                                color="teal"
                                variant="light"
                                size={25}
                                title="Statistiques & Analyses"
                              >
                                <TbChartBar />
                              </ActionIcon>
                            </Link>
                            <Link href={`/share/${share.id}/edit`}>
                              <ActionIcon color="orange" variant="light" size={25}>
                                <TbEdit />
                              </ActionIcon>
                            </Link>
                            <ActionIcon
                              color="blue"
                              variant="light"
                              size={25}
                              onClick={() => {
                                showShareInformationsModal(
                                  modals,
                                  share,
                                  parseInt(config.get("share.maxSize")),
                                );
                              }}
                            >
                              <TbInfoCircle />
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
                              color="red"
                              variant="light"
                              size={25}
                              onClick={() => {
                                modals.openConfirmModal({
                                  title: t("account.shares.modal.delete.title", {
                                    share: share.id,
                                  }),
                                  children: (
                                    <Text size="sm">
                                      <FormattedMessage id="account.shares.modal.delete.description" />
                                    </Text>
                                  ),
                                  confirmProps: {
                                    color: "red",
                                  },
                                  labels: {
                                    confirm: t("common.button.delete"),
                                    cancel: t("common.button.cancel"),
                                  },
                                  onConfirm: async () => {
                                    try {
                                      await shareService.remove(share.id);
                                      setShares(
                                        shares.filter((item) => item.id !== share.id),
                                      );
                                    } catch (e) {
                                      toast.axiosError(e);
                                    }
                                  },
                                });
                              }}
                            >
                              <TbTrash />
                            </ActionIcon>
                          </Group>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Box>
          )}
        </>
      )}

      {/* Create / Edit Folder Modal */}
      <Modal
        opened={showCreateFolder}
        onClose={handleCloseFolderModal}
        title={editingFolder ? "Modifier le dossier" : "Créer un dossier personnalisé"}
        radius="md"
      >
        <Stack gap="md">
          <TextInput
            label="Nom du dossier"
            placeholder="Projets, Clients, Privé..."
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            required
          />

          <div>
            <Text size="sm" fw={500} mb="xs">Couleur personnalisée</Text>
            <Group gap="xs">
              {COLORS.map((c) => (
                <Tooltip key={c.name} label={c.label}>
                  <div
                    className="color-dot"
                    style={{ backgroundColor: c.value }}
                    onClick={() => setFolderColor(c.name)}
                  >
                    {folderColor === c.name && <TbCheck size={14} color="#ffffff" />}
                  </div>
                </Tooltip>
              ))}
            </Group>
          </div>

          <div>
            <Text size="sm" fw={500} mb="xs">Icône personnalisée</Text>
            <SimpleGrid cols={4} spacing="xs">
              {Object.keys(ICON_MAPPING).map((iconKey) => {
                const IconComponent = ICON_MAPPING[iconKey];
                return (
                  <div
                    key={iconKey}
                    className={`icon-select-btn ${folderIcon === iconKey ? "active" : ""}`}
                    onClick={() => setFolderIcon(iconKey)}
                  >
                    <IconComponent size={20} />
                  </div>
                );
              })}
            </SimpleGrid>
          </div>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleCloseFolderModal}>
              Annuler
            </Button>
            <Button onClick={handleCreateOrUpdateFolder}>
              {editingFolder ? "Enregistrer" : "Créer"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Share / Collaboration Modal */}
      <Modal
        opened={showShareFolder}
        onClose={() => {
          setShowShareFolder(false);
          setSharingFolder(null);
          setInvitee("");
        }}
        title={`Collaboration - Dossier "${sharingFolder?.name}"`}
        radius="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Partagez ce dossier avec d'autres utilisateurs pour leur permettre de voir et d'y insérer des partages !
          </Text>

          <Group align="flex-end">
            <TextInput
              label="Inviter un collaborateur"
              placeholder="Nom d'utilisateur ou e-mail"
              value={invitee}
              onChange={(e) => setInvitee(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={handleInviteCollaborator}>Inviter</Button>
          </Group>

          <Space h={5} />
          <Text size="sm" fw={600}>Collaborateurs actifs</Text>
          
          {sharingFolder?.accesses?.length === 0 ? (
            <Text size="xs" c="dimmed">Aucun collaborateur pour le moment.</Text>
          ) : (
            <Stack gap="xs">
              {sharingFolder?.accesses?.map((access) => (
                <Group key={access.id} justify="space-between" p="xs" style={{
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}`,
                  borderRadius: "6px"
                }}>
                  <div>
                    <Text size="sm" fw={500}>{access.user.username}</Text>
                    <Text size="xs" c="dimmed">{access.user.email}</Text>
                  </div>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleRemoveCollaborator(access.userId)}
                  >
                    <TbTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      </Modal>
    </>
  );
};

export default MyShares;
