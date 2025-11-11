"use client";

import {
  Info,
  Trophy,
  Medal,
  Award,
  Flag,
  CircleStar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

export type PerformanceTierKey =
  | "legend"
  | "champion"
  | "contender"
  | "challenger"
  | "rising-runner";

export type PerformanceTierDefinition = {
  key: PerformanceTierKey;
  minPercentage: number;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
};

export const PERFORMANCE_TIERS: PerformanceTierDefinition[] = [
  {
    key: "legend",
    minPercentage: 90,
    label: "Legend (top 10%)",
    description: "Elite performance",
    color: "#723EEB",
    icon: Trophy,
  },
  {
    key: "champion",
    minPercentage: 75,
    label: "Champion (top 25%)",
    description: "You outran most peers",
    color: "#0EA5E9",
    icon: Medal,
  },
  {
    key: "contender",
    minPercentage: 60,
    label: "Contender (top 50%)",
    description: "Above-average pace",
    color: "#10B981",
    icon: Award,
  },
  {
    key: "challenger",
    minPercentage: 40,
    label: "Challenger (top 75%)",
    description: "Right in the mix",
    color: "#F59E0B",
    icon: CircleStar,
  },
  {
    key: "rising-runner",
    minPercentage: 0,
    label: "Rising Runner (bottom 25%)",
    description: "Early in the journey",
    color: "#EF4444",
    icon: Flag,
  },
];

export type PerformanceTierBadgeProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  value: number | string | null | undefined;
  isLoading?: boolean;
};

type TierMatch = PerformanceTierDefinition & { percentage: number };

export const PerformanceTierBadge = forwardRef<
  HTMLDivElement,
  PerformanceTierBadgeProps
>(({ value, isLoading = false, className, ...props }, ref) => {
  if (isLoading) {
    return <Skeleton className="h-9 w-40 rounded-xl" />;
  }

  const tier = resolveTier(value);
  if (!tier) {
    return null;
  }

  const { icon: Icon, description, color, percentage } = tier;

  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(percentage);

  const backgroundColor = hexToRgba(color, 0.12);
  const borderColor = hexToRgba(color, 0.32);
  const accentStyle = { color } as const;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={ref}
          className={cn(
            "group text-foreground inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
            className,
          )}
          style={{
            backgroundColor,
            borderColor,
          }}
          {...props}
        >
          <span className="flex items-center gap-2" style={accentStyle}>
            <Icon className="h-4 w-4" aria-hidden style={accentStyle} />
            <span className="flex items-center gap-1">
              {tier.key}
              <span className="text-xs font-semibold" style={accentStyle}>
                • {formatted}%
              </span>
            </span>
          </span>
          <Info className="h-3.5 w-3.5" aria-hidden style={accentStyle} />
          <span className="sr-only">{description}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs space-y-3">
        <div className="space-y-1 px-3 py-1">
          <p className="text-secondary-foreground/80 mb-2 text-[14px] font-semibold tracking-wide uppercase">
            Tier guide
          </p>
          <ul className="space-y-2 text-sm">
            {PERFORMANCE_TIERS.map((tierDef) => {
              const TierIcon = tierDef.icon;
              return (
                <li key={tierDef.key} className="flex items-start gap-2">
                  <span
                    className="mt-[2px] flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: tierDef.color }}
                    aria-hidden
                  >
                    <TierIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="text-secondary-foreground/90 space-y-0.5">
                    <p className="leading-tight font-medium">{tierDef.label}</p>
                    <p className="text-xs leading-snug">
                      {tierDef.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

PerformanceTierBadge.displayName = "PerformanceTierBadge";

export function resolveTier(
  value: number | string | null | undefined,
): TierMatch | null {
  const percentage = normalisePercentage(value);
  if (percentage === null) return null;

  const tier = PERFORMANCE_TIERS.find(
    (definition) => percentage >= definition.minPercentage,
  );
  if (!tier) {
    return null;
  }

  return { ...tier, percentage };
}

export function normalisePercentage(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    if (Number.isNaN(parsed)) return null;
    return parsed;
  }

  return null;
}

function hexToRgba(hex: string, alpha: number) {
  const normalised = hex.replace("#", "");
  if (normalised.length !== 6) {
    return hex;
  }
  const r = Number.parseInt(normalised.slice(0, 2), 16);
  const g = Number.parseInt(normalised.slice(2, 4), 16);
  const b = Number.parseInt(normalised.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
