import { Metadata } from "next";
import VCSProviderSelector from "@/modules/vcs/components/vcs-provider-selector";

export const metadata: Metadata = {
  title: "Version Control",
  description: "Connect your Git providers to CodeHorse.",
};

export default function VCSPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Version Control</h1>
        <p className="text-muted-foreground">Connect your Git providers</p>
      </div>
      <VCSProviderSelector />
    </div>
  );
}
