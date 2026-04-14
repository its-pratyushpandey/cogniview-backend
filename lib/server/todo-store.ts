import "server-only";

import type { DocumentData } from "firebase-admin/firestore";

import { adminDb } from "@/firebase/admin";

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface TodoUpdateInput {
  id: string;
  text?: string;
  completed?: boolean;
}

const MAX_TODO_TEXT_LENGTH = 500;

function itemsCollection(userId: string) {
  return adminDb.collection("todos").doc(userId).collection("items");
}

function normalizeCreatedAt(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return new Date(0).toISOString();
}

function toTodoItem(id: string, data: DocumentData | undefined): TodoItem {
  const textValue =
    typeof data?.text === "string"
      ? data.text
      : typeof data?.title === "string"
        ? data.title
        : "";

  return {
    id,
    text: textValue,
    completed: data?.completed === true,
    createdAt: normalizeCreatedAt(data?.createdAt),
  };
}

export function sanitizeTodoText(input: string): string {
  const normalized = input.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Todo text is required.");
  }

  if (normalized.length > MAX_TODO_TEXT_LENGTH) {
    throw new Error(`Todo text must be at most ${MAX_TODO_TEXT_LENGTH} characters.`);
  }

  return normalized;
}

export async function listTodos(userId: string): Promise<TodoItem[]> {
  const snapshot = await itemsCollection(userId).orderBy("createdAt", "asc").get();

  return snapshot.docs
    .map((doc) => toTodoItem(doc.id, doc.data()))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createTodo(userId: string, text: string): Promise<TodoItem> {
  const normalizedText = sanitizeTodoText(text);
  const docRef = itemsCollection(userId).doc();

  const todoData = {
    text: normalizedText,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  await docRef.set(todoData);

  return {
    id: docRef.id,
    ...todoData,
  };
}

export async function updateTodo(
  userId: string,
  todoId: string,
  updates: Pick<TodoUpdateInput, "text" | "completed">
): Promise<TodoItem> {
  const normalizedTodoId = todoId.trim();
  if (!normalizedTodoId) {
    throw new Error("Todo id is required.");
  }

  const docRef = itemsCollection(userId).doc(normalizedTodoId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new Error("Todo not found.");
  }

  const patch: Record<string, unknown> = {};

  if (typeof updates.text === "string") {
    patch.text = sanitizeTodoText(updates.text);
  }

  if (typeof updates.completed === "boolean") {
    patch.completed = updates.completed;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No valid todo fields provided for update.");
  }

  await docRef.set(patch, { merge: true });

  return toTodoItem(normalizedTodoId, {
    ...(snapshot.data() ?? {}),
    ...patch,
  });
}

export async function batchUpdateTodos(
  userId: string,
  updates: TodoUpdateInput[]
): Promise<TodoItem[]> {
  if (!updates.length) {
    return [];
  }

  const refs = updates.map((update) => itemsCollection(userId).doc(update.id.trim()));
  const snapshots = await adminDb.getAll(...refs);

  const batch = adminDb.batch();
  const updatedTodos: TodoItem[] = [];

  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) {
      return;
    }

    const update = updates[index];
    const patch: Record<string, unknown> = {};

    if (typeof update.text === "string") {
      patch.text = sanitizeTodoText(update.text);
    }

    if (typeof update.completed === "boolean") {
      patch.completed = update.completed;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    batch.set(snapshot.ref, patch, { merge: true });
    updatedTodos.push(
      toTodoItem(snapshot.id, {
        ...(snapshot.data() ?? {}),
        ...patch,
      })
    );
  });

  if (updatedTodos.length === 0) {
    return [];
  }

  await batch.commit();

  return updatedTodos;
}

export async function deleteTodo(userId: string, todoId: string): Promise<void> {
  const normalizedTodoId = todoId.trim();
  if (!normalizedTodoId) {
    throw new Error("Todo id is required.");
  }

  await itemsCollection(userId).doc(normalizedTodoId).delete();
}

export async function batchDeleteTodos(userId: string, todoIds: string[]): Promise<number> {
  const uniqueIds = Array.from(
    new Set(todoIds.map((id) => id.trim()).filter((id) => id.length > 0))
  );

  if (!uniqueIds.length) {
    return 0;
  }

  const batch = adminDb.batch();
  uniqueIds.forEach((todoId) => {
    batch.delete(itemsCollection(userId).doc(todoId));
  });

  await batch.commit();
  return uniqueIds.length;
}
