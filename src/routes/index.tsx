import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "../components/site/LandingPage";

export const Route = createFileRoute("/")({
  component: LandingPage,
});
