import * as React from "react"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive'
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-card text-foreground border-input",
      destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
    }
    return (
      <div
        ref={ref}
        role="alert"
        className={`relative w-full rounded-lg border p-4 [&>svg~*]:ps-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4 [&>svg]:text-foreground ${variants[variant]} ${className || ''}`}
        {...props}
      />
    )
  }
)
Alert.displayName = "Alert"

export { Alert }
