import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  GetCurrentAuthUserResponse,
  LogoutMobileSessionResponse,
  ExchangeMobileAuthorizationCodeResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  deleteSession,
  verifyPassword,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";
import { hashPassword } from "../lib/auth";

const router: IRouter = Router();

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

const LocalLoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const MobileLoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const CreateUserBody = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["agent", "assistant"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
});

const PatchUserBody = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["agent", "assistant"]).optional(),
});

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = LocalLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is deactivated" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ success: true });
});

router.post("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

router.post("/mobile-auth/login", async (req: Request, res: Response) => {
  const parsed = MobileLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required parameters" });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is deactivated" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
    },
  };

  const sid = await createSession(sessionData);
  res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
});

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

router.get("/admin/users", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.isSystemAccount, false));

  res.json({ users });
});

router.post("/admin/users", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { username, password, role, firstName, lastName, email } = parsed.data;

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (existing) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);

  const [newUser] = await db
    .insert(usersTable)
    .values({
      username,
      passwordHash,
      role,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      email: email ?? null,
      isSystemAccount: false,
      isActive: true,
    })
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });

  res.status(201).json({ user: newUser });
});

router.patch("/admin/users/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = PatchUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.isSystemAccount, false)));

  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updates: Partial<{ isActive: boolean; role: "agent" | "assistant" }> = {};
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });

  res.json({ user: updated });
});

export default router;
