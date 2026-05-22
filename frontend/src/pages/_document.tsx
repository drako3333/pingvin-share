import { Head, Html, Main, NextScript } from "next/document";
import { ColorSchemeScript } from "@mantine/core";

export default function Document() {
  return (
    <Html>
      <Head>
        <ColorSchemeScript defaultColorScheme="auto" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/x-icon" href="/img/favicon.ico" />
        <link rel="apple-touch-icon" href="/img/icons/icon-128x128.png" />

        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#46509e" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
