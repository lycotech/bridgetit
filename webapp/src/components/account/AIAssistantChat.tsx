import { useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Modal } from "@/components/dashboard/Modal";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { useAiAssistantChat } from "@/lib/account/session";
import type { AiAssistantMessage } from "../../../../backend/src/types";

/**
 * The real AI Assistant chat — a live Claude call (backend/src/routes/
 * ai-assistant.ts), grounded only in the signed-in customer's own real
 * PayBridge data. Kept as a SEPARATE floating launcher from AIAssistWidget
 * (the rules-based savings suggestion) rather than replacing it, by explicit
 * user decision — bottom-left here, bottom-right there, so both can be open
 * on the page without colliding.
 */
export function AIAssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiAssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chat = useAiAssistantChat();
  const listRef = useRef<HTMLDivElement>(null);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || chat.isPending) return;

    setError(null);
    const history = messages;
    const nextMessages: AiAssistantMessage[] = [...history, { role: "user", content: text }];
    setMessages(nextMessages);
    setDraft("");

    try {
      const result = await chat.mutateAsync({ message: text, history });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI Assistant could not respond right now.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-3 text-sm font-semibold text-primary shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <MessageCircle className="h-4 w-4" /> Ask PayBridge AI
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="PayBridge AI Assistant"
        description="Ask about your Bridge eligibility, Savings, or PayBridge Score. Answers are grounded in your own account — not financial advice."
        size="wide"
        footer={
          <form onSubmit={(e) => void send(e)} className="flex w-full items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(e);
                }
              }}
              placeholder="Ask a question about your account…"
              rows={1}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
            />
            <ActionButton type="submit" loading={chat.isPending} icon={<Send className="h-4 w-4" />}>
              Send
            </ActionButton>
          </form>
        }
      >
        <div ref={listRef} className="max-h-[50vh] min-h-[10rem] space-y-3 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Try "Am I eligible for a Bridge draw?" or "What is my PayBridge Score?"
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground"
                    : "mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground"
                }
              >
                {m.content}
              </div>
            ))
          )}
          {chat.isPending ? <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary/60 px-3.5 py-2.5 text-sm text-muted-foreground">Thinking…</div> : null}
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </Modal>
    </>
  );
}
