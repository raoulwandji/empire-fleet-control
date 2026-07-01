'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import AvatarUploader from '@/components/AvatarUploader';

type Author = {
  id: string;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  role: string;
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  author: Author;
};

type UserOption = { id: string; username: string; fullName: string };

const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'text-empire-rougeVif',
  MANAGER: 'text-yellow-400',
  EMPLOYEE: 'text-hud-cyan',
};

// Convertit les @username en spans mis en évidence
function renderContent(content: string, users: UserOption[]) {
  const usernames = new Set(users.map((u) => u.username));
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && usernames.has(part.slice(1))) {
      return (
        <span key={i} className="bg-hud-cyan/20 text-hud-cyan font-semibold rounded px-0.5">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFiltered, setMentionFiltered] = useState<UserOption[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/chat');
    if (res.ok) {
      const data: Message[] = await res.json();
      setMessages(data.reverse()); // API retourne du plus récent, on inverse pour affichage
    }
  }, []);

  // Chargement initial + polling toutes les 3s
  useEffect(() => {
    fetchMessages();
    pollingRef.current = setInterval(fetchMessages, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchMessages]);

  // Liste des utilisateurs pour @mentions
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setUsers(data.map((u: any) => ({ id: u.id, username: u.username, fullName: u.fullName }))));
  }, []);

  // Scroll vers le bas quand de nouveaux messages arrivent
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);

    // Détection du @ en cours de saisie
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      setMentionQuery(query);
      setMentionFiltered(users.filter((u) => u.username.toLowerCase().startsWith(query) || u.fullName.toLowerCase().startsWith(query)));
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(username: string) {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, cursor);
    const after = input.slice(cursor);
    const replaced = before.replace(/@\w*$/, `@${username} `);
    setInput(replaced + after);
    setMentionOpen(false);
    inputRef.current?.focus();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    setMentionOpen(false);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      await fetchMessages();
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as any);
    }
    if (e.key === 'Escape') setMentionOpen(false);
  }

  // Groupement par date pour afficher des séparateurs
  let lastDate = '';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full px-4 py-4">
        <div className="mb-4">
          <h1 className="font-display font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-hud-cyan to-white tracking-widest">
            CHAT
          </h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase">Canal général — taguez avec @identifiant</p>
        </div>

        {/* Zone de messages */}
        <div className="card flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0, height: 'calc(100vh - 260px)' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {messages.length === 0 && (
              <p className="text-gray-600 text-sm italic text-center mt-8">Aucun message. Soyez le premier à écrire !</p>
            )}
            {messages.map((msg) => {
              const dateLabel = formatDate(msg.createdAt);
              const showDate = dateLabel !== lastDate;
              lastDate = dateLabel;
              const isMe = msg.author.id === session?.user.id;

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-hud-line" />
                      <span className="text-xs text-gray-500 shrink-0">{dateLabel}</span>
                      <div className="flex-1 h-px bg-hud-line" />
                    </div>
                  )}
                  <div className={`flex gap-2 items-start group ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className="shrink-0 mt-0.5">
                      <AvatarUploader
                        fullName={msg.author.fullName}
                        avatarUrl={msg.author.avatarUrl}
                        size={28}
                      />
                    </div>
                    <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : ''}`}>
                      <div className={`flex items-baseline gap-2 mb-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className={`text-xs font-semibold ${ROLE_COLOR[msg.author.role] ?? 'text-gray-400'}`}>
                          {msg.author.fullName}
                        </span>
                        <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <div className={`text-sm rounded-xl px-3 py-2 break-words leading-relaxed ${
                        isMe
                          ? 'bg-hud-cyan/15 text-white rounded-tr-none'
                          : 'bg-white/5 text-gray-200 rounded-tl-none'
                      }`}>
                        {renderContent(msg.content, users)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Zone de saisie */}
        <div className="mt-3 relative">
          {/* Autocomplete @mention */}
          {mentionOpen && mentionFiltered.length > 0 && (
            <div className="absolute bottom-full mb-1 left-0 card w-64 z-40 overflow-hidden">
              {mentionFiltered.slice(0, 6).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => insertMention(u.username)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-hud-cyan/10 transition-colors text-left"
                >
                  <AvatarUploader fullName={u.fullName} avatarUrl={null} size={20} />
                  <span className="text-hud-cyan font-mono">@{u.username}</span>
                  <span className="text-gray-400 text-xs truncate">{u.fullName}</span>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Écrivez un message… (@ pour mentionner, Entrée pour envoyer)"
              rows={2}
              className="form-input flex-1 resize-none text-sm"
            />
            <button type="submit" disabled={!input.trim() || sending} className="btn-primary px-4 py-2 shrink-0 disabled:opacity-40">
              {sending ? '...' : 'Envoyer'}
            </button>
          </form>
          <p className="text-[10px] text-gray-600 mt-1">Maj+Entrée pour aller à la ligne</p>
        </div>
      </div>
    </div>
  );
}
