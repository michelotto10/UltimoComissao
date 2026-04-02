export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="background: #0b0f1a; text-zinc-100">
      <div className="w-full min-h-screen bg-[#0b0f1a] px-10 py-8">{children}</div>
    </div>
  );
}