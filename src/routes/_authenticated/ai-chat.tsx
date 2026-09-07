import { createFileRoute } from "@tanstack/react-router";
import { TutorPage } from "./tutor";

export const Route = createFileRoute("/_authenticated/ai-chat")({ component: TutorPage });
