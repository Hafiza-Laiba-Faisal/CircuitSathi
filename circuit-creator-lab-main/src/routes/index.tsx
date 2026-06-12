import { createFileRoute } from "@tanstack/react-router";
import { CircuitGame } from "@/components/CircuitGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CircuitSathi — Electronics Learning Game" },
      { name: "description", content: "Learn electronics through five playable circuit-building quests, from Ohm's Law to Kirchhoff's laws." },
      { property: "og:title", content: "CircuitSathi — Electronics Learning Game" },
      { property: "og:description", content: "Build circuits, solve missions and master electronics through five interactive levels." },
    ],
  }),
  component: Index,
});

function Index() {
  return <CircuitGame />;
}
