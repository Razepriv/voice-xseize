import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import memoize from "memoizee";
import crypto from "crypto";
import type { User, UserRole } from "@shared/schema";
import { supabaseAuthClient, supabaseAdmin, type SupabaseUser, type SupabaseSession } from "./supabaseClient";
import { storage } from "./storage";

// Rate limiting store
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const pgStore = connectPg(session);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const devLoginEmail = process.env.DEV_LOGIN_EMAIL;
const devLoginPassword = process.env.DEV_LOGIN_PASSWORD;
const basicAuthEnabled = process.env.BASIC_AUTH_ENABLED !== "false";
const BASIC_AUTH_DEFAULT_ROLE: UserRole = "admin";

// Security constants
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AuthenticatedUser {
  claims: {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
  };
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface User extends AuthenticatedUser { }
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Security helper functions
function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: 'Password is too long' };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return { valid: false, error: 'Password must contain uppercase, lowercase, number, and special character' };
  }

  return { valid: true };
}

function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  if (trimmedName.length > 100) {
    return { valid: false, error: 'Name is too long' };
  }

  return { valid: true };
}

function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>"']/g, '');
}

function checkRateLimit(identifier: string): { allowed: boolean; resetIn?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(identifier);

  if (!attempt || now > attempt.resetAt) {
    loginAttempts.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    const resetIn = Math.ceil((attempt.resetAt - now) / 1000 / 60);
    return { allowed: false, resetIn };
  }

  attempt.count++;
  return { allowed: true };
}

function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function verifyCSRFToken(req: any): boolean {
  const sessionToken = req.session.csrfToken;
  const bodyToken = req.body?._csrf;
  return sessionToken && bodyToken && sessionToken === bodyToken;
}

function getClientIdentifier(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.ip || req.connection.remoteAddress;
  return `${ip}-${req.headers['user-agent']}`;
}

const ensureSessionSecret = () => {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set");
  }
};

export const sessionMiddleware = memoize(() => {
  ensureSessionSecret();
  return session({
    secret: process.env.SESSION_SECRET!,
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: SESSION_TTL_MS / 1000,
      tableName: "sessions",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_MS,
      sameSite: 'strict', // CSRF protection
    },
    name: 'megna.sid', // Custom session name
  });
});

function buildClaims(user: SupabaseUser) {
  const metadata = user.user_metadata || {};
  const fullName = metadata.full_name || metadata.name || "";
  const [firstName, ...rest] = fullName.split(" ").filter(Boolean);
  const lastName = rest.join(" ");
  return {
    sub: user.id,
    email: user.email ?? undefined,
    first_name: metadata.first_name || firstName || undefined,
    last_name: metadata.last_name || lastName || undefined,
    profile_image_url: metadata.avatar_url || metadata.picture || undefined,
  };
}

async function ensureAppUser(user: SupabaseUser) {
  const { email } = user;
  if (!email) {
    throw new Error("Supabase user is missing email");
  }

  let existing = await storage.getUser(user.id);
  if (existing) {
    await storage.upsertUser({
      id: user.id,
      organizationId: existing.organizationId,
      email,
      firstName: existing.firstName || buildClaims(user).first_name,
      lastName: existing.lastName || buildClaims(user).last_name,
      profileImageUrl: buildClaims(user).profile_image_url,
      role: existing.role,
    });
    return existing;
  }

  // Create unique organization per user for absolute isolation
  // Use user ID as domain to ensure uniqueness
  const domain = `user-${user.id}`;
  const orgName = email.split("@")[0] || "User";
  const organization = await storage.upsertOrganization({
    name: `${orgName.charAt(0).toUpperCase()}${orgName.slice(1)}'s Workspace`,
    domain, // Unique per user
  });

  existing = await storage.upsertUser({
    id: user.id,
    organizationId: organization.id,
    email,
    firstName: buildClaims(user).first_name,
    lastName: buildClaims(user).last_name,
    profileImageUrl: buildClaims(user).profile_image_url,
    role: "admin",
  });

  return existing;
}

async function ensureBasicLoginUser(options: {
  email: string;
  fullName?: string;
  role?: string;
  userId?: string;
}): Promise<User> {
  const { email, fullName, role, userId } = options;
  const lowerEmail = email.toLowerCase();

  // Create unique organization per user for absolute isolation
  // Use userId or email hash as domain to ensure uniqueness
  const safeId = userId || `basic-${lowerEmail.replace(/[^a-z0-9.-]/gi, "-")}`;
  const domain = `user-${safeId}`;
  const orgName = lowerEmail.split("@")[0] || "User";

  const organization = await storage.upsertOrganization({
    name: `${orgName.charAt(0).toUpperCase()}${orgName.slice(1)}'s Workspace`,
    domain, // Unique per user
  });

  const [firstName, ...rest] = (fullName || lowerEmail.split("@")[0] || "Demo").split(" ").filter(Boolean);
  const lastName = rest.join(" ") || undefined;
  const resolvedRole: UserRole =
    (["admin", "agent_manager", "analyst", "developer"] as UserRole[]).includes(role as UserRole)
      ? (role as UserRole)
      : BASIC_AUTH_DEFAULT_ROLE;

  return storage.upsertUser({
    id: safeId,
    organizationId: organization.id,
    email: lowerEmail,
    firstName: firstName || "Demo",
    lastName,
    role: resolvedRole,
  });
}

function buildSessionUser(user: SupabaseUser, session: SupabaseSession): AuthenticatedUser {
  return {
    claims: buildClaims(user),
    access_token: session.access_token,
    refresh_token: session.refresh_token ?? undefined,
    expires_at: session.expires_at ?? (session.expires_in ? Math.floor(Date.now() / 1000) + session.expires_in : undefined),
  };
}

function renderAuthPage(options: {
  title: string;
  subtitle: string;
  action: string;
  buttonText: string;
  alternateText: string;
  alternateHref: string;
  fields: string;
  message?: string;
  messageType?: "error" | "success";
  csrfToken?: string;
}) {
  const { title, subtitle, action, buttonText, alternateHref, alternateText, fields, message, messageType, csrfToken } = options;
  const bannerColor = messageType === "success" ? "#22c55e" : "#f87171";
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${title} - Megna Voice AI</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex, nofollow" />
      <style>
        :root {
          color-scheme: dark;
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          background: radial-gradient(circle at top, #1d2961, #050816);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          color: #f8fafc;
        }
        .card {
          width: min(420px, 100%);
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 1.25rem;
          padding: 2rem;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.6);
        }
        h1 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 600;
        }
        p.subtitle {
          margin: 0.5rem 0 1.5rem;
          color: #94a3b8;
        }
        label {
          display: block;
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 0.35rem;
        }
        input, select {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(15, 23, 42, 0.8);
          color: #f8fafc;
          font-size: 1rem;
          transition: border 0.2s, box-shadow 0.2s;
        }
        input:focus, select:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.7);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
        }
        button {
          margin-top: 1.25rem;
          width: 100%;
          padding: 0.85rem;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 30px rgba(79, 70, 229, 0.35);
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .footer-link {
          margin-top: 1.5rem;
          font-size: 0.95rem;
          text-align: center;
          color: #94a3b8;
        }
        .footer-link a {
          color: #60a5fa;
          font-weight: 600;
          text-decoration: none;
        }
        .footer-link a:hover {
          text-decoration: underline;
        }
        .message {
          margin-bottom: 1rem;
          padding: 0.65rem 0.9rem;
          border-radius: 0.65rem;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid ${bannerColor};
          color: ${bannerColor};
          font-size: 0.9rem;
        }
        .fields {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .password-requirements {
          font-size: 0.8rem;
          color: #94a3b8;
          margin-top: 0.25rem;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${title}</h1>
        <p class="subtitle">${subtitle}</p>
        ${message ? `<div class="message">${message}</div>` : ""}
        <form method="POST" action="${action}" class="fields" id="authForm">
          ${csrfToken ? `<input type="hidden" name="_csrf" value="${csrfToken}" />` : ""}
          ${fields}
          <button type="submit" id="submitBtn">${buttonText}</button>
        </form>
        <p class="footer-link">${alternateText} <a href="${alternateHref}">Click here</a></p>
      </div>
      <script>
        const form = document.getElementById('authForm');
        const btn = document.getElementById('submitBtn');
        
        form.addEventListener('submit', function(e) {
          btn.disabled = true;
          btn.textContent = 'Please wait...';
        });
        
        // Re-enable if validation fails
        form.addEventListener('invalid', function() {
          btn.disabled = false;
          btn.textContent = '${buttonText}';
        }, true);
      </script>
    </body>
  </html>`;
}

function buildBasicSessionUser(user: User): AuthenticatedUser {
  return {
    claims: {
      sub: user.id,
      email: user.email || undefined,
      first_name: user.firstName || undefined,
      last_name: user.lastName || undefined,
    },
    access_token: `basic-${Date.now()}`,
    refresh_token: undefined,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_MS / 1000,
  };
}

async function tryDevLogin(email: string, password: string): Promise<AuthenticatedUser | null> {
  if (!devLoginEmail || !devLoginPassword) return null;
  if (email !== devLoginEmail || password !== devLoginPassword) return null;

  const userId = `dev-${email}`;
  let user = await storage.getUser(userId);

  if (!user) {
    const domain = email.split("@")[1] || "dev.local";
    const orgName = domain.split(".")[0] || "Dev";
    const organization = await storage.upsertOrganization({
      name: `${orgName.charAt(0).toUpperCase()}${orgName.slice(1)} Dev Workspace`,
      domain,
    });

    user = await storage.upsertUser({
      id: userId,
      organizationId: organization.id,
      email,
      firstName: "Dev",
      lastName: "User",
      role: "admin",
    });
  }

  return {
    claims: {
      sub: user.id,
      email: user.email || undefined,
      first_name: user.firstName || undefined,
      last_name: user.lastName || undefined,
    },
    access_token: `dev-${Date.now()}`,
    refresh_token: undefined,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(sessionMiddleware());
  app.use((req, _res, next) => {
    if (req.session.user) {
      req.user = req.session.user;
    }
    next();
  });

  app.get("/api/auth/csrf", (req, res) => {
    const csrfToken = generateCSRFToken();
    req.session.csrfToken = csrfToken;
    res.json({ csrfToken });
  });

  app.get("/api/login", (req, res) => {
    if (req.session.user) {
      return res.redirect("/");
    }

    // Generate CSRF token
    const csrfToken = generateCSRFToken();
    req.session.csrfToken = csrfToken;

    const { error, success } = req.query as Record<string, string | undefined>;
    res.type("html").send(
      renderAuthPage({
        title: basicAuthEnabled ? "Testing login" : "Welcome back",
        subtitle: basicAuthEnabled
          ? "Supabase auth is disabled. Enter any email to preview the dashboard."
          : "Sign in to manage your AI voice operations",
        action: "/api/login",
        buttonText: basicAuthEnabled ? "Continue" : "Sign in",
        alternateText: basicAuthEnabled ? "Need real auth?" : "Don't have an account?",
        alternateHref: basicAuthEnabled ? "https://supabase.com/" : "/api/signup",
        csrfToken,
        fields: basicAuthEnabled
          ? `
          <div>
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="demo@company.com" autocomplete="email" />
          </div>
          <div>
            <label for="fullName">Full name (optional)</label>
            <input id="fullName" name="fullName" type="text" placeholder="Demo User" autocomplete="name" />
          </div>
          <div>
            <label for="role">Role (optional)</label>
            <select id="role" name="role">
              <option value="">Default (admin)</option>
              <option value="admin">Admin</option>
              <option value="agent_manager">Agent Manager</option>
              <option value="analyst">Analyst</option>
              <option value="developer">Developer</option>
            </select>
          </div>
        `
          : `
          <div>
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="you@company.com" autocomplete="email" />
          </div>
          <div>
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required placeholder="••••••••" autocomplete="current-password" minlength="${MIN_PASSWORD_LENGTH}" />
          </div>
        `,
        message: error || success,
        messageType: success ? "success" : error ? "error" : undefined,
      })
    );
  });

  app.get("/api/signup", (_req, res) => {
    if (basicAuthEnabled) {
      return res.redirect("/api/login?success=Basic%20login%20is%20enabled.%20Use%20any%20email%20to%20sign%20in.");
    }

    // Generate CSRF token
    const csrfToken = generateCSRFToken();
    _req.session.csrfToken = csrfToken;

    const { error, success } = _req.query as Record<string, string | undefined>;
    res.type("html").send(
      renderAuthPage({
        title: "Create your workspace",
        subtitle: "Spin up AI agents, telephony, and analytics in minutes",
        action: "/api/signup",
        buttonText: "Create account",
        alternateText: "Already have an account?",
        alternateHref: "/api/login",
        csrfToken,
        fields: `
          <div>
            <label for="fullName">Full name</label>
            <input id="fullName" name="fullName" type="text" required placeholder="Jane Doe" autocomplete="name" minlength="2" maxlength="100" />
          </div>
          <div>
            <label for="email">Work email</label>
            <input id="email" name="email" type="email" required placeholder="you@company.com" autocomplete="email" />
          </div>
          <div>
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required placeholder="Create a strong password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" />
            <div class="password-requirements">Min ${MIN_PASSWORD_LENGTH} characters, with uppercase, lowercase, number, and special character</div>
          </div>
        `,
        message: error || success,
        messageType: success ? "success" : "error",
      })
    );
  });

  app.post("/api/login", async (req, res) => {
    const isJson = req.headers['content-type'] === 'application/json';
    try {
      // CSRF validation (skip for basic auth)
      if (!basicAuthEnabled && !verifyCSRFToken(req)) {
        const msg = "Invalid security token. Please try again.";
        return isJson ? res.status(403).json({ message: msg }) : res.redirect(`/api/login?error=${encodeURIComponent(msg)}`);
      }

      const { email, password } = req.body ?? {};

      // Rate limiting
      const clientId = getClientIdentifier(req);
      const rateLimitCheck = checkRateLimit(clientId);

      if (!rateLimitCheck.allowed) {
        console.warn(`Rate limit exceeded for ${clientId}`);
        const msg = `Too many attempts. Please try again in ${rateLimitCheck.resetIn} minutes.`;
        return isJson ? res.status(429).json({ message: msg }) : res.redirect(`/api/login?error=${encodeURIComponent(msg)}`);
      }

      // Validate inputs
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return isJson ? res.status(400).json({ message: emailValidation.error }) : res.redirect(`/api/login?error=${encodeURIComponent(emailValidation.error!)}`);
      }

      if (!basicAuthEnabled) {
        if (!password) {
          return isJson ? res.status(400).json({ message: "Password is required" }) : res.redirect("/api/login?error=Password%20is%20required");
        }
      }

      const sanitizedEmail = sanitizeInput(email.toLowerCase());

      // Basic auth bypass
      if (basicAuthEnabled) {
        const basicUser = await ensureBasicLoginUser({
          email: sanitizedEmail,
          fullName: req.body?.fullName,
          role: req.body?.role,
        });
        const sessionUser = buildBasicSessionUser(basicUser);
        req.session.user = sessionUser;
        req.user = sessionUser;
        console.log(`✅ Basic auth login: ${sanitizedEmail}`);
        return isJson ? res.json({ success: true }) : res.redirect("/");
      }

      // Dev login
      const devSession = await tryDevLogin(sanitizedEmail, password);
      if (devSession) {
        req.session.user = devSession;
        req.user = devSession;
        console.log(`✅ Dev login: ${sanitizedEmail}`);
        return isJson ? res.json({ success: true }) : res.redirect("/");
      }

      // Supabase authentication
      const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      });

      if (error || !data.session || !data.user) {
        console.warn(`❌ Login failed for ${sanitizedEmail}: ${error?.message}`);
        const message = error?.message || "Invalid credentials";
        return isJson ? res.status(401).json({ message }) : res.redirect(`/api/login?error=${encodeURIComponent(message)}`);
      }

      await ensureAppUser(data.user);
      const sessionUser = buildSessionUser(data.user, data.session);
      req.session.user = sessionUser;
      req.user = sessionUser;

      // Clear rate limit on successful login
      loginAttempts.delete(clientId);

      console.log(`✅ Login successful: ${sanitizedEmail}`);
      return isJson ? res.json({ success: true }) : res.redirect("/");
    } catch (err) {
      console.error("Login error:", err);
      const message = (err as Error)?.message || "Unable to sign in";
      return isJson ? res.status(500).json({ message }) : res.redirect(`/api/login?error=${encodeURIComponent(message)}`);
    }
  });

  app.post("/api/signup", async (req, res) => {
    const isJson = req.headers['content-type'] === 'application/json';
    try {
      if (basicAuthEnabled) {
        const msg = "Basic login is enabled. Use any email to sign in.";
        return isJson ? res.status(400).json({ message: msg }) : res.redirect(`/api/login?success=${encodeURIComponent(msg)}`);
      }

      // CSRF validation
      if (!verifyCSRFToken(req)) {
        const msg = "Invalid security token. Please try again.";
        return isJson ? res.status(403).json({ message: msg }) : res.redirect(`/api/signup?error=${encodeURIComponent(msg)}`);
      }

      // Rate limiting
      const clientId = getClientIdentifier(req);
      const rateLimitCheck = checkRateLimit(clientId);

      if (!rateLimitCheck.allowed) {
        console.warn(`Rate limit exceeded for signup: ${clientId}`);
        const msg = `Too many attempts. Please try again in ${rateLimitCheck.resetIn} minutes.`;
        return isJson ? res.status(429).json({ message: msg }) : res.redirect(`/api/signup?error=${encodeURIComponent(msg)}`);
      }

      const { email, password, fullName } = req.body ?? {};

      // Validate all fields
      const nameValidation = validateName(fullName);
      if (!nameValidation.valid) {
        return isJson ? res.status(400).json({ message: nameValidation.error }) : res.redirect(`/api/signup?error=${encodeURIComponent(nameValidation.error!)}`);
      }

      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return isJson ? res.status(400).json({ message: emailValidation.error }) : res.redirect(`/api/signup?error=${encodeURIComponent(emailValidation.error!)}`);
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return isJson ? res.status(400).json({ message: passwordValidation.error }) : res.redirect(`/api/signup?error=${encodeURIComponent(passwordValidation.error!)}`);
      }

      const sanitizedEmail = sanitizeInput(email.toLowerCase());
      const sanitizedName = sanitizeInput(fullName);

      // Get redirect URL for email verification (defaults to platform.automitra.ai)
      const authRedirectUrl = process.env.AUTH_REDIRECT_URL || process.env.SITE_URL || "https://platform.automitra.ai";

      // Create user in Supabase
      const { data, error } = await supabaseAuthClient.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          data: {
            full_name: sanitizedName,
          },
          emailRedirectTo: `${authRedirectUrl}/api/auth/callback`,
        },
      });

      if (error) {
        console.error(`❌ Signup failed for ${sanitizedEmail}:`, error.message);

        // Handle duplicate email error specifically
        let message = error.message || "Unable to create account";
        if (error.message?.includes('User already registered') ||
          error.message?.includes('already been registered') ||
          error.message?.includes('duplicate key value') ||
          error.message?.includes('users_email_unique')) {
          message = "This email is already registered. Please use a different email or log in instead.";
        }

        return isJson ? res.status(400).json({ message }) : res.redirect(`/api/signup?error=${encodeURIComponent(message)}`);
      }

      if (data.user) {
        // Create local user record (organization will be created here)
        await ensureAppUser(data.user);
      }

      // Clear rate limit on successful signup
      loginAttempts.delete(clientId);

      console.log(`✅ Account created: ${sanitizedEmail}`);

      // Check if email confirmation is required (session is null)
      if (data.user && !data.session) {
        const successMsg = "Account created! Please check your email to verify your account.";
        return isJson ? res.json({ success: true, message: successMsg }) : res.redirect(`/api/login?success=${encodeURIComponent(successMsg)}`);
      }

      const successMsg = "Account created successfully. Please sign in.";
      return isJson ? res.json({ success: true, message: successMsg }) : res.redirect(`/api/login?success=${encodeURIComponent(successMsg)}`);
    } catch (err: any) {
      console.error("Signup error:", err);

      // Handle duplicate email error in catch block too
      let message = err?.message || "Unable to create account";
      if (message?.includes('duplicate key value') ||
        message?.includes('users_email_unique') ||
        message?.includes('User already registered') ||
        message?.includes('already been registered')) {
        message = "This email is already registered. Please use a different email or log in instead.";
      }

      return isJson ? res.status(500).json({ message }) : res.redirect(`/api/signup?error=${encodeURIComponent(message)}`);
    }
  });

  // Auth callback endpoint for email verification and magic links
  app.get("/api/auth/callback", async (req, res) => {
    const { token_hash, type, code } = req.query;

    try {
      // Handle email verification with token_hash (Supabase email verification)
      if (token_hash && type) {
        const { data, error } = await supabaseAuthClient.auth.verifyOtp({
          token_hash: token_hash as string,
          type: type as any,
        });

        if (error || !data.session || !data.user) {
          console.error("Auth callback error:", error?.message);
          return res.redirect(`/api/login?error=${encodeURIComponent(error?.message || "Verification failed")}`);
        }

        // Create user in app database if needed
        await ensureAppUser(data.user);

        // Create session
        const sessionUser = buildSessionUser(data.user, data.session);
        req.session.user = sessionUser;
        req.user = sessionUser;

        console.log(`✅ Email verified and logged in: ${data.user.email}`);
        return res.redirect("/?verified=true");
      }

      // Handle PKCE flow with code (for OAuth and some email flows)
      if (code) {
        const { data, error } = await supabaseAuthClient.auth.exchangeCodeForSession(code as string);

        if (error || !data.session || !data.user) {
          console.error("Auth callback error:", error?.message);
          return res.redirect(`/api/login?error=${encodeURIComponent(error?.message || "Verification failed")}`);
        }

        // Create user in app database if needed
        await ensureAppUser(data.user);

        // Create session
        const sessionUser = buildSessionUser(data.user, data.session);
        req.session.user = sessionUser;
        req.user = sessionUser;

        console.log(`✅ Session created via callback: ${data.user.email}`);
        return res.redirect("/?verified=true");
      }

      // If no token or code, check if user is already verified and redirect accordingly
      return res.redirect("/api/login?success=Email%20verified%20successfully");
    } catch (err: any) {
      console.error("Auth callback error:", err);
      return res.redirect(`/api/login?error=${encodeURIComponent(err?.message || "Verification failed")}`);
    }
  });

  app.get("/api/logout", (req, res) => {
    const email = req.user?.claims?.email;
    req.session.destroy(() => {
      if (email) {
        console.log(`✅ Logout: ${email}`);
      }
      res.redirect("/api/login");
    });
  });
}

async function refreshSession(sessionUser: AuthenticatedUser): Promise<AuthenticatedUser | null> {
  if (!sessionUser.refresh_token) {
    return null;
  }

  try {
    const { data, error } = await supabaseAuthClient.auth.refreshSession({
      refresh_token: sessionUser.refresh_token,
    });

    if (error || !data.session || !data.user) {
      return null;
    }

    await ensureAppUser(data.user);
    return buildSessionUser(data.user, data.session);
  } catch (error) {
    console.error("Session refresh failed:", error);
    return null;
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (basicAuthEnabled) {
    req.user = sessionUser;
    return next();
  }

  const now = Math.floor(Date.now() / 1000);
  if (sessionUser.expires_at && sessionUser.expires_at > now + 60) {
    req.user = sessionUser;
    return next();
  }

  try {
    const refreshed = await refreshSession(sessionUser);
    if (!refreshed) {
      req.session.destroy(() => { });
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.session.user = refreshed;
    req.user = refreshed;
    next();
  } catch (error) {
    console.error("Failed to refresh Supabase session:", error);
    req.session.destroy(() => { });
    res.status(401).json({ message: "Unauthorized" });
  }
};
