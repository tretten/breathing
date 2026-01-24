// src/pages/RoomListPage.tsx
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useTotalTogetherCount } from "../hooks";
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
  const totalTogetherCount = useTotalTogetherCount();

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
          withFriendsDesc: "Дышать с друзьями",
        };

  return (
    <div className="page-container">
      <TopBar />

      <main className="page-content">
        <div className="content-centered">
          <header className="page-header">
            <BreathingIcon className="page-icon" />
            <h1>{texts.title}</h1>
            <p className="subtitle">{texts.subtitle}</p>
          </header>

          <div className="card-grid--row">
            <button className="card card--lg" onClick={() => navigate("/room")}>
              <FriendsIcon className="card__icon" />
              <span className="card__title">{texts.withFriends}</span>
              <span className="card__subtitle">{texts.withFriendsDesc}</span>
              {totalTogetherCount > 0 && (
                <span className="card__badge">{totalTogetherCount}</span>
              )}
            </button>

            <button
              className="card card--lg"
              onClick={() => navigate("/solo/")}
            >
              <MeditationIcon className="card__icon" />
              <span className="card__title">{texts.solo}</span>
              <span className="card__subtitle">{texts.soloDesc}</span>
            </button>
          </div>

          <PageFooter />
        </div>
      </main>
    </div>
  );
}
