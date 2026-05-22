import { Center, Grid, Paper, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TbChartBar,
  TbLink,
  TbListDetails,
  TbRefresh,
  TbSettings,
  TbUsers,
} from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import useTranslate from "../../hooks/useTranslate.hook";
import configService from "../../services/config.service";
import classes from "./index.module.css";

const Admin = () => {
  const t = useTranslate();

  const [managementOptions, setManagementOptions] = useState([
    {
      title: t("admin.button.users"),
      icon: TbUsers,
      route: "/admin/users",
    },
    {
      title: t("admin.button.shares"),
      icon: TbLink,
      route: "/admin/shares",
    },
    {
      title: t("analytics.title"),
      icon: TbChartBar,
      route: "/admin/analytics",
    },
    {
      title: t("analytics.logs-audit"),
      icon: TbListDetails,
      route: "/admin/audit-logs",
    },
    {
      title: t("admin.button.config"),
      icon: TbSettings,
      route: "/admin/config/general",
    },
  ]);

  useEffect(() => {
    configService
      .isNewReleaseAvailable()
      .then((isNewReleaseAvailable) => {
        if (isNewReleaseAvailable) {
          setManagementOptions([
            ...managementOptions,
            {
              title: "Update",
              icon: TbRefresh,
              route:
                "https://github.com/stonith404/pingvin-share/releases/latest",
            },
          ]);
        }
      })
      .catch();
  }, []);

  return (
    <>
      <Meta title={t("admin.title")} />
      <Title mb={20} order={3}>
        <FormattedMessage id="admin.title" />
      </Title>

      <Stack justify="space-between">
        <Paper withBorder p={30}>
          <Grid>
            {managementOptions.map((item) => {
              return (
                <Grid.Col span={{ base: 12, xs: 6 }} key={item.route}>
                  <Paper
                    withBorder
                    component={Link}
                    href={item.route}
                    key={item.title}
                    className={classes.item}
                  >
                    <item.icon
                      color="var(--mantine-color-victoria-8)"
                      size={30}
                    />
                    <Text mt={7}>{item.title}</Text>
                  </Paper>
                </Grid.Col>
              );
            })}
          </Grid>
        </Paper>

        <Center mt={20}>
          <Text size="xs" c="dimmed">
            <FormattedMessage id="admin.version" /> {process.env.VERSION}
          </Text>
        </Center>
      </Stack>
    </>
  );
};

export default Admin;
