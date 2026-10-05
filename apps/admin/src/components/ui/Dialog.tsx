import * as React from 'react';
import { cn } from '../../lib/cn.js';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card.js';

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { onOpenChange(false); }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-lg" onClick={(e) => { e.stopPropagation(); }}>
        <Card className="w-full shadow-lg">
          {children}
        </Card>
      </div>
    </div>
  );
}

export function DialogHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <CardHeader className={className}>{children}</CardHeader>;
}

export function DialogTitle({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <CardTitle className={className}>{children}</CardTitle>;
}

export function DialogContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <CardContent className={className}>{children}</CardContent>;
}

export function DialogFooter({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <CardFooter className={cn("flex justify-end gap-2", className)}>{children}</CardFooter>;
}
