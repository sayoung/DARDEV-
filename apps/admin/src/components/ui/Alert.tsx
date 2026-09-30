import * as React from "react"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive'
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-white text-gray-900 border-gray-200",
      destructive: "border-red-500/50 text-red-600 dark:border-red-500 [&>svg]:text-red-600",
    }
    return (
      <div
        ref={ref}
        role="alert"
        className={`relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-gray-950 ${variants[variant]} ${className || ''}`}
        {...props}
      />
    )
  }
)
Alert.displayName = "Alert"

export { Alert }
