import * as React from 'react';
export function Card({ className, ...props }: React.ComponentProps<'div'>) { return <div className={`card ${className ?? ''}`} {...props} />; }
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) { return <div className={`card-header ${className ?? ''}`} {...props} />; }
export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) { return <h3 className={`card-title ${className ?? ''}`} {...props} />; }
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) { return <div className={`card-content ${className ?? ''}`} {...props} />; }
export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) { return <div className={`card-footer ${className ?? ''}`} {...props} />; }
