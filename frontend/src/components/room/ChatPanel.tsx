"use client";

import clsx from "clsx";
import { Ellipsis, FileText, MessagesSquare, PenLine, SendHorizontal, Smile, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MenuItem, Popover } from "@/components/ui/Popover";
import { roomActions } from "@/lib/meeting/actions";
import type { Participant } from "@/lib/meeting/room";
import { useRoom } from "@/lib/meeting/room";
import { toast } from "@/lib/toast";

import { SidePanel } from "./SidePanel";

const QUICK_EMOJI = ["👍", "😂", "❤️", "🎉", "👏", "🙌", "😮", "🙏"];

export function ChatPanel({ participants }: { participants: Participant[] }) {
  const meeting = useRoom((s) => s.meeting);
  const self = useRoom((s) => s.self);
  const messages = useRoom((s) => s.messages);
  const allowChat = useRoom((s) => s.host.allowChat);
  const setPanel = useRoom((s) => s.setPanel);

  const [draft, setDraft] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const others = participants.filter((p) => !p.isSelf);
  const recipient = others.find((p) => p.id === recipientId) ?? null;
  const blocked = !allowChat && self?.role === "attendee";

  // Messages visible to me: everyone-messages, and private ones I sent or received.
  const visible = messages.filter(
    (m) => m.recipientId === null || m.senderId === self?.id || m.recipientId === self?.id,
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [visible.length]);

  function send() {
    const body = draft.trim();
    if (!body || blocked) return;
    roomActions.sendChat(body, recipient);
    setDraft("");
  }

  return (
    <SidePanel
      title={meeting?.title ?? "Chat"}
      icon={<MessagesSquare className="size-5 text-[#5c8dff]" strokeWidth={1.6} />}
      onClose={() => setPanel(null)}
      footer={
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => toast("Everyone in the meeting can see group messages; direct messages are private")}
            className="flex w-full items-center justify-center gap-1.5 bg-room-control py-1.5 text-xs text-room-text-2"
          >
            <UserRound className="size-3.5" /> Who can see your messages?
          </button>
          <div className="flex items-center gap-2 px-2 pt-2 text-xs text-room-text-2">
            to:
            <Popover
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              tone="dark"
              side="top"
              className="max-h-64 w-60 overflow-y-auto"
              anchor={
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  className="rounded-full bg-zoom-blue px-3.5 py-1 text-[13px] text-white"
                >
                  {recipient?.name ?? "Meeting Group Chat"}
                </button>
              }
            >
              <MenuItem tone="dark" onClick={() => (setRecipientId(null), setPickerOpen(false))}>
                Meeting Group Chat
              </MenuItem>
              {others.map((p) => (
                <MenuItem key={p.id} tone="dark" onClick={() => (setRecipientId(p.id), setPickerOpen(false))}>
                  {p.name}
                </MenuItem>
              ))}
            </Popover>
          </div>
          <textarea
            aria-label="Type message"
            value={draft}
            disabled={blocked}
            placeholder={blocked ? "The host has disabled chat" : "Type message here ..."}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={3}
            className="w-full resize-none bg-transparent px-2 pt-2 text-sm text-white placeholder:text-[#e1e1e3] focus:outline-none disabled:placeholder:text-room-text-2"
          />
          <div className="flex items-center gap-3 px-2.5 pb-2.5 text-room-text-2">
            <button type="button" aria-label="Format" onClick={() => toast("Rich text isn't available")}>
              <PenLine className="size-4" />
            </button>
            <button type="button" aria-label="File" onClick={() => toast("File sharing isn't available")}>
              <FileText className="size-4" />
            </button>
            <Popover
              open={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              tone="dark"
              side="top"
              className="flex gap-1 px-2 py-2"
              anchor={
                <button type="button" aria-label="Emoji" onClick={() => setEmojiOpen((o) => !o)}>
                  <Smile className="size-4" />
                </button>
              }
            >
              {QUICK_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => (setDraft((d) => d + e), setEmojiOpen(false))}
                  className="rounded p-1 text-lg hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </Popover>
            <Ellipsis className="size-4" />
            <button
              type="button"
              aria-label="Send"
              onClick={send}
              disabled={!draft.trim() || blocked}
              className={clsx(
                "ml-auto flex size-7 items-center justify-center rounded-md",
                draft.trim() ? "bg-zoom-blue text-white" : "bg-room-control text-[#6c717f]",
              )}
            >
              <SendHorizontal className="size-4" />
            </button>
          </div>
        </div>
      }
    >
      <div ref={listRef} className="flex h-full flex-col overflow-y-auto px-4 pb-3">
        <p className="mx-auto max-w-[320px] pt-1 pb-4 text-center text-xs text-room-text-2">
          Messages addressed to &quot;Meeting Group Chat&quot; will also appear in the meeting group chat in Team Chat
        </p>
        {visible.map((m, i) => {
          const mine = m.senderId === self?.id;
          const prev = visible[i - 1];
          const grouped = prev && prev.senderId === m.senderId && prev.recipientId === m.recipientId;
          const to = m.recipientId === null ? "Everyone" : m.recipientId === self?.id ? "Me" : m.recipientName;
          return (
            <div key={m.id} className={clsx("flex flex-col", grouped ? "mt-1" : "mt-3")}>
              {!grouped && (
                <p className="mb-1 text-xs text-room-text-2">
                  <span className="font-semibold text-white">{mine ? "Me" : m.senderName}</span> to{" "}
                  <span className={clsx(m.recipientId && "text-[#ff8a80]")}>{to}</span>
                  {m.recipientId && " (Direct Message)"}
                  <span className="ml-2">
                    {new Date(m.sentAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </p>
              )}
              <p className="w-fit max-w-full rounded-lg bg-room-control px-3 py-2 text-sm break-words whitespace-pre-wrap">
                {m.body}
              </p>
            </div>
          );
        })}
      </div>
    </SidePanel>
  );
}
