import { Button, Center, Stack, TextInput } from "@mantine/core";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import { TbDownload } from "react-icons/tb";
import { translateOutsideContext } from "../../hooks/useTranslate.hook";

const showShareLinkModal = (modals: ModalsContextProps, shareId: string) => {
  const t = translateOutsideContext();
  const link = `${window.location.origin}/s/${shareId}`;
  const qrCodeUrl = `/api/shares/${shareId}/qrcode`;

  const downloadQrCode = () => {
    const a = document.createElement("a");
    a.href = qrCodeUrl;
    a.download = `qrcode-${shareId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return modals.openModal({
    title: t("account.shares.modal.share-link"),
    children: (
      <Stack align="stretch" spacing="md">
        <TextInput variant="filled" value={link} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
        <Center>
          <div style={{
            padding: 16,
            borderRadius: 12,
            background: "#fff",
            boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.05)",
          }}>
            <img
              src={qrCodeUrl}
              alt="QR Code"
              style={{ width: 180, height: 180, display: "block" }}
            />
          </div>
        </Center>
        <Center>
          <Button
            leftIcon={<TbDownload size={16} />}
            variant="subtle"
            size="xs"
            onClick={downloadQrCode}
          >
            Télécharger le QR Code
          </Button>
        </Center>
      </Stack>
    ),
  });
};

export default showShareLinkModal;
