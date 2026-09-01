import type { ReactNode } from 'react';

type SkeletonProps = {
  className?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
};

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

export function Skeleton({ className = '', rounded = 'md' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${ROUNDED[rounded]} ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
          rounded="md"
        />
      ))}
    </div>
  );
}

function DashPageWrap({ children }: { children: ReactNode }) {
  return (
    <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
      <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28">
        {children}
      </div>
    </main>
  );
}

export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8" aria-hidden="true">
      <div className="space-y-3 flex-1">
        <Skeleton className="h-8 w-48 md:w-64" rounded="lg" />
        <Skeleton className="h-4 w-full max-w-xl" rounded="md" />
        <Skeleton className="h-4 w-2/3 max-w-lg" rounded="md" />
      </div>
      {withAction && <Skeleton className="h-11 w-40 shrink-0" rounded="xl" />}
    </div>
  );
}

export function EventsGridSkeleton() {
  return (
    <DashPageWrap>
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dash-stat-card space-y-3">
            <Skeleton className="h-3 w-20" rounded="md" />
            <Skeleton className="h-8 w-12" rounded="lg" />
          </div>
        ))}
      </div>
      <Skeleton className="h-12 w-full mb-4" rounded="2xl" />
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20" rounded="full" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="dash-event-card overflow-hidden">
            <Skeleton className="aspect-[16/9] w-full" rounded="none" />
            <div className="p-5 space-y-4">
              <Skeleton className="h-6 w-3/4" rounded="lg" />
              <Skeleton className="h-4 w-1/2" rounded="md" />
              <Skeleton className="h-10 w-full" rounded="xl" />
              <Skeleton className="h-10 w-full" rounded="xl" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-7 w-20" rounded="full" />
                <Skeleton className="h-9 w-28" rounded="xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashPageWrap>
  );
}

export function PublicationPanelSkeleton() {
  return (
    <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
      <div className="relative z-10 max-w-5xl mx-auto px-gutter pb-12 pt-24 md:pt-28">
        <PageHeaderSkeleton withAction={false} />
        <div className="app-card rounded-2xl overflow-hidden" aria-hidden="true">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
            <Skeleton className="aspect-[16/10] lg:min-h-[420px] w-full" rounded="none" />
            <div className="p-6 md:p-8 space-y-5 border-t lg:border-t-0 lg:border-l border-[var(--md-border)]">
              <Skeleton className="h-3 w-32" rounded="md" />
              <SkeletonText lines={3} />
              <Skeleton className="h-16 w-full" rounded="xl" />
              <Skeleton className="h-10 w-full" rounded="xl" />
              <div className="flex gap-3 pt-4">
                <Skeleton className="h-11 flex-1" rounded="xl" />
                <Skeleton className="h-11 flex-1" rounded="xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function TablePageSkeleton({
  rows = 6,
  kpiCount = 0,
  showFilters = true,
  className = '',
}: {
  rows?: number;
  kpiCount?: number;
  showFilters?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-6 ${className}`} aria-busy="true" aria-label="Chargement">
      {kpiCount > 0 && (
        <div className={`grid gap-4 grid-cols-2 ${kpiCount > 2 ? 'lg:grid-cols-4' : 'md:grid-cols-2'}`}>
          {Array.from({ length: kpiCount }).map((_, i) => (
            <div key={i} className="dash-stat-card flex items-center gap-4">
              <Skeleton className="h-14 w-14 shrink-0" rounded="full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" rounded="md" />
                <Skeleton className="h-6 w-16" rounded="lg" />
              </div>
            </div>
          ))}
        </div>
      )}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-11 flex-1 max-w-md" rounded="xl" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-24" rounded="xl" />
            ))}
          </div>
        </div>
      )}
      <div className="app-card rounded-2xl overflow-hidden p-1">
        <div className="border-b border-[var(--md-border)] px-4 py-3 flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" rounded="md" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, row) => (
          <div
            key={row}
            className="px-4 py-4 flex items-center gap-4 border-b border-[var(--md-border)] last:border-0"
          >
            <Skeleton className="h-4 w-4 shrink-0" rounded="sm" />
            <Skeleton className="h-4 flex-1" rounded="md" />
            <Skeleton className="h-4 w-24 hidden sm:block" rounded="md" />
            <Skeleton className="h-8 w-20" rounded="lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanningSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement du planning">
      <div className="flex justify-between items-end gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" rounded="lg" />
          <Skeleton className="h-4 w-64" rounded="md" />
        </div>
        <Skeleton className="h-11 w-40" rounded="xl" />
      </div>
      <Skeleton className="h-11 w-full max-w-md" rounded="xl" />
      <div className="app-card rounded-2xl p-4 overflow-x-auto">
        <div className="min-w-[800px] space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-32 shrink-0" rounded="lg" />
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 flex-1" rounded="lg" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="flex gap-2 items-center">
              <Skeleton className="h-12 w-32 shrink-0" rounded="lg" />
              <Skeleton className="h-12 flex-1" rounded="lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FinanceSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement des finances">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-56" rounded="lg" />
        <Skeleton className="h-10 w-48" rounded="xl" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="app-card rounded-2xl p-6 space-y-4">
          <Skeleton className="h-5 w-32" rounded="md" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton className="h-4 flex-1" rounded="md" />
              <Skeleton className="h-4 w-20" rounded="md" />
            </div>
          ))}
        </div>
        <div className="app-card rounded-2xl p-6 space-y-4">
          <Skeleton className="h-5 w-32" rounded="md" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton className="h-4 flex-1" rounded="md" />
              <Skeleton className="h-4 w-20" rounded="md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicEventsListSkeleton() {
  return (
    <div className="landing-page min-h-screen" aria-busy="true" aria-label="Chargement">
      <section className="relative pt-20 pb-10 px-gutter">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-10">
          <Skeleton className="h-4 w-32 mx-auto" rounded="full" />
          <Skeleton className="h-12 w-full max-w-lg mx-auto" rounded="xl" />
          <Skeleton className="h-5 w-full max-w-xl mx-auto" rounded="md" />
        </div>
        <Skeleton className="h-14 w-full max-w-4xl mx-auto" rounded="2xl" />
      </section>
      <div className="px-gutter flex flex-wrap justify-center gap-2 mb-10">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" rounded="full" />
        ))}
      </div>
      <div className="px-gutter pb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-container-max mx-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="landing-event-card overflow-hidden">
            <Skeleton className="aspect-[16/10] w-full" rounded="none" />
            <div className="p-5 space-y-3">
              <Skeleton className="h-6 w-4/5" rounded="lg" />
              <SkeletonText lines={2} />
              <Skeleton className="h-10 w-full" rounded="xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicEventLandingSkeleton() {
  return (
    <div className="landing-page min-h-screen px-gutter py-8" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-10 w-44 mb-8" rounded="full" />
      <Skeleton className="aspect-[21/9] w-full max-w-5xl mx-auto mb-8" rounded="2xl" />
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-2/3" rounded="xl" />
        <SkeletonText lines={4} />
        <div className="grid md:grid-cols-3 gap-4 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" rounded="2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="app-shell flex min-h-screen" aria-busy="true" aria-label="Chargement">
      <aside className="hidden md:flex w-60 app-sidebar border-r flex-col p-4 gap-4 shrink-0">
        <Skeleton className="h-8 w-32" rounded="lg" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" rounded="lg" />
        ))}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <Skeleton className="h-14 w-full shrink-0" rounded="none" />
        <div className="flex-1 p-6 space-y-6">
          <PageHeaderSkeleton />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="dash-event-card overflow-hidden">
                <Skeleton className="aspect-[16/9] w-full" rounded="none" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" rounded="lg" />
                  <Skeleton className="h-4 w-1/2" rounded="md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthCardSkeleton() {
  return (
    <div className="space-y-5 py-4" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-10 w-full" rounded="xl" />
      <Skeleton className="h-10 w-full" rounded="xl" />
      <Skeleton className="h-11 w-full" rounded="xl" />
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="app-card rounded-xl p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-40" rounded="lg" />
            <Skeleton className="h-4 w-24" rounded="md" />
          </div>
          <SkeletonText lines={2} />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-24" rounded="lg" />
            <Skeleton className="h-9 w-24" rounded="lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ModalSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-6 w-1/2" rounded="lg" />
      <Skeleton className="h-10 w-full" rounded="xl" />
      <Skeleton className="h-10 w-full" rounded="xl" />
      <Skeleton className="h-24 w-full" rounded="xl" />
    </div>
  );
}

export function InlineListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="app-card rounded-2xl overflow-hidden" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-[var(--md-border)] last:border-0">
          <Skeleton className="h-4 flex-1" rounded="md" />
          <Skeleton className="h-4 w-16" rounded="md" />
        </div>
      ))}
    </div>
  );
}
