import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "../components/site/PrivacyPage";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});
