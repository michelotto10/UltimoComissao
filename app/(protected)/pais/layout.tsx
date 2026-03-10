export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="background: #0b0f1a; text-zinc-100">
      <div className="max-w-6xl mx-auto p-6">{children}</div>
    </div>
  );
}