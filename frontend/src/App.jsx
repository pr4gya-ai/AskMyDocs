import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SignedIn, SignedOut, SignIn, UserButton, useUser } from "@clerk/clerk-react";
import {
  FileText,
  Upload,
  Send,
  ChevronDown,
  Circle,
  BookOpen,
  Loader2,
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
 
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const STORAGE_KEY = "askmydocs-conversations";
 
// -----------------------------------------------------------------------
// Backend calls.
// -----------------------------------------------------------------------
 
async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}
 
async function askDocument(question, history, k = 4) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history, k }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ask failed");
  return data;
}
 
async function askChat(promptText) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: promptText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Chat failed");
  return data.answer;
}
 
async function pingServer() {
  try {
    const res = await fetch(`${API_BASE}/`);
    return res.ok;
  } catch {
    return false;
  }
}
 
// -----------------------------------------------------------------------
// Conversation persistence (browser localStorage — this is a real app,
// not a sandboxed artifact, so localStorage is fine here). Each
// conversation is { id, title, doc, messages, createdAt }.
// -----------------------------------------------------------------------
 
function loadConversations(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
 
function saveConversations(userId, conversations) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(conversations));
  } catch {
    // Quota exceeded or storage disabled — non-fatal, just skip persisting.
  }
}
 
function makeConversation() {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    doc: null,
    messages: [],
    createdAt: Date.now(),
  };
}
 
// -----------------------------------------------------------------------
// Small presentational pieces
// -----------------------------------------------------------------------
 
function ConnectionDot({ connected }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono text-parchment-muted">
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ledger opacity-60" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            connected ? "bg-ledger" : "bg-rust"
          }`}
        />
      </span>
      {connected ? "backend connected" : "backend offline"}
    </div>
  );
}
 
function SourceChip({ chunk, index, expanded, onToggle }) {
  const page = chunk.metadata?.loc?.pageNumber;
  const score = chunk.score?.toFixed(2);
 
  return (
    <div className="border border-ink-lighter rounded-md overflow-hidden bg-ink-light/50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-ink-lighter/60 transition-colors"
      >
        <span className="flex items-center gap-2 font-mono text-xs text-ledger-bright">
          <BookOpen size={13} className="shrink-0" />
          {page ? `p.${page}` : `excerpt ${index + 1}`}
          <span className="text-parchment-dim">· relevance {score}</span>
        </span>
        <ChevronDown
          size={14}
          className={`text-parchment-dim shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className="px-3 pb-3 text-sm text-parchment-muted leading-relaxed border-t border-ink-lighter pt-2">
              {chunk.content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
 
function SourceChipWrapper({ chunk, index }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <SourceChip
      chunk={chunk}
      index={index}
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    />
  );
}
 
function ChatMessage({ message }) {
  const isUser = message.role === "user";
 
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        <div
          className={`px-4 py-2.5 rounded-lg text-[15px] leading-relaxed ${
            isUser
              ? "bg-lamp text-parchment font-medium rounded-br-sm"
              : "bg-ink-light border border-ink-lighter text-parchment rounded-bl-sm markdown-content"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          )}
        </div>
 
        {message.sources && message.sources.length > 0 && (
          <div className="w-full flex flex-col gap-1.5 mt-0.5">
            {message.sources.map((chunk, i) => (
              <SourceChipWrapper key={i} chunk={chunk} index={i} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
 
/**
 * The one deliberate orchestrated animation moment: a scan-line sweeps
 * down a document glyph while the upload is processing.
 */
function ScanningDocument() {
  return (
    <div className="relative w-16 h-20 mx-auto overflow-hidden">
      <FileText size={64} className="text-parchment-dim" strokeWidth={1} />
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-lamp shadow-[0_0_8px_2px_rgba(127,176,105,0.6)]"
        initial={{ top: "0%" }}
        animate={{ top: "100%" }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
 
/**
 * Left-most sidebar: list of saved conversations, ChatGPT-style. Purely
 * a browser-side history (localStorage) — the backend doesn't know or
 * care about "conversations", it just answers whatever /ask receives.
 */
function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  collapsed,
  onToggleCollapse,
}) {
  if (collapsed) {
    return (
      <div className="w-12 shrink-0 border-r border-ink-lighter flex flex-col items-center py-4 gap-3">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-md hover:bg-ink-lighter/60 text-parchment-muted transition-colors"
          aria-label="Expand sidebar"
        >
          <PanelLeft size={18} />
        </button>
        <button
          onClick={onNew}
          className="p-2 rounded-md hover:bg-ink-lighter/60 text-parchment-muted transition-colors"
          aria-label="New chat"
        >
          <Plus size={18} />
        </button>
      </div>
    );
  }
 
  return (
    <div className="w-64 shrink-0 border-r border-ink-lighter flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3 border-b border-ink-lighter">
        <button
          onClick={onNew}
          className="flex-1 flex items-center gap-2 text-sm text-parchment px-2 py-1.5 rounded-md hover:bg-ink-lighter/60 transition-colors"
        >
          <Plus size={16} />
          New chat
        </button>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-ink-lighter/60 text-parchment-muted transition-colors shrink-0"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
 
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <p className="text-xs text-parchment-dim px-4 py-3">No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`group flex items-start gap-2 mx-2 px-2 py-2 rounded-md cursor-pointer transition-colors ${
              c.id === activeId ? "bg-ink-lighter" : "hover:bg-ink-lighter/50"
            }`}
          >
            <MessageSquare size={14} className="text-parchment-dim mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-parchment truncate">{c.title}</p>
              {c.doc && (
                <p className="text-xs text-parchment-dim truncate font-mono">{c.doc.filename}</p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rust/20 text-parchment-dim hover:text-rust transition-all shrink-0"
              aria-label="Delete conversation"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
 
// -----------------------------------------------------------------------
// Main app
// -----------------------------------------------------------------------
 
function AuthenticatedApp() {
  const { user } = useUser();
  const userId = user?.id;
 
  const [connected, setConnected] = useState(null);
  const [conversations, setConversations] = useState(() => {
    const loaded = loadConversations(userId);
    return loaded.length > 0 ? loaded : [makeConversation()];
  });
  const [activeId, setActiveId] = useState(() => conversations[0]?.id);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
 
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
 
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
 
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? conversations[0],
    [conversations, activeId]
  );
 
  // Persist every change to localStorage, scoped to this user.
  useEffect(() => {
    if (userId) saveConversations(userId, conversations);
  }, [conversations, userId]);
 
  useEffect(() => {
    pingServer().then(setConnected);
    const interval = setInterval(() => pingServer().then(setConnected), 15000);
    return () => clearInterval(interval);
  }, []);
 
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeConversation?.messages]);
 
  function updateActiveConversation(updater) {
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? updater(c) : c))
    );
  }
 
  const handleNewChat = useCallback(() => {
    const fresh = makeConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setUploadError(null);
  }, []);
 
  const handleSelectConversation = useCallback((id) => {
    setActiveId(id);
    setUploadError(null);
  }, []);
 
  const handleDeleteConversation = useCallback(
    (id) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (next.length === 0) {
          const fresh = makeConversation();
          setActiveId(fresh.id);
          return [fresh];
        }
        if (id === activeId) setActiveId(next[0].id);
        return next;
      });
    },
    [activeId]
  );
 
  const handleFileSelect = useCallback(
    async (file) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setUploadError("Only PDF files are supported.");
        return;
      }
      setUploadError(null);
      setUploading(true);
      try {
        const result = await uploadDocument(file);
        const docMeta = {
          filename: result.filename,
          totalPages: result.totalPages,
          totalChunks: result.totalChunks,
        };
        updateActiveConversation((c) => ({
          ...c,
          doc: docMeta,
          messages: [],
          title: result.filename,
        }));
      } catch (err) {
        setUploadError(err.message);
      } finally {
        setUploading(false);
      }
    },
    [activeConversation]
  );
 
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      handleFileSelect(file);
    },
    [handleFileSelect]
  );
 
  const handleAsk = useCallback(async () => {
    const question = input.trim();
    if (!question || asking || !activeConversation) return;
 
    const conv = activeConversation;
    const isFirstMessage = conv.messages.length === 0;
 
    setInput("");
    updateActiveConversation((c) => ({
      ...c,
      messages: [...c.messages, { role: "user", content: question }],
      // Auto-title the conversation from the first question asked,
      // same idea as ChatGPT deriving a title from your first message —
      // only if we don't already have a doc-derived title.
      title: isFirstMessage && !c.doc ? question.slice(0, 48) : c.title,
    }));
    setAsking(true);
 
    try {
      if (conv.doc) {
        const history = conv.messages.map(({ role, content }) => ({ role, content }));
        const { answer, sources } = await askDocument(question, history, 4);
        updateActiveConversation((c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: answer, sources }],
        }));
      } else {
        const answer = await askChat(question);
        updateActiveConversation((c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: answer }],
        }));
      }
    } catch (err) {
      updateActiveConversation((c) => ({
        ...c,
        messages: [
          ...c.messages,
          { role: "assistant", content: err.message || "Something went wrong." },
        ],
      }));
    } finally {
      setAsking(false);
    }
  }, [input, asking, activeConversation]);
 
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };
 
  if (!activeConversation) return null;
  const { doc, messages } = activeConversation;
 
  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />
 
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-ink-lighter shrink-0">
          <h1 className="font-display italic text-2xl text-parchment tracking-tight">
            AskMyDocs
          </h1>
          <div className="flex items-center gap-4">
            <ConnectionDot connected={connected} />
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
 
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* The Document */}
          <aside className="w-full md:w-[360px] shrink-0 border-b md:border-b-0 md:border-r border-ink-lighter p-6 flex flex-col gap-5 overflow-y-auto">
            <div>
              <h2 className="font-display text-lg text-parchment-muted mb-1">The Document</h2>
              <p className="text-sm text-parchment-dim leading-relaxed">
                Upload a PDF. Questions you ask will be answered using only its content.
              </p>
            </div>
 
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-ink-lighter hover:border-lamp-dim rounded-lg p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors min-h-[160px]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
 
              {uploading ? (
                <>
                  <ScanningDocument />
                  <p className="text-xs font-mono text-lamp-dim">reading document…</p>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-parchment-dim" strokeWidth={1.5} />
                  <p className="text-sm text-parchment-muted text-center">
                    Drop a PDF here, or click to browse
                  </p>
                </>
              )}
            </div>
 
            {uploadError && (
              <p className="text-xs font-mono text-rust border border-rust/30 bg-rust/10 rounded-md px-3 py-2">
                {uploadError}
              </p>
            )}
 
            {doc && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="border border-ink-lighter rounded-lg p-4 bg-ink-light/40"
              >
                <div className="flex items-start gap-3">
                  <FileText size={18} className="text-ledger-bright mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-parchment truncate">{doc.filename}</p>
                    <p className="text-xs font-mono text-parchment-dim mt-1">
                      {doc.totalPages} pages · {doc.totalChunks} chunks indexed
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
 
            <div className="mt-auto pt-4 border-t border-ink-lighter">
              <p className="text-xs text-parchment-dim leading-relaxed">
                Answers cite the page and relevance score of every excerpt they draw
                from — expand a citation under any response to read the source text.
              </p>
              <p className="text-xs text-parchment-dim leading-relaxed mt-2">
                Note: switching to an older chat about a different PDF won't have
                isolated retrieval unless you re-upload that document here — the
                backend currently searches across whatever's been uploaded most
                recently.
              </p>
            </div>
          </aside>
 
          {/* The Conversation */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-parchment-dim">
                  <Circle size={6} className="fill-current mb-2" />
                  <p className="text-sm max-w-xs">
                    {doc
                      ? `Ask something about ${doc.filename}.`
                      : "Upload a document on the left, or just start chatting."}
                  </p>
                </div>
              )}
 
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <ChatMessage key={i} message={msg} />
                ))}
              </AnimatePresence>
 
              {asking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-parchment-dim text-sm px-1"
                >
                  <Loader2 size={14} className="animate-spin" />
                  {doc ? "searching document…" : "thinking…"}
                </motion.div>
              )}
            </div>
 
            {/* Composer */}
            <div className="border-t border-ink-lighter p-4 shrink-0">
              <div className="flex items-end gap-3 max-w-3xl mx-auto">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={doc ? "Ask about the document…" : "Ask anything…"}
                  rows={1}
                  className="flex-1 resize-none bg-ink-light border border-ink-lighter focus:border-lamp-dim rounded-lg px-4 py-3 text-sm text-parchment placeholder:text-parchment-dim outline-none transition-colors max-h-32"
                />
                <button
                  onClick={handleAsk}
                  disabled={!input.trim() || asking}
                  className="shrink-0 bg-lamp hover:bg-lamp-bright disabled:bg-ink-lighter disabled:text-parchment-dim text-parchment rounded-lg p-3 transition-colors"
                  aria-label="Send"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
 
/**
 * Sign-in gate. SignedOut/SignedIn are Clerk's components that render
 * their children only in the matching auth state — no manual "is the
 * user logged in" state needed, Clerk handles that.
 */
export default function App() {
  return (
    <>
      <SignedOut>
        <div className="h-screen w-screen flex items-center justify-center bg-ink px-4">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <h1 className="font-display italic text-3xl text-parchment tracking-tight">
                AskMyDocs
              </h1>
              <p className="text-sm text-parchment-dim mt-2">
                Sign in to upload documents and start asking questions.
              </p>
            </div>
            <SignIn
              appearance={{
                elements: {
                  rootBox: "mx-auto w-full",
                  card: "bg-ink-light border border-ink-lighter shadow-none",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "border border-ink-lighter",
                  formButtonPrimary: "bg-lamp hover:bg-lamp-bright text-parchment",
                  footerActionLink: "text-ledger-bright",
                },
              }}
            />
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </>
  );
}