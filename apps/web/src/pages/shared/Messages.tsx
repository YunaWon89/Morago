import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { BrandHeader, SkeletonList } from "../../components/Layout";
import { api, errorMessage } from "../../lib/api";
import { formatDate, formatTime } from "../../lib/format";
import type { ConversationDto, MessageDto } from "../../lib/types";
import { useSocketEvent } from "../../realtime/RealtimeContext";

export function Messages() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ConversationDto[] | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    api<{ items: ConversationDto[] }>("GET", "/conversations")
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  useEffect(load, [load]);
  useSocketEvent("message:new", load);
  useSocketEvent("messages:read", load);

  const shown = (items ?? []).filter((item) =>
    item.other.fullName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="screen">
      <BrandHeader>
        <h1 style={{ fontSize: 24, marginTop: 14, fontWeight: 700 }}>Message</h1>
        <div className="search-yellow">
          <Icon name="search" size={18} />
          <input placeholder="Search messages" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </BrandHeader>
      <div className="body inbox">
        {items === null && <SkeletonList />}
        {items !== null && shown.length === 0 && (
          <div className="empty">
            No conversations yet. Open a translator's card and tap the message icon to write to them.
          </div>
        )}
        {shown.map((item) => (
          <button key={item.id} className="list-item" onClick={() => navigate(`/messages/${item.id}`)}>
            <Avatar fileId={item.other.avatarFileId} name={item.other.fullName} size={44} />
            <div className="grow">
              <div className="name">{item.other.fullName}</div>
              <div className="sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.lastMessage?.text ?? "No messages yet"}
              </div>
            </div>
            <div className="meta">
              {item.lastMessage && <div>{formatTime(item.lastMessage.createdAt)}</div>}
              {item.unreadCount > 0 && <span className="badge">{item.unreadCount}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Chat() {
  const { id } = useParams();
  const conversationId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [other, setOther] = useState<ConversationDto["other"] | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(() => {
    api("POST", `/conversations/${conversationId}/read`).catch(() => undefined);
  }, [conversationId]);

  useEffect(() => {
    api<{ items: ConversationDto[] }>("GET", "/conversations")
      .then((data) => setOther(data.items.find((item) => item.id === conversationId)?.other ?? null))
      .catch(() => undefined);
    api<{ items: MessageDto[] }>("GET", `/conversations/${conversationId}/messages?limit=100`)
      .then((data) => {
        setMessages(data.items);
        markRead();
      })
      .catch((e) => setError(errorMessage(e)));
  }, [conversationId, markRead]);

  useSocketEvent<MessageDto>("message:new", (message) => {
    if (message.conversationId !== conversationId) return;
    setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
    if (message.senderId !== user?.id) markRead();
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const value = text.trim();
    if (!value) return;
    setText("");
    try {
      await api("POST", `/conversations/${conversationId}/messages`, { text: value });
    } catch (e) {
      setError(errorMessage(e));
      setText(value);
    }
  }

  let lastDay = "";
  return (
    <div className="phone chat-page" style={{ height: "100vh" }}>
      <div className="chat-head">
        <button className="chat-back" onClick={() => navigate("/messages")} aria-label="Back">
          <Icon name="back" size={22} />
        </button>
        {other && (
          <span className="chat-avatar">
            <Avatar fileId={other.avatarFileId} name={other.fullName} size={46} />
            <i className="online" />
          </span>
        )}
        <div className="chat-title">
          <b>{other?.fullName ?? "Chat"}</b>
          {other && <span>{other.role === "TRANSLATOR" ? "Translator" : "Client"}</span>}
        </div>
      </div>

      <div className="chat-body">
        {error && <div className="alert error">{error}</div>}
        {messages.length === 0 && !error && <div className="empty">Write the first message</div>}
        {messages.map((message) => {
          const day = formatDate(message.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={message.id} style={{ display: "contents" }}>
              {showDay && (
                <div className="chat-day">{day}</div>
              )}
              <div className={message.senderId === user?.id ? "bubble mine" : "bubble theirs"}>
                {message.text}
              </div>
              <small className={message.senderId === user?.id ? "stamp mine" : "stamp"}>
                {message.callId ? "during a call · " : ""}
                {formatTime(message.createdAt)}
              </small>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <Icon name="paperclip" size={20} />
        <input
          placeholder="Start typing..."
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && send()}
        />
        <button onClick={send} aria-label="Send">
          <Icon name="send" size={22} />
        </button>
      </div>
    </div>
  );
}
