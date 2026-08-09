import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types";
import {
  createKnowledge,
  createProject,
  deleteKnowledge,
  deleteProject,
  getKnowledge,
  getProjectBySlug,
  listProjects,
  semanticSearch,
  searchKeyword,
  updateKnowledge,
  upsertEmbedding,
} from "../src";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const enabled = Boolean(url && serviceKey && anonKey);

describe.skipIf(!enabled)("database integration", () => {
  const admin = () =>
    createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const rand = Math.random().toString(36).slice(2, 8);
  const emailA = `pam-a-${rand}@example.com`;
  const emailB = `pam-b-${rand}@example.com`;
  const password = "test-password-123";

  let userA = "";
  let userB = "";
  let anonA: SupabaseClient<Database>;
  let anonB: SupabaseClient<Database>;
  const cleanup: (() => Promise<unknown>)[] = [];

  async function createAuthedClient(email: string, pwd: string): Promise<SupabaseClient<Database>> {
    const client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password: pwd });
    if (error || !data.session) {
      throw error ?? new Error("sign in failed");
    }
    await client.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    return client;
  }

  beforeAll(async () => {
    const client = admin();
    const a = await client.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    const b = await client.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    if (!a.data.user || !b.data.user) {
      throw new Error("failed to create integration test users");
    }
    userA = a.data.user.id;
    userB = b.data.user.id;
    anonA = await createAuthedClient(emailA, password);
    anonB = await createAuthedClient(emailB, password);
  });

  afterAll(async () => {
    for (const run of cleanup) {
      try {
        await run();
      } catch {
        // best-effort cleanup
      }
    }
    const client = admin();
    await client.auth.admin.deleteUser(userA).catch(() => {});
    await client.auth.admin.deleteUser(userB).catch(() => {});
  });

  it("CRUD for a single user", async () => {
    const client = admin();
    const project = await createProject(client, userA, { name: `Phase2 Test ${rand}` });
    cleanup.push(() => deleteProject(client, userA, project.id));
    expect(project.slug).toBe(`phase2-test-${rand}`);

    const knowledge = await createKnowledge(client, userA, {
      projectId: project.id,
      type: "pattern",
      title: "Unit test pattern",
      content: "covers CRUD",
      importance: 3,
      tags: ["alpha", "beta"],
    });
    cleanup.push(() => deleteKnowledge(client, userA, knowledge.id));

    const fetched = await getKnowledge(client, userA, knowledge.id);
    expect(fetched?.title).toBe("Unit test pattern");
    expect(fetched?.tags).toEqual(["alpha", "beta"]);
    expect(fetched?.projectSlug).toBe(project.slug);

    const updated = await updateKnowledge(client, userA, knowledge.id, { title: "Renamed" });
    expect(updated?.title).toBe("Renamed");

    expect((await getProjectBySlug(client, userA, project.slug))?.name).toBe(project.name);
    expect((await listProjects(client, userA)).some((p) => p.id === project.id)).toBe(true);
  });

  it("user B cannot see or mutate user A's data", async () => {
    const client = admin();
    const project = await createProject(client, userA, { name: `Private ${rand}` });
    cleanup.push(() => deleteProject(client, userA, project.id));
    const knowledge = await createKnowledge(client, userA, {
      projectId: project.id,
      type: "lesson",
      title: "Secret note",
      content: "hidden",
      importance: 2,
    });
    cleanup.push(() => deleteKnowledge(client, userA, knowledge.id));

    expect(await getProjectBySlug(client, userB, project.slug)).toBeNull();
    expect(await getKnowledge(client, userB, knowledge.id)).toBeNull();
    expect(await updateKnowledge(client, userB, knowledge.id, { title: "hacked" })).toBeNull();
    expect(await deleteKnowledge(client, userB, knowledge.id)).toBe(false);

    const { data: bProjects } = await anonB.from("projects").select("id");
    expect(bProjects).toHaveLength(0);

    const { data: aProjects } = await anonA.from("projects").select("id");
    expect(aProjects ?? []).toContainEqual({ id: project.id });
  });

  it("unauthenticated access is blocked by RLS", async () => {
    const anon = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
    const { data: projects } = await anon.from("projects").select("id");
    const { data: knowledge } = await anon.from("knowledge").select("id");
    expect(projects).toHaveLength(0);
    expect(knowledge).toHaveLength(0);
  });

  it("keyword search finds matching knowledge", async () => {
    const client = admin();
    const marker = `gluconaut-${rand}`;
    const knowledge = await createKnowledge(client, userA, {
      projectId: null,
      type: "feature",
      title: marker,
      content: "keyword search target content",
      importance: 2,
    });
    cleanup.push(() => deleteKnowledge(client, userA, knowledge.id));

    const hits = await searchKeyword(client, userA, marker, { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.knowledge.id).toBe(knowledge.id);
    expect(hits[0]?.keywordScore).toBeGreaterThan(0);
  });

  it("vector search ranks similar embeddings first", async () => {
    const client = admin();
    const knowledge = await createKnowledge(client, userA, {
      projectId: null,
      type: "pattern",
      title: "Vector target",
      content: "content",
      importance: 3,
    });
    cleanup.push(() => deleteKnowledge(client, userA, knowledge.id));

    const base = new Array(1536).fill(0);
    const stored = [...base];
    stored[0] = 1;
    const query = [...base];
    query[0] = 0.9;
    query[5] = 0.05;

    await upsertEmbedding(client, userA, knowledge.id, stored, "text-embedding-3-small");
    const hits = await semanticSearch(client, userA, query, { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.knowledge.id).toBe(knowledge.id);
    expect(hits[0]?.vectorScore).toBeGreaterThan(0.9);
  });
});
