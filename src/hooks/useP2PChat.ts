import { useState, useEffect, useRef, useCallback } from "react";
import {
  sendMessage, subscribeRoom, generateRoomCode,
  saveRoom, loadSavedRooms, leaveRoom,
  type ChatMessage, type SavedRoom,
} from "@/lib/p2pChat";

export function useP2PChat(alias: string) {
  const [rooms, setRooms]         = useState<SavedRoom[]>(() => loadSavedRooms());
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [sending, setSending]     = useState(false);
  const unsubRef                  = useRef<(() => void) | null>(null);

  // Subscribe when active room changes
  useEffect(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    setMessages([]);
    if (!activeRoom) return;

    unsubRef.current = subscribeRoom(activeRoom, alias, (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    return () => { unsubRef.current?.(); };
  }, [activeRoom, alias]);

  const joinRoom = useCallback((code: string) => {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;
    saveRoom({ code: trimmed, alias, joinedAt: Date.now() });
    setRooms(loadSavedRooms());
    setActiveRoom(trimmed);
  }, [alias]);

  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    joinRoom(code);
    return code;
  }, [joinRoom]);

  const exitRoom = useCallback((code: string) => {
    leaveRoom(code);
    setRooms(loadSavedRooms());
    if (activeRoom === code) {
      setActiveRoom(null);
      setMessages([]);
    }
  }, [activeRoom]);

  const send = useCallback(async (text: string) => {
    if (!activeRoom || !text.trim()) return;
    setSending(true);
    try {
      await sendMessage(activeRoom, alias, text.trim());
    } finally {
      setSending(false);
    }
  }, [activeRoom, alias]);

  return { rooms, activeRoom, messages, sending, joinRoom, createRoom, exitRoom, send, setActiveRoom };
}
