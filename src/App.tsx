// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { WelcomeModal } from './components/WelcomeModal';
import { RoomListPage } from './pages/RoomListPage';
import { SoloRoomPage } from './pages/SoloRoomPage';
import { WithFriendsRoomPage } from './pages/WithFriendsRoomPage';

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
      </div>
    </AppProvider>
  );
}

export default App;
