"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2, Plus, Trash2 } from "lucide-react";

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface TodoPanelProps {
  refreshKey: number;
}

function normalizeTodo(value: unknown): TodoItem {
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const text =
    typeof obj.text === "string"
      ? obj.text
      : typeof obj.title === "string"
        ? obj.title
        : "";

  return {
    id: typeof obj.id === "string" ? obj.id : "",
    text,
    completed: obj.completed === true,
    createdAt:
      typeof obj.createdAt === "string" && obj.createdAt.length > 0
        ? obj.createdAt
        : new Date(0).toISOString(),
  };
}

function sortTodos(todos: TodoItem[]) {
  return [...todos].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const maybeError = (payload as Record<string, unknown>).error;
    if (typeof maybeError === "string" && maybeError.trim().length > 0) {
      return maybeError;
    }
  }

  return fallback;
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function TodoPanel({ refreshKey }: TodoPanelProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const completedCount = useMemo(
    () => todos.filter((todo) => todo.completed).length,
    [todos]
  );

  useEffect(() => {
    let active = true;

    const loadTodos = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/todo", { method: "GET" });
        const payload = await safeReadJson(response);

        if (!response.ok) {
          throw new Error(extractErrorMessage(payload, "Failed to fetch todos."));
        }

        const rawTodos =
          payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).todos)
            ? ((payload as Record<string, unknown>).todos as unknown[])
            : [];

        const normalized = rawTodos
          .map((todo) => normalizeTodo(todo))
          .filter((todo) => todo.id.length > 0 && todo.text.length > 0);

        if (!active) {
          return;
        }

        setTodos(sortTodos(normalized));
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "Failed to fetch todos.";
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadTodos();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleAddTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = draft.trim();
    if (!text || isSubmitting) {
      return;
    }

    const optimisticTodo: TodoItem = {
      id: `optimistic-${Date.now()}`,
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setError(null);
    setDraft("");
    setIsSubmitting(true);
    setTodos((prev) => sortTodos([...prev, optimisticTodo]));

    try {
      const response = await fetch("/api/todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const payload = await safeReadJson(response);

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "Failed to create todo."));
      }

      const todoPayload =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>).todo
          : null;

      const createdTodo = normalizeTodo(todoPayload);
      setTodos((prev) =>
        sortTodos(
          prev.map((todo) =>
            todo.id === optimisticTodo.id && createdTodo.id
              ? { ...createdTodo }
              : todo
          )
        )
      );
    } catch (createError) {
      setTodos((prev) => prev.filter((todo) => todo.id !== optimisticTodo.id));
      setDraft(text);

      const message =
        createError instanceof Error ? createError.message : "Failed to create todo.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const setPending = (todoId: string, value: boolean) => {
    setPendingById((prev) => {
      if (value) {
        return { ...prev, [todoId]: true };
      }

      const rest = { ...prev };
      delete rest[todoId];
      return rest;
    });
  };

  const handleToggle = async (todo: TodoItem) => {
    const nextCompleted = !todo.completed;

    setError(null);
    setPending(todo.id, true);
    setTodos((prev) =>
      prev.map((item) =>
        item.id === todo.id ? { ...item, completed: nextCompleted } : item
      )
    );

    try {
      const response = await fetch("/api/todo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: todo.id, completed: nextCompleted }),
      });

      const payload = await safeReadJson(response);

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "Failed to update todo."));
      }

      const todoPayload =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>).todo
          : null;

      const updatedTodo = normalizeTodo(todoPayload);
      if (updatedTodo.id) {
        setTodos((prev) =>
          prev.map((item) =>
            item.id === todo.id ? { ...item, ...updatedTodo, id: todo.id } : item
          )
        );
      }
    } catch (toggleError) {
      setTodos((prev) =>
        prev.map((item) =>
          item.id === todo.id ? { ...item, completed: todo.completed } : item
        )
      );

      const message =
        toggleError instanceof Error ? toggleError.message : "Failed to update todo.";
      setError(message);
    } finally {
      setPending(todo.id, false);
    }
  };

  const handleDelete = async (todo: TodoItem) => {
    setError(null);
    setPending(todo.id, true);
    setTodos((prev) => prev.filter((item) => item.id !== todo.id));

    try {
      const response = await fetch("/api/todo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: todo.id }),
      });

      const payload = await safeReadJson(response);

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "Failed to delete todo."));
      }
    } catch (deleteError) {
      setTodos((prev) => sortTodos([...prev, todo]));

      const message =
        deleteError instanceof Error ? deleteError.message : "Failed to delete todo.";
      setError(message);
    } finally {
      setPending(todo.id, false);
    }
  };

  return (
    <section className="rounded-xl border border-black/10 bg-white/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          Todo List
        </p>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
          {todos.length - completedCount} open / {completedCount} done
        </span>
      </div>

      <form onSubmit={handleAddTodo} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a todo"
          className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!draft.trim() || isSubmitting}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Add todo"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </form>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-2">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading todos...
          </div>
        ) : todos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            No todos yet. Ask Kiki to create one or add it here.
          </p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {todos.map((todo) => {
                const isPending = pendingById[todo.id] === true;

                return (
                  <motion.li
                    key={todo.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                      todo.completed
                        ? "border-emerald-200 bg-emerald-50/70"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleToggle(todo)}
                      disabled={isPending}
                      aria-label={todo.completed ? "Mark todo as incomplete" : "Mark todo as complete"}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <motion.span
                        animate={{ scale: todo.completed ? 1 : 0.94, rotate: todo.completed ? 0 : -6 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                      >
                        {todo.completed ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                        ) : (
                          <Circle className="h-4.5 w-4.5" />
                        )}
                      </motion.span>
                    </button>

                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        todo.completed ? "text-gray-500 line-through" : "text-gray-800"
                      }`}
                    >
                      {todo.text}
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleDelete(todo)}
                      disabled={isPending}
                      aria-label="Delete todo"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
