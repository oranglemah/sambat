export default function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="https://sambat.xyz/gojohd.jpg" 
            alt="Logo" 
            className="w-10 h-10 rounded-full border-2 border-blue-500 shadow-lg shadow-blue-500/50"
          />
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
