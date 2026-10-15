import {useTranslation} from "react-i18next";
import {Copy, Plus, X} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input} from "@/components/ui/input.tsx";
import {DEFAULT_TIMEZONE, WEEKDAYS} from "@/lib/custom-apps/types.ts";
import type {OperatingHours, TimeWindow, Weekday} from "@/lib/custom-apps/types.ts";
import {validateHours} from "@/pages/custom-apps/components/operating-hours.ts";

const WORKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
const DEFAULT_WINDOW: TimeWindow = {start: "09:00", end: "18:00"};

/** The window after `last`: starting where it ended, an hour long, never past the end of the day. */
const nextWindow = (last: TimeWindow | undefined): TimeWindow => {
  if (!last) return DEFAULT_WINDOW;
  const [hours, minutes] = last.end.split(":").map(Number);
  const end = Math.min(hours * 60 + minutes + 60, 23 * 60 + 59);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {start: last.end, end: `${pad(Math.floor(end / 60))}:${pad(end % 60)}`};
};

/**
 * When the client uses the app, per weekday, as zero or more time windows.
 *
 * Optional as a whole: `null` means nobody said, which is different from "closed every day". The
 * schedule is what the usage heatmap is read against later, so the field is about being exact
 * rather than quick — but a client's week is usually five copies of one day, hence the copy button.
 */
export const OperatingHoursField = ({
  value,
  onChange,
  disabled,
  defaultTimezone = DEFAULT_TIMEZONE,
}: {
  value: OperatingHours | null;
  onChange: (value: OperatingHours | null) => void;
  disabled?: boolean;
  defaultTimezone?: string;
}) => {
  const {t} = useTranslation("custom_apps");
  const problems = validateHours(value);

  const setDay = (day: Weekday, windows: TimeWindow[]) => {
    if (!value) return;
    onChange({...value, days: {...value.days, [day]: windows}});
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={value !== null}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? {timezone: defaultTimezone, days: Object.fromEntries(WORKDAYS.map((day) => [day, [DEFAULT_WINDOW]]))}
                : null,
            )
          }
          className="size-4 accent-[var(--color-accent)]"
        />
        {t("hours.enabled")}
      </label>

      {value === null ? (
        <p className="text-[13px] leading-relaxed text-neutral-500">{t("hours.none")}</p>
      ) : (
        <>
          <Field label={t("hours.timezone")} htmlFor="hours-timezone" hint={t("hours.timezone_hint")} className="max-w-sm">
            <Input
              id="hours-timezone"
              value={value.timezone}
              disabled={disabled}
              onChange={(event) => onChange({...value, timezone: event.target.value})}
              className="font-mono text-[13px]"
              autoComplete="off"
            />
          </Field>

          <ul className="flex flex-col divide-y divide-neutral-800 rounded-[var(--radius-md)] border border-neutral-800">
            {WEEKDAYS.map((day) => {
              const windows = value.days[day] ?? [];
              const problem = problems[day];
              return (
                <li key={day} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start">
                  <span className="w-28 shrink-0 pt-2 text-sm text-neutral-300">{t(`weekdays.${day}`)}</span>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {windows.length === 0 && <span className="pt-2 text-[13px] text-neutral-600">{t("hours.closed")}</span>}
                    {windows.map((window, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          value={window.start}
                          disabled={disabled}
                          aria-label={t("hours.start_aria", {day: t(`weekdays.${day}`)})}
                          onChange={(event) =>
                            setDay(day, windows.map((entry, at) => (at === index ? {...entry, start: event.target.value} : entry)))
                          }
                          className="h-9 w-32 font-mono text-[13px]"
                        />
                        <span className="text-neutral-600">–</span>
                        <Input
                          type="time"
                          value={window.end}
                          disabled={disabled}
                          aria-label={t("hours.end_aria", {day: t(`weekdays.${day}`)})}
                          onChange={(event) =>
                            setDay(day, windows.map((entry, at) => (at === index ? {...entry, end: event.target.value} : entry)))
                          }
                          className="h-9 w-32 font-mono text-[13px]"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9"
                          disabled={disabled}
                          aria-label={t("hours.remove_window")}
                          onClick={() => setDay(day, windows.filter((_, at) => at !== index))}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ))}
                    {problem && <p className="text-xs text-red-400">{t(`hours.problems.${problem}`)}</p>}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => setDay(day, [...windows, nextWindow(windows[windows.length - 1])])}
                    >
                      <Plus size={14} /> {t("hours.add_window")}
                    </Button>
                    {day === "mon" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        title={t("hours.copy_weekdays_hint")}
                        onClick={() =>
                          onChange({
                            ...value,
                            days: {...value.days, ...Object.fromEntries(WORKDAYS.map((entry) => [entry, windows]))},
                          })
                        }
                      >
                        <Copy size={14} /> {t("hours.copy_weekdays")}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};
