import BottomNav from '@/components/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-400 rounded-full flex items-center justify-center text-sm">⚽</div>
          <span className="font-medium text-sm">Chute Certo</span>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-2">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}