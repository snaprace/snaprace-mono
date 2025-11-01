"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

// 모바일(터치) 환경에서 클릭으로 토글되도록 제어하기 위한 컨텍스트
type TooltipMobileContextValue = {
  isTouchDevice: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  mobileClick: boolean;
};

const TooltipMobileContext =
  React.createContext<TooltipMobileContextValue | null>(null);

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  mobileClick = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & {
  mobileClick?: boolean;
}) {
  // 터치 디바이스 감지 (SSR 안전)
  const [isTouchDevice, setIsTouchDevice] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const isCoarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(Boolean(isCoarse || hasTouch));
  }, []);

  // 모바일 클릭 모드일 때는 수동 제어
  const [open, setOpen] = React.useState(false);
  const controlledProps =
    isTouchDevice && mobileClick
      ? ({ open, onOpenChange: setOpen } as const)
      : ({} as const);

  return (
    <TooltipProvider>
      <TooltipMobileContext.Provider
        value={{ isTouchDevice, open, setOpen, mobileClick }}
      >
        <TooltipPrimitive.Root
          data-slot="tooltip"
          {...controlledProps}
          {...props}
        />
      </TooltipMobileContext.Provider>
    </TooltipProvider>
  );
}

function TooltipTrigger({
  onClick,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const ctx = React.useContext(TooltipMobileContext);

  if (ctx && ctx.isTouchDevice && ctx.mobileClick) {
    return (
      <TooltipPrimitive.Trigger
        data-slot="tooltip-trigger"
        onClick={(e) => {
          ctx.setOpen(!ctx.open);
          onClick?.(e);
        }}
        {...props}
      />
    );
  }

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onClick={onClick}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const ctx = React.useContext(TooltipMobileContext);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        onPointerDownOutside={(e) => {
          props.onPointerDownOutside?.(e);
          if (ctx && ctx.isTouchDevice && ctx.mobileClick) {
            ctx.setOpen(false);
          }
        }}
        onEscapeKeyDown={(e) => {
          props.onEscapeKeyDown?.(e);
          if (ctx && ctx.isTouchDevice && ctx.mobileClick) {
            ctx.setOpen(false);
          }
        }}
        className={cn(
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md bg-[#eaeff3] px-3 py-1.5 text-xs text-balance text-[#040c13]",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-[#eaeff3] fill-[#eaeff3]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
