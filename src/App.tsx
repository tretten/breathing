// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { RoomListPage } from "./pages/RoomListPage";
import { SoloLobbyPage } from "./pages/SoloLobbyPage";
import { SoloRoomPage } from "./pages/SoloRoomPage";
import { TogetherLobbyPage } from "./pages/TogetherLobbyPage";
import { TogetherRoomPage } from "./pages/TogetherRoomPage";
import { AboutPage } from "./pages/AboutPage";

declare const __BUILD_TIME__: string;

// Format build time as short version string
const buildVersion = (() => {
  const date = new Date(__BUILD_TIME__);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${month}${day}.${hours}${minutes}`;
})();

function App() {
  return (
    <AppProvider>
      <div className="app">
        <Routes>
          <Route path="/" element={<RoomListPage />} />
          <Route path="/solo" element={<SoloLobbyPage />} />
          <Route path="/solo/:presetId" element={<SoloRoomPage />} />
          <Route path="/room" element={<TogetherLobbyPage />} />
          <Route path="/room/:presetId" element={<TogetherRoomPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
        <div className="build-version">{buildVersion}</div>
      </div>
    </AppProvider>
  );
}

export default App;
