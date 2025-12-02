import Navbar from './components/Navbar';
export default function Navbar() {
  return (
    <nav className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-4 sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Gambar Gojo dihapus dari sini */}
          <h1 className="text-xl font-bold text-white tracking-wider">
            MYXL <span className="text-blue-500">WEB</span>
          </h1>
        </div>
        <div className="text-xs text-gray-400 font-mono">
          v8.9.0 (Sunset)
        </div>
      </div>
    </nav>
  );
}
