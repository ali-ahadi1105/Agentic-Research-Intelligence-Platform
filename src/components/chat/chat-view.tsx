"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, Plus, Send, Loader2, Trash2, FileText, Quote,
  Brain, Sparkles, ChevronLeft, AlertCircle,
} from "lucide-react";
import { formatFaDateTime, timeAgo, confidenceLabel, confidenceColor } from "@/lib/fa";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { Message, Conversation } from "@/types";

export function ChatView() {
  const { currentWorkspaceId, currentConversationId, setConversation } = useAppStore();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: ["conversations", currentWorkspaceId],
    queryFn: () => api.chat.list(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  const { data: currentConv } = useQuery({
    queryKey: ["conversation", currentWorkspaceId, currentConversationId],
    queryFn: () => api.chat.get(currentWorkspaceId!, currentConversationId!),
    enabled: !!currentWorkspaceId && !!currentConversationId,
    refetchInterval: false,
  });

  const createMutation = useMutation({
    mutationFn: () => api.chat.create(currentWorkspaceId!),
    onSuccess: (conv) => {
      setConversation(conv.id);
      qc.invalidateQueries({ queryKey: ["conversations", currentWorkspaceId] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: ({ convId, question }: { convId: string; question: string }) =>
      api.chat.send(currentWorkspaceId!, convId, question),
    onMutate: async ({ convId, question }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ["conversation", currentWorkspaceId, convId] });
      const previous = qc.getQueryData<Message[]>(["conversation", currentWorkspaceId, convId]);
      // We don't update here because we need the response
      return { previous };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation", currentWorkspaceId, currentConversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", currentWorkspaceId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  const deleteMutation = useMutation({
    mutationFn: (convId: string) => api.chat.delete(currentWorkspaceId!, convId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", currentWorkspaceId] });
      setConversation(null);
      toast.success("گفتگو حذف شد");
    },
  });

  const handleSend = async () => {
    if (!input.trim() || !currentConversationId || isSending) return;
    const question = input.trim();
    setInput("");
    setIsSending(true);

    // Optimistic: show user message immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: currentConversationId,
      role: "user",
      content: question,
      citations: [],
      relatedEntities: [],
      confidence: null,
      createdAt: new Date().toISOString(),
    };

    // Get current messages
    const currentMessages = currentConv?.messages || [];
    qc.setQueryData(
      ["conversation", currentWorkspaceId, currentConversationId],
      {
        ...currentConv,
        messages: [...currentMessages, optimisticMessage],
      }
    );

    try {
      const result = await sendMutation.mutateAsync({
        convId: currentConversationId,
        question,
      });

      // Add assistant response
      const currentAfter = qc.getQueryData<Conversation & { messages: Message[] }>(
        ["conversation", currentWorkspaceId, currentConversationId]
      );
      qc.setQueryData(
        ["conversation", currentWorkspaceId, currentConversationId],
        {
          ...currentAfter,
          messages: [...(currentAfter?.messages || []), result.message],
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ارسال پیام");
    } finally {
      setIsSending(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConv?.messages]);

  if (!currentWorkspaceId) return null;

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-4 animate-fade-in">
      {/* Conversations sidebar */}
      <Card className="w-64 shrink-0 hidden lg:flex flex-col">
        <div className="p-3 border-b">
          <Button
            className="w-full"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Plus className="size-4 ml-2" />
            گفتگوی جدید
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                className={`p-2 rounded-md cursor-pointer text-sm transition-colors group ${
                  currentConversationId === conv.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
                onClick={() => setConversation(conv.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{conv.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {timeAgo(conv.updatedAt)}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(conv.id);
                    }}
                  >
                    <Trash2 className="size-3 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            {conversations?.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                گفتگویی وجود ندارد
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col min-w-0">
        {!currentConversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="size-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">گفتگوی هوشمند با دانش‌نامه</h3>
              <p className="text-muted-foreground text-sm mb-4">
                دستیار هوشمند بر اساس دانش‌نامه شما پاسخ می‌دهد — هر پاسخ با شواهد و منابع
              </p>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                <Plus className="size-4 ml-2" />
                شروع گفتگو
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentConv?.messages?.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isSending && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>در حال تفکر و جستجو در دانش‌نامه...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-3 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="سؤال خود را بپرسید..."
                disabled={isSending}
              />
              <Button onClick={handleSend} disabled={!input.trim() || isSending}>
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  // Normalize citations — handle both string (raw from DB) and array (parsed)
  const citations = Array.isArray(message.citations)
    ? message.citations
    : typeof message.citations === "string"
      ? (() => {
          try { return JSON.parse(message.citations); } catch { return []; }
        })()
      : [];

  if (isUser) {
    return (
      <div className="flex justify-start">
        <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2 max-w-[80%]">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="bg-muted rounded-2xl px-4 py-3 max-w-[85%] space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1 border-b">
          <Brain className="size-3.5" />
          <span>دستیار هوشمند</span>
          {message.confidence !== null && (
            <Badge variant="secondary" className={`text-xs ${confidenceColor(message.confidence)}`}>
              اطمینان: {confidenceLabel(message.confidence)}
            </Badge>
          )}
        </div>

        <div className="prose-fa text-sm">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* Citations */}
        {citations.length > 0 && (
          <div className="space-y-2 pt-3 border-t">
            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Quote className="size-3.5" />
              شواهد و منابع ({citations.length})
            </div>
            <div className="space-y-1.5">
              {citations.map((c) => (
                <div
                  key={c.index}
                  className="text-xs bg-background border-r-2 border-accent p-2 rounded"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      شاهد {c.index}
                    </Badge>
                    <span className="font-medium">{c.sourceTitle}</span>
                    <Badge variant="secondary" className={`text-[10px] ${confidenceColor(c.confidence)}`}>
                      {Math.round(c.confidence * 100)}%
                    </Badge>
                  </div>
                  <p className="italic text-muted-foreground">«{c.excerpt}»</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {citations.length === 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t flex items-center gap-1">
            <AlertCircle className="size-3" />
            <span>این پاسخ بدون شاهد مستند است — لطفاً با احتیاط بررسی کنید</span>
          </div>
        )}
      </div>
    </div>
  );
}
