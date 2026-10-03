import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/cn.js"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:ps-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-card text-foreground border-input",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant, className }))}
      {...props}
    />
  )
)
Alert.displayName = "Alert"

export { Alert, alertVariants }
