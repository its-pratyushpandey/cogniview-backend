import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/server/session-auth";
import {
  batchDeleteTodos,
  batchUpdateTodos,
  createTodo,
  deleteTodo,
  listTodos,
  type TodoItem,
  type TodoUpdateInput,
  updateTodo,
} from "@/lib/server/todo-store";

export const dynamic = "force-dynamic";

type TodoResponseItem = TodoItem & { title: string };

interface CreateTodoBody {
  text?: unknown;
  title?: unknown;
}

interface SingleUpdateBody {
  id?: unknown;
  todoId?: unknown;
  text?: unknown;
  title?: unknown;
  completed?: unknown;
}

interface BatchUpdateBody {
  updates?: unknown;
}

interface DeleteTodoBody {
  id?: unknown;
  todoId?: unknown;
  ids?: unknown;
}

function toTodoResponseItem(todo: TodoItem): TodoResponseItem {
  return {
    ...todo,
    title: todo.text,
  };
}

function getErrorDetails(error: unknown): { message: string; status: number } {
  const message = error instanceof Error ? error.message : String(error);

  if (/not found/i.test(message)) {
    return { message, status: 404 };
  }

  if (/required|invalid|empty|at most|valid/i.test(message)) {
    return { message, status: 400 };
  }

  return { message, status: 500 };
}

async function parseJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

async function requireUserId() {
  const userId = await getSessionUserId();

  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    userId,
    response: null,
  };
}

export async function POST(req: Request) {
  const authResult = await requireUserId();
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const body = await parseJson<CreateTodoBody>(req);
    const text =
      typeof body?.text === "string"
        ? body.text
        : typeof body?.title === "string"
          ? body.title
          : "";

    if (!text.trim()) {
      return NextResponse.json({ error: "Todo text is required" }, { status: 400 });
    }

    const todo = await createTodo(authResult.userId, text);
    const todos = await listTodos(authResult.userId);

    return NextResponse.json({
      message: `Todo created: "${todo.text}"`,
      todo: toTodoResponseItem(todo),
      totalTodos: todos.length,
    });
  } catch (error) {
    const { message, status } = getErrorDetails(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET() {
  const authResult = await requireUserId();
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const todos = await listTodos(authResult.userId);
    return NextResponse.json({
      todos: todos.map(toTodoResponseItem),
      count: todos.length,
    });
  } catch (error) {
    const { message, status } = getErrorDetails(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  const authResult = await requireUserId();
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const body = await parseJson<SingleUpdateBody & BatchUpdateBody>(req);
    const updatesRaw = Array.isArray(body?.updates) ? body.updates : null;

    if (updatesRaw && updatesRaw.length > 0) {
      const updates: TodoUpdateInput[] = [];

      updatesRaw.forEach((entry) => {
        const value =
          typeof entry === "object" && entry ? (entry as SingleUpdateBody) : null;
        if (!value) {
          return;
        }

        const id =
          typeof value.id === "string"
            ? value.id
            : typeof value.todoId === "string"
              ? value.todoId
              : "";

        const text =
          typeof value.text === "string"
            ? value.text
            : typeof value.title === "string"
              ? value.title
              : undefined;

        const completed =
          typeof value.completed === "boolean" ? value.completed : undefined;

        if (!id.trim()) {
          return;
        }

        const normalizedUpdate: TodoUpdateInput = { id };
        if (typeof text === "string") {
          normalizedUpdate.text = text;
        }
        if (typeof completed === "boolean") {
          normalizedUpdate.completed = completed;
        }

        if (
          typeof normalizedUpdate.text !== "string" &&
          typeof normalizedUpdate.completed !== "boolean"
        ) {
          return;
        }

        updates.push(normalizedUpdate);
      });

      if (!updates.length) {
        return NextResponse.json({ error: "No valid updates provided." }, { status: 400 });
      }

      const updated = await batchUpdateTodos(authResult.userId, updates);
      return NextResponse.json({
        updated: updated.map(toTodoResponseItem),
        count: updated.length,
      });
    }

    const todoId =
      typeof body?.id === "string"
        ? body.id
        : typeof body?.todoId === "string"
          ? body.todoId
          : "";

    const text =
      typeof body?.text === "string"
        ? body.text
        : typeof body?.title === "string"
          ? body.title
          : undefined;

    const completed = typeof body?.completed === "boolean" ? body.completed : undefined;

    if (!todoId.trim()) {
      return NextResponse.json({ error: "Todo id is required." }, { status: 400 });
    }

    if (typeof text !== "string" && typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "Provide at least one valid field to update." },
        { status: 400 }
      );
    }

    const updatedTodo = await updateTodo(authResult.userId, todoId, { text, completed });

    return NextResponse.json({
      message: "Todo updated successfully.",
      todo: toTodoResponseItem(updatedTodo),
    });
  } catch (error) {
    const { message, status } = getErrorDetails(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  const authResult = await requireUserId();
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const url = new URL(req.url);
    const queryTodoId = url.searchParams.get("id") ?? url.searchParams.get("todoId");
    const body = await parseJson<DeleteTodoBody>(req);

    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((value): value is string => typeof value === "string")
      : [];

    if (ids.length > 0) {
      const deletedCount = await batchDeleteTodos(authResult.userId, ids);
      return NextResponse.json({
        message: "Todos deleted successfully.",
        deleted: deletedCount,
      });
    }

    const todoId =
      queryTodoId ??
      (typeof body?.id === "string"
        ? body.id
        : typeof body?.todoId === "string"
          ? body.todoId
          : "");

    if (!todoId.trim()) {
      return NextResponse.json({ error: "Todo id is required." }, { status: 400 });
    }

    await deleteTodo(authResult.userId, todoId);

    return NextResponse.json({
      message: "Todo deleted successfully.",
      id: todoId,
    });
  } catch (error) {
    const { message, status } = getErrorDetails(error);
    return NextResponse.json({ error: message }, { status });
  }
}
