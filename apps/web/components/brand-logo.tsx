import Image from "next/image"

import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
  imageClassName?: string
  priority?: boolean
  size?: number
}

export function BrandLogo({
  className,
  imageClassName,
  priority = false,
  size = 48,
}: BrandLogoProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/15",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/agentbridge-logo.png"
        alt="AgentBridge logo"
        fill
        className={cn("object-cover", imageClassName)}
        priority={priority}
        sizes={`${size}px`}
      />
    </span>
  )
}
