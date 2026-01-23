// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { WelcomeModal } from './components/WelcomeModal';
import { RoomListPage } from './pages/RoomListPage';
import { SoloRoomPage } from './pages/SoloRoomPage';
import { WithFriendsRoomPage } from './pages/WithFriendsRoomPage';

declare const __BUILD_TIME__: string;

// Format build time as short version string
const buildVersion = (() => {
  const date = new Date(__BUILD_TIME__);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}${day}.${hours}${minutes}`;
})();

function AppContent() {
  const { isSetupComplete, completeSetup } = useAppContext();

  if (!isSetupComplete) {
    return <WelcomeModal onComplete={completeSetup} />;
  }

  return (
    <Routes>
      <Route path="/" element={<RoomListPage />} />
      <Route path="/room/solo" element={<SoloRoomPage />} />
      <Route path="/room/with_friends" element={<WithFriendsRoomPage />} />
    </Routes>
  );
}

function App() {
  return (
    <AppProvider>
      <div className="app">
        <AppContent />
        <div className="build-version">{buildVersion}</div>
      </div>
    </AppProvider>
  );
}

export default App;
