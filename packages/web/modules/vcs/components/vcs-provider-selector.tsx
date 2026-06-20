"use client";

import { useState } from "react";
import { Check, GitBranch, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type Provider = "github" | "gitlab" | "bitbucket";

interface ProviderOption {
  id: Provider;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const providers: ProviderOption[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect repositories, review PRs, and track contributions from GitHub.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    color: "hover:border-foreground/30",
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Integrate with GitLab for merge request reviews and project insights.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
      </svg>
    ),
    color: "hover:border-orange-400/50",
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    description: "Connect Bitbucket repositories for pull request analysis.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
        <path d="M.778 1.211c-.119 0-.22.042-.304.126L0 1.815h.003l3.14 18.466c.026.158.117.288.272.36.154.073.32.078.48.016l5.74-2.264-1.598-9.653h9.32l.028.164 2.764 15.83c.026.158.117.288.272.36.154.073.32.078.48.016l5.74-2.264L23.997 1.337a.38.38 0 00-.137-.126.463.463 0 00-.338-.036L.778 1.211zM14.383 15.297l-1.52-9.173h4.162l-1.298 7.952-1.344 1.221z" />
      </svg>
    ),
    color: "hover:border-blue-500/50",
  },
];

interface VCSProviderSelectorProps {
  onSelect?: (provider: Provider) => void;
}

export default function VCSProviderSelector({
  onSelect,
}: VCSProviderSelectorProps) {
  const [selected, setSelected] = useState<Provider | null>(null);

  const handleSelect = (provider: Provider) => {
    setSelected(provider);
    onSelect?.(provider);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {providers.map((provider) => {
        const isSelected = selected === provider.id;

        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => handleSelect(provider.id)}
            className={cn(
              "relative flex flex-col items-start gap-3 rounded-xl border-2 p-6 text-left transition-all",
              "bg-card shadow-sm",
              isSelected
                ? "border-primary ring-2 ring-primary/20"
                : cn("border-border", provider.color),
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {isSelected && (
              <div className="absolute top-3 right-3">
                <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" />
                </div>
              </div>
            )}

            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-lg transition-colors",
                isSelected
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {provider.icon}
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold">{provider.name}</h3>
              <p className="text-sm text-muted-foreground">
                {provider.description}
              </p>
            </div>

            {isSelected && (
              <div className="mt-auto flex items-center gap-2 text-sm font-medium text-primary">
                <GitBranch className="size-4" />
                Connected
              </div>
            )}

            {!isSelected && (
              <div className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="size-4" />
                Connect
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
