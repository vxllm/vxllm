import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/models/")({
  component: ModelsPage,
});

function ModelsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Models</h1>
      <p className="text-muted-foreground">Coming soon...</p>
    </div>
  );
}
