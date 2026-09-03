import { useMemo, useSyncExternalStore } from "react";
import { AlarmClock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  getReminder,
  setReminder,
  clearReminder,
  hasActiveReminder,
  getRemindersVersion,
  subscribeReminders,
  type PRReminder,
} from "../lib/reminders";
import { cn } from "../cn";

/** Local time one hour in the future. */
function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

/** Tomorrow (or next Monday for `nextWeek`) at 9:00 local time. */
function morningAt(daysAhead: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(9, 0, 0, 0);
  return d;
}

function nextMondayMorning(): Date {
  const daysAhead = (8 - new Date().getDay()) % 7 || 7;
  return morningAt(daysAhead);
}

/** Compact future-relative label, e.g. "in 25m", "in 3h", "in 2d". */
function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

const PRESETS: Array<{ label: string; at: () => Date }> = [
  { label: "30 minutes", at: () => hoursFromNow(0.5) },
  { label: "1 hour", at: () => hoursFromNow(1) },
  { label: "3 hours", at: () => hoursFromNow(3) },
  { label: "Tomorrow 9:00", at: () => morningAt(1) },
  { label: "Next week (Mon 9:00)", at: nextMondayMorning },
];

interface ReminderMenuProps {
  prId: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  authorLogin?: string;
  className?: string;
  iconClassName?: string;
}

/** Slack-style "Remind me about this PR" menu. The trigger calls
 *  preventDefault so BlockLink row containers don't re-dispatch the click
 *  onto the row's link. */
export function ReminderMenu({
  prId,
  owner,
  repo,
  number,
  title,
  authorLogin,
  className,
  iconClassName,
}: ReminderMenuProps) {
  const version = useSyncExternalStore(subscribeReminders, getRemindersVersion);
  const existing: PRReminder | null = useMemo(
    () => getReminder(prId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prId, version]
  );
  const active = existing && hasActiveReminder(prId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Remind me about this PR"
          title="Remind me"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={cn(
            "relative p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0",
            className
          )}
        >
          <AlarmClock className={cn("w-3.5 h-3.5", iconClassName)} />
          {active && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[11rem]">
        <DropdownMenuLabel>
          {existing ? `Reminding ${timeUntil(existing.remindAt)}` : "Remind me"}
        </DropdownMenuLabel>
        {existing && <DropdownMenuSeparator />}
        {PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onSelect={() =>
              setReminder(prId, {
                owner,
                repo,
                number,
                title,
                authorLogin,
                remindAt: preset.at().toISOString(),
              })
            }
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
        {existing && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => clearReminder(prId)}
            >
              Remove reminder
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
