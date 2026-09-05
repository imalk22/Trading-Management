export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">This part of the platform is coming in a later phase.</p>
    </main>
  );
}
