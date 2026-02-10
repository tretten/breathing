// src/pages/RoomListPage.tsx
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useTotalTogetherCount, useContentIndex } from "../hooks";
import { TopBar } from "../components/TopBar";
import { PageFooter } from "../components/PageFooter";
import {
  BreathingIcon,
  MeditationIcon,
  FriendsIcon,
} from "../components/Icons";

export function RoomListPage() {
  const navigate = useNavigate();
  const { language } = useAppContext();
  const { togetherPresets } = useContentIndex();
  const totalTogetherCount = useTotalTogetherCount(togetherPresets);

  const texts =
    language === "en"
      ? {
          title: "Breathing Room",
          subtitle: "Breathe together",
          solo: "Solo",
          soloDesc: "Practice alone",
          withFriends: "Together",
          withFriendsDesc: "Breathe with friends",
        }
      : {
          title: "Breathing Room",
          subtitle: "Дышим вместе",
          solo: "Соло",
          soloDesc: "Практика соло",
          withFriends: "Вместе",
          withFriendsDesc: "Практика вместе",
        };

  return (
    <div className="wrap">
      <TopBar />

      <main className="main">
        <div className="center">
          <header className="hdr">
            <BreathingIcon className="ico" />
            <h1>{texts.title}</h1>
            <p className="subtitle">{texts.subtitle}</p>
          </header>

          <div className="card-grid--row">
            <button type="button" className="card card--lg" onClick={() => navigate("/room")}>
              <FriendsIcon className="card-icon" />
              <span className="card-ttl">{texts.withFriends}</span>
              <p className="card-subtitle">{texts.withFriendsDesc}</p>
              {totalTogetherCount > 0 && (
                <span className="badge">{totalTogetherCount}</span>
              )}
            </button>

            <button
              type="button"
              className="card card--lg"
              onClick={() => navigate("/solo/")}
            >
              <MeditationIcon className="card-icon" />
              <span className="card-ttl">{texts.solo}</span>
              <p className="card-subtitle">{texts.soloDesc}</p>
            </button>
          </div>

          <PageFooter />
        </div>
      </main>
    </div>
  );
}
