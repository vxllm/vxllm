import { createFileRoute } from "@tanstack/react-router";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vxllm/ui/components/tabs";

import { ApiKeysTable } from "@/components/settings/api-keys-table";
import { CreateApiKeyDialog } from "@/components/settings/create-api-key-dialog";
import { HardwareInfo } from "@/components/settings/hardware-info";
import { LoadedModels } from "@/components/settings/loaded-models";
import { ServerConfigForm } from "@/components/settings/server-config-form";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Tabs defaultValue="models">
        <TabsList>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="server">Server</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
        </TabsList>
        <TabsContent value="models">
          <LoadedModels />
        </TabsContent>
        <TabsContent value="server">
          <ServerConfigForm />
        </TabsContent>
        <TabsContent value="api-keys">
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">API Keys</h2>
              <CreateApiKeyDialog />
            </div>
            <ApiKeysTable />
          </div>
        </TabsContent>
        <TabsContent value="hardware">
          <HardwareInfo />
        </TabsContent>
      </Tabs>
    </div>
  );
}
