import { Burger, Button, Group, Text } from "@mantine/core";
import Link from "next/link";
import { Dispatch, SetStateAction } from "react";
import { FormattedMessage } from "react-intl";
import useConfig from "../../../hooks/config.hook";
import Logo from "../../Logo";

const ConfigurationHeader = ({
  isMobileNavBarOpened,
  setIsMobileNavBarOpened,
}: {
  isMobileNavBarOpened: boolean;
  setIsMobileNavBarOpened: Dispatch<SetStateAction<boolean>>;
}) => {
  const config = useConfig();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        padding: "var(--mantine-spacing-md)",
      }}
    >
      <Burger
        opened={isMobileNavBarOpened}
        onClick={() => setIsMobileNavBarOpened((o) => !o)}
        size="sm"
        mr="xl"
        display={{ base: "block", sm: "none" }}
      />
      <Group justify="space-between" w="100%">
        <Link
          href="/"
          passHref
          style={{ display: "flex", alignItems: "center" }}
        >
          <Group>
            <Logo height={35} width={35} />
            <Text fw={600}>{config.get("general.appName")}</Text>
          </Group>
        </Link>
        <Button
          variant="light"
          component={Link}
          href="/admin"
          display={{ base: "none", sm: "block" }}
        >
          <FormattedMessage id="common.button.go-back" />
        </Button>
      </Group>
    </div>
  );
};

export default ConfigurationHeader;
