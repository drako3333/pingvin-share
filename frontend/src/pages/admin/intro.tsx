import {
  Button,
  Center,
  Container,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import Logo from "../../components/Logo";
import Meta from "../../components/Meta";

const Intro = () => {
  return (
    <>
      <Meta title="Intro" />
      <Container size="xs">
        <Stack>
          <Center>
            <Logo height={80} width={80} />
          </Center>
          <Center>
            <Title order={2}>Welcome to Ustrohosting Share</Title>
          </Center>
          <Text>
            Your premium sharing platform is ready. Here you can configure user registrations, SMTP email, S3 providers, reverse shares, security, and more.
          </Text>
          <Text>Enjoy hosting with Ustrohosting Share!</Text>
          <Text mt="lg">How would you like to continue?</Text>
          <Stack>
            <Button href="/admin/config/general" component={Link}>
              Customize configuration
            </Button>
            <Button href="/" component={Link} variant="light">
              Explore Ustrohosting Share
            </Button>
          </Stack>
        </Stack>
      </Container>
    </>
  );
};

export default Intro;
