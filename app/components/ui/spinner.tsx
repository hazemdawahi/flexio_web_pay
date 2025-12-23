import { cn } from "~/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

interface CenterSpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

function CenterSpinner({ className, size = "md" }: CenterSpinnerProps) {
  const sizeClasses = {
    sm: "size-6",
    md: "size-10",
    lg: "size-14",
  }

  return (
    <div className={cn("min-h-[40vh] w-full flex items-center justify-center bg-white", className)}>
      <Spinner className={cn(sizeClasses[size], "text-black")} />
    </div>
  )
}

export { Spinner, CenterSpinner }
