import Head from "next/head";
import useConfig from "../hooks/config.hook";

const Meta = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => {
  const config = useConfig();

  const metaTitle = `${title} - ${config.get("general.appName")}`;

  return (
    <Head>
      <title>{metaTitle}</title>
      <meta property="og:title" content={metaTitle} />
      <meta
        property="og:description"
        content={
          description ?? "Your premium, fast, and secure sharing platform."
        }
      />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={description} />
    </Head>
  );
};

export default Meta;
