import * as React from 'react';

export interface PageHeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center mb-6">
      <h2 className="text-2xl font-bold tracking-tight m-0">{title}</h2>
      {actions && (
        <div className="ms-auto flex items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
