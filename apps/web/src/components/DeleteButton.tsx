"use client";

import { useTransition } from "react";
import { deleteKnowledgeAction } from "@/actions/knowledge";

export function DeleteButton({
  knowledgeId,
  title,
}: {
  knowledgeId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(`Delete "${title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    const formData = new FormData();
    formData.set("knowledgeId", knowledgeId);
    startTransition(() => {
      void deleteKnowledgeAction(formData);
    });
  }

  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={handleDelete}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
