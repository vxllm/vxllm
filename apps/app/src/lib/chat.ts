type ConversationItem = {
  id: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
};

type DateGroup = {
  label: string;
  conversations: ConversationItem[];
};

export function formatRelativeDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86_400_000);

  if (timestamp >= todayStart.getTime()) {
    return "Today";
  }
  if (timestamp >= yesterdayStart.getTime()) {
    return "Yesterday";
  }
  if (timestamp >= sevenDaysAgo.getTime()) {
    return "Last 7 days";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
  });
}

export function groupConversationsByDate(
  conversations: ConversationItem[],
): DateGroup[] {
  const groups = new Map<string, ConversationItem[]>();

  for (const conversation of conversations) {
    const label = formatRelativeDate(conversation.updatedAt);
    const existing = groups.get(label);
    if (existing) {
      existing.push(conversation);
    } else {
      groups.set(label, [conversation]);
    }
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    conversations: items,
  }));
}

export function truncateTitle(
  title: string | null,
  maxLength: number = 40,
): string {
  if (!title) {
    return "New conversation";
  }
  if (title.length <= maxLength) {
    return title;
  }
  return `${title.slice(0, maxLength)}...`;
}
