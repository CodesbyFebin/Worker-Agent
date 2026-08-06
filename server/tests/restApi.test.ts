import { describe, expect, it, vi } from "vitest";
import { buildOpenApiDocument } from "../routers/openapi";
import { requirePermission } from "../_core/restAuth";

describe("REST API surface", () => {
  describe("openapi contract", () => {
    it("is a valid OpenAPI 3.1 document describing the real /api/v1 routes", () => {
      const doc = buildOpenApiDocument();
      expect(doc.openapi).toBe("3.1.0");
      expect(doc.info.title).toContain("REST");
      expect(doc.servers?.[0]?.url).toBe("/api/v1");
      expect(Object.keys(doc.paths)).toEqual(
        expect.arrayContaining([
          "/health",
          "/openapi.json",
          "/workflows",
          "/goals",
          "/campaigns",
          "/youtube/channels",
        ]),
      );
    });

    it("documents the session-cookie security scheme used by tRPC too", () => {
      const doc = buildOpenApiDocument() as unknown as {
        components: { securitySchemes: Record<string, unknown> };
      };
      const cookie = doc.components.securitySchemes.cookie as {
        type: string;
        in: string;
        name: string;
      };
      expect(cookie.type).toBe("apiKey");
      expect(cookie.in).toBe("cookie");
      expect(cookie.name).toBe("wa_session");
    });
  });

  describe("requirePermission (no session)", () => {
    it("rejects with 401 without calling DB or next", async () => {
      const mw = requirePermission("workflow:read");
      const json = vi.fn();
      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnValue({ json }),
      } as unknown as Parameters<typeof mw>[1];
      const next = vi.fn();
      const req = { headers: {} } as Parameters<typeof mw>[0];

      await mw(req, res, next);

      expect(res.setHeader).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "UNAUTHENTICATED" }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
