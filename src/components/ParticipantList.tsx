// src/components/ParticipantList.tsx
// ============================================================================
// Participant List with Status Dots
// ============================================================================

import type { VoiceChatParticipant } from '../types';

interface ParticipantListProps {
  participants: VoiceChatParticipant[];
  currentClientId: string;
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
      className={`status-dot status-dot-${status}`}
      aria-label={`Status: ${status}`}
    />
  );
}

export function ParticipantList({
  participants,
  currentClientId,
}: ParticipantListProps) {
  // Sort participants: current user first, then by name
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.clientId === currentClientId) return -1;
    if (b.clientId === currentClientId) return 1;
    return a.name.localeCompare(b.name);
  });

  if (sortedParticipants.length === 0) {
    return (
      <div className="participant-list" role="list" aria-label="Participants">
        <div className="participant-item">
          <StatusDot status="online" />
          <span className="participant-name">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="participant-list" role="list" aria-label="Participants">
      {sortedParticipants.map((participant) => {
        const isCurrentUser = participant.clientId === currentClientId;
        const status = getParticipantStatus(participant);

        return (
          <div
            key={participant.clientId}
            className={`participant-item ${isCurrentUser ? 'current-user' : ''}`}
            role="listitem"
          >
            <StatusDot status={status} />
            <span className="participant-name">
              {participant.name}
              {isCurrentUser && ' (you)'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
