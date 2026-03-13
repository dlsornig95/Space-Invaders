import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import TagBrowser from './pages/TagBrowser';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <nav className="bg-gray-800 px-6 py-3 flex gap-4">
          <span className="font-bold text-lg mr-4">MyLocker</span>
          <NavLink to="/" className={({isActive}) => isActive ? 'text-blue-400' : 'text-gray-300 hover:text-white'}>
            Dashboard
          </NavLink>
          <NavLink to="/map" className={({isActive}) => isActive ? 'text-blue-400' : 'text-gray-300 hover:text-white'}>
            Map
          </NavLink>
          <NavLink to="/tags" className={({isActive}) => isActive ? 'text-blue-400' : 'text-gray-300 hover:text-white'}>
            Tag Browser
          </NavLink>
        </nav>
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/tags" element={<TagBrowser />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App
