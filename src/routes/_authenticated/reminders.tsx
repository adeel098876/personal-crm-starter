import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeReminder,
  createReminder,
  listReminders,
  snoozeReminder,
} from "@/lib/reminders.functions";
import { listPeople } from "@/lib/people.functions";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reminders")({
  component: RemindersPage,
});

function RemindersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listReminders);
  const create = useServerFn(createReminder);
  const done = useServerFn(completeReminder);
  const snooze = useServerFn(snoozeReminder);
  const people = useServerFn(listPeople);

  const [tab, setTab] = useState<"open" | "done">("open");
  const [openCreate, setOpenCreate] = useState(false);

  const q = useQuery({
    queryKey: ["reminders", tab],
    queryFn: () => list({ data: { status: tab } }),
  });
  const pplQuery = useQuery({
    queryKey: ["people-mini"],
    queryFn: () => people({ data: {} }),
  });

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [personId, setPersonId] = useState<string>("");

  const createMut = useMutation({
    mutationFn: (vars?: { title: string; due: Date; person_id: string }) => {
      const t = vars?.title ?? title;
      const d = vars?.due ?? dueDate;
      const p = vars?.person_id ?? personId;

      if (!t.trim()) {
        throw new Error("Please enter what to remember");
      }
      if (!d || isNaN(d.getTime())) {
        throw new Error("Please select a valid due date");
      }

      return create({
        data: {
          title: t.trim(),
          due_at: d.toISOString(),
          person_id: p || null,
          kind: "custom",
        },
      });
    },
    onSuccess: () => {
      setTitle("");
      setDueDate(addDays(new Date(), 1));
      setPersonId("");
      setOpenCreate(false);
      toast.success("Reminder added ✓");
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add reminder"),
  });

  const handleQuickAdd = () => {
    if (!title.trim()) {
      toast.error("Please enter what to remember");
      return;
    }
    if (!dueDate || isNaN(dueDate.getTime())) {
      toast.error("Please select a valid due date");
      return;
    }
    createMut.mutate({ title, due: dueDate, person_id: personId });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Cadence
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
            Reminders
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-lg cursor-pointer"
        >
          Add reminder
        </button>
      </header>

      {/* Quick Add Bar */}
      <div className="glass-panel rounded-3xl p-6 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="What to remember…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleQuickAdd();
            }}
            className="md:col-span-2 glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
          />
          <DatePicker
            date={dueDate}
            onDateChange={setDueDate}
            placeholder="Pick due date"
            className="w-full"
          />
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
          >
            <option value="" className="bg-popover text-popover-foreground">
              — No person —
            </option>
            {pplQuery.data?.people.map((p) => (
              <option key={p.id} value={p.id} className="bg-popover text-popover-foreground">
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={createMut.isPending}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-all hover:opacity-90 active:scale-95 shadow-md cursor-pointer"
          >
            {createMut.isPending ? "Adding…" : "Add reminder"}
          </button>
        </div>
      </div>

      <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-wider">
        {(["open", "done"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full border transition-all duration-200 cursor-pointer ${
              tab === t
                ? "border-primary/40 bg-primary/10 text-primary font-bold shadow-sm"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-border shadow-xl">
        {q.data?.reminders.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No {tab} reminders.</p>
        )}
        {q.isError && (
          <div className="p-8 text-center">
            <div className="glass-panel rounded-2xl p-5 border-destructive/30 bg-destructive/5 max-w-sm mx-auto">
              <p className="text-sm font-semibold text-destructive mb-1">
                We couldn't load your reminders.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Your connection is fine — the request failed on our end.
              </p>
              <button
                type="button"
                onClick={() => q.refetch()}
                disabled={q.isFetching}
                className="text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20 bg-primary/10 rounded-full px-3.5 py-1.5 hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-50"
              >
                {q.isFetching ? "Retrying…" : "Try again"}
              </button>
            </div>
          </div>
        )}
        {q.data?.reminders.map((r) => (
          <div
            key={r.id}
            className="p-4.5 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                {r.people?.name ?? "General"} · {format(new Date(r.due_at), "MMM d, yyyy")}
              </p>
            </div>
            {tab === "open" && (
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await done({ data: { id: r.id } });
                      toast.success("Reminder marked done ✓");
                      qc.invalidateQueries({ queryKey: ["reminders"] });
                      qc.invalidateQueries({ queryKey: ["dashboard"] });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to complete");
                    }
                  }}
                  className="text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20 bg-primary/10 rounded-full px-3.5 py-1.5 hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 cursor-pointer"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await snooze({ data: { id: r.id, days: 7 } });
                      toast.success("Snoozed for 7 days");
                      qc.invalidateQueries({ queryKey: ["reminders"] });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed to snooze");
                    }
                  }}
                  className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground border border-border bg-surface rounded-full px-3.5 py-1.5 hover:bg-surface-2 hover:text-foreground transition-all active:scale-95 cursor-pointer"
                >
                  +7d
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Reminder Dialog Modal */}
      {openCreate && (
        <CreateReminderDialog
          people={pplQuery.data?.people ?? []}
          onClose={() => setOpenCreate(false)}
          onSubmit={(vars) => createMut.mutate(vars)}
          busy={createMut.isPending}
        />
      )}
    </div>
  );
}

const createReminderSchema = z.object({
  title: z.string().trim().min(1, "Please enter what to remember"),
  due: z.date({
    required_error: "Please select a due date",
    invalid_type_error: "Please select a due date",
  }),
  person_id: z.string(),
});

type CreateReminderFormValues = z.infer<typeof createReminderSchema>;

function CreateReminderDialog({
  people,
  onClose,
  onSubmit,
  busy,
}: {
  people: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (v: { title: string; due: Date; person_id: string }) => void;
  busy: boolean;
}) {
  const form = useForm<CreateReminderFormValues>({
    resolver: zodResolver(createReminderSchema),
    defaultValues: {
      title: "",
      due: addDays(new Date(), 1),
      person_id: "",
    },
  });

  const handleFormSubmit = form.handleSubmit(
    (values) => {
      onSubmit({
        title: values.title.trim(),
        due: values.due,
        person_id: values.person_id,
      });
    },
    (errors) => {
      const firstError = Object.values(errors)[0];
      if (firstError?.message) {
        toast.error(String(firstError.message));
      }
    },
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="glass-panel max-w-md p-6.5 rounded-3xl shadow-2xl border-border bg-transparent backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground pl-1">New Reminder</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleFormSubmit} className="space-y-5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                    What to remember
                  </FormLabel>
                  <FormControl>
                    <input
                      autoFocus
                      placeholder="e.g. Follow up on design review"
                      {...field}
                      className="mt-1.5 w-full glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                      Due Date
                    </FormLabel>
                    <FormControl>
                      <div className="mt-1.5">
                        <DatePicker
                          date={field.value}
                          onDateChange={field.onChange}
                          placeholder="Pick due date"
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="person_id"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                      Person (optional)
                    </FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="mt-1.5 w-full glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
                      >
                        <option value="" className="bg-popover text-popover-foreground">
                          — No person —
                        </option>
                        {people.map((p) => (
                          <option
                            key={p.id}
                            value={p.id}
                            className="bg-popover text-popover-foreground"
                          >
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-border hover:bg-surface-2 rounded-full text-xs font-semibold text-foreground transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
