// src/components/Chat.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import API_BASE_URL from "../apiConfig";
import "./Chat.css";

function Chat() {
    const [employees, setEmployees] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messageInput, setMessageInput] = useState("");
    const [chats, setChats] = useState({}); // { userId: [messages] }
    const [searchText, setSearchText] = useState("");
    const [unreadCounts, setUnreadCounts] = useState({});
    const [muted, setMuted] = useState(false);

    const stompClientRef = useRef(null);
    const messageKeysRef = useRef(new Set());
    const lastReceivedRef = useRef({});
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const windowFocusedRef = useRef(true);
    const audioRef = useRef(null);

    const loggedInUser = JSON.parse(localStorage.getItem("user"));
    const myEmpKey = loggedInUser?.emp_pkey ? String(loggedInUser.emp_pkey) : null;

    /* ----------------------- Audio ----------------------- */
    useEffect(() => {
        try {
            audioRef.current = new Audio("/sounds/notify.mp3");
            audioRef.current.preload = "auto";
            audioRef.current.volume = 0.9;
        } catch {
            audioRef.current = null;
        }
    }, []);

    /* ----------------------- Window focus ----------------------- */
    const markVisibleMessagesRead = useCallback(() => {
        if (!messagesContainerRef.current || !selectedUser) return;
        const container = messagesContainerRef.current;
        const visibleMessages = Array.from(container.querySelectorAll("[data-msg-id]")).filter((el) => {
            const rect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            return rect.bottom > containerRect.top && rect.top < containerRect.bottom;
        });

        visibleMessages.forEach((el) => {
            const msgId = el.getAttribute("data-msg-id");
            const msg = chats[selectedUser.emp_pkey]?.find((m) => String(m.id) === msgId);
            if (!msg || msg.sender !== "them" || msg.status === "READ") return;

            try {
                stompClientRef.current?.publish({
                    destination: "/app/message-read",
                    body: JSON.stringify({ messageId: msg.id, sender: String(selectedUser.emp_pkey), receiver: myEmpKey }),
                });

                setChats((prev) => {
                    const list = [...(prev[selectedUser.emp_pkey] || [])];
                    const idx = list.findIndex((m) => String(m.id) === msg.id);
                    if (idx !== -1) list[idx].status = "READ";
                    return { ...prev, [selectedUser.emp_pkey]: list };
                });

                setUnreadCounts((prev) => {
                    const copy = { ...prev };
                    delete copy[selectedUser.emp_pkey];
                    return copy;
                });
            } catch (err) {
                console.warn("Failed to mark read on focus", err);
            }
        });
    }, [chats, selectedUser, myEmpKey]);

    useEffect(() => {
        const onFocus = () => {
            windowFocusedRef.current = true;
            markVisibleMessagesRead();
        };
        const onBlur = () => (windowFocusedRef.current = false);

        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);
        return () => {
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("blur", onBlur);
        };
    }, [markVisibleMessagesRead]);

    /* ----------------------- Fetch employees ----------------------- */
    useEffect(() => {
        if (!loggedInUser || !loggedInUser.user_id) return;

        fetch(`${API_BASE_URL}/proxy/employees?user_id=${loggedInUser.user_id}`)
            .then((res) => res.json())
            .then((json) => setEmployees(json.success === 1 ? json.data : []))
            .catch(() => setEmployees([]));
    }, [loggedInUser]);

    /* ----------------------- Unread helpers ----------------------- */
    const incrementUnread = useCallback((otherUserId) => {
        if (!otherUserId) return;
        setUnreadCounts((prev) => {
            const current = prev[otherUserId] || 0;
            return { ...prev, [otherUserId]: current + 1 };
        });
    }, []);

    const clearUnread = useCallback((otherUserId) => {
        if (!otherUserId) return;
        setUnreadCounts((prev) => {
            const copy = { ...prev };
            delete copy[otherUserId];
            return copy;
        });
    }, []);

    /* ----------------------- Play notification ----------------------- */
    const playNotification = useCallback(() => {
        if (muted) return;
        const audio = audioRef.current;
        if (!audio) return;
        try {
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === "function") {
                playPromise.catch(() => { });
            }
        } catch { }
    }, [muted]);

    /* ----------------------- Load chat history ----------------------- */
    const loadHistoryForUser = useCallback(async (otherEmpKey) => {
        if (!otherEmpKey) return;
        try {
            const res = await fetch(`${API_BASE_URL}/chat/history/${otherEmpKey}`, {
                credentials: "include",
                headers: { "Content-Type": "application/json", "emp_pkey": myEmpKey },
            });
            if (!res.ok) return;
            const history = await res.json();

            const mapped = history.map((h) => ({
                id: h.id,
                text: h.content,
                sender: String(h.sender) === myEmpKey ? "me" : "them",
                senderId: h.sender,
                time: h.sentAt
                    ? new Date(h.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: h.status || "DELIVERED",
            }));

            setChats((prev) => ({ ...prev, [otherEmpKey]: mapped }));

            const unreadFromHistory = history.filter(
                (h) => String(h.receiver) === myEmpKey && h.status !== "READ"
            ).length;

            setUnreadCounts((prev) => {
                const copy = { ...prev };
                if (unreadFromHistory > 0) copy[otherEmpKey] = unreadFromHistory;
                else delete copy[otherEmpKey];
                return copy;
            });

            if (selectedUser && String(selectedUser.emp_pkey) === otherEmpKey && unreadFromHistory > 0 && stompClientRef.current?.connected) {
                const lastUnread = history.filter((h) => String(h.receiver) === myEmpKey && h.status !== "READ").pop();
                if (lastUnread) {
                    stompClientRef.current.publish({
                        destination: "/app/message-read",
                        body: JSON.stringify({ messageId: lastUnread.id, sender: lastUnread.sender, receiver: myEmpKey }),
                    });
                }
                clearUnread(otherEmpKey);
            }
        } catch (err) {
            console.warn("Failed to load history", err);
        }
    }, [myEmpKey, selectedUser, clearUnread]);

    /* ----------------------- WebSocket / STOMP ----------------------- */
    useEffect(() => {
        if (!myEmpKey) return;

        const rootURL = API_BASE_URL.replace("/api", "");
        const client = new Client({
            webSocketFactory: () => new SockJS(`${rootURL}/ws-chat`),
            connectHeaders: { emp_pkey: myEmpKey },
            reconnectDelay: 5000,
            debug: () => { },
        });

        const handleIncomingMessage = async (frame) => {
            if (!frame.body) return;
            const msg = JSON.parse(frame.body);

            const dedupeKey = msg.id ? `id-${msg.id}-${msg.status}` : `${msg.sender}-${msg.receiver}-${msg.content}-${msg.status}`;
            if (messageKeysRef.current.has(dedupeKey)) return;
            messageKeysRef.current.add(dedupeKey);
            if (messageKeysRef.current.size > 5000) messageKeysRef.current.clear(); // Prevent memory leak

            const senderId = String(msg.sender);
            const receiverId = String(msg.receiver);
            const otherUserId = senderId === myEmpKey ? receiverId : senderId;

            if (receiverId === myEmpKey && senderId !== myEmpKey) {
                lastReceivedRef.current[otherUserId] = msg.id || new Date().toISOString();
            }

            // Delivery ACK
            if (receiverId === myEmpKey && senderId !== myEmpKey && msg.id) {
                try {
                    stompClientRef.current.publish({
                        destination: "/app/message-delivered",
                        body: JSON.stringify({ id: msg.id, sender: msg.sender, receiver: msg.receiver, content: msg.content, tempId: msg.tempId || null }),
                    });
                } catch { }
            }

            // Handle READ
            if (msg.status === "READ") {
                setChats((prev) => {
                    const list = prev[otherUserId] ? [...prev[otherUserId]] : [];
                    const idx = list.findIndex((m) => String(m.id) === String(msg.id));
                    if (idx !== -1) list[idx] = { ...list[idx], status: "READ" };
                    else for (let i = 0; i < list.length; i++) if (list[i].sender === "them") list[i].status = "READ";
                    return { ...prev, [otherUserId]: list };
                });
                if (selectedUser && String(selectedUser.emp_pkey) === otherUserId) clearUnread(otherUserId);
                return;
            }

            // Upsert message
            setChats((prev) => {
                const existing = prev[otherUserId] ? [...prev[otherUserId]] : [];
                const existsById = msg.id && existing.some((m) => String(m.id) === String(msg.id));
                const existsByTemp = msg.tempId && existing.some((m) => String(m.id) === String(msg.tempId));
                if (existsById || existsByTemp) {
                    const updated = existing.map((m) => {
                        if ((msg.id && String(m.id) === String(msg.id)) || (msg.tempId && String(m.id) === String(msg.tempId))) {
                            return { ...m, id: msg.id || m.id, status: msg.status || m.status, text: msg.content || m.text };
                        }
                        return m;
                    });
                    return { ...prev, [otherUserId]: updated };
                }

                const newMsg = {
                    id: msg.id,
                    text: msg.content,
                    sender: senderId === myEmpKey ? "me" : "them",
                    senderId: msg.sender,
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    status: msg.status || "DELIVERED",
                };

                const appended = existing.concat(newMsg);

                if (receiverId === myEmpKey && senderId !== myEmpKey) {
                    const chatOpen = selectedUser && String(selectedUser.emp_pkey) === otherUserId;
                    if (!chatOpen || !windowFocusedRef.current) {
                        incrementUnread(otherUserId);
                        playNotification();
                    } else {
                        try {
                            stompClientRef.current.publish({
                                destination: "/app/message-read",
                                body: JSON.stringify({ messageId: msg.id, sender: msg.sender, receiver: myEmpKey }),
                            });
                            appended[appended.length - 1].status = "READ";
                        } catch { }
                    }
                }

                return { ...prev, [otherUserId]: appended };
            });
        };

        client.onConnect = async () => {
            client.subscribe("/user/queue/messages", handleIncomingMessage);

            // Replay missed messages
            for (const userId of Object.keys(lastReceivedRef.current)) {
                try {
                    const after = lastReceivedRef.current[userId];
                    const res = await fetch(`${API_BASE_URL}/chat/missed-messages/${userId}?after=${after}`, {
                        credentials: "include",
                        headers: { "Content-Type": "application/json", "emp_pkey": myEmpKey },
                    });
                    if (!res.ok) continue;
                    const missed = await res.json();
                    setChats((prev) => {
                        const existing = prev[userId] ? [...prev[userId]] : [];
                        const newMessages = missed.map((m) => ({
                            id: m.id,
                            text: m.content,
                            sender: String(m.sender) === myEmpKey ? "me" : "them",
                            senderId: m.sender,
                            time: new Date(m.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                            status: m.status || "DELIVERED",
                        }));
                        return { ...prev, [userId]: [...existing, ...newMessages] };
                    });
                } catch { }
            }
        };

        client.activate();
        stompClientRef.current = client;
        return () => client.deactivate();
    }, [myEmpKey, incrementUnread, clearUnread, playNotification, selectedUser]);

    /* ----------------------- Send message ----------------------- */
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!messageInput.trim() || !selectedUser) return;

        const tempId = `tmp-${Date.now()}`;
        setChats((prev) => ({
            ...prev,
            [selectedUser.emp_pkey]: [
                ...(prev[selectedUser.emp_pkey] || []),
                { id: tempId, text: messageInput, sender: "me", senderId: myEmpKey, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "SENT" },
            ],
        }));

        if (stompClientRef.current?.connected) {
            stompClientRef.current.publish({
                destination: "/app/send-message",
                body: JSON.stringify({ tempId, receiver: String(selectedUser.emp_pkey), content: messageInput }),
            });
        }

        setMessageInput("");
    };

    /* ----------------------- Selected user ----------------------- */
    useEffect(() => {
        if (selectedUser) {
            loadHistoryForUser(String(selectedUser.emp_pkey));
            clearUnread(String(selectedUser.emp_pkey));
        }
    }, [selectedUser, loadHistoryForUser, clearUnread]);

    const currentMessages = selectedUser ? chats[selectedUser.emp_pkey] || [] : [];

    /* ----------------------- Auto-scroll ----------------------- */
    useEffect(() => {
        if (!messagesEndRef.current) return;
        const raf = requestAnimationFrame(() => {
            try {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
            } catch {
                const container = messagesEndRef.current?.parentElement;
                if (container) container.scrollTop = container.scrollHeight;
            }
        });
        return () => cancelAnimationFrame(raf);
    }, [currentMessages, selectedUser]);

    /* ----------------------- Optimized READ detection ----------------------- */
    useEffect(() => {
        if (!messagesContainerRef.current || !selectedUser) return;
        const container = messagesContainerRef.current;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const msgId = entry.target.getAttribute("data-msg-id");
                    if (!msgId) return;
                    const msg = currentMessages.find((m) => String(m.id) === msgId);
                    if (!msg || msg.sender !== "them" || msg.status === "READ") return;

                    if (entry.isIntersecting) {
                        try {
                            stompClientRef.current.publish({
                                destination: "/app/message-read",
                                body: JSON.stringify({ messageId: msg.id, sender: String(selectedUser.emp_pkey), receiver: myEmpKey }),
                            });

                            setChats((prev) => {
                                const list = [...(prev[selectedUser.emp_pkey] || [])];
                                const idx = list.findIndex((m) => String(m.id) === msg.id);
                                if (idx !== -1) list[idx].status = "READ";
                                return { ...prev, [selectedUser.emp_pkey]: list };
                            });

                            clearUnread(String(selectedUser.emp_pkey));
                        } catch { }
                    }
                });
            },
            { root: container, threshold: 0.5 }
        );

        container.querySelectorAll("[data-msg-id]").forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [currentMessages, selectedUser, myEmpKey, clearUnread]);

    /* ----------------------- UI ----------------------- */
    return (
        <div className="chat-container">
            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <div className="chat-search-container" style={{ flex: 1 }}>
                        <input
                            className="chat-search"
                            placeholder="Search"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setMuted((m) => !m)}
                        style={{
                            marginLeft: 8,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "16px",
                            opacity: 0.6
                        }}
                        title={muted ? "Unmute" : "Mute"}
                    >
                        {muted ? "🔇" : "🔔"}
                    </button>
                </div>

                <div className="contact-list">
                    {employees
                        .filter((e) => String(e.emp_pkey) !== myEmpKey)
                        .filter((e) => e.EmpName?.toLowerCase().includes(searchText.toLowerCase()))
                        .map((emp) => {
                            const key = String(emp.emp_pkey);
                            const unread = unreadCounts[key] || 0;
                            return (
                                <div
                                    key={emp.emp_pkey}
                                    className={`contact-item ${selectedUser?.emp_pkey === emp.emp_pkey ? "active" : ""}`}
                                    onClick={() => setSelectedUser(emp)}
                                >
                                    <div className="avatar">{emp.EmpName?.charAt(0).toUpperCase()}</div>
                                    <div className="contact-info">
                                        <div className="contact-name-row">
                                            <p className="contact-name">{emp.EmpName}</p>
                                            {/* Time of last message could go here if available */}
                                        </div>
                                        {unread > 0 && <span className="badge">{unread}</span>}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* Chat Window */}
            <div className="chat-window">
                {selectedUser ? (
                    <>
                        <div className="chat-header">
                            <span className="recipient-name">To: {selectedUser.EmpName}</span>
                        </div>
                        <div className="chat-messages" ref={messagesContainerRef}>
                            {currentMessages.map((m, index) => {
                                const isLast = index === currentMessages.length - 1;
                                return (
                                    <div key={m.id || index} style={{ display: 'flex', flexDirection: 'column' }} data-msg-id={m.id}>
                                        <div className={`chat-message ${m.sender}`}>
                                            <div className="message-text">{m.text}</div>
                                            <div className="message-meta">
                                                <span className="message-time">{m.time}</span>
                                                {m.sender === "me" && (
                                                    <span className={`message-status ${m.status}`}>
                                                        {m.status === "SENT" && "✓"}
                                                        {m.status === "DELIVERED" && "✓✓"}
                                                        {m.status === "READ" && "✓✓"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div ref={messagesEndRef} />
                        </div>
                        <form className="chat-input" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                placeholder="Message"
                            />
                            <button type="submit" className="send-btn" disabled={!messageInput.trim()}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                </svg>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="chat-placeholder">Select a contact to start chatting</div>
                )}
            </div>
        </div>
    );
}

export default Chat;
