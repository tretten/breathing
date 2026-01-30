// src/components/ParticipantList.tsx
// ============================================================================
// Participant List with Status Dots
// ============================================================================

import type { VoiceChatParticipant } from '../types';
import { getNameFromIndices, type NameIndices } from '../utils/randomNames';

interface ParticipantListProps {
  participants: VoiceChatParticipant[];
  currentClientId: string;
  language: 'en' | 'ru';
}

type StatusType = 'offline' | 'online' | 'voice' | 'ready' | 'speaking' | 'muted';

function getParticipantStatus(
  participant: VoiceChatParticipant
): StatusType {
  if (participant.isMuted && participant.isVoiceEnabled) {
    return 'muted';
  }
  if (participant.isSpeaking) {
    return 'speaking';
  }
  if (participant.isReady) {
    return 'ready';
  }
  if (participant.isVoiceEnabled) {
    return 'voice';
  }
  return 'online';
}

function StatusDot({ status }: { status: StatusType }) {
  return (
    <span
      className={`status-dot ${status}`}
      aria-label={`Status: ${status}`}
    />
  );
}

// Parse name indices from stored string (JSON or legacy plain text)
function parseDisplayName(storedName: string, language: 'en' | 'ru'): string {
  if (!storedName) return '...';

  // Try to parse as JSON indices
  try {
    // Handle both proper JSON and potentially malformed strings
    if (storedName.startsWith('{') && storedName.includes('adj')) {
      const indices = JSON.parse(storedName) as NameIndices;
      if (typeof indices.adj === 'number' && typeof indices.noun === 'number') {
        return getNameFromIndices(indices, language);
      }
    }
  } catch {
    // Parsing failed - check if it looks like truncated/malformed JSON
    if (storedName.startsWith('{')) {
      // It's malformed JSON, return fallback
      return language === 'en' ? 'Anonymous' : 'Аноним';
    }
  }

  // Legacy format - plain text name, return as-is
  return storedName;
}

export function ParticipantList({
  participants,
  currentClientId,
  language,
}: ParticipantListProps) {
  // Sort participants: current user first, then by name
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.clientId === currentClientId) return -1;
    if (b.clientId === currentClientId) return 1;
    const nameA = parseDisplayName(a.name, language);
    const nameB = parseDisplayName(b.name, language);
    return nameA.localeCompare(nameB);
  });

  const youLabel = language === 'en' ? 'you' : 'ты';

  if (sortedParticipants.length === 0) {
    return (
      <div className="participant-list" role="list" aria-label="Participants">
        <div className="participant-item">
          <StatusDot status="online" />
          <span className="participant-name">...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="participant-list" role="list" aria-label="Participants">
      {sortedParticipants.map((participant) => {
        const isCurrentUser = participant.clientId === currentClientId;
        const status = getParticipantStatus(participant);
        const isReady = participant.isReady;
        const displayName = parseDisplayName(participant.name, language);

        return (
          <div
            key={participant.clientId}
            className={`participant-item ${isCurrentUser ? 'current-user' : ''} ${isReady ? 'ready' : 'not-ready'}`}
            role="listitem"
          >
            <StatusDot status={status} />
            <span className="participant-name">
              {displayName}
              {isCurrentUser && ` (${youLabel})`}
            </span>
            {isReady && <span className="ready-check">✓</span>}
          </div>
        );
      })}
    </div>
  );
}
